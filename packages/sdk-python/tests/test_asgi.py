import asyncio

import pytest
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

import sentinel_sdk
from sentinel_sdk import SentinelAsgiMiddleware

TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
PARENT = "00f067aa0ba902b7"


def make_app():
    async def user(request):
        with sentinel_sdk.start_span("db.query", "load user"):
            pass
        return PlainTextResponse(f"user {request.path_params['id']}")

    async def boom(request):
        sentinel_sdk.set_tag("route", "boom")
        raise RuntimeError("explotó")

    async def missing(request):
        raise HTTPException(404, "no such thing")

    async def whoami(request):
        sentinel_sdk.capture_message("from handler")
        return PlainTextResponse("ok")

    app = Starlette(
        routes=[
            Route("/users/{id:int}", user),
            Route("/boom", boom),
            Route("/missing", missing),
            Route("/whoami", whoami),
        ]
    )
    return SentinelAsgiMiddleware(app)


def test_each_request_is_a_transaction_named_by_its_route(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = TestClient(make_app())
    assert client.get("/users/42?token=secret").status_code == 200

    [tx] = sink.transactions
    assert tx["name"] == "GET /users/{id:int}"  # la ruta registrada, no la URL con el id
    assert tx["op"] == "http.server" and tx["status"] == "ok" and tx["platform"] == "python"
    assert tx["tags"]["http.status_code"] == "200"
    assert [s["description"] for s in tx["spans"]] == ["load user"]
    assert "secret" not in str(tx)


def test_unhandled_exceptions_are_captured_with_the_request_and_the_trace(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = TestClient(make_app(), raise_server_exceptions=False)
    assert client.get("/boom", headers={"user-agent": "curl/8"}).status_code == 500

    [event] = sink.events
    [tx] = sink.transactions
    assert event["exception"]["values"][-1] == {**event["exception"]["values"][-1], "type": "RuntimeError", "value": "explotó"}
    assert event["tags"] == {"route": "boom", "handled": "false", "mechanism": "asgi"}
    assert event["request"]["method"] == "GET" and event["request"]["url"].endswith("/boom")
    assert event["request"]["headers"] == {"User-Agent": "curl/8"}
    assert event["contexts"]["trace"]["trace_id"] == tx["trace_id"]
    assert tx["status"] == "internal_error"


def test_a_4xx_response_is_not_an_error(sdk):
    sink = sdk(traces_sample_rate=1.0)
    assert TestClient(make_app()).get("/missing").status_code == 404
    assert sink.events == []
    assert sink.transactions[0]["status"] == "ok"
    assert sink.transactions[0]["tags"]["http.status_code"] == "404"


def test_the_trace_from_the_browser_is_continued(sdk):
    sink = sdk(traces_sample_rate=1.0)
    TestClient(make_app()).get("/users/1", headers={"traceparent": f"00-{TRACE}-{PARENT}-01"})
    assert (sink.transactions[0]["trace_id"], sink.transactions[0]["parent_span_id"]) == (TRACE, PARENT)


def test_if_the_caller_did_not_sample_the_trace_nothing_is_sent(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = TestClient(make_app())
    client.get("/users/1", headers={"traceparent": f"00-{TRACE}-{PARENT}-00"})
    client.get("/users/2")
    assert len(sink.transactions) == 1


def test_without_traces_sample_rate_errors_are_still_captured(sdk):
    sink = sdk()
    TestClient(make_app(), raise_server_exceptions=False).get("/boom")
    assert len(sink.events) == 1 and sink.transactions == []


def test_each_request_has_its_own_scope(sdk):
    sink = sdk()
    client = TestClient(make_app(), raise_server_exceptions=False)
    client.get("/boom")
    client.get("/whoami")
    boom, who = sink.events
    assert boom["tags"]["route"] == "boom"
    assert "route" not in who.get("tags", {})  # la etiqueta de la petición anterior no se arrastra


def test_the_sdk_not_initialized_is_transparent():
    sentinel_sdk.close()
    assert TestClient(make_app()).get("/users/7").text == "user 7"


def test_lifespan_and_unknown_scopes_pass_through(sdk):
    sdk(traces_sample_rate=1.0)
    seen = []

    async def app(scope, receive, send):
        seen.append(scope["type"])

    wrapped = SentinelAsgiMiddleware(app)
    asyncio.run(wrapped({"type": "lifespan"}, None, None))
    assert seen == ["lifespan"]


def test_a_cancelled_request_is_not_an_error(sdk):
    sink = sdk(traces_sample_rate=1.0)

    async def slow(scope, receive, send):
        await asyncio.sleep(10)

    async def main():
        task = asyncio.create_task(
            SentinelAsgiMiddleware(slow)({"type": "http", "method": "GET", "path": "/slow", "headers": []}, None, None)
        )
        await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(main())
    assert sink.events == []
    assert sink.transactions[0]["status"] == "cancelled"


def test_concurrent_requests_do_not_mix_transactions(sdk):
    sink = sdk(traces_sample_rate=1.0)

    async def app(scope, receive, send):
        delay = 0.03 if scope["path"] == "/slow" else 0.0
        await asyncio.sleep(delay)
        with sentinel_sdk.start_span("work", scope["path"]):
            pass
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def call(path):
        scope = {"type": "http", "method": "GET", "path": path, "headers": []}
        await SentinelAsgiMiddleware(app)(scope, None, lambda m: asyncio.sleep(0))

    async def main():
        await asyncio.gather(call("/slow"), call("/fast"))

    asyncio.run(main())
    assert len(sink.transactions) == 2
    for tx in sink.transactions:
        assert [s["description"] for s in tx["spans"]] == [tx["name"].split(" ")[1]]
