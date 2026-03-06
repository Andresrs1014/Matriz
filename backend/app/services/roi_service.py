from typing import cast
from sqlmodel import Session, select, col

from app.models.project import Project
from app.models.roi import ROIEvaluation
from app.schemas.roi import ROIInput, ROIPlotPoint


# ── Umbrales de clasificación ──────────────────────────────────────────────────
ROI_UMBRAL_PCT         = 100.0   # ROI >= 100 % → alto (dobla la inversión)
PAYBACK_UMBRAL_SEMANAS = 26.0    # ≤ 26 semanas (6 meses) → payback rápido


def assign_roi_quadrant(roi_pct: float, payback_semanas: float) -> str:
    """
    Cuadrantes:
      rentable_rapido → alto ROI + payback rápido  → Ejecutar ya
      rentable_lento  → alto ROI + payback lento   → Planificar
      dudoso_rapido   → bajo ROI + payback rápido  → Evaluar
      no_justificado  → bajo ROI + payback lento   → Descartar
    """
    alto_roi    = roi_pct >= ROI_UMBRAL_PCT
    pago_rapido = payback_semanas <= PAYBACK_UMBRAL_SEMANAS

    if alto_roi and pago_rapido:
        return "rentable_rapido"
    if alto_roi and not pago_rapido:
        return "rentable_lento"
    if not alto_roi and pago_rapido:
        return "dudoso_rapido"
    return "no_justificado"


def calculate_roi(data: ROIInput) -> dict:
    """
    Fórmulas:
      costo_total          = (horas_inversion × valor_hora) + costo_infraestructura
      ahorro_semanal       = horas_ahorradas_semana × valor_hora
      ahorro_anual         = (ahorro_semanal × semanas_anio) + ahorro_directo + ahorro_errores
      horas_liberadas_anio = horas_ahorradas_semana × semanas_anio
      roi_pct              = ((ahorro_anual - costo_total) / costo_total) × 100
      payback_semanas      = costo_total / ahorro_semanal
    """
    costo_total          = (data.horas_inversion * data.valor_hora) + data.costo_infraestructura
    ahorro_semanal       = data.horas_ahorradas_semana * data.valor_hora
    ahorro_anual         = (ahorro_semanal * data.semanas_anio) + data.ahorro_directo + data.ahorro_errores
    horas_liberadas_anio = data.horas_ahorradas_semana * data.semanas_anio

    roi_pct         = round(((ahorro_anual - costo_total) / costo_total) * 100, 2) if costo_total > 0 else 0.0
    payback_semanas = round(costo_total / ahorro_semanal, 2) if ahorro_semanal > 0 else 9999.0

    return {
        "costo_total":          round(costo_total, 2),
        "ahorro_anual":         round(ahorro_anual, 2),
        "horas_liberadas_anio": round(horas_liberadas_anio, 2),
        "roi_pct":              roi_pct,
        "payback_semanas":      payback_semanas,
        "cuadrante_roi":        assign_roi_quadrant(roi_pct, payback_semanas),
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_roi_evaluation(db: Session, project_id: int, data: ROIInput) -> ROIEvaluation:
    calculated = calculate_roi(data)
    evaluation = ROIEvaluation(
        project_id=project_id,
        horas_inversion=data.horas_inversion,
        valor_hora=data.valor_hora,
        costo_infraestructura=data.costo_infraestructura,
        horas_ahorradas_semana=data.horas_ahorradas_semana,
        semanas_anio=data.semanas_anio,
        ahorro_directo=data.ahorro_directo,
        ahorro_errores=data.ahorro_errores,
        **calculated,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


def get_latest_roi(db: Session, project_id: int) -> ROIEvaluation | None:
    return db.exec(
        select(ROIEvaluation)
        .where(ROIEvaluation.project_id == project_id)
        .order_by(col(ROIEvaluation.created_at).desc())
    ).first()


def get_roi_history(db: Session, project_id: int) -> list[ROIEvaluation]:
    return list(
        db.exec(
            select(ROIEvaluation)
            .where(ROIEvaluation.project_id == project_id)
            .order_by(col(ROIEvaluation.created_at).desc())
        )
    )


def get_roi_plot_points(db: Session, owner_id: int | None) -> list[ROIPlotPoint]:
    """Un punto ROI por proyecto (la evaluación más reciente)."""
    if owner_id is None:
        projects = list(db.exec(select(Project)))
    else:
        projects = list(db.exec(select(Project).where(Project.owner_id == owner_id)))

    points: list[ROIPlotPoint] = []
    for project in projects:
        latest = get_latest_roi(db, cast(int, project.id))
        if latest:
            points.append(ROIPlotPoint(
                project_id=cast(int, project.id),
                project_title=project.title,
                roi_pct=latest.roi_pct,
                payback_semanas=latest.payback_semanas,
                cuadrante_roi=latest.cuadrante_roi,
                roi_id=cast(int, latest.id),
                evaluated_at=latest.created_at,
            ))
    return points
