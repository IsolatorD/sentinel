"""Ajusta los eventos a los límites del servidor para que nunca los rechace por exceso."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

# Mismos límites que `packages/shared/src/ingest.ts` y `transactions.ts`.
SHORT = 256
MEDIUM = 2_048
LONG = 16_384
MAX_FRAMES = 250
MAX_EXCEPTIONS = 10
MAX_BREADCRUMBS = 100
MAX_TAG_VALUE = 512
MAX_TAG_KEY = 64
MAX_SPANS = 200


def clip(value: Any, limit: int) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[: limit - 1] + "…"
    return value


def serialize(value: Any, depth: int = 5, max_items: int = 50, max_str: int = MEDIUM) -> Any:
    """Convierte cualquier objeto en algo seguro de enviar como JSON, sin recorrerlo entero."""
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if value == value and value not in (float("inf"), float("-inf")) else str(value)
    if isinstance(value, str):
        return clip(value, max_str)
    if depth <= 0:
        return clip(repr(value), max_str)
    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for i, (k, v) in enumerate(value.items()):
            if i >= max_items:
                out["…"] = f"{len(value) - max_items} more"
                break
            out[clip(str(k), MAX_TAG_KEY)] = serialize(v, depth - 1, max_items, max_str)
        return out
    if isinstance(value, (list, tuple, set, frozenset)):
        items = list(value)
        out_list: List[Any] = [serialize(v, depth - 1, max_items, max_str) for v in items[:max_items]]
        if len(items) > max_items:
            out_list.append(f"… {len(items) - max_items} more")
        return out_list
    if isinstance(value, bytes):
        return clip(value.decode("utf-8", "replace"), max_str)
    try:
        return clip(repr(value), max_str)
    except Exception:  # un __repr__ que lanza no debe romper el envío
        return f"<{type(value).__name__}>"


def _str_map(data: Optional[Dict[str, Any]], value_limit: int) -> Dict[str, str]:
    return {
        clip(str(k), MAX_TAG_KEY): clip(str(v), value_limit)
        for k, v in (data or {}).items()
    }


def _frame(frame: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(frame)
    for key, limit in (("filename", MEDIUM), ("abs_path", MEDIUM), ("function", SHORT), ("module", SHORT)):
        if key in out:
            out[key] = clip(out[key], limit)
    if "context_line" in out:
        out["context_line"] = clip(out["context_line"], MEDIUM)
    for key in ("pre_context", "post_context"):
        if key in out:
            out[key] = [clip(line, MEDIUM) for line in out[key][:10]]
    return out


def normalize_event(event: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(event)
    for key in ("platform", "release", "environment"):
        if key in out:
            out[key] = clip(out[key], SHORT)
    if "message" in out:
        out["message"] = clip(out["message"], LONG)

    exception = out.get("exception")
    if exception:
        values = []
        for v in exception.get("values", [])[-MAX_EXCEPTIONS:]:
            item = {"type": clip(v.get("type", "Error"), SHORT)}
            if v.get("value") is not None:
                item["value"] = clip(str(v["value"]), LONG)
            frames = (v.get("stacktrace") or {}).get("frames")
            if frames:
                item["stacktrace"] = {"frames": [_frame(f) for f in frames[-MAX_FRAMES:]]}
            values.append(item)
        out["exception"] = {"values": values}

    if "fingerprint" in out:
        out["fingerprint"] = [clip(str(f), SHORT) for f in out["fingerprint"][:10]]
    if out.get("user"):
        out["user"] = {k: clip(str(v), SHORT) for k, v in out["user"].items() if k in ("id", "email", "username", "ip_address")}
    if out.get("tags"):
        out["tags"] = _str_map(out["tags"], MAX_TAG_VALUE)
    if out.get("request"):
        req = dict(out["request"])
        if "url" in req:
            req["url"] = clip(req["url"], MEDIUM)
        if "method" in req:
            req["method"] = clip(req["method"], 16)
        if "headers" in req:
            req["headers"] = _str_map(req["headers"], 1_024)
        out["request"] = req
    if out.get("contexts"):
        out["contexts"] = {
            clip(str(name), MAX_TAG_KEY): serialize(ctx, depth=3) for name, ctx in out["contexts"].items() if isinstance(ctx, dict)
        }
    if out.get("breadcrumbs"):
        crumbs = []
        for c in out["breadcrumbs"][-MAX_BREADCRUMBS:]:
            item = {k: clip(c[k], SHORT) for k in ("category", "type") if c.get(k)}
            if c.get("level"):
                item["level"] = c["level"]
            if c.get("timestamp") is not None:
                item["timestamp"] = c["timestamp"]
            if c.get("message") is not None:
                item["message"] = clip(str(c["message"]), MEDIUM)
            if c.get("data"):
                item["data"] = serialize(c["data"], depth=3)
            crumbs.append(item)
        out["breadcrumbs"] = crumbs
    if out.get("extra"):
        out["extra"] = serialize(out["extra"], depth=4)
    return out


def normalize_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(tx)
    out["name"] = clip(out.get("name") or "/", MEDIUM)
    for key in ("op", "status", "platform", "release", "environment"):
        if key in out:
            out[key] = clip(out[key], SHORT)
    if out.get("tags"):
        out["tags"] = _str_map(out["tags"], MAX_TAG_VALUE)
    if out.get("user"):
        out["user"] = {k: clip(str(v), SHORT) for k, v in out["user"].items() if k in ("id", "email", "username", "ip_address")}
    if out.get("measurements"):
        out["measurements"] = {
            clip(str(k), 32): {"value": m["value"], **({"unit": clip(m["unit"], 16)} if m.get("unit") else {})}
            for k, m in out["measurements"].items()
        }
    spans = []
    for s in (out.get("spans") or [])[:MAX_SPANS]:
        item = dict(s)
        item["op"] = clip(item.get("op", "span"), SHORT)
        if item.get("description"):
            item["description"] = clip(item["description"], MEDIUM)
        if item.get("status"):
            item["status"] = clip(item["status"], SHORT)
        if item.get("data"):
            item["data"] = serialize(item["data"], depth=2, max_str=512)
        spans.append(item)
    out["spans"] = spans
    return out


def to_json(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), default=repr, ensure_ascii=False).encode("utf-8")
