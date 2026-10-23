import argparse
import getpass
import json

from .db import database_tables, delete_employee_data, initialize
from .settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove dados de uso de um colaborador do banco do backend.")
    parser.add_argument("--employee-id", required=True, help="ID confirmado do colaborador")
    parser.add_argument("--confirm-employee-id", required=True, help="Repita o ID para confirmar a exclusão")
    args = parser.parse_args()
    if args.employee_id != args.confirm_employee_id:
        parser.error("os IDs não coincidem; nenhuma exclusão foi feita")
    if not 1 <= len(args.employee_id) <= 128 or any(char not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._@:-" for char in args.employee_id):
        parser.error("ID de colaborador inválido; nenhuma exclusão foi feita")

    settings = get_settings()
    if not settings.uses_postgres and not settings.database_path.is_file():
        parser.error(f"banco não encontrado em {settings.database_path}; nenhuma exclusão foi feita")
    tables = database_tables(settings)
    if not {"interactions", "machines", "employees"}.issubset(tables):
        parser.error("o arquivo não parece ser o banco ativo do backend; nenhuma exclusão foi feita")
    initialize(settings)
    counts = delete_employee_data(settings, args.employee_id, f"os-user:{getpass.getuser()}")
    print(json.dumps({"deleted": counts, "total_records": sum(counts.values())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
