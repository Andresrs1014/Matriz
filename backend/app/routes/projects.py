# backend/app/routes/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col
from datetime import datetime, timezone, timedelta
import asyncio
import json
import logging
from app.core.dependencies import (
    get_db, get_current_user,
    require_admin, require_superadmin,
)
from app.models.project import Project
from app.models.user import User
from app.models.roi import ROIEvaluation
from app.models.project_question import ProjectQuestion
from app.models.work_catalog import WorkArea
from app.schemas.project import (
    ProjectCreate, ProjectRead,
    SuperaprobacionInput, SalarioInput,
    DatosOperacionalesInput, ProjectQuestionRead,
    OkrProductiveInput, DueDateInput, DueDateExtendInput, ProjectEditInput,
    AssignAreaInput,
)
from app.services.project_service import (
    get_project_any, create_project, delete_project, list_all_projects,
    escalar_proyecto, superaprobar_proyecto, iniciar_evaluacion,
    marcar_evaluado, registrar_salario, iniciar_calculo_roi,
    aprobacion_final, rechazar_proyecto,
    assign_project_to_development, clear_development_assignment,
    assign_area as assign_project_area,
    get_area_member_emails,
)
from app.services.dev_team_service import get_team_emails
from app.services.email_service import (
    send_dev_assignment_notification_detached,
    send_area_assignment_notification_detached,
)
from app.services.evidence_service import count_active_evidences, evidence_counts_by_project_ids
from app.services.comment_service import create_status_comment
from app.services import task_service as task_svc
from app.services.roi_service import (
    _calcular_valor_hora, assign_roi_quadrant, completar_roi_calculo  # ← añadido
)
from app.core.ws_manager import ws_manager

router = APIRouter(prefix="/projects", tags=["Projects"])

logger = logging.getLogger(__name__)


def _owner_area_map(
    db: Session, owner_ids: list[int]
) -> dict[int, tuple[int | None, str | None]]:
    """owner_id -> (work_area_id, work_area_name) según el usuario dueño."""
    if not owner_ids:
        return {}
    unique = list({i for i in owner_ids})
    users = list(db.exec(select(User).where(User.id.in_(unique))).all())
    wa_ids = {u.work_area_id for u in users if u.work_area_id}
    names: dict[int, str] = {}
    if wa_ids:
        for wa in db.exec(select(WorkArea).where(WorkArea.id.in_(wa_ids))).all():
            if wa.id is not None:
                names[wa.id] = wa.name
    out: dict[int, tuple[int | None, str | None]] = {}
    for u in users:
        if u.id is None:
            continue
        wid = u.work_area_id
        out[u.id] = (wid, names.get(wid) if wid else None)
    return out


