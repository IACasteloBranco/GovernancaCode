"""Operator action: bind an enrolled extension installation to a roster employee."""

import argparse
import re
from uuid import UUID

from app.db import begin_write, connect, initialize, iso, utc_now
from app.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Atribui uma instalação cadastrada a um colaborador.")
    parser.add_argument("installation_id", type=UUID)
    employee = parser.add_mutually_exclusive_group()
    employee.add_argument("--employee-id", help="ID do colaborador cadastrado")
    employee.add_argument("--approve-request", action="store_true", help="Aprova o ID solicitado pelo popup")
    parser.add_argument("--project-id", help="ID legado opcional; não restringe os chats capturados")
    parser.add_argument("--fingerprint-prefix", required=True,
                        help="Primeiros 16 caracteres da chave mostrados no popup")
    args = parser.parse_args()
    employee_id = args.employee_id.strip() if args.employee_id else None
    project = args.project_id.strip() if args.project_id else None
    identifier = re.compile(r"[A-Za-z0-9._@:-]{1,128}")
    if (not (employee_id or args.approve_request) or
            (employee_id and not identifier.fullmatch(employee_id)) or
            (project and (not project.startswith("g-p-") or not project[4:].isalnum() or len(project) > 128))):
        parser.error("Informe --employee-id ou --approve-request e um ID de projeto válido")
    settings = get_settings()
    initialize(settings)
    with connect(settings) as db:
        begin_write(db, "machines")
        row = db.execute(
            """SELECT key_fingerprint, google_sub, revoked_at, requested_employee_id
               FROM machines WHERE installation_id = ?""",
            (str(args.installation_id),),
        ).fetchone()
        if row is None:
            parser.error("Instalação não cadastrada; use primeiro o popup da extensão")
        prefix = args.fingerprint_prefix.strip().lower()
        if len(prefix) < 16 or not row["key_fingerprint"].startswith(prefix):
            parser.error("Impressão digital da chave não confere com a instalação")
        if row["revoked_at"]:
            parser.error("Instalação revogada")
        if args.approve_request:
            employee_id = row["requested_employee_id"]
            if not employee_id:
                parser.error("Não existe pedido de atribuição pendente")
        assert employee_id is not None
        employee_row = db.execute(
            """SELECT e.person_name, e.department_code
               FROM employees e JOIN departments d USING (department_code)
               WHERE e.employee_id = ? AND e.active = 1 AND d.active = 1""",
            (employee_id,),
        ).fetchone()
        if employee_row is None:
            parser.error("Colaborador não encontrado ou inativo no cadastro")
        name = employee_row["person_name"]
        department_code = employee_row["department_code"]
        if settings.app_env.lower() == "lab" and (
                not row["google_sub"] or not settings.allows_pilot_department(department_code)):
            parser.error("Instalação sem conta Google vinculada ou fora do setor piloto")
        if args.approve_request:
            print(f"Pedido: {employee_id} — {name} ({department_code})")
            print(f"Instalação: {args.installation_id}; chave: {row['key_fingerprint'][:16]}")
            if input("Confirma a atribuição? [s/N] ").strip().lower() not in {"s", "sim"}:
                parser.exit(1, "Atribuição cancelada.\n")
        cursor = db.execute(
            """UPDATE machines
               SET person_name = ?, employee_id = ?, department_code = ?, project_id = ?, assigned_at = ?,
                   requested_employee_id = NULL, requested_at = NULL
               WHERE installation_id = ? AND (? = 0 OR requested_employee_id = ?)""",
            (name, employee_id, department_code, project, iso(utc_now()), str(args.installation_id),
             int(args.approve_request), employee_id if args.approve_request else None),
        )
        if cursor.rowcount != 1:
            parser.error("O pedido mudou durante a confirmação; atualize a identificação e tente novamente")
    print(f"Instalação {args.installation_id} atribuída a {name} ({department_code}); chave {row['key_fingerprint'][:16]}...")


if __name__ == "__main__":
    main()
