"""Flask: nombra las transacciones con la ruta registrada y captura los errores que Flask maneja."""

from __future__ import annotations

import sys
from typing import Any

from .. import get_client
from ..tracing import get_current_transaction
from .wsgi import SentinelWsgiMiddleware


def setup_flask(app: Any) -> Any:
    """
    Instala el SDK en una aplicación Flask::

        sentinel_sdk.init(dsn, traces_sample_rate=1.0)
        setup_flask(app)

    Flask convierte las excepciones en una respuesta 500 sin dejarlas llegar al servidor, así que se
    captura la señal `got_request_exception`.
    """
    from flask import got_request_exception, request

    app.wsgi_app = SentinelWsgiMiddleware(app.wsgi_app)

    @app.before_request
    def name_transaction() -> None:
        tx = get_current_transaction()
        rule = request.url_rule
        if tx is not None and rule is not None:
            tx.set_name(f"{request.method} {rule.rule}")

    def capture(_sender: Any, exception: BaseException, **_extra: Any) -> None:
        client = get_client()
        if client is not None and client.enabled:
            client.capture_exception(
                (type(exception), exception, exception.__traceback__ or sys.exc_info()[2]),
                tags={"handled": "true", "mechanism": "flask"},
            )

    got_request_exception.connect(capture, app, weak=False)
    return app
