from pathlib import Path

import pytest

from app.db import connect, initialize
from app.roster import apply_roster, load_roster
from app.settings import get_settings


def test_roster_import_is_idempotent_and_preserves_missing_employees(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "roster.sqlite3"))
    get_settings.cache_clear()
    settings = get_settings()
    initialize(settings)
    source = tmp_path / "roster.csv"
    source.write_text(
        "código funcionário;nome;código departamento;departamento;ativo\n"
        "func-001;Pessoa Sintética A;dep-01;Departamento Sintético;sim\n"
        "func-002;Pessoa Sintética B;dep-01;Departamento Sintético;não\n",
        encoding="utf-8",
    )
    roster = load_roster(source)

    apply_roster(roster, settings)
    apply_roster(roster, settings)

    source.write_text(
        "employee_id,person_name,department_code,department_name\n"
        "func-001,Pessoa Sintética Atualizada,dep-01,Departamento Sintético\n",
        encoding="utf-8",
    )
    apply_roster(load_roster(source), settings)
    with connect(settings) as db:
        employees = db.execute(
            "SELECT employee_id, person_name, active FROM employees ORDER BY employee_id"
        ).fetchall()
        departments = db.execute("SELECT COUNT(*) FROM departments").fetchone()[0]
    assert departments == 1
    assert [tuple(row) for row in employees] == [
        ("func-001", "Pessoa Sintética Atualizada", 1),
        ("func-002", "Pessoa Sintética B", 0),
    ]
    get_settings.cache_clear()


def test_roster_rejects_duplicate_employee_before_writing(tmp_path):
    source = Path(tmp_path) / "duplicate.csv"
    source.write_text(
        "employee_id,person_name,department_code,department_name\n"
        "func-001,Pessoa A,dep-01,Departamento\n"
        "func-001,Pessoa B,dep-01,Departamento\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="colaborador duplicado"):
        load_roster(source)


def test_roster_accepts_company_sheet_layout(tmp_path):
    source = Path(tmp_path) / "company.csv"
    source.write_text(
        "Departamentos ,Codigo ,,Funcionario,Codigo,Departamento\n"
        "Departamento Sintetico,DEP-01,,Pessoa Sintetica A,COLAB-001,Departamento Sintetico\n"
        ",,,Pessoa Sintetica B,COLAB-002,Departamento Sintetico\n",
        encoding="utf-8",
    )

    roster = load_roster(source)

    assert [(item.code, item.name) for item in roster.departments] == [
        ("DEP-01", "Departamento Sintetico")
    ]
    assert [(item.employee_id, item.department_code) for item in roster.employees] == [
        ("COLAB-001", "DEP-01"),
        ("COLAB-002", "DEP-01"),
    ]
