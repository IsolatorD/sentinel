import io

from flask import Flask, abort, request

import sentinel_sdk
from sentinel_sdk import SentinelWsgiMiddleware, setup_flask

TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
PARENT = "00f067aa0ba902b7"


def call(app, path="/", method="GET", headers=None, query=""):
    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "QUERY_STRING": query,
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "80",
        "wsgi.url_scheme": "http",
        "wsgi.input": io.BytesIO(),
        "wsgi.errors": io.StringIO(),
        "HTTP_HOST": "localhost",
        **{f"HTTP_{k.upper().replace('-', '_')}": v for k, v in (headers or {}).items()},
    }
    captured = {}

    def start_response(status, response_headers, exc_info=None):
        captured["status"] = status

    result = app(environ, start_response)
    body = b"".join(result)
    if hasattr(result, "close"):
        result.close()
    return captured.get("status"), body


def test_a_plain_wsgi_app_is_measured_and_its_exceptions_captured(sdk):
    sink = sdk(traces_sample_rate=1.0)

    def app(environ, start_response):
        if environ["PATH_INFO"] == "/boom":
            raise RuntimeError("explotó")
        with sentinel_sdk.start_span("work", "inside"):
            pass
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"ok"]

    wrapped = SentinelWsgiMiddleware(app)
    assert call(wrapped, "/orders/1234")[0] == "200 OK"
    try:
        call(wrapped, "/boom")
    except RuntimeError:
        pass

    ok, failed = sink.transactions
    assert ok["name"] == "GET /orders/:id" and ok["status"] == "ok"
    assert [s["description"] for s in ok["spans"]] == ["inside"]
    assert failed["status"] == "internal_error"
    [event] = sink.events
    assert event["tags"]["mechanism"] == "wsgi" and event["request"]["url"] == "http://localhost/boom"


def test_the_response_is_consumed_before_the_transaction_ends(sdk):
    sink = sdk(traces_sample_rate=1.0)

    def streaming(environ, start_response):
        start_response("200 OK", [])

        def body():
            with sentinel_sdk.start_span("chunk", "late"):
                yield b"a"
            yield b"b"

        return body()

    assert call(SentinelWsgiMiddleware(streaming))[1] == b"ab"
    assert [s["description"] for s in sink.transactions[0]["spans"]] == ["late"]


def test_the_trace_from_the_browser_is_continued(sdk):
    sink = sdk(traces_sample_rate=1.0)

    def app(environ, start_response):
        start_response("200 OK", [])
        return [b""]

    call(SentinelWsgiMiddleware(app), headers={"traceparent": f"00-{TRACE}-{PARENT}-01"})
    assert (sink.transactions[0]["trace_id"], sink.transactions[0]["parent_span_id"]) == (TRACE, PARENT)


def test_5xx_status_marks_the_transaction_4xx_does_not(sdk):
    sink = sdk(traces_sample_rate=1.0)

    def app(environ, start_response):
        start_response(environ["PATH_INFO"][1:] + " X", [])
        return [b""]

    call(SentinelWsgiMiddleware(app), "/404")
    call(SentinelWsgiMiddleware(app), "/503")
    assert [t["status"] for t in sink.transactions] == ["ok", "internal_error"]


def test_not_initialized_is_transparent():
    sentinel_sdk.close()

    def app(environ, start_response):
        start_response("200 OK", [])
        return [b"hi"]

    assert call(SentinelWsgiMiddleware(app)) == ("200 OK", b"hi")


def fetch(client, path):
    """Pide y cierra la respuesta, como hace un servidor WSGI de verdad (el cliente de pruebas no la cierra solo)."""
    response = client.get(path)
    response.get_data()
    response.close()
    return response


def make_flask():
    app = Flask(__name__)

    @app.route("/users/<int:user_id>")
    def user(user_id):
        sentinel_sdk.set_tag("user", str(user_id))
        return f"user {user_id}"

    @app.route("/boom")
    def boom():
        raise RuntimeError("flask exploded")

    @app.route("/gone")
    def gone():
        abort(404)

    @app.route("/echo")
    def echo():
        sentinel_sdk.capture_message(f"hello {request.args.get('n')}")
        return "ok"

    setup_flask(app)
    return app


def test_flask_transactions_use_the_registered_route(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = make_flask().test_client()
    assert fetch(client, "/users/42").status_code == 200
    assert sink.transactions[0]["name"] == "GET /users/<int:user_id>"


def test_flask_errors_handled_by_flask_are_captured_but_a_404_is_not(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = make_flask().test_client()
    assert fetch(client, "/boom").status_code == 500
    assert fetch(client, "/gone").status_code == 404

    [event] = sink.events
    assert event["exception"]["values"][-1]["value"] == "flask exploded"
    assert event["tags"]["mechanism"] == "flask"
    [boom, gone] = sink.transactions
    assert boom["status"] == "internal_error" and gone["status"] == "ok"
    assert event["contexts"]["trace"]["trace_id"] == boom["trace_id"]


def test_flask_requests_have_their_own_scope(sdk):
    sink = sdk()
    client = make_flask().test_client()
    fetch(client, "/users/1")
    fetch(client, "/echo?n=2")
    assert "user" not in sink.events[0].get("tags", {})
