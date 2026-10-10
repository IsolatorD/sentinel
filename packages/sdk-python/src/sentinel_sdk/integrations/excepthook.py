"""Captura las excepciones no controladas del proceso y de los hilos, y deja actuar al manejador original."""

from __future__ import annotations

import sys
import threading
from typing import Any, Callable

from ..client import Client


def install(client: Client) -> Callable[[], None]:
    original_excepthook = sys.excepthook
    original_thread_hook = threading.excepthook

    def excepthook(exc_type: Any, exc: Any, tb: Any) -> None:
        # Ctrl+C no es un fallo de la aplicación.
        if not issubclass(exc_type, KeyboardInterrupt):
            client.capture_exception((exc_type, exc, tb), level="fatal", tags={"handled": "false", "mechanism": "excepthook"})
            # El intérprete está a punto de terminar: se da tiempo a enviar antes.
            client.flush()
        original_excepthook(exc_type, exc, tb)

    def thread_hook(args: "threading.ExceptHookArgs") -> None:
        if args.exc_type is not SystemExit and args.exc_value is not None:
            client.capture_exception(
                (args.exc_type, args.exc_value, args.exc_traceback),
                level="fatal",
                tags={"handled": "false", "mechanism": "threading"},
            )
        original_thread_hook(args)

    sys.excepthook = excepthook
    threading.excepthook = thread_hook

    def uninstall() -> None:
        # Solo se restaura si nadie más los envolvió encima.
        if sys.excepthook is excepthook:
            sys.excepthook = original_excepthook
        if threading.excepthook is thread_hook:
            threading.excepthook = original_thread_hook

    return uninstall
