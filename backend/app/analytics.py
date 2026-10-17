from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from .db import connect, iso
from .security import require_operator_token
from .settings import Settings, get_settings


router = APIRouter(prefix="/v1/admin/analytics", tags=["analytics"])


def _normalize_period(start: datetime | None, end: datetime | None) -> tuple[datetime | None, datetime | None]:
    if start is not None and start.tzinfo is None:
        raise HTTPException(status_code=422, detail="from must include a timezone")
    if end is not None and end.tzinfo is None:
        raise HTTPException(status_code=422, detail="to must include a timezone")
    start = start.astimezone(timezone.utc) if start else None
    end = end.astimezone(timezone.utc) if end else None
    if start and end and start >= end:
        raise HTTPException(status_code=422, detail="from must be earlier than to")
    return start, end


def _interaction_filter(department_code: str | None, start: datetime | None,
                        end: datetime | None) -> tuple[str, list[str]]:
    clauses: list[str] = []
    values: list[str] = []
    if department_code is not None:
        clauses.append("i.department_code = ?")
        values.append(department_code)
    if start is not None:
        clauses.append("i.received_at >= ?")
        values.append(iso(start))
    if end is not None:
        clauses.append("i.received_at < ?")
        values.append(iso(end))
    return (" AND ".join(clauses) or "1 = 1"), values


def _event_count(db, table: str, department_code: str | None,
                 start: datetime | None, end: datetime | None) -> int:
    clauses: list[str] = []
    values: list[str] = []
    if department_code is not None:
        clauses.append("department_code = ?")
        values.append(department_code)
    if start is not None:
        clauses.append("received_at >= ?")
        values.append(iso(start))
    if end is not None:
        clauses.append("received_at < ?")
        values.append(iso(end))
    where = " AND ".join(clauses) or "1 = 1"
    return db.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", values).fetchone()[0]


@router.get("/summary")
def analytics_summary(
    start: datetime | None = Query(default=None, alias="from"),
    end: datetime | None = Query(default=None, alias="to"),
    department_code: str | None = Depends(require_operator_token),
    settings: Settings = Depends(get_settings),
) -> dict:
    start, end = _normalize_period(start, end)
    where, values = _interaction_filter(department_code, start, end)
    with connect(settings) as db:
        rows = db.execute(
            f"""SELECT
                    COALESCE(i.employee_id, 'unknown') AS employee_id,
                    MAX(COALESCE(i.attributed_person, 'Não atribuído')) AS person_name,
                    COALESCE(i.department_code, 'unknown') AS department_code,
                    MAX(COALESCE(d.department_name, i.department_code, 'Não atribuído')) AS department_name,
                    COUNT(DISTINCT i.interaction_id) AS interactions,
                    COUNT(r.response_id) AS responses,
                    SUM(CASE WHEN r.capture_status = 'complete' THEN 1 ELSE 0 END) AS complete_responses,
                    SUM(CASE WHEN r.capture_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_responses,
                    MAX(COALESCE(r.received_at, i.received_at)) AS last_activity_at
                FROM interactions i
                LEFT JOIN responses r ON r.interaction_id = i.interaction_id
                LEFT JOIN departments d ON d.department_code = i.department_code
                WHERE {where}
                GROUP BY COALESCE(i.employee_id, 'unknown'), COALESCE(i.department_code, 'unknown')
                ORDER BY interactions DESC, employee_id""",
            values,
        ).fetchall()
        streams = _event_count(db, "stream_captures", department_code, start, end)
        artifacts = _event_count(db, "artifact_metadata", department_code, start, end)

    employees = [dict(row) for row in rows]
    departments: dict[str, dict] = defaultdict(lambda: {
        "interactions": 0,
        "responses": 0,
        "complete_responses": 0,
        "incomplete_responses": 0,
        "last_activity_at": None,
    })
    for employee in employees:
        department = departments[employee["department_code"]]
        department["department_name"] = employee["department_name"]
        for field in ("interactions", "responses", "complete_responses", "incomplete_responses"):
            department[field] += employee[field]
        if employee["last_activity_at"] and (
                department["last_activity_at"] is None or
                employee["last_activity_at"] > department["last_activity_at"]):
            department["last_activity_at"] = employee["last_activity_at"]
    by_department = [
        {"department_code": code, **totals}
        for code, totals in sorted(departments.items())
    ]
    totals = {
        "interactions": sum(item["interactions"] for item in employees),
        "responses": sum(item["responses"] for item in employees),
        "complete_responses": sum(item["complete_responses"] for item in employees),
        "incomplete_responses": sum(item["incomplete_responses"] for item in employees),
        "stream_captures": streams,
        "artifact_metadata": artifacts,
    }
    return {
        "period": {"from": iso(start) if start else None, "to": iso(end) if end else None},
        "department_scope": department_code,
        "totals": totals,
        "by_department": by_department,
        "by_employee": employees,
    }
