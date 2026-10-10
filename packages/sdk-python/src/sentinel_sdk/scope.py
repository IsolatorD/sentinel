"""Lo que acompaña a los eventos: usuario, tags, contextos, extras y breadcrumbs, por contexto de ejecución."""

from __future__ import annotations

import contextvars
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Iterator, List, Optional


def utc_iso(ts: Optional[float] = None) -> str:
    moment = datetime.fromtimestamp(ts, timezone.utc) if ts is not None else datetime.now(timezone.utc)
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Scope:
    def __init__(self, max_breadcrumbs: int = 50) -> None:
        self.user: Optional[Dict[str, str]] = None
        self.tags: Dict[str, str] = {}
        self.contexts: Dict[str, Dict[str, Any]] = {}
        self.extra: Dict[str, Any] = {}
        self.request: Optional[Dict[str, Any]] = None
        self.breadcrumbs: Deque[Dict[str, Any]] = deque(maxlen=max_breadcrumbs)

    def set_max_breadcrumbs(self, limit: int) -> None:
        self.breadcrumbs = deque(self.breadcrumbs, maxlen=limit)

    def clone(self) -> "Scope":
        """Copia independiente: lo que se cambie en la copia no afecta al original."""
        other = Scope(self.breadcrumbs.maxlen or 0)
        other.user = dict(self.user) if self.user else None
        other.tags = dict(self.tags)
        other.contexts = {k: dict(v) for k, v in self.contexts.items()}
        other.extra = dict(self.extra)
        other.request = dict(self.request) if self.request else None
        other.breadcrumbs.extend(self.breadcrumbs)
        return other

    def add_breadcrumb(self, crumb: Dict[str, Any]) -> None:
        if self.breadcrumbs.maxlen == 0:
            return
        crumb.setdefault("timestamp", utc_iso())
        self.breadcrumbs.append(crumb)

    def breadcrumb_list(self) -> List[Dict[str, Any]]:
        return list(self.breadcrumbs)


_global_scope = Scope()
_current: "contextvars.ContextVar[Scope]" = contextvars.ContextVar("sentinel_scope", default=_global_scope)


def get_current_scope() -> Scope:
    return _current.get()


def get_global_scope() -> Scope:
    return _global_scope


@contextmanager
def isolation_scope() -> Iterator[Scope]:
    """
    Un alcance propio para lo que se ejecute dentro (una petición, un trabajo): sus tags, usuario y
    breadcrumbs no se mezclan con los de otras peticiones simultáneas. Parte de una copia del actual.
    """
    scope = _current.get().clone()
    token = _current.set(scope)
    try:
        yield scope
    finally:
        _current.reset(token)
