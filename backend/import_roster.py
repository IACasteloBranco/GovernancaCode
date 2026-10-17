"""Validate and import the employee roster into the backend database."""

import argparse
from pathlib import Path

from app.db import initialize
from app.roster import apply_roster, load_roster
from app.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida e importa colaboradores e departamentos.")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--apply", action="store_true", help="Grava o cadastro após a validação")
    args = parser.parse_args()
    try:
        roster = load_roster(args.csv_path)
    except (OSError, UnicodeError, ValueError) as error:
        parser.error(str(error))
    print(f"Validação concluída: {len(roster.employees)} colaboradores, {len(roster.departments)} departamentos.")
    if not args.apply:
        print("Nenhuma alteração gravada. Use --apply para importar.")
        return
    settings = get_settings()
    initialize(settings)
    apply_roster(roster, settings)
    print("Cadastro importado.")


if __name__ == "__main__":
    main()
