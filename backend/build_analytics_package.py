from __future__ import annotations

import argparse
import hashlib
import os
import stat
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "reports" / "analytics-backend-lab.zip"
FIXED_FILES = (
    "backend/requirements.txt",
    "backend/.env.example",
    "analytics/index.html",
)
SKIPPED_DIRS = {"tests", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
ZIP_TIME = (1980, 1, 1, 0, 0, 0)


@dataclass(frozen=True)
class Member:
    name: str
    data: bytes


def _read_member(root: Path, name: str) -> Member:
    path = root.joinpath(*PurePosixPath(name).parts)
    current = path
    while current != root:
        if current.is_symlink():
            raise ValueError(f"Symlink is not allowed in package input: {name}")
        current = current.parent
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root) or not stat.S_ISREG(resolved.stat().st_mode):
        raise ValueError(f"Package input must be a regular file under the repository: {name}")
    return Member(name, resolved.read_bytes())


def collect_members(root: Path) -> tuple[Member, ...]:
    app = root / "backend" / "app"
    if app.is_symlink() or not app.is_dir() or any(path.is_symlink() for path in app.rglob("*")):
        raise ValueError("backend/app must be a real directory without symlinks")

    names = [
        path.relative_to(root).as_posix()
        for path in app.rglob("*.py")
        if path.is_file()
        and not any(part.lower() in SKIPPED_DIRS for part in path.relative_to(root).parts[:-1])
        and not path.name.lower().startswith("test_")
        and not path.name.lower().endswith("_test.py")
    ]
    if not names:
        raise ValueError("No backend/app Python files were found")
    names.extend(FIXED_FILES)
    if len(names) != len(set(names)):
        raise ValueError("Package input paths contain duplicates")

    members = tuple(_read_member(root, name) for name in sorted(names))
    example = next(member.data for member in members if member.name == "backend/.env.example")
    for line in example.decode("utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip().upper().endswith(("_TOKEN", "_SECRET", "_PASSWORD", "_API_KEY")) and value.strip():
            raise ValueError(f"Sensitive example setting must be empty: {key.strip()}")
    return members


def _validate_archive(path: Path, members: tuple[Member, ...]) -> None:
    expected = {member.name: member.data for member in members}
    with zipfile.ZipFile(path, "r") as archive:
        names = [item.filename for item in archive.infolist()]
        if len(names) != len(set(names)) or set(names) != set(expected):
            raise ValueError("Archive member list does not match the package inputs")
        for name in names:
            member = PurePosixPath(name)
            if member.is_absolute() or ".." in member.parts or "\\" in name:
                raise ValueError(f"Unsafe archive path: {name}")
        if archive.testzip() is not None:
            raise ValueError("Archive CRC validation failed")
        for name, data in expected.items():
            actual = archive.read(name)
            if hashlib.sha256(actual).digest() != hashlib.sha256(data).digest():
                raise ValueError(f"Archive content does not match package input: {name}")


def build_package(root: Path, output: Path) -> str:
    root = root.resolve(strict=True)
    output = output.resolve()
    if not output.is_relative_to(root):
        raise ValueError("Output path must stay under the repository")
    members = collect_members(root)
    source_paths = {root.joinpath(*PurePosixPath(member.name).parts).resolve() for member in members}
    if output in source_paths:
        raise ValueError("Output path cannot replace a package input")

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".zip.tmp", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_STORED) as archive:
            for member in members:
                info = zipfile.ZipInfo(member.name, ZIP_TIME)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                info.compress_type = zipfile.ZIP_STORED
                archive.writestr(info, member.data)
        _validate_archive(temporary_path, members)
        os.replace(temporary_path, output)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    return hashlib.sha256(output.read_bytes()).hexdigest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build and verify the analytics backend lab package.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    digest = build_package(ROOT, args.output)
    with zipfile.ZipFile(args.output) as package:
        print(f"Validated {len(package.namelist())} files: {args.output}")
    print(f"SHA-256: {digest}")
