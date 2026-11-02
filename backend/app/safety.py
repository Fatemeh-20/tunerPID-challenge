"""Basic static checks for uploaded dynamics files.

The engine *executes* the uploaded file, so we scan its AST first. This is
basic hardening (allow-listed imports, no dangerous builtins, no dunder
tricks) -- it is NOT a sandbox. See the README for the limitations.
"""
import ast

ALLOWED_IMPORTS = frozenset(
    {
        "numpy", "math", "cmath", "typing", "functools", "itertools",
        "collections", "dataclasses", "numbers", "__future__",
    }
)
BLOCKED_CALLS = frozenset(
    {
        "eval", "exec", "compile", "open", "__import__", "getattr", "setattr",
        "delattr", "globals", "locals", "vars", "input", "breakpoint", "exit", "quit",
    }
)
# File / pickle access reachable through numpy
BLOCKED_ATTRIBUTES = frozenset(
    {
        "load", "loads", "loadtxt", "genfromtxt", "fromfile", "tofile", "save",
        "savez", "savetxt", "memmap", "ctypeslib", "f2py", "system", "popen",
    }
)


class UnsafeCodeError(ValueError):
    """The uploaded file failed the static safety check."""


def _check_module(name: str, line: int) -> None:
    root = name.split(".")[0]
    if root not in ALLOWED_IMPORTS:
        allowed = ", ".join(sorted(ALLOWED_IMPORTS - {"__future__"}))
        raise UnsafeCodeError(
            f"Line {line}: import of '{name}' is not allowed (allowed modules: {allowed})"
        )


def check_source(source: str) -> None:
    """Raise UnsafeCodeError if the source looks dangerous or is not valid Python."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise UnsafeCodeError(f"Syntax error on line {exc.lineno}: {exc.msg}") from exc

    for node in ast.walk(tree):
        line = getattr(node, "lineno", 0)
        if isinstance(node, ast.Import):
            for alias in node.names:
                _check_module(alias.name, line)
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                raise UnsafeCodeError(f"Line {line}: relative imports are not allowed")
            _check_module(node.module or "", line)
        elif isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in BLOCKED_CALLS:
                raise UnsafeCodeError(f"Line {line}: call to '{func.id}()' is not allowed")
        elif isinstance(node, ast.Attribute):
            if node.attr in BLOCKED_ATTRIBUTES or (
                node.attr.startswith("__") and node.attr.endswith("__")
            ):
                raise UnsafeCodeError(f"Line {line}: access to '.{node.attr}' is not allowed")
        elif isinstance(node, ast.Name):
            if node.id.startswith("__") and node.id.endswith("__") and node.id != "__name__":
                raise UnsafeCodeError(f"Line {line}: use of '{node.id}' is not allowed")
