"""`logging` como breadcrumbs (y, si se pide, los errores registrados como eventos)."""

from __future__ import annotations

import logging
from typing import Callable

from ..client import Client
from ..scope import get_current_scope

_LEVELS = {
    logging.DEBUG: "debug",
    logging.INFO: "info",
    logging.WARNING: "warning",
    logging.ERROR: "error",
    logging.CRITICAL: "fatal",
}
# Lo que escribe el propio SDK o sus transportes no debe generar breadcrumbs ni eventos (bucles).
_IGNORED = ("sentinel_sdk", "urllib3", "asyncio")


class _Handler(logging.Handler):
    def __init__(self, client: Client) -> None:
        super().__init__(level=logging.INFO)
        self.client = client

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if record.name.startswith(_IGNORED):
                return
            level = _LEVELS.get(max(l for l in _LEVELS if l <= record.levelno), "info")
            if self.client.options.log_breadcrumbs:
                get_current_scope().add_breadcrumb(
                    {"category": record.name, "type": "log", "level": level, "message": record.getMessage()}
                )
            if self.client.options.capture_logged_errors and record.levelno >= logging.ERROR:
                tags = {"handled": "true", "mechanism": "logging", "logger": record.name}
                if record.exc_info and record.exc_info[1] is not None:
                    self.client.capture_exception(record.exc_info, tags=tags)
                else:
                    self.client.capture_message(record.getMessage(), "error", tags=tags)
        except Exception:  # un logging que falla no debe romper la aplicación
            self.handleError(record)


def install(client: Client) -> Callable[[], None]:
    handler = _Handler(client)
    root = logging.getLogger()
    root.addHandler(handler)
    return lambda: root.removeHandler(handler)
