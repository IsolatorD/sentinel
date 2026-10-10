from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Pattern, Sequence, Union

Event = Dict[str, Any]
BeforeSend = Callable[[Event, Dict[str, Any]], Optional[Event]]
BeforeSendTransaction = Callable[[Event], Optional[Event]]
IgnoreRule = Union[str, type, Pattern[str]]


@dataclass
class Options:
    """Opciones de `init`. Solo `dsn` es obligatoria."""

    #: DSN del proyecto: `https://<clave>@<host>/<projectId>`.
    dsn: str
    release: Optional[str] = None
    environment: Optional[str] = None
    #: Fracción de eventos que se envían (0 a 1).
    sample_rate: float = 1.0
    #: Fracción de transacciones que se registran (0 a 1). Con 0 el rendimiento está apagado.
    traces_sample_rate: float = 0.0
    max_breadcrumbs: int = 50
    #: Corta las tormentas de errores desde un mismo proceso.
    max_events_per_minute: int = 60
    #: Tipos de excepción (clase, nombre o regex sobre "Tipo: mensaje") que no se envían.
    ignore_errors: Sequence[IgnoreRule] = field(default_factory=tuple)
    #: Última oportunidad de modificar o descartar (devolver `None`) un evento.
    before_send: Optional[BeforeSend] = None
    before_send_transaction: Optional[BeforeSendTransaction] = None
    tags: Dict[str, str] = field(default_factory=dict)
    user: Optional[Dict[str, str]] = None
    #: Desactiva el SDK sin quitar el código.
    enabled: bool = True
    #: Mensajes del SDK en `logging` (logger `sentinel_sdk`) y en stderr.
    debug: bool = False
    server_name: Optional[str] = None
    #: A qué URLs se añade la cabecera `traceparent` (substring o regex). Por defecto, a ninguna.
    trace_propagation_targets: Optional[Sequence[Union[str, Pattern[str]]]] = None
    max_spans: int = 100
    #: Cuántos segundos esperar a enviar lo pendiente al salir.
    shutdown_timeout: float = 2.0
    #: Las rutas se envían relativas a esta carpeta (por defecto, el directorio de trabajo).
    project_root: Optional[str] = None
    #: Módulos (prefijo) que cuentan como código propio aunque estén en `site-packages`, y los que no.
    in_app_include: Sequence[str] = field(default_factory=tuple)
    in_app_exclude: Sequence[str] = field(default_factory=tuple)
    #: Captura las excepciones no controladas del proceso y de los hilos (`sys.excepthook`).
    capture_global_errors: bool = True
    #: Convierte en breadcrumbs lo que se escribe con `logging` (INFO o más).
    log_breadcrumbs: bool = True
    #: Envía como evento lo que se registra con `logging` en nivel ERROR o más (con su excepción si la hay).
    capture_logged_errors: bool = False
    #: Qué instrumentar solo (las bibliotecas que estén instaladas).
    http_client_spans: bool = True

    def __post_init__(self) -> None:
        self.max_breadcrumbs = max(0, min(int(self.max_breadcrumbs), 100))
        self.max_spans = max(0, min(int(self.max_spans), 200))
        self.sample_rate = _clamp01(self.sample_rate)
        self.traces_sample_rate = _clamp01(self.traces_sample_rate)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def ignore_matches(rules: Sequence[IgnoreRule], exc_type: str, exc_class: Optional[type], text: str) -> bool:
    """¿Alguna regla de `ignore_errors` coincide con esta excepción?"""
    for rule in rules:
        if isinstance(rule, type):
            if exc_class is not None and issubclass(exc_class, rule):
                return True
        elif isinstance(rule, str):
            if rule == exc_type or rule in text:
                return True
        elif rule.search(text):
            return True
    return False


__all__: List[str] = ["Options", "Event", "ignore_matches"]
