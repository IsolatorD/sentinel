import os
import sys
import sysconfig

from sentinel_sdk.exceptions import exception_values
from sentinel_sdk.stacktrace import is_in_app


def boom():
    raise ValueError("bad value")


def capture(fn):
    try:
        fn()
    except BaseException:
        return sys.exc_info()
    raise AssertionError("did not raise")


def test_frames_go_from_oldest_to_newest_and_the_last_is_where_it_was_raised():
    values = exception_values(capture(boom), os.path.dirname(__file__))
    assert len(values) == 1
    frames = values[0]["stacktrace"]["frames"]
    assert values[0]["type"] == "ValueError"
    assert values[0]["value"] == "bad value"
    assert frames[-1]["function"].endswith("boom")
    assert frames[-2]["function"].endswith("capture")


def test_frame_details_module_relative_path_and_source_context():
    frame = exception_values(capture(boom), os.path.dirname(__file__))[0]["stacktrace"]["frames"][-1]
    assert frame["module"] == "test_exceptions"
    assert frame["filename"] == "test_exceptions.py"  # relativo a la raíz del proyecto
    assert frame["abs_path"].endswith("test_exceptions.py")
    assert frame["context_line"].strip() == 'raise ValueError("bad value")'
    assert any("def boom" in line for line in frame["pre_context"])
    assert frame["in_app"] is True


def test_dependencies_and_the_stdlib_are_not_in_app():
    assert is_in_app(os.path.join(sysconfig.get_paths()["stdlib"], "json", "decoder.py")) is False
    assert is_in_app("/srv/app/.venv/lib/python3.13/site-packages/flask/app.py") is False
    assert is_in_app("<frozen importlib._bootstrap>") is False
    assert is_in_app(None) is False
    assert is_in_app("/srv/app/shop/orders.py") is True


def test_in_app_include_and_exclude_by_module_prefix():
    site_file = "/srv/app/.venv/lib/python3.13/site-packages/mycompany_lib/x.py"
    assert is_in_app(site_file, "mycompany_lib.x", include=["mycompany_lib"]) is True
    assert is_in_app("/srv/app/shop/vendored.py", "shop.vendored", exclude=["shop.vendored"]) is False


def test_chain_puts_causes_first_and_the_main_exception_last():
    def inner():
        try:
            raise KeyError("missing")
        except KeyError as cause:
            raise RuntimeError("could not load") from cause

    values = exception_values(capture(inner))
    assert [v["type"] for v in values] == ["KeyError", "RuntimeError"]


def test_follows_the_implicit_context_but_not_when_suppressed():
    def implicit():
        try:
            raise KeyError("a")
        except KeyError:
            raise RuntimeError("b")

    def suppressed():
        try:
            raise KeyError("a")
        except KeyError:
            raise RuntimeError("b") from None

    assert [v["type"] for v in exception_values(capture(implicit))] == ["KeyError", "RuntimeError"]
    assert [v["type"] for v in exception_values(capture(suppressed))] == ["RuntimeError"]


def test_a_cycle_between_causes_does_not_hang_and_the_depth_is_limited():
    a, b = ValueError("a"), ValueError("b")
    a.__cause__, b.__cause__ = b, a
    assert len(exception_values((ValueError, a, None))) == 2

    deep = ValueError("0")
    for i in range(1, 20):
        nxt = ValueError(str(i))
        nxt.__cause__ = deep
        deep = nxt
    assert len(exception_values((ValueError, deep, None))) <= 6
