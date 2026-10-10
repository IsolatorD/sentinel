import logging
import sys
import threading

import sentinel_sdk


def make_exc():
    try:
        raise ValueError("uncaught!")
    except ValueError:
        return sys.exc_info()


def test_excepthook_captures_the_uncaught_exception_as_fatal_and_still_calls_the_original(sdk, capsys, monkeypatch):
    printed = []
    monkeypatch.setattr(sys, "excepthook", lambda *a: printed.append(a))
    sink = sdk(capture_global_errors=True)
    sys.excepthook(*make_exc())

    [event] = sink.events
    assert event["level"] == "fatal"
    assert event["tags"] == {"handled": "false", "mechanism": "excepthook"}
    assert printed and printed[0][0] is ValueError  # el manejador original sigue haciendo su trabajo


def test_keyboard_interrupt_is_not_reported(sdk, monkeypatch):
    monkeypatch.setattr(sys, "excepthook", lambda *a: None)
    sink = sdk(capture_global_errors=True)
    try:
        raise KeyboardInterrupt
    except KeyboardInterrupt:
        sys.excepthook(*sys.exc_info())
    assert sink.events == []


def test_threading_excepthook_captures_errors_in_threads(sdk, monkeypatch):
    seen = []
    monkeypatch.setattr(threading, "excepthook", lambda args: seen.append(args.exc_type))
    sink = sdk(capture_global_errors=True)
    exc_type, exc, tb = make_exc()
    threading.excepthook(threading.ExceptHookArgs((exc_type, exc, tb, threading.current_thread())))
    assert sink.events[0]["tags"]["mechanism"] == "threading"
    assert seen == [ValueError]


def test_the_hooks_are_restored_on_close(sdk):
    before = sys.excepthook, threading.excepthook
    sdk(capture_global_errors=True)
    assert (sys.excepthook, threading.excepthook) != before
    sentinel_sdk.close()
    assert (sys.excepthook, threading.excepthook) == before


def test_logging_becomes_breadcrumbs(sdk):
    sink = sdk(log_breadcrumbs=True)
    log = logging.getLogger("shop.orders")
    log.setLevel(logging.INFO)
    log.info("order %s created", 42)
    log.debug("not recorded (below INFO)")
    logging.getLogger("sentinel_sdk").warning("the SDK's own logs are never breadcrumbs")
    sentinel_sdk.capture_message("x")
    [crumb] = sink.events[0]["breadcrumbs"]
    assert (crumb["category"], crumb["type"], crumb["level"], crumb["message"]) == ("shop.orders", "log", "info", "order 42 created")


def test_logged_errors_can_be_sent_as_events(sdk):
    sink = sdk(log_breadcrumbs=False, capture_logged_errors=True)
    log = logging.getLogger("shop.payments")
    try:
        1 / 0
    except ZeroDivisionError:
        log.exception("payment failed")
    log.error("plain error without exception")
    first, second = sink.events
    assert first["exception"]["values"][-1]["type"] == "ZeroDivisionError"
    assert first["tags"]["mechanism"] == "logging" and first["tags"]["logger"] == "shop.payments"
    assert second["message"] == "plain error without exception" and second["level"] == "error"


def test_logged_errors_are_off_by_default(sdk):
    sink = sdk()
    logging.getLogger("x").error("nothing sent")
    assert sink.events == []
