from sqlmodel import Session, select
from app.models.matrix import MatrixQuestion, QuestionCategory


DEFAULT_QUESTIONS = [
    # Impacto
    {"axis": "impact", "text": "¿El proyecto reduce significativamente el tiempo de entrega o lead time?",         "weight": 1.2, "order": 1},
    {"axis": "impact", "text": "¿Elimina o reduce errores críticos en el proceso?",                                "weight": 1.5, "order": 2},
    {"axis": "impact", "text": "¿El resultado es escalable sin aumentar el equipo?",                               "weight": 1.0, "order": 3},
    {"axis": "impact", "text": "¿Mejora la visibilidad o experiencia del cliente final?",                          "weight": 0.8, "order": 4},
    {"axis": "impact", "text": "¿Genera ahorro económico directo o evita costos futuros?",                         "weight": 1.3, "order": 5},
    # Esfuerzo
    {"axis": "effort", "text": "¿Requiere integración con sistemas legados o complejos?",                          "weight": 1.2, "order": 1},
    {"axis": "effort", "text": "¿El equipo necesita capacitación significativa?",                                   "weight": 1.0, "order": 2},
    {"axis": "effort", "text": "¿La calidad de los datos actuales dificulta la implementación?",                   "weight": 1.1, "order": 3},
    {"axis": "effort", "text": "¿Tiene costos altos de infraestructura, licencias o recursos externos?",           "weight": 0.9, "order": 4},
    {"axis": "effort", "text": "¿Se espera resistencia al cambio por parte del equipo o usuarios?",                "weight": 1.0, "order": 5},
]


def seed_matrix_questions(db: Session) -> None:
    # Verificar si ya existe la categoría por defecto
    default_cat = db.exec(
        select(QuestionCategory).where(QuestionCategory.is_default == True)
    ).first()

    if not default_cat:
        default_cat = QuestionCategory(
            name="General / Operaciones",
            description="Set de preguntas por defecto para evaluación operacional",
            is_active=True,
            is_default=True,
        )
        db.add(default_cat)
        db.commit()
        db.refresh(default_cat)
        print("[seed] Categoría por defecto creada: General / Operaciones")

    # Solo crear preguntas si no existen aún
    existing = db.exec(select(MatrixQuestion)).first()
    if not existing:
        for q_data in DEFAULT_QUESTIONS:
            q = MatrixQuestion(category_id=default_cat.id, **q_data)
            db.add(q)
        db.commit()
        print(f"[seed] {len(DEFAULT_QUESTIONS)} preguntas creadas en categoría '{default_cat.name}'")


