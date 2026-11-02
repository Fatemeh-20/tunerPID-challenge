"""In-memory registry of uploaded systems (no database needed)."""
import threading
from collections import OrderedDict
from dataclasses import dataclass, field

from src.core.dynamics import DynamicalSystem

MAX_SYSTEMS = 50  # oldest uploads are evicted so memory cannot grow forever


@dataclass
class StoredSystem:
    system_id: str
    name: str
    system: DynamicalSystem
    # The engine keeps simulation settings on the system object, so two
    # simultaneous runs on the same system must not interleave.
    lock: threading.Lock = field(default_factory=threading.Lock)


class SystemStore:
    def __init__(self, max_systems: int = MAX_SYSTEMS) -> None:
        self._items: "OrderedDict[str, StoredSystem]" = OrderedDict()
        self._max = max_systems
        self._guard = threading.Lock()

    def add(self, item: StoredSystem) -> None:
        with self._guard:
            self._items[item.system_id] = item
            while len(self._items) > self._max:
                self._items.popitem(last=False)

    def get(self, system_id: str) -> StoredSystem:
        """Raises KeyError if the id is unknown."""
        with self._guard:
            return self._items[system_id]

    def clear(self) -> None:
        with self._guard:
            self._items.clear()


store = SystemStore()
