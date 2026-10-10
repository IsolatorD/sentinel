import re
import time

import pytest

import sentinel_sdk
from conftest import DSN


def error():
    try:
        raise TypeError("cannot add 'int' and 'str'")
    except TypeError as e:
        return e


def test_capture_exception_sends_a_valid_event(sdk):
    sink = sdk(release="1.2.3", environment="prod")
    sentinel_sdk.set_user({"id": "u1", "email": "ana@example.com"})
    sentinel_sdk.set_tag("feature", "billing")
    sentinel_sdk.add_breadcrumb(category="ui", message="clicked pay")
    event_id = sentinel_sdk.capture_exception(error(), extra={"order": 99})

    [event] = sink.events
    assert event["event_id"] == event_id
    assert event["platform"] == "python"
    assert event["level"] == "error"
    assert event["release"] == "1.2.3"
    assert event["environment"] == "prod"
    assert event["user"] == {"id": "u1", "email": "ana@example.com"}
    assert event["tags"] == {"feature": "billing"}
    assert event["extra"] == {"order": 99}
    assert event["breadcrumbs"][0]["message"] == "clicked pay"
    assert event["contexts"]["sdk"]["name"] == "sentinel.python"
    assert event["contexts"]["runtime"]["name"] in ("CPython", "PyPy")
    assert re.match(r"^\d{4}-\d\d-\d\dT[\d:.]+Z$", event["timestamp"])
    assert event["exception"]["values"][-1]["type"] == "TypeError"


def test_capture_exception_without_arguments_uses_the_exception_being_handled(sdk):
    sink = sdk()
    try:
        {}["nope"]
    except KeyError:
        sentinel_sdk.capture_exception()
    assert sink.events[0]["exception"]["values"][-1]["type"] == "KeyError"
    # Sin ninguna excepción en curso no hay nada que enviar.
    assert sentinel_sdk.capture_exception() is None


def test_capture_message_and_levels(sdk):
    sink = sdk()
    sentinel_sdk.capture_message("Checkout done")
    sentinel_sdk.capture_message("careful", "warning", fingerprint=["custom", "key"])
    first, second = sink.events
    assert first["message"] == "Checkout done" and first["level"] == "info"
    assert second["level"] == "warning" and second["fingerprint"] == ["custom", "key"]


def test_exc_info_tuples_and_non_exceptions_are_accepted_or_ignored(sdk):
    import sys

    sink = sdk()
    try:
        1 / 0
    except ZeroDivisionError:
        sentinel_sdk.capture_exception(sys.exc_info())
    assert sentinel_sdk.capture_exception("not an exception") is None
    assert len(sink.events) == 1


def test_ignore_errors_by_class_name_and_regex(sdk):
    import re as regex

    sink = sdk(ignore_errors=[KeyboardInterrupt, "TimeoutError", regex.compile(r"ValueError: skip")])
    for exc in (KeyboardInterrupt(), TimeoutError("slow"), ValueError("skip me"), ValueError("keep me")):
        sentinel_sdk.capture_exception(exc)
    assert [e["exception"]["values"][-1]["value"] for e in sink.events] == ["keep me"]


def test_sample_rate_zero_drops_everything(sdk):
    sink = sdk(sample_rate=0)
    sentinel_sdk.capture_exception(error())
    assert sink.events == []


def test_the_same_error_twice_in_a_row_is_sent_once(sdk):
    sink = sdk()
    err = error()
    assert sentinel_sdk.capture_exception(err) is not None
    assert sentinel_sdk.capture_exception(err) is None
    assert len(sink.events) == 1


def test_per_minute_limit(sdk):
    sink = sdk(max_events_per_minute=3)
    for i in range(6):
        sentinel_sdk.capture_message(f"distinct {i}")
    assert len(sink.events) == 3


def test_before_send_can_modify_or_drop(sdk):
    sink = sdk(before_send=lambda event, hint: None if "secret" in event.get("message", "") else {**event, "message": event["message"].upper()})
    sentinel_sdk.capture_message("a secret thing")
    sentinel_sdk.capture_message("hello")
    assert [e["message"] for e in sink.events] == ["HELLO"]


def test_before_send_that_raises_sends_the_original_event(sdk):
    def explode(event, hint):
        raise RuntimeError("bad hook")

    sink = sdk(before_send=explode)
    sentinel_sdk.capture_message("still sent")
    assert [e["message"] for e in sink.events] == ["still sent"]


def test_events_exceeding_the_server_limits_are_trimmed_to_fit_the_contract(sdk):
    sink = sdk()
    sentinel_sdk.set_tag("k" * 200, "v" * 2000)
    sentinel_sdk.capture_message("m" * 40_000, extra={"big": ["x" * 5000] * 500})
    [event] = sink.events  # el fixture valida el contrato: si no se recortara, fallaría
    assert len(event["message"]) <= 16_384
    assert all(len(k) <= 64 and len(v) <= 512 for k, v in event["tags"].items())


def test_an_invalid_dsn_or_disabled_sdk_never_raises_and_sends_nothing():
    client = sentinel_sdk.init("not a dsn")
    assert client.enabled is False
    assert sentinel_sdk.capture_exception(error()) is None
    assert sentinel_sdk.capture_message("x") is None
    sentinel_sdk.close()
    assert sentinel_sdk.capture_message("x") is None


def test_disabled_flag(sdk):
    sink = sdk(enabled=False)
    assert sentinel_sdk.capture_message("x") is None
    assert sink.items == []


def test_the_sdk_never_raises_from_capture(sdk):
    class Evil:
        def __repr__(self):
            raise RuntimeError("no repr for you")

    sink = sdk()
    sentinel_sdk.capture_message("with a hostile extra", extra={"evil": Evil()})
    assert len(sink.events) == 1


def test_flush_and_close_return_quickly_when_nothing_is_pending(sdk):
    sdk()
    start = time.monotonic()
    assert sentinel_sdk.flush(1) is True
    assert sentinel_sdk.close(1) is True
    assert time.monotonic() - start < 0.5


@pytest.mark.parametrize("name", ["init", "capture_exception", "capture_message", "start_transaction", "trace"])
def test_the_public_api_is_exported(name):
    assert hasattr(sentinel_sdk, name)
    assert DSN
