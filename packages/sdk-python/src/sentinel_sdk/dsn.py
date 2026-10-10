"""La DSN del proyecto: `https://<clave>@<host>[/<prefijo>]/<projectId>`."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import unquote, urlsplit

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_KEY = re.compile(r"^[0-9a-f]{32}$", re.I)


@dataclass(frozen=True)
class Dsn:
    public_key: str
    project_id: str
    #: A donde se envían los eventos (errores).
    events_url: str
    #: A donde se envían las transacciones (rendimiento).
    transactions_url: str

    @property
    def own_base(self) -> str:
        """Prefijo común de las URLs del propio SDK: sus peticiones no se miden ni se registran."""
        return self.events_url[: -len("events")]


def parse_dsn(dsn: object) -> Optional[Dsn]:
    """Devuelve `None` si la DSN no es válida: el SDK se desactiva en lugar de lanzar."""
    if not isinstance(dsn, str):
        return None
    try:
        url = urlsplit(dsn)
        key = unquote(url.username or "")
        host = url.netloc.rsplit("@", 1)[-1]
    except ValueError:
        return None
    if url.scheme not in ("http", "https") or not host:
        return None
    segments = [s for s in url.path.split("/") if s]
    project_id = segments.pop() if segments else ""
    if not _KEY.match(key) or not _UUID.match(project_id):
        return None
    prefix = "/" + "/".join(segments) if segments else ""
    base = f"{url.scheme}://{host}{prefix}/api/{project_id}"
    return Dsn(key.lower(), project_id, f"{base}/events", f"{base}/transactions")