def _parse_collaborators(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [str(item).strip() for item in data if str(item).strip()]


def _to_read(
    db: Session,
    p: Project,
    current_user: User,
    evidence_count: int = 0,
    area_name_by_id: dict[int, str] | None = None,
    owner_area_by_owner_id: dict[int, tuple[int | None, str | None]] | None = None,
) -> ProjectRead:
    assert p.id is not None
    if owner_area_by_owner_id is None:
        owner_area_by_owner_id = _owner_area_map(db, [p.owner_id])
    ow_area_id, ow_area_name = owner_area_by_owner_id.get(
        p.owner_id, (None, None)
    )
    assigned_area_name = None
    if p.assigned_area_id:
        if area_name_by_id is not None and p.assigned_area_id in area_name_by_id:
            assigned_area_name = area_name_by_id[p.assigned_area_id]
        else:
            wa = db.get(WorkArea, p.assigned_area_id)
            assigned_area_name = wa.name if wa else None
    return ProjectRead(
        id=p.id,
        title=p.title,
        description=p.description,
        okr_objectives=p.okr_objectives,
        key_results=p.key_results,
        key_actions=p.key_actions,
        resources=p.resources,
        five_whys=p.five_whys,
        measurement_methods=p.measurement_methods,
        submitted_by_name=p.submitted_by_name,
        okr_creator=p.okr_creator,
        collaborators=_parse_collaborators(p.collaborators_json),
        due_date=p.due_date,
        okr_productive=p.okr_productive,
        status=p.status,
        source=p.source,
        owner_id=p.owner_id,
        ms_list_id=p.ms_list_id,
        approved_by=p.approved_by,
        approved_at=p.approved_at,
        final_approved_by=p.final_approved_by,
        final_approved_at=p.final_approved_at,
        assigned_to_dev=p.assigned_to_dev,
        assigned_to_dev_at=p.assigned_to_dev_at,
        assigned_to_dev_by=p.assigned_to_dev_by,
        assigned_area_id=p.assigned_area_id,
        assigned_area_at=p.assigned_area_at,
        assigned_area_by=p.assigned_area_by,
        assigned_area_name=assigned_area_name,
        created_at=p.created_at,
        updated_at=p.updated_at,
        evidence_count=evidence_count,
        viewer_can_modify_tasks=task_svc.can_modify_tasks(db, p, current_user),
        owner_work_area_id=ow_area_id,
        owner_work_area_name=ow_area_name,
    )


def _read_with_evidence_count(
    db: Session, p: Project, current_user: User
) -> ProjectRead:
    assert p.id is not None
    return _to_read(db, p, current_user, count_active_evidences(db, p.id))


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
    ids = [p.id for p in projects if p.id is not None]
    ev_counts = evidence_counts_by_project_ids(db, ids)
    area_ids = list({p.assigned_area_id for p in projects if p.assigned_area_id})
    area_name_by_id: dict[int, str] | None = None
    if area_ids:
        area_name_by_id = {}
        for row in db.exec(select(WorkArea).where(WorkArea.id.in_(area_ids))).all():
            if row.id is not None:
                area_name_by_id[row.id] = row.name
    owner_area_by_owner_id = _owner_area_map(
        db, list({p.owner_id for p in projects})
    )
    return [
        _to_read(
            db,
            p,
            current_user,
            ev_counts.get(p.id, 0),
            area_name_by_id,
            owner_area_by_owner_id,
        )
        for p in projects
    ]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cualquier usuario autenticado puede crear un proyecto."""
    assert current_user.id is not None
    collaborators = [
        name.strip()
        for name in payload.collaborators
        if isinstance(name, str) and name.strip()
    ]
    now = datetime.now(timezone.utc)
    project = Project(
        title=payload.title,
        description=payload.description,
        okr_objectives=payload.okr_objectives,
        key_results=payload.key_results,
        key_actions=payload.key_actions,
        resources=payload.resources,
        five_whys=payload.five_whys,
        measurement_methods=payload.measurement_methods,
        submitted_by_name=current_user.full_name or current_user.email,
        okr_creator=payload.okr_creator or current_user.full_name or current_user.email,
        collaborators_json=json.dumps(collaborators, ensure_ascii=False),
        due_date=now + timedelta(days=90),
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
    return _to_read(db, project, current_user, 0)


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
    return _read_with_evidence_count(db, project, current_user)


@router.patch("/{project_id}", response_model=ProjectRead)
async def edit_project(
    project_id: int,
    payload: ProjectEditInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """admin/superadmin pueden editar los campos del OKR en cualquier estado."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if payload.title is not None:
        project.title = payload.title.strip() or project.title
    if payload.okr_objectives is not None:
        project.okr_objectives = payload.okr_objectives or None
        project.description = payload.okr_objectives or project.description
    if payload.key_results is not None:
        project.key_results = payload.key_results or None
    if payload.key_actions is not None:
        project.key_actions = payload.key_actions or None
    if payload.resources is not None:
        project.resources = payload.resources or None
    if payload.five_whys is not None:
        project.five_whys = payload.five_whys or None
    if payload.measurement_methods is not None:
        project.measurement_methods = payload.measurement_methods or None
    if payload.okr_creator is not None:
        project.okr_creator = payload.okr_creator or None
    if payload.collaborators is not None:
        project.collaborators_json = json.dumps(payload.collaborators, ensure_ascii=False)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    await ws_manager.broadcast("project.updated", {"id": project_id})
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


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
    return _read_with_evidence_count(db, project, current_user)


# ── Marcar productividad del OKR ──────────────────────────────────────────────
@router.patch("/{project_id}/productividad", response_model=ProjectRead)
async def marcar_productividad(
    project_id: int,
    payload: OkrProductiveInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """admin/superadmin pueden marcar si un OKR fue productivo o no."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    project.okr_productive = payload.productive
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    await ws_manager.broadcast("project.productividad", {
        "id": project_id, "productive": payload.productive
    })
    return _read_with_evidence_count(db, project, current_user)


# ── Cambiar fecha de vencimiento del OKR ─────────────────────────────────────
@router.patch("/{project_id}/due-date", response_model=ProjectRead)
async def actualizar_due_date(
    project_id: int,
    payload: DueDateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """admin/superadmin pueden ajustar la fecha de vencimiento del OKR."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    try:
        from datetime import date as _date
        parsed = datetime.combine(
            _date.fromisoformat(payload.due_date),
            datetime.min.time(),
            tzinfo=timezone.utc,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD.")
    project.due_date = parsed
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _read_with_evidence_count(db, project, current_user)


# ── Extender fecha de vencimiento (propietario del proyecto) ─────────────────
@router.patch("/{project_id}/extender-fecha", response_model=ProjectRead)
async def extender_fecha_proyecto(
    project_id: int,
    payload: DueDateExtendInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Usuario o coordinador pueden extender la fecha de sus propios proyectos.
    Requiere justificación (mínimo 10 caracteres).
    Crea un comentario de tipo 'extension_fecha' con la justificación.
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    # Verificar propiedad del proyecto
    # Usuario: solo puede extender sus propios proyectos
    # Coordinador: puede extender sus propios proyectos
    if current_user.role == "usuario" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes modificar la fecha de tus propios proyectos.")

    if current_user.role == "coordinador" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo puedes modificar la fecha de tus propios proyectos.")

    # Validar justificación
    if not payload.justificacion or len(payload.justificacion.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="La justificación debe tener al menos 10 caracteres."
        )

    # Guardar fecha anterior para el comentario
    old_due_date = project.due_date

    # Parsear nueva fecha
    try:
        from datetime import date as _date
        parsed = datetime.combine(
            _date.fromisoformat(payload.due_date),
            datetime.min.time(),
            tzinfo=timezone.utc,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD.")

    # Validar que la nueva fecha sea posterior a la actual
    if project.due_date and parsed <= project.due_date:
        raise HTTPException(
            status_code=400,
            detail="La nueva fecha debe ser posterior a la fecha actual."
        )

    # Actualizar fecha
    project.due_date = parsed
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)

    # Crear comentario de tipo extension_fecha
    from app.schemas.comment import CommentCreate
    justificacion_texto = payload.justificacion.strip()
    old_str = old_due_date.strftime("%Y-%m-%d") if old_due_date else "No definida"
    new_str = parsed.strftime("%Y-%m-%d")

    comment_msg = (
        f"Fecha de vencimiento extendida de {old_str} a {new_str}. "
        f"Justificación: {justificacion_texto}"
    )
    sc = create_status_comment(
        db, project_id, current_user,
        comment_msg,
        tipo="extension_fecha",
    )

    # Broadcasts
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.fecha_extendida", {
        "id": project_id,
        "due_date": parsed.isoformat(),
    })

    # Notificar por email (fire and forget)
    from app.services.email_service import send_fecha_extendida_notification_detached
    try:
        asyncio.create_task(
            send_fecha_extendida_notification_detached(
                project_title=project.title,
                project_id=project_id,
                old_due_date=old_due_date,
                new_due_date=parsed,
                author_name=current_user.full_name or current_user.email,
                justificacion=justificacion_texto,
            )
        )
    except Exception:
        pass  # No bloquea la respuesta si falla el email

    return _read_with_evidence_count(db, project, current_user)


@router.post("/{project_id}/assign-area", response_model=ProjectRead)
async def assign_area(
    project_id: int,
    payload: AssignAreaInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    is_owner = project.owner_id == current_user.id
    is_superadmin = current_user.role == "superadmin"

    if not is_owner and not is_superadmin:
        raise HTTPException(status_code=403, detail="Sin permiso.")

    if is_owner and not is_superadmin:
        if current_user.work_area_id != payload.area_id:
            raise HTTPException(
                status_code=403,
                detail="Solo puedes asignar el proyecto a tu propia área.",
            )

    area = db.get(WorkArea, payload.area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    project = assign_project_area(db, project, payload.area_id, current_user)

    actor_label = current_user.full_name or current_user.email or ""
    sc = create_status_comment(
        db,
        project_id,
        current_user,
        f"Proyecto asignado al área '{area.name}' por {actor_label}.",
    )
    await ws_manager.broadcast(
        "comment.created",
        {
            "id": sc.id,
            "project_id": sc.project_id,
            "author_id": sc.author_id,
            "author_role": sc.author_role,
            "author_name": sc.author_name,
            "message": sc.message,
            "tipo": sc.tipo,
            "created_at": sc.created_at.isoformat(),
        },
    )
    await ws_manager.broadcast(
        "project.area_assigned",
        {
            "project_id": project_id,
            "area_id": payload.area_id,
            "area_name": area.name,
        },
    )

    area_emails = get_area_member_emails(db, payload.area_id)
    if area_emails:
        try:
            asyncio.create_task(
                send_area_assignment_notification_detached(
                    project_title=project.title,
                    project_id=project_id,
                    area_name=area.name,
                    assigned_by_name=actor_label,
                    recipient_emails=area_emails,
                )
            )
        except RuntimeError:
            logger.warning("[assign-area] No se programó correo (sin event loop)")
        except Exception:
            logger.exception("[assign-area] No se programó correo")

    return _read_with_evidence_count(db, project, current_user)


# ── Asignación interna al área de Desarrollo (superadmin; no cambia estado del flujo) ──


@router.post("/{project_id}/assign-to-dev", response_model=ProjectRead)
async def assign_to_dev(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    project = assign_project_to_development(db, project_id, current_user)
    actor_label = current_user.full_name or current_user.email or ""
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto asignado al Área de Desarrollo por {actor_label}.",
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.assigned_dev", {"id": project_id})

    team_snapshot = list(get_team_emails(db))
    title_snapshot = project.title
    if team_snapshot:
        try:
            asyncio.create_task(
                send_dev_assignment_notification_detached(
                    project_title=title_snapshot,
                    project_id=project_id,
                    assigned_by_name=actor_label,
                    team_emails=team_snapshot,
                )
            )
        except RuntimeError:
            logger.warning("[assign-to-dev] No se programó correo al equipo (sin event loop)")
        except Exception:
            logger.exception("[assign-to-dev] No se programó correo al equipo")

    return _read_with_evidence_count(db, project, current_user)


@router.delete("/{project_id}/assign-to-dev", response_model=ProjectRead)
async def unassign_from_dev(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    project = clear_development_assignment(db, project_id)
    await ws_manager.broadcast("project.unassigned_dev", {"id": project_id})
    return _read_with_evidence_count(db, project, current_user)
