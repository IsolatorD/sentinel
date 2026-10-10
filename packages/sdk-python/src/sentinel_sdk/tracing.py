"""Rendimiento: transacciones y spans, con la traza propagada por `traceparent` (W3C)."""

from __future__ import annotations

import contextvars
import functools
import inspect
import os
import re
import time
import uuid
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, TypeVar

from .scope import utc_iso

if TYPE_CHECKING:  # pragma: no cover
    from .client import Client

F = TypeVar("F", bound=Callable[..., Any])

_TRACEPARENT = re.compile(r"^([\da-f]{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$", re.I)


def random_hex(n_bytes: int) -> str:
    value = os.urandom(n_bytes).hex()
    # Un id de solo ceros no es válido en W3C trace-context.
    return value if value.strip("0") else value[:-1] + "1"


class IncomingTrace:
    def __init__(self, trace_id: str, parent_span_id: str, sampled: bool) -> None:
        self.trace_id = trace_id
        self.parent_span_id = parent_span_id
        self.sampled = sampled


def parse_traceparent(header: Optional[str]) -> Optional[IncomingTrace]:
    match = _TRACEPARENT.match(header.strip()) if header else None
    if not match:
        return None
    version, trace_id, parent, flags = match.groups()
    if version.lower() == "ff" or not trace_id.strip("0") or not parent.strip("0"):
        return None
    return IncomingTrace(trace_id.lower(), parent.lower(), bool(int(flags, 16) & 1))


def format_traceparent(trace_id: str, span_id: str, sampled: bool = True) -> str:
    return f"00-{trace_id}-{span_id}-{'01' if sampled else '00'}"


def status_from_http(code: Optional[int]) -> str:
    if code is None or code == 0:
        return "internal_error"
    if code < 400:
        return "ok"
    return {401: "unauthenticated", 403: "permission_denied", 404: "not_found", 429: "resource_exhausted"}.get(
        code, "internal_error" if code >= 500 else "invalid_argument"
    )


#: El span (o la transacción) en curso en este contexto de ejecución.
_current_span: "contextvars.ContextVar[Optional[Span]]" = contextvars.ContextVar("sentinel_span", default=None)


def get_current_span() -> Optional["Span"]:
    return _current_span.get()


def get_current_transaction() -> Optional["Transaction"]:
    span = _current_span.get()
    return span.transaction if span is not None else None


class Span:
    """Un tramo de trabajo. Como gestor de contexto (`with`), queda como "el span en curso"."""

    def __init__(
        self,
        op: str,
        description: Optional[str] = None,
        *,
        parent: Optional["Span"] = None,
        transaction: Optional["Transaction"] = None,
        data: Optional[Dict[str, Any]] = None,
        start: Optional[float] = None,
    ) -> None:
        self.span_id = random_hex(8)
        self.op = op
        self.description = description
        self.parent_span_id = parent.span_id if parent is not None else None
        self.transaction = transaction
        self.data: Dict[str, Any] = dict(data or {})
        self.status: Optional[str] = None
        self.start_time = start if start is not None else time.time()
        self._start_mono = time.monotonic()
        self.end_time: Optional[float] = None
        self.duration_ms: Optional[float] = None
        self._token: Optional["contextvars.Token[Optional[Span]]"] = None

    @property
    def finished(self) -> bool:
        return self.end_time is not None

    def set_data(self, key: str, value: Any) -> "Span":
        self.data[key] = value
        return self

    def set_status(self, status: str) -> "Span":
        self.status = status
        return self

    def finish(self, status: Optional[str] = None) -> None:
        """Termina el span. Llamarlo otra vez no hace nada."""
        if self.finished:
            return
        if status:
            self.status = status
        self.duration_ms = (time.monotonic() - self._start_mono) * 1000
        self.end_time = self.start_time + self.duration_ms / 1000

    def start_child(self, op: str, description: Optional[str] = None, **data: Any) -> "Span":
        tx = self.transaction
        child = Span(op, description, parent=self, transaction=tx, data=data)
        if tx is not None:
            tx._register(child)
        return child

    def traceparent(self) -> Optional[str]:
        tx = self.transaction
        if tx is None or not tx.sampled:
            return None
        return format_traceparent(tx.trace_id, self.span_id)

    def __enter__(self) -> "Span":
        self._token = _current_span.set(self)
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self._token is not None:
            _current_span.reset(self._token)
            self._token = None
        self.finish("internal_error" if exc_type is not None and self.status is None else None)


