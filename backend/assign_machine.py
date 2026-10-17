"""Operator action: bind an enrolled extension installation to a roster employee."""

import argparse
import re
from uuid import UUID

from app.db import connect, initialize, iso, utc_now
from app.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Atribui uma instalação cadastrada a um colaborador.")
    parser.add_argument("installation_id", type=UUID)
    parser.add_argument("--employee-id", required=True)
    parser.add_argument("--project-id", help="ID legado opcional; não restringe os chats capturados")
    parser.add_argument("--fingerprint-prefix", required=True,
                        help="Primeiros 16 caracteres da chave mostrados no popup")
    args = parser.parse_args()
    employee_id = args.employee_id.strip()
    project = args.project_id.strip() if args.project_id else None
    identifier = re.compile(r"[A-Za-z0-9._@:-]{1,128}")
    if (not identifier.fullmatch(employee_id) or
            (project and (not project.startswith("g-p-") or not project[4:].isalnum() or len(project) > 128))):
        parser.error("ID do colaborador ou ID do projeto inválido")
    settings = get_settings()
    initialize(settings)
    with connect(settings) as db:
        employee = db.execute(
            """SELECT e.person_name, e.department_code
               FROM employees e JOIN departments d USING (department_code)
               WHERE e.employee_id = ? AND e.active = 1 AND d.active = 1""",
            (employee_id,),
        ).fetchone()
        if employee is None:
            parser.error("Colaborador não encontrado ou inativo no cadastro")
        name = employee["person_name"]
        department_code = employee["department_code"]
        row = db.execute(
            "SELECT key_fingerprint, google_sub, revoked_at FROM machines WHERE installation_id = ?",
            (str(args.installation_id),),
        ).fetchone()
        if row is None:
            parser.error("Instalação não cadastrada; use primeiro o popup da extensão")
        prefix = args.fingerprint_prefix.strip().lower()
        if len(prefix) < 16 or not row["key_fingerprint"].startswith(prefix):
            parser.error("Impressão digital da chave não confere com a instalação")
        if row["revoked_at"]:
            parser.error("Instalação revogada")
        if settings.app_env.lower() == "lab" and (
                not row["google_sub"] or department_code != settings.pilot_department_code):
            parser.error("Instalação sem conta Google vinculada ou fora do setor piloto")
        db.execute(
            """UPDATE machines
               SET person_name = ?, employee_id = ?, department_code = ?, project_id = ?, assigned_at = ?
               WHERE installation_id = ?""",
            (name, employee_id, department_code, project, iso(utc_now()), str(args.installation_id)),
        )
    print(f"Instalação {args.installation_id} atribuída a {name} ({department_code}); chave {row['key_fingerprint'][:16]}...")


if __name__ == "__main__":
    main()
