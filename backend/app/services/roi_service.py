# backend/app/services/roi_service.py
from typing import cast
from sqlmodel import Session, select, col
from app.models.project import Project
from app.models.roi import ROIEvaluation
from app.schemas.roi import ROIParte1Input, ROIParte2Input, ROIPlotPoint

HORAS_UMBRAL = 4.0
VALOR_UMBRAL = 50_000.0  # COP — umbral de ahorro en dinero para cuadrante "alto valor"


def _calcular_valor_hora(salario_base: float) -> dict:
    return {
        "valor_quincena": round(salario_base / 2, 2),
        "valor_dia": round(salario_base / 30, 2),
        "valor_hora_hombre": round(salario_base / (30 * 8), 2),
    }


def assign_roi_quadrant(horas_ahorradas: float, roi_valor_total: float) -> str:
    """Cuadrante basado en horas hombre reales ahorradas y su valor en COP."""
    ahorra_horas = horas_ahorradas >= HORAS_UMBRAL
    ahorra_valor = roi_valor_total >= VALOR_UMBRAL
    if ahorra_horas and ahorra_valor:
        return "alto_impacto"
    if ahorra_horas and not ahorra_valor:
        return "proceso_pesado"
    if not ahorra_horas and ahorra_valor:
        return "eficiencia_menor"
    return "bajo_impacto"


def calculate_roi(parte1: ROIParte1Input, parte2: ROIParte2Input) -> dict:
    valores = _calcular_valor_hora(parte1.salario_base)
    valor_hora = valores["valor_hora_hombre"]
    horas_ahorradas = round(parte2.horas_proceso_actual - parte2.horas_proyectadas, 2)
    ahorro_horas_hombre = round(horas_ahorradas * parte1.num_personas, 2)
    valor_ahorro = round(ahorro_horas_hombre * valor_hora, 2)
    roi_valor = round(horas_ahorradas * valor_hora, 2)
    roi_valor_total = round(valor_ahorro, 2)
    roi_pct = round(
        (horas_ahorradas / parte2.horas_proceso_actual) * 100, 2
    ) if parte2.horas_proceso_actual > 0 else 0.0
    return {
        **valores,
        "horas_ahorradas": horas_ahorradas,
        "ahorro_horas_hombre": ahorro_horas_hombre,
        "valor_ahorro": valor_ahorro,
        "roi_valor": roi_valor,
        "roi_valor_total": roi_valor_total,
        "roi_pct": roi_pct,
        "cuadrante_roi": assign_roi_quadrant(horas_ahorradas, roi_valor_total),
    }


def create_roi_parte1(db: Session, project_id: int, parte1: ROIParte1Input) -> ROIEvaluation:
    valores = _calcular_valor_hora(parte1.salario_base)
    evaluation = ROIEvaluation(
        project_id=project_id,
        cargo=parte1.cargo,
        sede=parte1.sede,
        num_personas=parte1.num_personas,
        salario_base=parte1.salario_base,
        **valores,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


def update_roi_parte2(
    db: Session,
    evaluation: ROIEvaluation,
    parte1: ROIParte1Input,
    parte2: ROIParte2Input,
) -> ROIEvaluation:
    calculated = calculate_roi(parte1, parte2)
    evaluation.num_personas = parte1.num_personas
    evaluation.horas_proceso_actual = parte2.horas_proceso_actual
    evaluation.horas_proceso_nuevo = parte2.horas_proyectadas
    evaluation.horas_ahorradas = calculated["horas_ahorradas"]
    evaluation.ahorro_horas_hombre = calculated["ahorro_horas_hombre"]
    evaluation.valor_ahorro = calculated["valor_ahorro"]
    evaluation.roi_valor = calculated["roi_valor"]
    evaluation.roi_valor_total = calculated["roi_valor_total"]
    evaluation.roi_pct = calculated["roi_pct"]
    evaluation.cuadrante_roi = calculated["cuadrante_roi"]
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
    return list(db.exec(
        select(ROIEvaluation)
        .where(ROIEvaluation.project_id == project_id)
        .order_by(col(ROIEvaluation.created_at).desc())
    ).all())


def get_roi_plot_points(db: Session, owner_id: int | None = None) -> list[ROIPlotPoint]:
    query = select(Project)
    if owner_id is not None:
        query = query.where(Project.owner_id == owner_id)
    projects = list(db.exec(query))
    points: list[ROIPlotPoint] = []
    for project in projects:
        latest = get_latest_roi(db, cast(int, project.id))
        if latest and latest.horas_proceso_actual > 0:
            points.append(ROIPlotPoint(
                project_id=cast(int, project.id),
                project_title=project.title,
                horas_proceso_actual=latest.horas_proceso_actual,
                horas_ahorradas=latest.horas_ahorradas,
                roi_pct=latest.roi_pct,
                roi_valor_total=latest.roi_valor_total,
                num_personas=latest.num_personas,
                cuadrante_roi=latest.cuadrante_roi,
                roi_id=cast(int, latest.id),
                evaluated_at=latest.created_at,
            ))
    return points


# ── NUEVO: usado por /completar-roi para no duplicar lógica ──────────────────
def completar_roi_calculo(
    roi: ROIEvaluation,
    num_personas: int,
    horas_proceso_actual: float,
    horas_proceso_nuevo: float,
    db: Session,
) -> ROIEvaluation:
    horas_ahorradas = round(horas_proceso_actual - horas_proceso_nuevo, 2)
    ahorro_horas_hombre = round(horas_ahorradas * num_personas, 2)
    valor_ahorro = round(ahorro_horas_hombre * roi.valor_hora_hombre, 2)
    roi_valor = round(horas_ahorradas * roi.valor_hora_hombre, 2)
    roi_pct = round(
        (horas_ahorradas / horas_proceso_actual) * 100, 2
    ) if horas_proceso_actual > 0 else 0.0

    roi.num_personas = num_personas
    # ...existing code...
    return roi
