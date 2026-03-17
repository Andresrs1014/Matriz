# backend/app/routes/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col
from datetime import datetime, timezone
from app.core.dependencies import (
    get_db, get_current_user,
    require_admin, require_superadmin,
)
from app.models.project import Project
from app.models.user import User
from app.models.roi import ROIEvaluation
from app.models.project_question import ProjectQuestion
from app.schemas.project import (
    ProjectCreate, ProjectRead,
    SuperaprobacionInput, SalarioInput,
    DatosOperacionalesInput, ProjectQuestionRead,
)
from app.services.project_service import (
    get_project_any, create_project, delete_project, list_all_projects,
    escalar_proyecto, superaprobar_proyecto, iniciar_evaluacion,
    marcar_evaluado, registrar_salario, iniciar_calculo_roi,
    aprobacion_final, rechazar_proyecto,
)
from app.services.comment_service import create_status_comment
from app.services.roi_service import (
    _calcular_valor_hora, assign_roi_quadrant, completar_roi_calculo  # ← añadido
)
from app.core.ws_manager import ws_manager

router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_read(p: Project) -> ProjectRead:
    assert p.id is not None
    return ProjectRead(
        id=p.id,
        title=p.title,
        description=p.description,
        status=p.status,
        source=p.source,
        owner_id=p.owner_id,
        ms_list_id=p.ms_list_id,
        approved_by=p.approved_by,
        approved_at=p.approved_at,
        final_approved_by=p.final_approved_by,
        final_approved_at=p.final_approved_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ── CRUD base ────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    - admin/superadmin/coordinador: ven todos los proyectos
    - usuario: solo ve los suyos
    """
    if current_user.role in ("admin", "superadmin", "coordinador"):
        projects = list_all_projects(db)
    else:
        projects = list(db.exec(
            select(Project)
            .where(Project.owner_id == current_user.id)
            .order_by(col(Project.created_at).desc())
        ).all())
    return [_to_read(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cualquier usuario autenticado puede crear un proyecto."""
    assert current_user.id is not None
    project = Project(
        title=payload.title,
        description=payload.description,
        owner_id=current_user.id,
        source="manual",
        status="pendiente_revision",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    await ws_manager.broadcast(
        event_type="project.created",
        payload={"id": project.id, "title": project.title},
    )
    return _to_read(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin", "coordinador") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    return _to_read(project)


@router.delete("/{project_id}")
def delete_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso.")
    delete_project(db, project)
    return {"ok": True}


# ── Flujo Paso 1: Admin escala al superadmin ─────────────────────────────────
@router.post("/{project_id}/escalar", response_model=ProjectRead)
async def escalar(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Paso 1 — Admin revisa el proyecto y lo eleva al superadmin."""
    project = get_project_any(db, project_id)
    project = escalar_proyecto(db, project, current_user)
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto escalado al superadmin por {current_user.full_name or current_user.email}."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.escalado", {"id": project_id})
    return _to_read(project)


# ── Flujo Paso 2: Superadmin aprueba + asigna preguntas ──────────────────────
@router.post("/{project_id}/superaprobar", response_model=ProjectRead)
async def superaprobar(
    project_id: int,
    payload: SuperaprobacionInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Paso 2 — Superadmin aprueba el proyecto y asigna preguntas de evaluación.
    Mezcla preguntas existentes (question_ids) con custom (custom_questions).
    """
    project = get_project_any(db, project_id)
    project = superaprobar_proyecto(db, project, current_user)
    assert current_user.id is not None

    # Limpiar preguntas previas del proyecto (por si se llama más de una vez)
    existing_pqs = list(db.exec(
        select(ProjectQuestion).where(ProjectQuestion.project_id == project_id)
    ))
    for pq in existing_pqs:
        db.delete(pq)

    # Preguntas existentes seleccionadas por el superadmin
    for qid in payload.question_ids:
        from app.models.matrix import MatrixQuestion
        mq = db.get(MatrixQuestion, qid)
        if mq:
            db.add(ProjectQuestion(
                project_id=project_id,
                question_text=mq.text,
                axis=mq.axis,           # ← CORREGIDO: heredar el eje de MatrixQuestion
                source_question_id=qid,
                created_by=current_user.id,
            ))

    # Preguntas custom nuevas escritas por el superadmin
    for item in payload.custom_questions:
        # Soporta tanto objetos como strings
        text = getattr(item, "text", item)
        axis = getattr(item, "axis", "impact")
        if str(text).strip():
            db.add(ProjectQuestion(
                project_id=project_id,
                question_text=str(text).strip(),
                axis=axis,
                source_question_id=None,
                created_by=current_user.id,
            ))

    db.commit()
    total = len(payload.question_ids) + len([
        x for x in payload.custom_questions
        if (getattr(x, "text", x)) and str(getattr(x, "text", x)).strip()
    ])
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto aprobado por superadmin. {total} pregunta(s) asignadas para evaluación."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.superaprobado", {"id": project_id})
    return _to_read(project)


# ── GET preguntas asignadas al proyecto ──────────────────────────────────────
@router.get("/{project_id}/questions", response_model=list[ProjectQuestionRead])
def get_project_questions(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna las preguntas asignadas por el superadmin a este proyecto.
    - admin/superadmin: siempre pueden verlas
    - coordinador: puede verlas (para opinar vía chat)
    - usuario: NO puede verlas (solo ve impacto/esfuerzo)
    """
    if current_user.role == "usuario":
        raise HTTPException(status_code=403, detail="Sin acceso a las preguntas de evaluación.")
    questions = list(db.exec(
        select(ProjectQuestion).where(ProjectQuestion.project_id == project_id)
    ).all())
    return questions


# ── Flujo Paso 3: Admin inicia evaluación ────────────────────────────────────
@router.post("/{project_id}/iniciar-evaluacion", response_model=ProjectRead)
async def iniciar_eval(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Paso 3 — Admin inicia la evaluación con las preguntas asignadas."""
    project = get_project_any(db, project_id)
    questions = list(db.exec(
        select(ProjectQuestion).where(ProjectQuestion.project_id == project_id)
    ).all())
    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No hay preguntas asignadas. El superadmin debe aprobar y asignar preguntas primero."
        )
    project = iniciar_evaluacion(db, project)
    sc = create_status_comment(
        db, project_id, current_user,
        f"Evaluación iniciada por {current_user.full_name or current_user.email}. {len(questions)} pregunta(s) activas."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.en_evaluacion", {"id": project_id})
    return _to_read(project)


# ── Flujo Paso 4: Admin marca evaluado (tras llenar matrix) ──────────────────
@router.post("/{project_id}/marcar-evaluado", response_model=ProjectRead)
async def marcar_eval(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Paso 4 — Admin completa la matrix impacto/esfuerzo y marca el proyecto como evaluado.
    El coordinador y usuario ya pueden ver impacto/esfuerzo desde este punto.
    """
    project = get_project_any(db, project_id)
    project = marcar_evaluado(db, project)
    sc = create_status_comment(
        db, project_id, current_user,
        f"Evaluación completada por {current_user.full_name or current_user.email}. Impacto/esfuerzo registrado."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.evaluado", {"id": project_id})
    return _to_read(project)


# ── Flujo Paso 5: Superadmin provee salario ───────────────────────────────────
@router.post("/{project_id}/proveer-salario", response_model=ProjectRead)
async def proveer_salario(
    project_id: int,
    payload: SalarioInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Paso 5 — Superadmin provee el salario base para el cálculo del ROI.
    Este dato es privado: no se expone a coordinador ni usuario.
    Crea el registro ROIEvaluation con los datos económicos.
    """
    project = get_project_any(db, project_id)
    # REEMPLAZAR por — elimina el anterior si existe y crea uno nuevo limpio
    old_roi = db.exec(select(ROIEvaluation).where(ROIEvaluation.project_id == project_id)).first()
    if old_roi:
        db.delete(old_roi)
    db.flush()

    # existing = db.exec(select(ROIEvaluation).where(ROIEvaluation.project_id == project_id)).first()
    # if existing:
    #     raise HTTPException(status_code=400, detail="El salario ya fue registrado para este proyecto.")
    valores = _calcular_valor_hora(payload.salario_base)
    roi = ROIEvaluation(
        project_id=project_id,
        cargo=payload.cargo,
        sede=payload.sede or "No especificada",
        salario_base=payload.salario_base,
        valor_quincena=valores["valor_quincena"],
        valor_dia=valores["valor_dia"],
        valor_hora_hombre=valores["valor_hora_hombre"],
        num_personas=0,  # Admin lo llenará en paso 6
    )
    db.add(roi)
    db.commit()
    project = registrar_salario(db, project)
    sc = create_status_comment(
        db, project_id, current_user,
        "Datos salariales registrados por superadmin. Pendiente datos operacionales del admin."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.pendiente_salario", {"id": project_id})
    return _to_read(project)


# ── NUEVO: Superadmin corrige salario mal ingresado ───────────────────────────
@router.patch("/{project_id}/corregir-salario", response_model=dict)
async def corregir_salario(
    project_id: int,
    payload: SalarioInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """
    Corrección de salario por superadmin si fue ingresado con error.
    Solo disponible en estado pendiente_salario.
    """
    project = db.get(Project, project_id)
    if not project or project.status != "pendiente_salario":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede corregir el salario cuando el proyecto está en estado pendiente_salario."
        )
    roi = db.exec(select(ROIEvaluation).where(ROIEvaluation.project_id == project_id)).first()
    if not roi:
        raise HTTPException(status_code=404, detail="No existe registro ROI para este proyecto.")
    valores = _calcular_valor_hora(payload.salario_base)
    roi.salario_base = payload.salario_base
    roi.cargo = payload.cargo
    roi.sede = payload.sede or "No especificada"
    roi.valor_quincena = valores["valor_quincena"]
    roi.valor_dia = valores["valor_dia"]
    roi.valor_hora_hombre = valores["valor_hora_hombre"]
    db.add(roi)
    db.commit()
    return {
        "message": "Salario corregido correctamente.",
        "valor_hora_hombre": roi.valor_hora_hombre,
        "valor_dia": roi.valor_dia,
    }


# ── Flujo Paso 6: Admin completa datos operacionales + calcula ROI ────────────
@router.post("/{project_id}/completar-roi", response_model=ProjectRead)
async def completar_roi(
    project_id: int,
    payload: DatosOperacionalesInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Paso 6 — Admin llena: cuántas personas hacen el proceso y horas que ahorra.
    El sistema calcula automáticamente el ROI en horas hombre y cierra el flujo.
    """
    project = get_project_any(db, project_id)
    roi = db.exec(select(ROIEvaluation).where(ROIEvaluation.project_id == project_id)).first()
    if not roi:
        raise HTTPException(
            status_code=400,
            detail="El superadmin debe registrar el salario antes de completar el ROI."
        )

    # ← CORREGIDO: delegar a roi_service, sin cálculo inline duplicado
    roi = completar_roi_calculo(
        roi=roi,
        num_personas=payload.num_personas,
        horas_proceso_actual=payload.horas_proceso_actual,
        horas_proceso_nuevo=payload.horas_proceso_nuevo,
        db=db,
    )

    # Avanzar estados y cerrar flujo
    project = iniciar_calculo_roi(db, project)
    project = aprobacion_final(db, project, current_user)
    db.commit()

    obs = payload.observacion or "Sin observaciones."
    sc = create_status_comment(
        db, project_id, current_user,
        f"ROI calculado por {current_user.full_name or current_user.email}. "
        f"Ahorro: {roi.horas_ahorradas:.1f}h × {roi.num_personas} personas = "
        f"{roi.ahorro_horas_hombre:.1f} h/h ahorradas. {obs}"
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.aprobado_final", {"id": project_id})
    return _to_read(project)


# ── Rechazar (cualquier paso) ────────────────────────────────────────────────
@router.post("/{project_id}/rechazar", response_model=ProjectRead)
async def rechazar(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin o superadmin pueden rechazar el proyecto en cualquier etapa."""
    project = get_project_any(db, project_id)
    project = rechazar_proyecto(db, project, current_user)
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto rechazado por {current_user.full_name or current_user.email}."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.rechazado", {"id": project_id})
    return _to_read(project)
