"""Revoke one enrolled installation without deleting its capture history."""

import argparse
from uuid import UUID

from app.db import begin_write, connect, initialize, iso, utc_now
from app.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Revoga uma instalação cadastrada.")
    parser.add_argument("installation_id", type=UUID)
    parser.add_argument("--fingerprint-prefix", required=True)
    args = parser.parse_args()
    settings = get_settings()
    initialize(settings)
    with connect(settings) as db:
        begin_write(db, "machines")
        row = db.execute("SELECT key_fingerprint, revoked_at FROM machines WHERE installation_id = ?",
                         (str(args.installation_id),)).fetchone()
        if row is None or len(args.fingerprint_prefix) < 16 or not row["key_fingerprint"].startswith(args.fingerprint_prefix.lower()):
            parser.error("Instalação ou impressão digital inválida")
        if not row["revoked_at"]:
            db.execute("UPDATE machines SET revoked_at = ? WHERE installation_id = ?",
                       (iso(utc_now()), str(args.installation_id)))
    print(f"Instalação {args.installation_id} revogada")


if __name__ == "__main__":
    main()
