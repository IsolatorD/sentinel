"""El cliente: arma los eventos, aplica filtros, muestreo y límites, y los entrega al transporte."""

from __future__ import annotations

import logging
import os
import platform as _platform
import random
import socket
import sys
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from ._version import SDK_NAME, SDK_VERSION
from .dsn import Dsn, parse_dsn
from .exceptions import ExcInfo, exception_values
from .normalize import clip, normalize_event, normalize_transaction, to_json
from .options import Options, ignore_matches
from .scope import Scope, get_current_scope, get_global_scope, utc_iso
from .stacktrace import frames_from_stack
from .tracing import Transaction, get_current_span, get_current_transaction
from .transport import SendFn, Transport, register_exit_flush

logger = logging.getLogger("sentinel_sdk")

DEDUPE_WINDOW = 1.0
RATE_WINDOW = 60.0


class Client:
    def __init__(self, options: Options, *, send_fn: Optional[SendFn] = None, retry_delays: Tuple[float, ...] = (1.0, 3.0, 8.0)) -> None:
        self.options = options
        self.dsn: Optional[Dsn] = parse_dsn(options.dsn)
        self.transport: Optional[Transport] = None
        self._unregister_exit: Optional[Any] = None
        self._lock = threading.Lock()
        self._recent: Optional[Tuple[str, float]] = None
        self._sent_at: List[float] = []
        self._root = os.path.abspath(options.project_root or os.getcwd())
        self._server_name = options.server_name or socket.gethostname()
        get_global_scope().set_max_breadcrumbs(options.max_breadcrumbs)
        if options.user:
            get_global_scope().user = dict(options.user)
        get_global_scope().tags.update(options.tags)

        if self.dsn is None:
            self.debug("invalid DSN: the SDK is disabled")
            return
        if not options.enabled:
            return
        self.transport = Transport(self.dsn.public_key, send_fn, retry_delays, self.debug)
        self._unregister_exit = register_exit_flush(self.transport, options.shutdown_timeout)

    # ---------- estado ----------

    @property
    def enabled(self) -> bool:
        return self.transport is not None

    def debug(self, message: str) -> None:
        if self.options.debug:
            logger.warning("[Sentinel] %s", message)
            print(f"[Sentinel] {message}", file=sys.stderr)

    def is_own_url(self, url: str) -> bool:
        return bool(self.dsn and url.startswith(self.dsn.own_base))

    # ---------- captura ----------

    def capture_exception(self, error: Any = None, **hint: Any) -> Optional[str]:
        """Envía una excepción. Sin argumento, la que se está manejando (`sys.exc_info()`)."""
        try:
            info = self._exc_info(error)
            if info[1] is None:
                return None
            values = exception_values(info, self._root, self.options.in_app_include, self.options.in_app_exclude)
            return self._capture({"level": hint.pop("level", "error"), "exception": {"values": values}}, hint, info)
        except Exception as problem:  # el SDK nunca debe romper la app que monitorea
            self.debug(f"could not capture exception: {problem!r}")
            return None

    def capture_message(self, message: str, level: str = "info", **hint: Any) -> Optional[str]:
        try:
            return self._capture({"level": level, "message": message}, hint, None)
        except Exception as problem:
            self.debug(f"could not capture message: {problem!r}")
            return None

    @staticmethod
    def _exc_info(error: Any) -> ExcInfo:
        if error is None:
            return sys.exc_info()  # type: ignore[return-value]
        if isinstance(error, tuple):
            return error  # type: ignore[return-value]
        if isinstance(error, BaseException):
            return (type(error), error, error.__traceback__)
        return (None, None, None)

    def _capture(self, partial: Dict[str, Any], hint: Dict[str, Any], info: Optional[ExcInfo]) -> Optional[str]:
        if self.transport is None:
            return None
        event = self._build_event(partial, hint)
        opts = self.options

        if info is not None and info[1] is not None:
            text = f"{type(info[1]).__name__}: {info[1]}"
            if ignore_matches(opts.ignore_errors, type(info[1]).__name__, type(info[1]), text):
                return self._drop("ignored by ignore_errors")
        if opts.sample_rate < 1.0 and random.random() >= opts.sample_rate:
            return self._drop("sampled out")
        if self._is_duplicate(event):
            return self._drop("duplicate of the previous event")
        if not self._within_rate_limit():
            return self._drop("per-minute event limit reached")

        if opts.before_send is not None:
            try:
                result = opts.before_send(event, hint)
                if result is None:
                    return self._drop("dropped by before_send")
                event = result
            except Exception as problem:
                self.debug(f"before_send raised, sending the original event: {problem!r}")

        normalized = normalize_event(event)
        self.transport.submit(self.dsn.events_url, to_json(normalized))  # type: ignore[union-attr]
        return normalized["event_id"]

    def _build_event(self, partial: Dict[str, Any], hint: Dict[str, Any]) -> Dict[str, Any]:
        scope = get_current_scope()
        opts = self.options
        user = {**(scope.user or {}), **(hint.get("user") or {})}
        tags = {**scope.tags, **(hint.get("tags") or {})}
        extra = {**scope.extra, **(hint.get("extra") or {})}
        tx = get_current_transaction()

        contexts: Dict[str, Any] = {
            "sdk": {"name": SDK_NAME, "version": SDK_VERSION},
            # Une el error con la transacción en curso (se podrá ver la traza completa desde el error).
            **({"trace": {"trace_id": tx.trace_id, "span_id": tx.span_id}} if tx is not None and tx.sampled else {}),
            "runtime": {
                "name": _platform.python_implementation(),
                "version": _platform.python_version(),
                "server_name": self._server_name,
            },
            "os": {"name": sys.platform, "version": _platform.release()},
            **scope.contexts,
            **(hint.get("contexts") or {}),
        }
        crumbs = scope.breadcrumb_list()
        event: Dict[str, Any] = {
            "event_id": str(uuid.uuid4()),
            "timestamp": utc_iso(),
            "platform": "python",
            **({"release": opts.release} if opts.release else {}),
            **({"environment": opts.environment} if opts.environment else {}),
            **partial,
            "contexts": contexts,
        }
        if user:
            event["user"] = user
        if tags:
            event["tags"] = tags
        if scope.request:
            event["request"] = scope.request
        if crumbs:
            event["breadcrumbs"] = crumbs
        if extra:
            event["extra"] = extra
        if hint.get("fingerprint"):
            event["fingerprint"] = list(hint["fingerprint"])
        return event

    def _is_duplicate(self, event: Dict[str, Any]) -> bool:
        main = (event.get("exception") or {}).get("values", [None])[-1] or {}
        frames = (main.get("stacktrace") or {}).get("frames") or [{}]
        top = frames[-1]
        key = "|".join(str(x) for x in (event.get("message"), main.get("type"), main.get("value"), top.get("filename"), top.get("lineno")))
        now = time.monotonic()
        with self._lock:
            duplicate = self._recent is not None and self._recent[0] == key and now - self._recent[1] < DEDUPE_WINDOW
            self._recent = (key, now)
        return duplicate

    def _within_rate_limit(self) -> bool:
        now = time.monotonic()
        with self._lock:
            self._sent_at = [t for t in self._sent_at if now - t < RATE_WINDOW]
            if len(self._sent_at) >= self.options.max_events_per_minute:
                return False
            self._sent_at.append(now)
            return True

    def _drop(self, reason: str) -> None:
        self.debug(f"event dropped: {reason}")
        return None

    # ---------- rendimiento ----------

    def should_sample_trace(self) -> bool:
        return self.options.traces_sample_rate > 0 and random.random() < self.options.traces_sample_rate

    def start_transaction(self, name: str, op: str = "custom", **kwargs: Any) -> Transaction:
        return Transaction(self, name, op, **kwargs)

    def send_transaction(self, tx: Transaction) -> None:
        try:
            if self.transport is None:
                return
            payload: Optional[Dict[str, Any]] = tx.to_payload()
            if self.options.before_send_transaction is not None:
                try:
                    payload = self.options.before_send_transaction(payload)  # type: ignore[arg-type]
                except Exception as problem:
                    self.debug(f"before_send_transaction raised, sending the original: {problem!r}")
                if payload is None:
                    self.debug("transaction dropped by before_send_transaction")
                    return
            self.transport.submit(self.dsn.transactions_url, to_json(normalize_transaction(payload)))  # type: ignore[union-attr]
        except Exception as problem:
            self.debug(f"could not send transaction: {problem!r}")

    # ---------- alcance ----------

    def current_user(self) -> Optional[Dict[str, str]]:
        return get_current_scope().user

    def current_tags(self) -> Dict[str, str]:
        return dict(get_current_scope().tags)

    def should_propagate(self, url: str) -> bool:
        targets = self.options.trace_propagation_targets
        if not targets:
            return False
        for target in targets:
            if isinstance(target, str):
                if target in url:
                    return True
            elif target.search(url):
                return True
        return False

    # ---------- ciclo de vida ----------

    def flush(self, timeout: Optional[float] = None) -> bool:
        if self.transport is None:
            return True
        return self.transport.flush(self.options.shutdown_timeout if timeout is None else timeout)

    def close(self, timeout: Optional[float] = None) -> bool:
        if self._unregister_exit:
            self._unregister_exit()
            self._unregister_exit = None
        if self.transport is None:
            return True
        return self.transport.close(self.options.shutdown_timeout if timeout is None else timeout)

    # ---------- utilidades para las integraciones ----------

    def stack_frames(self, frames: Any) -> List[Dict[str, Any]]:
        return frames_from_stack(frames, self._root, self.options.in_app_include, self.options.in_app_exclude)

    def short(self, value: Any, limit: int = 256) -> Any:
        return clip(value, limit)
