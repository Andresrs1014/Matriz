from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user, require_admin, require_superadmin
from app.core.security import create_access_token
from app.schemas.auth import (
    RegisterRequest, TokenResponse, MeResponse,
    UserListResponse, UpdateRoleRequest, UpdateUserRequest
)
from app.services.auth_service import (
    create_user, authenticate_user, get_all_users,
    get_user_by_id, update_user_role, update_user, deactivate_user
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=MeResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = create_user(
        db,
        email=str(payload.email),
        password=payload.password,
        full_name=payload.full_name,
        area=payload.area,
    )
    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        area=user.area,
        is_active=user.is_active,
    )


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
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        area=current_user.area,
        is_active=current_user.is_active,
    )


# ── Endpoints de administración (solo admin+) ─────────────────────────────

@router.get("/users", response_model=list[UserListResponse], tags=["Admin"])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    """Lista todos los usuarios. Solo admin y superadmin."""
    users = get_all_users(db)
    return [
        UserListResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            area=u.area,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.put("/users/{user_id}/role", response_model=MeResponse, tags=["Admin"])
def change_user_role(
    user_id: int,
    payload: UpdateRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Cambia el rol de un usuario. Solo superadmin."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # El superadmin no puede degradarse a sí mismo
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cambiar tu propio rol."
        )

    updated = update_user_role(db, user, payload.role)
    return MeResponse(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        role=updated.role,
        area=updated.area,
        is_active=updated.is_active,
    )


@router.put("/users/{user_id}", response_model=MeResponse, tags=["Admin"])
def update_user_data(
    user_id: int,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Actualiza datos de un usuario. Solo admin+."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    updated = update_user(db, user, data)
    return MeResponse(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        role=updated.role,
        area=updated.area,
        is_active=updated.is_active,
    )


@router.delete("/users/{user_id}", tags=["Admin"])
def deactivate_user_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Desactiva un usuario (no lo elimina). Solo superadmin."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivarte a ti mismo."
        )
    deactivate_user(db, user)
    return {"ok": True, "message": f"Usuario {user.email} desactivado."}
