"""Envío en segundo plano: nunca bloquea la aplicación ni la rompe, y reintenta lo que falle."""

from __future__ import annotations

import atexit
import logging
import os
import queue
import threading
import time
import urllib.error
import urllib.request
from typing import Callable, Optional, Sequence, Tuple

from ._version import SDK_NAME, SDK_VERSION

logger = logging.getLogger("sentinel_sdk")

#: Resultado de un intento: (aceptado, reintentable, segundos de pausa pedidos por el servidor).
Attempt = Tuple[bool, bool, float]
SendFn = Callable[[str, bytes, str], Attempt]

QUEUE_SIZE = 100
DEFAULT_PAUSE = 60.0


def urllib_send(url: str, body: bytes, public_key: str) -> Attempt:
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Sentinel-Key": public_key,
            "User-Agent": f"{SDK_NAME}/{SDK_VERSION}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 (la URL viene de la DSN)
            return (200 <= response.status < 300, False, 0.0)
    except urllib.error.HTTPError as error:
        if error.code == 429:
            try:
                retry_after = float(error.headers.get("Retry-After", ""))
            except ValueError:
                retry_after = DEFAULT_PAUSE
            return (False, False, retry_after if retry_after > 0 else DEFAULT_PAUSE)
        # 4xx: el servidor lo rechazó y reintentar no cambia nada. 5xx: puede ser pasajero.
        return (False, error.code >= 500, 0.0)
    except Exception:  # red caída, DNS, timeout...
        return (False, True, 0.0)


class Transport:
    def __init__(
        self,
        public_key: str,
        send_fn: SendFn = None,  # type: ignore[assignment]
        retry_delays: Sequence[float] = (1.0, 3.0, 8.0),
        on_debug: Optional[Callable[[str], None]] = None,
    ) -> None:
        self._public_key = public_key
        self._send = send_fn or urllib_send
        self._retry_delays = tuple(retry_delays)
        self._debug = on_debug or (lambda _m: None)
        self._queue: "queue.Queue[Optional[Tuple[str, bytes]]]" = queue.Queue(maxsize=QUEUE_SIZE)
        self._thread: Optional[threading.Thread] = None
        self._pid = os.getpid()
        self._lock = threading.Lock()
        self._idle = threading.Condition()
        self._pending = 0
        self._paused_until = 0.0
        self._closed = False

    # ---------- API ----------

    def submit(self, url: str, body: bytes) -> bool:
        """Encola un envío. Devuelve `False` si se descartó (cola llena o cerrado)."""
        if self._closed:
            return False
        self._ensure_thread()
        try:
            with self._idle:
                self._pending += 1
            self._queue.put_nowait((url, body))
            return True
        except queue.Full:
            with self._idle:
                self._pending -= 1
                self._idle.notify_all()
            self._debug("event dropped: send queue is full")
            return False

    def flush(self, timeout: float = 2.0) -> bool:
        """Espera a que se envíe lo pendiente. `True` si todo salió dentro del plazo."""
        deadline = time.monotonic() + timeout
        with self._idle:
            while self._pending > 0:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                self._idle.wait(remaining)
        return True

    def close(self, timeout: float = 2.0) -> bool:
        ok = self.flush(timeout)
        self._closed = True
        self._queue.put(None)
        return ok

    # ---------- Hilo ----------

    def _ensure_thread(self) -> None:
        # Tras un `fork` (gunicorn con --preload, multiprocessing) el hilo no existe en el proceso hijo.
        if self._thread is not None and self._thread.is_alive() and self._pid == os.getpid():
            return
        with self._lock:
            if self._thread is not None and self._thread.is_alive() and self._pid == os.getpid():
                return
            if self._pid != os.getpid():
                self._queue = queue.Queue(maxsize=QUEUE_SIZE)
                self._idle = threading.Condition()
                self._pending = 0
                self._pid = os.getpid()
            self._thread = threading.Thread(target=self._run, name="sentinel-sdk-transport", daemon=True)
            self._thread.start()

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            if item is None:
                return
            url, body = item
            try:
                self._deliver(url, body)
            except Exception:  # el transporte nunca debe morir
                logger.debug("sentinel_sdk: unexpected transport error", exc_info=True)
            finally:
                with self._idle:
                    self._pending -= 1
                    self._idle.notify_all()

    def _deliver(self, url: str, body: bytes) -> None:
        if time.monotonic() < self._paused_until:
            self._debug("event dropped: sending is paused (rate limited by the server)")
            return
        for attempt in range(len(self._retry_delays) + 1):
            ok, retry, pause = self._send(url, body, self._public_key)
            if ok:
                return
            if pause:
                self._paused_until = time.monotonic() + pause
                self._debug(f"rate limited by the server, pausing for {pause:.0f}s")
                return
            if not retry:
                self._debug("event rejected by the server")
                return
            if attempt < len(self._retry_delays):
                time.sleep(self._retry_delays[attempt])
        self._debug("event dropped after retries")


def register_exit_flush(transport: Transport, timeout: float) -> Callable[[], None]:
    """Al salir del intérprete envía lo pendiente. Devuelve la función para quitar el hook."""
    def flush_at_exit() -> None:
        transport.flush(timeout)

    atexit.register(flush_at_exit)
    return lambda: atexit.unregister(flush_at_exit)
