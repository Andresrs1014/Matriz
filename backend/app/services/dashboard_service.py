from sqlmodel import Session, select, col

from app.models.matrix import MatrixEvaluation
from app.models.project import Project
from app.schemas.matrix import QuadrantSummary
from app.services.matrix_service import (
    get_latest_evaluation_per_project,
    QUADRANT_LABELS,
)


def get_quadrant_summary(db: Session, owner_email: str) -> list[QuadrantSummary]:
    """
    Retorna cuántos proyectos están en cada cuadrante (última evaluación).
    """
    plot_points = get_latest_evaluation_per_project(db, owner_email)

    buckets: dict[str, list[str]] = {
        "esencial":    [],
        "estrategico": [],
        "indiferente": [],
        "lujo":        [],
    }

    for point in plot_points:
        quadrant = point.quadrant if point.quadrant in buckets else "indiferente"
        buckets[quadrant].append(point.project_title)

    return [
        QuadrantSummary(
            quadrant=q,
            label=QUADRANT_LABELS[q],
            count=len(titles),
            projects=titles,
        )
        for q, titles in buckets.items()
    ]


def get_dashboard_stats(db: Session, owner_email: str) -> dict:
    """
    KPIs principales para las tarjetas del dashboard.
    """
    total_projects = len(list(db.exec(select(Project).where(Project.owner_email == owner_email))))
    evaluated_projects = len(get_latest_evaluation_per_project(db, owner_email))
    pending_evaluation = total_projects - evaluated_projects

    total_evaluations = len(list(
        db.exec(
            select(MatrixEvaluation)
            .join(Project, MatrixEvaluation.project_id == Project.id)
            .where(Project.owner_email == owner_email)
        )
    ))

    quadrant_summary = get_quadrant_summary(db, owner_email)
    quadrant_counts = {s.quadrant: s.count for s in quadrant_summary}

    return {
        "total_projects": total_projects,
        "evaluated_projects": evaluated_projects,
        "pending_evaluation": pending_evaluation,
        "total_evaluations": total_evaluations,
        "by_quadrant": quadrant_counts,
    }
