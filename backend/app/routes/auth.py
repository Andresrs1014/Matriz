from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose.exceptions import JWTError
from pydantic import BaseModel
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user, require_coordinador, require_superadmin
from app.core.security import create_access_token, decode_token, hash_password
from app.models.user import User
from app.schemas.auth import (
    MeResponse,
    RegisterRequest,
    SuperadminUpdateUserRequest,
    TokenResponse,
    UpdateRoleRequest,
    UserListResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_user,
    deactivate_user,
    get_all_users,
    get_archived_users,
    get_user_by_email,
    get_user_by_id,
    permanent_delete_user,
    reactivate_user,
    token_area_claim,
    update_user_role,
    update_user_superadmin,
    user_area_and_site_labels,
)
from app.services.work_catalog_service import resolve_work_area_id_by_name

router = APIRouter(prefix="/auth", tags=["Auth"])


def _to_me(db: Session, u: User) -> MeResponse:
    an, sn = user_area_and_site_labels(db, u)
    return MeResponse(
        id=cast(int, u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        area=an,
        site_name=sn,
        is_active=u.is_active,
    )


def _to_list(db: Session, u: User) -> UserListResponse:
    an, sn = user_area_and_site_labels(db, u)
    return UserListResponse(
        id=cast(int, u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        area=an,
        site_name=sn,
        work_area_id=u.work_area_id,
        work_site_id=u.work_site_id,
        is_active=u.is_active,
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
            detail=f"Rol inválido. Valores permitidos: {', '.join(VALID_ROLES)}",
        )
    user = create_user(
        db,
        email=str(payload.email),
        password=payload.password,
        full_name=payload.full_name,
        work_area_id=payload.work_area_id,
        work_site_id=payload.work_site_id,
        role=payload.role,
    )
    return _to_me(db, user)


class SSORequest(BaseModel):
    token: str


class SSOResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeResponse


@router.post("/sso", response_model=SSOResponse)
def sso_login(payload: SSORequest, db: Session = Depends(get_db)):
    """Acepta un JWT de la intranet ZYMO, valida con la misma SECRET_KEY
    y devuelve un token de sesión de Matriz. Crea el usuario si no existe."""
    try:
        claims = decode_token(payload.token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de intranet inválido o expirado.",
        )
    email = claims.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin sujeto.")

    user = get_user_by_email(db, email)
    if not user:
        wid = resolve_work_area_id_by_name(db, claims.get("area"))
        user = create_user(
            db,
            email=email,
            password="__sso__",
            full_name=claims.get("full_name"),
            work_area_id=wid,
            work_site_id=None,
            role="usuario",
        )
        user.hashed_password = hash_password("__sso_disabled__")
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo.")

    access_token = create_access_token(
        subject=user.email,
        extra={"role": user.role, "area": token_area_claim(db, user)},
    )
    return SSOResponse(
        access_token=access_token,
        user=_to_me(db, user),
    )


@router.post("/token", response_model=TokenResponse)
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    access_token = create_access_token(
        subject=user.email,
        extra={"role": user.role, "area": token_area_claim(db, user)},
    )
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=MeResponse)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _to_me(db, current_user)


@router.get("/users", response_model=list[UserListResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Lista usuarios activos. Coordinador+."""
    return [_to_list(db, u) for u in get_all_users(db)]


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
    return _to_me(db, update_user_role(db, user, payload.role))


@router.put("/users/{user_id}", response_model=MeResponse)
def update_user_data(
    user_id: int,
    payload: SuperadminUpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Nombre, correo, área, sede, contraseña (con confirmación de superadmin). Solo superadmin."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return _to_me(db, update_user_superadmin(db, user, current_user, payload))


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


@router.get("/users/archived", response_model=list[UserListResponse])
def list_archived(
    db: Session = Depends(get_db),
    _: User = Depends(require_coordinador),
):
    """Lista usuarios archivados (últimos 6 meses). Coordinador+."""
    return [_to_list(db, u) for u in get_archived_users(db)]


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
    return _to_me(db, reactivate_user(db, user))


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
