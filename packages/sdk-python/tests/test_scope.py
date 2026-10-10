import threading

import sentinel_sdk
from sentinel_sdk.scope import get_current_scope, isolation_scope


def test_isolation_scope_does_not_leak_into_the_outer_scope(sdk):
    sink = sdk()
    sentinel_sdk.set_tag("global", "yes")
    with isolation_scope():
        sentinel_sdk.set_user({"id": "request-user"})
        sentinel_sdk.set_tag("route", "/pay")
        sentinel_sdk.add_breadcrumb(message="inside")
        sentinel_sdk.capture_message("inside request")
    sentinel_sdk.capture_message("outside")

    inside, outside = sink.events
    assert inside["user"] == {"id": "request-user"}
    assert inside["tags"] == {"global": "yes", "route": "/pay"}
    assert inside["breadcrumbs"][0]["message"] == "inside"
    assert "user" not in outside
    assert outside["tags"] == {"global": "yes"}
    assert "breadcrumbs" not in outside


def test_nested_isolation_starts_from_a_copy_of_the_parent():
    with isolation_scope() as outer:
        outer.tags["a"] = "1"
        with isolation_scope() as inner:
            assert inner.tags == {"a": "1"}
            inner.tags["b"] = "2"
        assert outer.tags == {"a": "1"}


def test_concurrent_requests_in_async_code_do_not_mix(sdk):
    import asyncio

    sink = sdk()

    async def request(name: str, delay: float):
        with isolation_scope():
            sentinel_sdk.set_user({"id": name})
            await asyncio.sleep(delay)
            sentinel_sdk.capture_message(f"from {name}")

    async def main():
        await asyncio.gather(request("slow", 0.05), request("fast", 0.0))

    asyncio.run(main())
    assert {e["message"]: e["user"]["id"] for e in sink.events} == {"from slow": "slow", "from fast": "fast"}


def test_threads_share_the_process_scope_unless_they_isolate(sdk):
    sink = sdk()
    sentinel_sdk.set_tag("process", "p")
    seen = {}

    def worker():
        with isolation_scope():
            sentinel_sdk.set_tag("thread", "t")
            seen["inside"] = dict(get_current_scope().tags)

    t = threading.Thread(target=worker)
    t.start()
    t.join()
    assert seen["inside"] == {"process": "p", "thread": "t"}
    sentinel_sdk.capture_message("after")
    assert sink.events[0]["tags"] == {"process": "p"}


def test_breadcrumbs_are_capped_and_can_be_disabled(sdk):
    sink = sdk(max_breadcrumbs=3)
    for i in range(10):
        sentinel_sdk.add_breadcrumb(message=f"step {i}")
    sentinel_sdk.capture_message("x")
    assert [b["message"] for b in sink.events[0]["breadcrumbs"]] == ["step 7", "step 8", "step 9"]

    off = sdk(max_breadcrumbs=0)
    sentinel_sdk.add_breadcrumb(message="ignored")
    sentinel_sdk.capture_message("y")
    assert "breadcrumbs" not in off.events[0]
