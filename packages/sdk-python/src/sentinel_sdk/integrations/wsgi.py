"""Middleware WSGI (Flask, Django con WSGI, Bottle, Pyramid...)."""

from __future__ import annotations

import sys
from typing import Any, Callable, Dict, Iterable, Iterator, Optional

from .. import get_client
from ..scope import isolation_scope
from ..tracing import Transaction, _current_span
from ._common import begin_transaction, finish_request, request_info


class _ResponseIterator:
    """
    La respuesta de WSGI se consume después de que la aplicación retorne: la transacción (y el alcance
    de la petición) siguen abiertos hasta que el servidor llama a `close()`.
    """

    def __init__(self, result: Iterable[bytes], on_close: Callable[[], None], on_error: Callable[[BaseException], None]) -> None:
        self._result = result
        self._iterator: Iterator[bytes] = iter(result)
        self._on_close = on_close
        self._on_error = on_error

    def __iter__(self) -> "_ResponseIterator":
        return self

    def __next__(self) -> bytes:
        try:
            return next(self._iterator)
        except StopIteration:
            # La respuesta terminó: la transacción acaba aquí sin esperar al `close()` del servidor
            # (que algunos clientes de prueba no llaman). Cerrar dos veces no hace nada.
            self._on_close()
            raise
        except BaseException as error:
            self._on_error(error)
            raise

    def close(self) -> None:
        try:
            close = getattr(self._result, "close", None)
            if close is not None:
                close()
        finally:
            self._on_close()


class SentinelWsgiMiddleware:
    """
    Envuelve tu aplicación WSGI::

        app.wsgi_app = SentinelWsgiMiddleware(app.wsgi_app)

    Mide cada petición (continuando la traza que llegue en `traceparent`), aísla el usuario y los
    breadcrumbs de cada una y captura las excepciones que lleguen hasta aquí. Flask y Django capturan
    las suyas antes de que lleguen: ver `sentinel_sdk.integrations.flask` y `.django`.
    """

    def __init__(self, app: Any, transaction_name: Optional[Callable[[Dict[str, Any]], Optional[str]]] = None) -> None:
        self.app = app
        self.transaction_name = transaction_name

    def __call__(self, environ: Dict[str, Any], start_response: Callable[..., Any]) -> Iterable[bytes]:
        client = get_client()
        if client is None or not client.enabled:
            return self.app(environ, start_response)  # type: ignore[no-any-return]

        method = environ.get("REQUEST_METHOD", "GET")
        path = f"{environ.get('SCRIPT_NAME', '')}{environ.get('PATH_INFO', '')}" or "/"
        host = environ.get("HTTP_HOST") or environ.get("SERVER_NAME", "localhost")
        status: Optional[int] = None

        def tracking_start_response(status_line: str, headers: Any, exc_info: Any = None) -> Any:
            nonlocal status
            try:
                status = int(status_line.split(" ", 1)[0])
            except ValueError:
                pass
            return start_response(status_line, headers, exc_info)

        scope_manager = isolation_scope()
        scope = scope_manager.__enter__()
        scope.request = request_info(
            method, f"{environ.get('wsgi.url_scheme', 'http')}://{host}{path}", environ.get("HTTP_USER_AGENT")
        )
        custom = self.transaction_name(environ) if self.transaction_name else None
        tx: Optional[Transaction] = begin_transaction(client, method, path, environ.get("HTTP_TRACEPARENT"), custom)
        token = _current_span.set(tx) if tx is not None else None
        closed = False

        def close() -> None:
            nonlocal closed
            if closed:
                return
            closed = True
            try:
                if token is not None:
                    _current_span.reset(token)
                finish_request(tx, method, status)
            finally:
                scope_manager.__exit__(None, None, None)

        def on_error(error: BaseException) -> None:
            nonlocal status
            client.capture_exception(error, tags={"handled": "false", "mechanism": "wsgi"})
            status = status or 500

        try:
            result = self.app(environ, tracking_start_response)
        except BaseException as error:
            on_error(error)
            close()
            raise
        return _ResponseIterator(result, close, on_error)


_ = sys  # el módulo se importa para que `sys.exc_info` esté disponible a las integraciones derivadas
