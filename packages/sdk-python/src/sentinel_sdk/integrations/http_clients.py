"""Spans (y la cabecera `traceparent`) para las peticiones salientes de `requests` y `httpx`."""

from __future__ import annotations

import importlib.util
from typing import Any, Callable, List, Optional
from urllib.parse import urlsplit

from ..client import Client
from ..scope import get_current_scope
from ..tracing import Span, start_child_span, status_from_http


def _clean(url: str) -> str:
    """Sin query ni fragmento: pueden llevar tokens."""
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}{parts.path}"


class _Call:
    """Lo que dura una petición saliente: el span, la cabecera a añadir y el cierre."""

    def __init__(self, client: Client, method: str, url: str) -> None:
        self.client = client
        self.method = method.upper()
        self.url = _clean(url)
        self.own = client.is_own_url(url)
        self.span: Optional[Span] = None
        self.header: Optional[str] = None
        if not self.own:
            self.span = start_child_span("http.client", f"{self.method} {self.url}", method=self.method, url=self.url)
            if client.should_propagate(url):
                self.header = self.span.traceparent()

    def done(self, status: Optional[int], error: Optional[str] = None) -> None:
        if self.span is None:
            return
        if status is not None:
            self.span.set_data("http.status_code", status)
        self.span.finish(status_from_http(status))
        get_current_scope().add_breadcrumb(
            {
                "category": "http",
                "type": "http",
                "level": "warning" if error or (status or 0) >= 400 else "info",
                "data": {
                    "method": self.method,
                    "url": self.url,
                    **({"status_code": status} if status is not None else {}),
                    **({"error": error} if error else {}),
                },
            }
        )


def _available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def _patch_requests(client: Client) -> Optional[Callable[[], None]]:
    if not _available("requests"):
        return None
    import requests

    original = requests.sessions.Session.send

    def send(self: Any, request: Any, **kwargs: Any) -> Any:
        call = _Call(client, request.method or "GET", request.url or "")
        if call.header:
            request.headers["traceparent"] = call.header
        try:
            response = original(self, request, **kwargs)
        except Exception as error:
            call.done(None, type(error).__name__)
            raise
        call.done(response.status_code)
        return response

    requests.sessions.Session.send = send  # type: ignore[method-assign]

    def uninstall() -> None:
        if requests.sessions.Session.send is send:
            requests.sessions.Session.send = original  # type: ignore[method-assign]

    return uninstall


def _patch_httpx(client: Client) -> List[Callable[[], None]]:
    if not _available("httpx"):
        return []
    import httpx

    original_sync = httpx.Client.send
    original_async = httpx.AsyncClient.send

    def send(self: Any, request: Any, **kwargs: Any) -> Any:
        call = _Call(client, request.method, str(request.url))
        if call.header:
            request.headers["traceparent"] = call.header
        try:
            response = original_sync(self, request, **kwargs)
        except Exception as error:
            call.done(None, type(error).__name__)
            raise
        call.done(response.status_code)
        return response

    async def asend(self: Any, request: Any, **kwargs: Any) -> Any:
        call = _Call(client, request.method, str(request.url))
        if call.header:
            request.headers["traceparent"] = call.header
        try:
            response = await original_async(self, request, **kwargs)
        except Exception as error:
            call.done(None, type(error).__name__)
            raise
        call.done(response.status_code)
        return response

    httpx.Client.send = send  # type: ignore[method-assign]
    httpx.AsyncClient.send = asend  # type: ignore[method-assign]

    def uninstall() -> None:
        if httpx.Client.send is send:
            httpx.Client.send = original_sync  # type: ignore[method-assign]
        if httpx.AsyncClient.send is asend:
            httpx.AsyncClient.send = original_async  # type: ignore[method-assign]

    return [uninstall]


def install(client: Client) -> List[Callable[[], None]]:
    uninstallers: List[Callable[[], None]] = []
    requests_uninstall = _patch_requests(client)
    if requests_uninstall:
        uninstallers.append(requests_uninstall)
    uninstallers.extend(_patch_httpx(client))
    return uninstallers
