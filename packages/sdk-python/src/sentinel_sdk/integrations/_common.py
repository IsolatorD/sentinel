from __future__ import annotations

import re
from typing import Any, Dict, Optional

from ..client import Client
from ..tracing import Transaction, parse_traceparent

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_LONG_HEX = re.compile(r"^[0-9a-f]{16,}$", re.I)
_NUMERIC = re.compile(r"^\d+$")


def normalize_path(path: str) -> str:
    """`/users/42/orders/9f1d…` -> `/users/:id/orders/:id`: una transacción por ruta, no una por id."""
    parts = [":id" if _NUMERIC.match(p) or _UUID.match(p) or _LONG_HEX.match(p) else p for p in path.split("/")]
    return "/".join(parts) or "/"


def begin_transaction(
    client: Client, method: str, path: str, traceparent: Optional[str], name: Optional[str] = None
) -> Optional[Transaction]:
    """La transacción de una petición, continuando la traza que llegue en `traceparent`."""
    # Con el rendimiento apagado tampoco se continúa una traza ajena.
    if client.options.traces_sample_rate <= 0:
        return None
    incoming = parse_traceparent(traceparent)
    return client.start_transaction(
        name or f"{method} {normalize_path(path)}",
        "http.server",
        trace_id=incoming.trace_id if incoming else None,
        parent_span_id=incoming.parent_span_id if incoming else None,
        # Si quien nos llama ya decidió registrar (o no) la traza, se respeta.
        sampled=incoming.sampled if incoming else None,
    )


def request_info(method: str, url: str, user_agent: Optional[str]) -> Dict[str, Any]:
    info: Dict[str, Any] = {"url": url, "method": method}
    if user_agent:
        info["headers"] = {"User-Agent": user_agent}
    return info


def finish_request(tx: Optional[Transaction], method: str, status: Optional[int]) -> None:
    if tx is None:
        return
    tx.set_tag("http.method", method)
    if status is not None:
        tx.set_tag("http.status_code", str(status))
        # En un servidor, un 4xx es un error del cliente, no un fallo de la transacción.
        tx.status = "internal_error" if status >= 500 else "ok"
    tx.finish()