class Transaction(Span):
    """Una unidad de trabajo medida (una petición, un trabajo). Al terminar se envía si fue muestreada."""

    def __init__(
        self,
        client: "Client",
        name: str,
        op: str = "custom",
        *,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        sampled: Optional[bool] = None,
        start: Optional[float] = None,
    ) -> None:
        super().__init__(op, name, transaction=None, start=start)
        self.transaction = self
        self.client = client
        self.name = name
        self.trace_id = trace_id or random_hex(16)
        self.parent_span_id = parent_span_id
        self.sampled = sampled if sampled is not None else client.should_sample_trace()
        self.tags: Dict[str, str] = {}
        self.measurements: Dict[str, Dict[str, Any]] = {}
        self.spans: List[Span] = []
        self.dropped_spans = 0
        self.status = "ok"

    def _register(self, span: Span) -> None:
        if self.sampled and len(self.spans) < self.client.options.max_spans:
            self.spans.append(span)
        else:
            self.dropped_spans += 1

    def set_name(self, name: str) -> "Transaction":
        self.name = name
        return self

    def set_tag(self, key: str, value: str) -> "Transaction":
        self.tags[key] = value
        return self

    def set_measurement(self, name: str, value: float, unit: Optional[str] = None) -> "Transaction":
        self.measurements[name] = {"value": value, **({"unit": unit} if unit else {})}
        return self

    def finish(self, status: Optional[str] = None) -> None:
        if self.finished:
            return
        super().finish(status)
        end = self.end_time or time.time()
        # Un span que quedó abierto se cierra con la transacción.
        for span in self.spans:
            if not span.finished:
                span.status = span.status or "cancelled"
                span.duration_ms = max(0.0, (end - span.start_time) * 1000)
                span.end_time = end
        if self.sampled:
            self.client.send_transaction(self)

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self._token is not None:
            _current_span.reset(self._token)
            self._token = None
        self.finish("internal_error" if exc_type is not None and self.status == "ok" else None)

    def to_payload(self) -> Dict[str, Any]:
        opts = self.client.options
        payload: Dict[str, Any] = {
            "transaction_id": str(uuid.uuid4()),
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "name": self.name or "/",
            "op": self.op,
            "timestamp": utc_iso(self.start_time),
            "duration_ms": round(self.duration_ms or 0.0, 3),
            "status": self.status or "ok",
            "platform": "python",
            "spans": [
                {
                    "span_id": s.span_id,
                    "parent_span_id": s.parent_span_id or self.span_id,
                    "op": s.op,
                    **({"description": s.description} if s.description else {}),
                    "start_timestamp": utc_iso(s.start_time),
                    "duration_ms": round(s.duration_ms or 0.0, 3),
                    **({"status": s.status} if s.status else {}),
                    **({"data": s.data} if s.data else {}),
                }
                for s in self.spans
            ],
        }
        if self.parent_span_id:
            payload["parent_span_id"] = self.parent_span_id
        if opts.release:
            payload["release"] = opts.release
        if opts.environment:
            payload["environment"] = opts.environment
        user = self.client.current_user()
        if user:
            payload["user"] = user
        tags = {**self.client.current_tags(), **self.tags}
        if tags:
            payload["tags"] = tags
        if self.measurements:
            payload["measurements"] = self.measurements
        return payload


def start_child_span(op: str, description: Optional[str] = None, **data: Any) -> Span:
    """Span hijo del que esté en curso; sin ninguno, devuelve uno que no se registra en ningún sitio."""
    parent = _current_span.get()
    if parent is None:
        return Span(op, description, data=data)
    return parent.start_child(op, description, **data)


def trace(op: str = "function", description: Optional[str] = None) -> Callable[[F], F]:
    """Decorador: mide cada llamada a la función (síncrona o `async`) como un span de la transacción en curso."""

    def decorate(fn: F) -> F:
        label = description or getattr(fn, "__qualname__", fn.__name__)
        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def awrapper(*args: Any, **kwargs: Any) -> Any:
                with start_child_span(op, label):
                    return await fn(*args, **kwargs)

            return awrapper  # type: ignore[return-value]

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with start_child_span(op, label):
                return fn(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorate
