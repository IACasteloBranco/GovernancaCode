"""Operator action: bind an enrolled extension installation to a person and project."""

import argparse
from uuid import UUID

from app.db import connect, initialize, iso, utc_now
from app.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Atribui uma instalação cadastrada a uma pessoa.")
    parser.add_argument("installation_id", type=UUID)
    parser.add_argument("person_name")
    parser.add_argument("project_id", nargs="?", help="ID legado opcional; não restringe os chats capturados")
    parser.add_argument("--fingerprint-prefix", required=True, help="Primeiros 16 caracteres da chave mostrados no popup")
    args = parser.parse_args()
    name = args.person_name.strip()
    project = args.project_id.strip() if args.project_id else None
    if not name or len(name) > 160 or (project and (not project.startswith("g-p-") or
        not project[4:].isalnum() or len(project) > 128)):
        parser.error("Nome ou ID do projeto inválido")
    settings = get_settings()
    initialize(settings)
    with connect(settings) as db:
        row = db.execute("SELECT key_fingerprint FROM machines WHERE installation_id = ?",
                         (str(args.installation_id),)).fetchone()
        if row is None:
            parser.error("Instalação não cadastrada; use primeiro o popup da extensão")
        prefix = args.fingerprint_prefix.strip().lower()
        if len(prefix) < 16 or not row["key_fingerprint"].startswith(prefix):
            parser.error("Impressão digital da chave não confere com a instalação")
        db.execute("UPDATE machines SET person_name = ?, project_id = ?, assigned_at = ? WHERE installation_id = ?",
                   (name, project, iso(utc_now()), str(args.installation_id)))
    print(f"Instalação {args.installation_id} atribuída a {name}; chave {row['key_fingerprint'][:16]}...")


if __name__ == "__main__":
    main()
