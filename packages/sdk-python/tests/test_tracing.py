import asyncio
import time

import pytest

import sentinel_sdk
from sentinel_sdk import format_traceparent, parse_traceparent

TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"
PARENT = "00f067aa0ba902b7"


def test_a_transaction_with_nested_spans_is_sent_with_a_valid_payload(sdk):
    sink = sdk(traces_sample_rate=1.0, release="9.9.9", environment="e2e")
    sentinel_sdk.set_tag("region", "eu")
    with sentinel_sdk.start_transaction("import-orders", "task") as tx:
        tx.set_measurement("rows", 1200)
        with sentinel_sdk.start_span("parse", "read csv"):
            time.sleep(0.01)
            with sentinel_sdk.start_span("db.query", "find duplicates", table="orders"):
                pass
        sentinel_sdk.start_span("save", "write").finish()

    [payload] = sink.transactions
    assert payload["name"] == "import-orders" and payload["op"] == "task"
    assert payload["platform"] == "python" and payload["status"] == "ok"
    assert payload["release"] == "9.9.9" and payload["tags"] == {"region": "eu"}
    assert payload["measurements"] == {"rows": {"value": 1200}}
    assert payload["duration_ms"] >= 10
    spans = {s["op"]: s for s in payload["spans"]}
    assert spans["parse"]["parent_span_id"] == payload["span_id"]
    assert spans["db.query"]["parent_span_id"] == spans["parse"]["span_id"]
    assert spans["db.query"]["data"] == {"table": "orders"}
    assert spans["save"]["parent_span_id"] == payload["span_id"]


def test_without_traces_sample_rate_nothing_is_measured(sdk):
    sink = sdk()
    with sentinel_sdk.start_transaction("t") as tx:
        with sentinel_sdk.start_span("x"):
            pass
    assert tx.sampled is False
    assert sink.transactions == []


def test_an_exception_inside_marks_the_transaction_and_the_span_as_failed(sdk):
    sink = sdk(traces_sample_rate=1.0)
    with pytest.raises(ValueError):
        with sentinel_sdk.start_transaction("job") as tx:
            with sentinel_sdk.start_span("step"):
                raise ValueError("boom")
    [payload] = sink.transactions
    assert payload["status"] == "internal_error"
    assert payload["spans"][0]["status"] == "internal_error"
    assert tx.finished


def test_an_error_captured_inside_a_transaction_carries_its_trace(sdk):
    sink = sdk(traces_sample_rate=1.0)
    with sentinel_sdk.start_transaction("job") as tx:
        sentinel_sdk.capture_message("inside")
    sentinel_sdk.capture_message("outside")
    inside, outside = sink.events
    assert inside["contexts"]["trace"] == {"trace_id": tx.trace_id, "span_id": tx.span_id}
    assert "trace" not in outside["contexts"]


def test_continuing_a_trace_keeps_its_id_and_parent(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = sentinel_sdk.get_client()
    with client.start_transaction("GET /x", "http.server", trace_id=TRACE, parent_span_id=PARENT):
        pass
    assert (sink.transactions[0]["trace_id"], sink.transactions[0]["parent_span_id"]) == (TRACE, PARENT)


def test_the_callers_sampling_decision_wins(sdk):
    sink = sdk(traces_sample_rate=1.0)
    client = sentinel_sdk.get_client()
    with client.start_transaction("a", sampled=False):
        pass
    with client.start_transaction("b", sampled=True):
        pass
    assert [t["name"] for t in sink.transactions] == ["b"]


def test_open_spans_are_closed_with_the_transaction(sdk):
    sink = sdk(traces_sample_rate=1.0)
    tx = sentinel_sdk.start_transaction("t")
    with tx:
        sentinel_sdk.start_span("never.finished")
    assert sink.transactions[0]["spans"][0]["status"] == "cancelled"


def test_the_span_cap_drops_the_excess(sdk):
    sink = sdk(traces_sample_rate=1.0, max_spans=3)
    with sentinel_sdk.start_transaction("t") as tx:
        for i in range(10):
            sentinel_sdk.start_span("x", str(i)).finish()
    assert len(sink.transactions[0]["spans"]) == 3
    assert tx.dropped_spans == 7


def test_trace_decorator_for_sync_and_async_functions(sdk):
    sink = sdk(traces_sample_rate=1.0)

    @sentinel_sdk.trace("db.query")
    def load(n):
        return n * 2

    @sentinel_sdk.trace("work", "slow thing")
    async def slow():
        await asyncio.sleep(0.005)
        return "done"

    async def main():
        with sentinel_sdk.start_transaction("t"):
            assert load(2) == 4
            assert await slow() == "done"

    asyncio.run(main())
    spans = sink.transactions[0]["spans"]
    assert [s["op"] for s in spans] == ["db.query", "work"]
    assert spans[0]["description"].endswith("load") and spans[1]["description"] == "slow thing"


def test_concurrent_async_transactions_do_not_mix(sdk):
    sink = sdk(traces_sample_rate=1.0)

    async def job(name, delay):
        with sentinel_sdk.start_transaction(name):
            await asyncio.sleep(delay)
            with sentinel_sdk.start_span("step", name):
                pass

    async def main():
        await asyncio.gather(job("a", 0.03), job("b", 0.0))

    asyncio.run(main())
    for tx in sink.transactions:
        assert [s["description"] for s in tx["spans"]] == [tx["name"]]


def test_measuring_without_init_works_and_sends_nothing():
    sentinel_sdk.close()
    with sentinel_sdk.start_transaction("t") as tx:
        with sentinel_sdk.start_span("x") as span:
            span.set_data("a", 1)
    assert tx.sampled is False and tx.finished


def test_before_send_transaction_can_modify_or_drop(sdk):
    sink = sdk(traces_sample_rate=1.0, before_send_transaction=lambda p: None if p["name"] == "drop" else {**p, "name": "renamed"})
    with sentinel_sdk.start_transaction("drop"):
        pass
    with sentinel_sdk.start_transaction("keep"):
        pass
    assert [t["name"] for t in sink.transactions] == ["renamed"]


def test_traceparent_parse_and_format():
    assert parse_traceparent(f"00-{TRACE}-{PARENT}-01").sampled is True
    assert parse_traceparent(f"00-{TRACE}-{PARENT}-00").sampled is False
    assert parse_traceparent(f" 00-{TRACE.upper()}-{PARENT.upper()}-01 ").trace_id == TRACE
    for bad in (None, "", "nonsense", f"00-{TRACE}-{PARENT}", f"00-{'0' * 32}-{PARENT}-01", f"00-{TRACE}-{'0' * 16}-01", f"ff-{TRACE}-{PARENT}-01"):
        assert parse_traceparent(bad) is None
    assert format_traceparent(TRACE, PARENT) == f"00-{TRACE}-{PARENT}-01"
    assert format_traceparent(TRACE, PARENT, False).endswith("-00")
