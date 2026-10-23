import csv
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from .db import begin_write, connect, iso, utc_now
from .settings import Settings


IDENTIFIER = re.compile(r"[A-Za-z0-9._@:-]{1,128}")
HEADER_ALIASES = {
    "employee_id": {"employee_id", "codigo_funcionario", "codigo_colaborador", "id_colaborador"},
    "person_name": {"person_name", "nome", "nome_colaborador", "colaborador"},
    "department_code": {"department_code", "codigo_departamento", "id_departamento"},
    "department_name": {"department_name", "departamento", "nome_departamento"},
    "active": {"active", "ativo"},
}
TRUE_VALUES = {"1", "true", "sim", "yes", "ativo"}
FALSE_VALUES = {"0", "false", "nao", "não", "no", "inativo"}


@dataclass(frozen=True)
class Department:
    code: str
    name: str
    active: bool


@dataclass(frozen=True)
class Employee:
    employee_id: str
    person_name: str
    department_code: str
    active: bool


@dataclass(frozen=True)
class Roster:
    departments: tuple[Department, ...]
    employees: tuple[Employee, ...]


def _normalize_header(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return normalized.strip().lower().replace(" ", "_")


def _canonical_headers(fieldnames: list[str] | None) -> dict[str, str]:
    if not fieldnames:
        raise ValueError("CSV sem cabeçalho")
    mapped: dict[str, str] = {}
    for original in fieldnames:
        normalized = _normalize_header(original)
        canonical = next((name for name, aliases in HEADER_ALIASES.items() if normalized in aliases), None)
        if canonical is None:
            raise ValueError(f"Coluna desconhecida: {original}")
        if canonical in mapped:
            raise ValueError(f"Coluna duplicada: {canonical}")
        mapped[canonical] = original
    required = set(HEADER_ALIASES) - {"active"}
    missing = sorted(required - set(mapped))
    if missing:
        raise ValueError(f"Colunas obrigatórias ausentes: {', '.join(missing)}")
    return mapped


def _load_company_sheet(rows: list[list[str]]) -> Roster:
    departments_by_name: dict[str, Department] = {}
    employees: dict[str, Employee] = {}
    for row_number, row in enumerate(rows[1:], start=2):
        row += [""] * (6 - len(row))
        department_name, department_code = row[0].strip(), row[1].strip()
        if department_name or department_code:
            if not department_name or len(department_name) > 160 or not IDENTIFIER.fullmatch(department_code):
                raise ValueError(f"Linha {row_number}: departamento invalido")
            existing = departments_by_name.get(department_name)
            if existing and existing.code != department_code:
                raise ValueError(f"Linha {row_number}: codigos diferentes para o departamento {department_name}")
            departments_by_name[department_name] = Department(department_code, department_name, True)

    for row_number, row in enumerate(rows[1:], start=2):
        row += [""] * (6 - len(row))
        person_name, employee_id, department_name = (row[index].strip() for index in (3, 4, 5))
        if not (person_name or employee_id or department_name):
            continue
        department = departments_by_name.get(department_name)
        if (not person_name or len(person_name) > 160 or not IDENTIFIER.fullmatch(employee_id)
                or department is None):
            raise ValueError(f"Linha {row_number}: colaborador invalido")
        if employee_id in employees:
            raise ValueError(f"Linha {row_number}: colaborador duplicado: {employee_id}")
        employees[employee_id] = Employee(employee_id, person_name, department.code, True)

    if not employees:
        raise ValueError("CSV sem colaboradores")
    return Roster(tuple(departments_by_name.values()), tuple(employees.values()))


def _active(value: str | None, row_number: int) -> bool:
    normalized = (value or "true").strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise ValueError(f"Linha {row_number}: valor de active inválido")


def load_roster(path: Path) -> Roster:
    text = path.read_text(encoding="utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(text.splitlines(), dialect=dialect))
    normalized = [_normalize_header(value) for value in rows[0]] if rows else []
    if normalized[:6] == ["departamentos", "codigo", "", "funcionario", "codigo", "departamento"]:
        return _load_company_sheet(rows)
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    headers = _canonical_headers(reader.fieldnames)
    departments: dict[str, Department] = {}
    employees: dict[str, Employee] = {}
    for row_number, row in enumerate(reader, start=2):
        if None in row:
            raise ValueError(f"Linha {row_number}: quantidade de colunas inválida")
        if not any((value or "").strip() for value in row.values()):
            continue
        employee_id = (row[headers["employee_id"]] or "").strip()
        person_name = (row[headers["person_name"]] or "").strip()
        department_code = (row[headers["department_code"]] or "").strip()
        department_name = (row[headers["department_name"]] or "").strip()
        active = _active(row.get(headers.get("active", "")), row_number)
        if not IDENTIFIER.fullmatch(employee_id) or not IDENTIFIER.fullmatch(department_code):
            raise ValueError(f"Linha {row_number}: código de colaborador ou departamento inválido")
        if not person_name or len(person_name) > 160 or not department_name or len(department_name) > 160:
            raise ValueError(f"Linha {row_number}: nome de colaborador ou departamento inválido")
        if employee_id in employees:
            raise ValueError(f"Linha {row_number}: colaborador duplicado: {employee_id}")
        department = Department(department_code, department_name, True)
        existing_department = departments.get(department_code)
        if existing_department and existing_department.name != department_name:
            raise ValueError(f"Linha {row_number}: nomes diferentes para o departamento {department_code}")
        departments[department_code] = department
        employees[employee_id] = Employee(employee_id, person_name, department_code, active)
    if not employees:
        raise ValueError("CSV sem colaboradores")
    return Roster(tuple(departments.values()), tuple(employees.values()))


def apply_roster(roster: Roster, settings: Settings) -> None:
    now = iso(utc_now())
    with connect(settings) as db:
        begin_write(db, "departments", "employees")
        for department in roster.departments:
            db.execute(
                """INSERT INTO departments(department_code, department_name, active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(department_code) DO UPDATE SET
                     department_name = excluded.department_name,
                     active = excluded.active,
                     updated_at = excluded.updated_at""",
                (department.code, department.name, int(department.active), now, now),
            )
        for employee in roster.employees:
            db.execute(
                """INSERT INTO employees(employee_id, person_name, department_code, active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(employee_id) DO UPDATE SET
                     person_name = excluded.person_name,
                     department_code = excluded.department_code,
                     active = excluded.active,
                     updated_at = excluded.updated_at""",
                (employee.employee_id, employee.person_name, employee.department_code,
                 int(employee.active), now, now),
            )
