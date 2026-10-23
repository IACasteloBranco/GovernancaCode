"""Import an offline SQLite snapshot into an already migrated PostgreSQL database."""

import argparse
import sqlite3
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlsplit

from .db import SCHEMA_VERSION, _clean_expired, begin_write, connect
from .settings import get_settings

TABLES = (
    "machines", "departments", "employees", "interactions", "responses", "capture_events",
    "stream_captures", "artifact_metadata", "machine_nonces", "privacy_audit",
)
IDENTITIES = {"capture_events": "event_id", "privacy_audit": "audit_id"}
PRIMARY_KEYS = {
    "machines": ("installation_id",), "departments": ("department_code",),
    "employees": ("employee_id",), "interactions": ("interaction_id",),
    "responses": ("response_id",), "capture_events": ("event_id",),
    "stream_captures": ("capture_id",), "artifact_metadata": ("artifact_id",),
    "machine_nonces": ("installation_id", "nonce"), "privacy_audit": ("audit_id",),
}


def _columns(db: Any, table: str) -> list[str]:
    return [getattr(row, "name", row[0]) for row in db.execute(f"SELECT * FROM {table} LIMIT 0").description]


def _rows(source: sqlite3.Connection, table: str) -> Iterator[tuple[Any, ...]]:
    for row in source.execute(f'SELECT * FROM "{table}"'):
        yield tuple(row)


def _count(db: Any, table: str) -> int:
    return db.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()["count"]


def import_snapshot(path: Path, apply: bool, confirmation: str | None) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.uses_postgres:
        raise ValueError("DATABASE_URL precisa apontar para PostgreSQL")
    source = sqlite3.connect(f"file:{path.resolve().as_posix()}?mode=ro", uri=True)
    source.row_factory = sqlite3.Row
    try:
        source.execute("BEGIN")
        if source.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("O snapshot SQLite falhou em integrity_check")
        if source.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise ValueError("O snapshot SQLite contém referências inválidas")
        source_tables = {row[0] for row in source.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )}
        expected = {*TABLES, "schema_migrations"}
        if source_tables != expected:
            raise ValueError("Snapshot incompatível: são aceitas somente as tabelas da versão atual 1.0")
        versions = {row[0] for row in source.execute("SELECT version FROM schema_migrations")}
        if SCHEMA_VERSION not in versions:
            raise ValueError("Snapshot precisa estar migrado para a versão 1.0 antes da importação")
        source_counts = {table: source.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] for table in TABLES}
    except Exception:
        source.close()
        raise

    with connect(settings) as target:
        version = target.execute("SELECT version FROM schema_migrations WHERE version = ?", (SCHEMA_VERSION,)).fetchone()
        if version is None:
            raise ValueError("PostgreSQL sem schema 1.0; execute python -m app.migrate_database")
        parsed_target = urlsplit(settings.database_url.get_secret_value())
        host = f"{parsed_target.hostname}:{parsed_target.port}" if parsed_target.port else parsed_target.hostname
        target_name = f"{host}/{parsed_target.path.strip('/')}"
        before = {table: _count(target, table) for table in TABLES}
        for table in TABLES:
            if _columns(target, table) != [row["name"] for row in source.execute(f'PRAGMA table_info("{table}")')]:
                raise ValueError(f"Colunas incompatíveis em {table}")
        if not apply:
            source.close()
            return {"target": target_name, "source": sum(source_counts.values()),
                    "target_before": sum(before.values())}
        if confirmation != target_name:
            raise ValueError(f"Para gravar, informe --confirm-target {target_name}")
        begin_write(target, *TABLES)
        inserted = {}
        for table in TABLES:
            columns = _columns(target, table)
            placeholders = ", ".join("?" for _ in columns)
            quoted_columns = ", ".join(f'"{column}"' for column in columns)
            for values in _rows(source, table):
                keys = PRIMARY_KEYS[table]
                condition = " AND ".join(f'"{key}" = ?' for key in keys)
                key_values = tuple(values[columns.index(key)] for key in keys)
                existing = target.execute(f"SELECT {quoted_columns} FROM {table} WHERE {condition}", key_values).fetchone()
                if existing is not None and tuple(existing[column] for column in columns) != values:
                    raise ValueError(f"Conflito de dados em {table}; destino não foi confirmado")
                cursor = target.execute(
                    f"INSERT INTO {table} ({quoted_columns}) VALUES ({placeholders}) ON CONFLICT DO NOTHING", values
                )
                if existing is None and cursor.rowcount == 0:
                    raise ValueError(f"Conflito em chave única de {table}; destino não foi confirmado")
                inserted[table] = inserted.get(table, 0) + cursor.rowcount
        for table, column in IDENTITIES.items():
            target.execute(
                "SELECT setval(pg_get_serial_sequence(?, ?), GREATEST(COALESCE(MAX(" + column + "), 1), 1), "
                "COALESCE(MAX(" + column + ") IS NOT NULL, FALSE)) FROM " + table,
                (table, column),
            )
        after = {table: _count(target, table) for table in TABLES}
        if any(after[table] != before[table] + inserted[table] for table in TABLES):
            raise RuntimeError("A contagem final não corresponde ao snapshot; transação revertida")
        _clean_expired(target, settings)
        after = {table: _count(target, table) for table in TABLES}
        source.close()
        return {"target": target_name, "source": sum(source_counts.values()), "inserted": sum(inserted.values()),
                "target_before": sum(before.values()), "target_after": sum(after.values())}


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa snapshot SQLite para PostgreSQL")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--apply", action="store_true", help="grava; sem esta opção apenas confere compatibilidade")
    parser.add_argument("--confirm-target", help="confirma host/nome do banco PostgreSQL antes da escrita")
    args = parser.parse_args()
    try:
        result = import_snapshot(args.source, args.apply, args.confirm_target)
    except (OSError, sqlite3.Error, ValueError, RuntimeError) as error:
        parser.error(str(error))
    print("Importação concluída." if args.apply else "Prévia concluída; o destino não foi alterado.")
    print("Contagens agregadas:", result)


if __name__ == "__main__":
    main()
