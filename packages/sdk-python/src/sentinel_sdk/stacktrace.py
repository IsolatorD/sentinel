"""Convierte un traceback de Python en los frames que espera el servidor (del más antiguo al más reciente)."""

from __future__ import annotations

import linecache
import os
import site
import sysconfig
from types import FrameType, TracebackType
from typing import Any, Dict, Iterable, List, Optional, Sequence

CONTEXT_LINES = 5
MAX_FRAMES = 250


def _library_paths() -> List[str]:
    paths = sysconfig.get_paths()
    found = {paths.get(k) for k in ("stdlib", "platstdlib", "purelib", "platlib")}
    try:
        found.update(site.getsitepackages())
        found.add(site.getusersitepackages())
    except Exception:  # entornos sin `site` completo (p. ej. virtualenv antiguo)
        pass
    return [os.path.abspath(p) for p in found if p]


_LIBRARY_PATHS = _library_paths()


def is_in_app(
    filename: Optional[str],
    module: Optional[str] = None,
    include: Sequence[str] = (),
    exclude: Sequence[str] = (),
) -> bool:
    """¿Es código de la aplicación (y no la biblioteca estándar, una dependencia o código generado)?"""
    if not filename or filename.startswith("<"):
        return False
    if module:
        if any(module == p or module.startswith(p + ".") for p in include):
            return True
        if any(module == p or module.startswith(p + ".") for p in exclude):
            return False
    path = os.path.abspath(filename)
    if "site-packages" in path or "dist-packages" in path:
        return False
    return not any(path == p or path.startswith(p + os.sep) for p in _LIBRARY_PATHS)


def _relative(path: str, root: str) -> str:
    absolute = os.path.abspath(path)
    return os.path.relpath(absolute, root) if absolute.startswith(root + os.sep) else absolute


def frame_info(
    frame: FrameType,
    lineno: int,
    root: str,
    include: Sequence[str] = (),
    exclude: Sequence[str] = (),
) -> Dict[str, Any]:
    code = frame.f_code
    filename = code.co_filename
    module = frame.f_globals.get("__name__")
    out: Dict[str, Any] = {
        "filename": _relative(filename, root) if not filename.startswith("<") else filename,
        "function": getattr(code, "co_qualname", code.co_name),
        "lineno": lineno,
        "in_app": is_in_app(filename, module, include, exclude),
    }
    if isinstance(module, str):
        # El agrupamiento usa el módulo (no la ruta): es el mismo en todas las máquinas y despliegues.
        out["module"] = module
    if not filename.startswith("<"):
        out["abs_path"] = os.path.abspath(filename)
        lines = linecache.getlines(filename, frame.f_globals)
        if lines and 0 < lineno <= len(lines):
            out["context_line"] = lines[lineno - 1].rstrip("\n")
            out["pre_context"] = [l.rstrip("\n") for l in lines[max(0, lineno - 1 - CONTEXT_LINES) : lineno - 1]]
            out["post_context"] = [l.rstrip("\n") for l in lines[lineno : lineno + CONTEXT_LINES]]
    return out


def frames_from_traceback(
    tb: Optional[TracebackType],
    root: str,
    include: Sequence[str] = (),
    exclude: Sequence[str] = (),
) -> List[Dict[str, Any]]:
    import traceback

    frames = [frame_info(f, n, root, include, exclude) for f, n in traceback.walk_tb(tb)]
    return frames[-MAX_FRAMES:]


def frames_from_stack(
    frames: Iterable[FrameType],
    root: str,
    include: Sequence[str] = (),
    exclude: Sequence[str] = (),
) -> List[Dict[str, Any]]:
    return [frame_info(f, f.f_lineno, root, include, exclude) for f in frames][-MAX_FRAMES:]
