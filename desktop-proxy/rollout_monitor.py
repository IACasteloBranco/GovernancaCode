"""Watch rollout file metadata without opening rollout contents."""

from __future__ import annotations

import argparse
import json
import math
import os
import stat
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal


ChangeKind = Literal["created", "grew", "shrank", "modified", "replaced", "missing"]


@dataclass(frozen=True)
class _FileState:
    size_bytes: int
    modified_ns: int
    identity: tuple[int, int] | None


@dataclass(frozen=True)
class FileChange:
    event_type: Literal["file_change"]
    change: ChangeKind
    relative_path: str
    previous_size_bytes: int | None
    size_bytes: int | None
    modified_ns: int | None
    observed_at: str


@dataclass(frozen=True)
class MonitorStatus:
    event_type: Literal["monitor_status"]
    status: Literal["baseline", "scan_error", "recovered"]
    file_count: int | None
    error_class: str | None
    observed_at: str


MonitorEvent = FileChange | MonitorStatus


def _observed_at() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _is_reparse_point(info: os.stat_result) -> bool:
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & reparse_flag)


def _scan(root: Path) -> dict[str, _FileState]:
    root_info = root.stat(follow_symlinks=False)
    if not stat.S_ISDIR(root_info.st_mode) or _is_reparse_point(root_info):
        raise NotADirectoryError

    files: dict[str, _FileState] = {}
    pending = [root]
    while pending:
        directory = pending.pop()
        with os.scandir(directory) as entries:
            for entry in entries:
                if entry.is_symlink():
                    continue
                info = entry.stat(follow_symlinks=False)
                if _is_reparse_point(info):
                    continue
                if stat.S_ISDIR(info.st_mode):
                    pending.append(Path(entry.path))
                elif (stat.S_ISREG(info.st_mode) and entry.name.startswith("rollout-")
                      and entry.name.endswith(".jsonl")):
                    relative_path = Path(entry.path).relative_to(root).as_posix()
                    identity = (info.st_dev, info.st_ino) if info.st_ino else None
                    files[relative_path] = _FileState(
                        size_bytes=info.st_size,
                        modified_ns=info.st_mtime_ns,
                        identity=identity,
                    )
    return files


class RolloutMonitor:
    """Poll one sessions directory and emit changes only after complete scans."""

    def __init__(self, root: Path):
        self._root = Path(root).expanduser()
        self._baseline: dict[str, _FileState] | None = None
        self._last_error: str | None = None

    def poll(self) -> list[MonitorEvent]:
        observed_at = _observed_at()
        try:
            current = _scan(self._root)
        except OSError as exc:
            error_class = type(exc).__name__
            if error_class == self._last_error:
                return []
            self._last_error = error_class
            return [MonitorStatus("monitor_status", "scan_error", None, error_class, observed_at)]

        events: list[MonitorEvent] = []
        if self._last_error is not None:
            events.append(MonitorStatus("monitor_status", "recovered", len(current), None, observed_at))
            self._last_error = None
        if self._baseline is None:
            self._baseline = current
            events.append(MonitorStatus("monitor_status", "baseline", len(current), None, observed_at))
            return events

        for relative_path in sorted(self._baseline.keys() | current.keys()):
            previous = self._baseline.get(relative_path)
            after = current.get(relative_path)
            if previous == after:
                continue

            change: ChangeKind
            if previous is None:
                change = "created"
            elif after is None:
                change = "missing"
            elif (previous.identity is not None and after.identity is not None
                  and previous.identity != after.identity):
                change = "replaced"
            elif after.size_bytes > previous.size_bytes:
                change = "grew"
            elif after.size_bytes < previous.size_bytes:
                change = "shrank"
            else:
                change = "modified"
            events.append(FileChange(
                event_type="file_change",
                change=change,
                relative_path=relative_path,
                previous_size_bytes=previous.size_bytes if previous else None,
                size_bytes=after.size_bytes if after else None,
                modified_ns=after.modified_ns if after else None,
                observed_at=observed_at,
            ))

        self._baseline = current
        return events


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.home() / ".codex" / "sessions")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds between metadata scans")
    args = parser.parse_args(argv)
    if not math.isfinite(args.interval) or args.interval <= 0:
        parser.error("--interval must be a positive finite number")

    monitor = RolloutMonitor(args.root)
    try:
        while True:
            for event in monitor.poll():
                print(json.dumps(asdict(event), ensure_ascii=False), flush=True)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
