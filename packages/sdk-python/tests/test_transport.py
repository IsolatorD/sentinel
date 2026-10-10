import threading
import time

from sentinel_sdk.transport import Transport

URL = "https://sentinel.example.com/api/p/events"


def make(results, **kw):
    calls = []

    def send(url, body, key):
        calls.append((url, body, key))
        return results[min(len(calls) - 1, len(results) - 1)]

    return Transport("key", send, retry_delays=(0.0, 0.0), **kw), calls


def test_delivers_in_the_background_and_flush_waits():
    transport, calls = make([(True, False, 0.0)])
    assert transport.submit(URL, b"{}")
    assert transport.flush(2) is True
    assert calls == [(URL, b"{}", "key")]
    transport.close()


def test_retries_5xx_and_network_errors_then_gives_up():
    transport, calls = make([(False, True, 0.0)])
    transport.submit(URL, b"{}")
    transport.flush(2)
    assert len(calls) == 3  # el intento inicial y 2 reintentos
    transport.close()


def test_succeeds_after_a_transient_failure():
    transport, calls = make([(False, True, 0.0), (True, False, 0.0)])
    transport.submit(URL, b"{}")
    transport.flush(2)
    assert len(calls) == 2
    transport.close()


def test_4xx_is_not_retried():
    transport, calls = make([(False, False, 0.0)])
    transport.submit(URL, b"{}")
    transport.flush(2)
    assert len(calls) == 1
    transport.close()


def test_429_pauses_sending_for_what_the_server_asked():
    debug = []
    transport, calls = make([(False, False, 30.0), (True, False, 0.0)], on_debug=debug.append)
    transport.submit(URL, b"1")
    transport.flush(2)
    transport.submit(URL, b"2")
    transport.flush(2)
    assert len(calls) == 1  # el segundo no llegó a intentarse
    assert any("paused" in m or "pausing" in m for m in debug)
    transport.close()


def test_a_full_queue_drops_instead_of_blocking():
    gate = threading.Event()

    def slow(url, body, key):
        gate.wait(2)
        return (True, False, 0.0)

    transport = Transport("key", slow, retry_delays=())
    accepted = [transport.submit(URL, b"x") for _ in range(250)]
    assert not all(accepted)  # parte se descartó, y submit no se bloqueó
    gate.set()
    transport.flush(5)
    transport.close()


def test_flush_times_out_when_the_server_is_slow():
    gate = threading.Event()
    transport = Transport("key", lambda *a: (gate.wait(2), False, 0.0)[1:] and (True, False, 0.0), retry_delays=())
    transport.submit(URL, b"x")
    start = time.monotonic()
    assert transport.flush(0.1) is False
    assert time.monotonic() - start < 1
    gate.set()
    transport.close(2)


def test_submit_after_close_is_a_no_op():
    transport, calls = make([(True, False, 0.0)])
    transport.close()
    assert transport.submit(URL, b"x") is False
    assert calls == []
