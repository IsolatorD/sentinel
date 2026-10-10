import asyncio

import httpx
import pytest
import requests

import sentinel_sdk

TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"


def test_requests_creates_a_span_and_propagates_traceparent_only_to_configured_targets(sdk, local_server):
    sink = sdk(traces_sample_rate=1.0, trace_propagation_targets=["127.0.0.1"])
    with sentinel_sdk.start_transaction("job") as tx:
        assert requests.get(f"{local_server.url}/items?token=secret").status_code == 200

    [span] = sink.transactions[0]["spans"]
    assert span["op"] == "http.client"
    assert span["description"] == f"GET {local_server.url}/items"  # sin la query: puede llevar tokens
    assert span["status"] == "ok" and span["data"]["http.status_code"] == 200
    assert "secret" not in str(sink.transactions[0])
    header = local_server.requests[0]["headers"]["traceparent"]
    assert header == f"00-{tx.trace_id}-{span['span_id']}-01"


def test_traceparent_is_not_sent_to_third_parties_by_default(sdk, local_server):
    sdk(traces_sample_rate=1.0)
    with sentinel_sdk.start_transaction("job"):
        requests.get(f"{local_server.url}/x")
    assert "traceparent" not in local_server.requests[0]["headers"]


def test_a_failing_response_and_a_network_error_close_the_span_with_an_error(sdk, local_server):
    sink = sdk(traces_sample_rate=1.0)
    local_server.status = 503
    with sentinel_sdk.start_transaction("job"):
        requests.get(f"{local_server.url}/down")
        with pytest.raises(requests.ConnectionError):
            requests.get("http://127.0.0.1:1/refused", timeout=1)
    assert [s["status"] for s in sink.transactions[0]["spans"]] == ["internal_error", "internal_error"]


def test_requests_outside_a_transaction_only_leave_breadcrumbs(sdk, local_server):
    sink = sdk(traces_sample_rate=1.0)
    requests.get(f"{local_server.url}/a")
    sentinel_sdk.capture_message("after")
    crumb = sink.events[0]["breadcrumbs"][0]
    assert crumb["category"] == "http" and crumb["data"]["status_code"] == 200
    assert sink.transactions == []


def test_the_sdk_does_not_measure_its_own_requests(sdk, local_server):
    sink = sdk(traces_sample_rate=1.0)
    client = sentinel_sdk.get_client()
    own = f"https://sentinel.example.com/api/{client.dsn.project_id}/events"
    from sentinel_sdk.integrations.http_clients import _Call

    with sentinel_sdk.start_transaction("job") as tx:
        call = _Call(client, "POST", own)
        assert call.span is None
    assert tx.spans == []
    assert sink.transactions[0]["spans"] == []


def test_httpx_sync_and_async(sdk, local_server):
    sink = sdk(traces_sample_rate=1.0, trace_propagation_targets=[local_server.url])

    async def fetch():
        async with httpx.AsyncClient() as client:
            return (await client.get(f"{local_server.url}/async")).status_code

    with sentinel_sdk.start_transaction("job") as tx:
        assert httpx.get(f"{local_server.url}/sync").status_code == 200
        assert asyncio.run(fetch()) == 200

    spans = sink.transactions[0]["spans"]
    assert [s["description"].endswith(p) for s, p in zip(spans, ("/sync", "/async"))] == [True, True]
    assert all(r["headers"]["traceparent"].startswith(f"00-{tx.trace_id}-") for r in local_server.requests)


def test_closing_restores_the_original_methods(sdk):
    original_send = requests.sessions.Session.send
    original_httpx = httpx.Client.send
    sdk()
    assert requests.sessions.Session.send is not original_send
    assert httpx.Client.send is not original_httpx
    sentinel_sdk.close()
    assert requests.sessions.Session.send is original_send
    assert httpx.Client.send is original_httpx
