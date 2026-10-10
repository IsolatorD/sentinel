"""Instrumentación automática: se instala sola con `init()`, solo para lo que esté disponible."""

from __future__ import annotations

from typing import Callable, List

from ..client import Client

Uninstall = Callable[[], None]


def install_defaults(client: Client) -> List[Uninstall]:
    from . import excepthook, http_clients, logging_

    uninstallers: List[Uninstall] = []
    if client.options.capture_global_errors:
        uninstallers.append(excepthook.install(client))
    if client.options.log_breadcrumbs or client.options.capture_logged_errors:
        uninstallers.append(logging_.install(client))
    if client.options.http_client_spans:
        uninstallers.extend(http_clients.install(client))
    return uninstallers
