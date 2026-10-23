"""Apply the PostgreSQL schema before starting the API."""

from .db import migrate_postgres
from .settings import get_settings


if __name__ == "__main__":
    migrate_postgres(get_settings())
    print("Schema PostgreSQL aplicado na versão 1.0.")
