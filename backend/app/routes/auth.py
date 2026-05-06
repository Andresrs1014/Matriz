from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import cast
from sqlmodel import Session
from app.core.dependencies import get_db, get_current_user, require_coordinador, require_admin, require_superadmin
from app.core.security import create_access_token
from app.schemas.auth import (
    RegisterRequest, TokenResponse, MeResponse,
    UserListResponse, UpdateRoleRequest, UpdateUserRequest
)
from app.services.auth_service import (
    create_user, authenticate_user, get_all_users, get_archived_users,
    get_user_by_id, update_user_role, update_user,
    deactivate_user, reactivate_user, permanent_delete_user
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


def _to_me(u: User) -> MeResponse:
    return MeResponse(
        id=cast(int, u.id), email=u.email, full_name=u.full_name,
        role=u.role, area=u.area, is_active=u.is_active,
    )

def _to_list(u: User) -> UserListResponse:
    return UserListResponse(
        id=cast(int, u.id), email=u.email, full_name=u.full_name,
        role=u.role, area=u.area, is_active=u.is_active,
        created_at=u.created_at.isoformat(),
    )


@router.post("/register", response_model=MeResponse)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    VALID_ROLES = ("superadmin", "admin", "coordinador", "usuario")
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}"
        )
    user = create_user(
        db, email=str(payload.email),
        password=payload.password,
        full_name=payload.full_name,
        area=payload.area,
        role=payload.role,
    )
    return _to_me(user)


@router.post("/token", response_model=TokenResponse)
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    access_token = create_access_token(
        subject=user.email,
        extra={"role": user.role, "area": user.area}
    )
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return _to_me(current_user)


# ── Usuarios activos ──────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserListResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Lista usuarios activos. Coordinador+."""
    return [_to_list(u) for u in get_all_users(db)]


@router.put("/users/{user_id}/role", response_model=MeResponse)
def change_user_role(
    user_id: int,
    payload: UpdateRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinador),
):
    """Cambia el rol. Coordinador+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol.")
    return _to_me(update_user_role(db, user, payload.role))


@router.put("/users/{user_id}", response_model=MeResponse)
def update_user_data(
    user_id: int,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Actualiza datos. Coordinador+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return _to_me(update_user(db, user, payload.model_dump(exclude_unset=True)))


@router.delete("/users/{user_id}")
def deactivate_user_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinador),
):
    """Desactiva (archiva) un usuario. Coordinador+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo.")
    deactivate_user(db, user)
    return {"ok": True}


# ── Usuarios archivados ───────────────────────────────────────────────────────

@router.get("/users/archived", response_model=list[UserListResponse])
def list_archived(
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Lista usuarios archivados (últimos 6 meses). Coordinador+."""
    return [_to_list(u) for u in get_archived_users(db)]


@router.post("/users/{user_id}/reactivar", response_model=MeResponse)
def reactivar_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Reactiva un usuario archivado. Coordinador+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.is_active:
        raise HTTPException(status_code=400, detail="El usuario ya está activo.")
    return _to_me(reactivate_user(db, user))


@router.delete("/users/{user_id}/permanent")
def delete_permanent(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinador),
):
    """Elimina permanentemente de la DB en cascada. Coordinador+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo.")
    permanent_delete_user(db, user)
    return {"ok": True}
