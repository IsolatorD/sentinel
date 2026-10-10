from __future__ import annotations

import os
from types import TracebackType
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

from .stacktrace import frames_from_traceback

MAX_CHAIN = 5

ExcInfo = Tuple[Optional[Type[BaseException]], Optional[BaseException], Optional[TracebackType]]


def exception_values(
    exc_info: ExcInfo,
    root: Optional[str] = None,
    include: Sequence[str] = (),
    exclude: Sequence[str] = (),
) -> List[Dict[str, Any]]:
    """
    La cadena de excepciones tal como la espera el servidor: las causas primero y la
    principal al final. Sigue `raise ... from causa` y las excepciones durante el manejo de otra
    (salvo `from None`), con un límite y a prueba de ciclos.
    """
    root = root or os.getcwd()
    _, exc, tb = exc_info
    chain: List[Dict[str, Any]] = []
    seen = set()
    current: Optional[BaseException] = exc
    current_tb = tb
    while current is not None and id(current) not in seen and len(chain) <= MAX_CHAIN:
        seen.add(id(current))
        value: Dict[str, Any] = {"type": type(current).__name__, "value": str(current)}
        frames = frames_from_traceback(current_tb if current_tb is not None else current.__traceback__, root, include, exclude)
        if frames:
            value["stacktrace"] = {"frames": frames}
        chain.insert(0, value)
        if current.__cause__ is not None:
            current = current.__cause__
        elif current.__context__ is not None and not current.__suppress_context__:
            current = current.__context__
        else:
            current = None
        current_tb = None
    return chain
