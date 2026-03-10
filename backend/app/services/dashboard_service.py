from sqlmodel import Session, select, func, col
from app.models.project import Project
from app.models.matrix import MatrixEvaluation, QuestionCategory


def get_dashboard_stats(db: Session, user_id: int, role: str) -> dict:
    """
    admin/superadmin → estadísticas globales de todos los proyectos
    user             → estadísticas solo de sus proyectos
    """
    is_admin = role in ("admin", "superadmin")

    # Base query según rol
    base = select(Project)
    if not is_admin:
        base = base.where(Project.owner_id == user_id)

    projects = db.exec(base).all()
    project_ids = [p.id for p in projects]

    total_projects = len(projects)

    # Proyectos que tienen al menos una evaluación
    evaluated_ids = set()
    if project_ids:
        evals = db.exec(
            select(MatrixEvaluation.project_id)
            .where(col(MatrixEvaluation.project_id).in_(project_ids))
        ).all()
        evaluated_ids = set(evals)

    evaluated_projects = len(evaluated_ids)
    pending_evaluation = total_projects - evaluated_projects

    # Total de evaluaciones
    total_evaluations = 0
    if project_ids:
        total_evaluations = db.exec(
            select(func.count(col(MatrixEvaluation.id)))
            .where(col(MatrixEvaluation.project_id).in_(project_ids))
        ).one()

    return {
        "total_projects":     total_projects,
        "evaluated_projects": evaluated_projects,
        "pending_evaluation": pending_evaluation,
        "total_evaluations":  total_evaluations,
        "scope":              "global" if is_admin else "personal",
    }


def get_quadrant_summary(db: Session, user_id: int, role: str) -> list[dict]:
    """
    Retorna conteo y lista de proyectos por cuadrante.
    Respeta el mismo filtro de rol que get_dashboard_stats.
    """
    is_admin = role in ("admin", "superadmin")

    # Obtener IDs de proyectos según rol
    base = select(Project)
    if not is_admin:
        base = base.where(Project.owner_id == user_id)

    projects = db.exec(base).all()
    project_ids = [p.id for p in projects]
    project_map = {p.id: p.title for p in projects}

    if not project_ids:
        return []

    # Última evaluación por proyecto (la más reciente)
    latest_evals: dict[int, MatrixEvaluation] = {}
    evals = db.exec(
        select(MatrixEvaluation)
        .where(col(MatrixEvaluation.project_id).in_(project_ids))
        .order_by(col(MatrixEvaluation.created_at).desc())
    ).all()

    for ev in evals:
        if ev.project_id not in latest_evals:
            latest_evals[ev.project_id] = ev

    # Agrupar por cuadrante
    quadrant_map: dict[str, list[str]] = {}
    for ev in latest_evals.values():
        quadrant_map.setdefault(ev.quadrant, [])
        title = project_map.get(ev.project_id, f"Proyecto {ev.project_id}")
        quadrant_map[ev.quadrant].append(title)

    return [
        {"quadrant": q, "count": len(titles), "projects": titles}
        for q, titles in quadrant_map.items()
    ]
