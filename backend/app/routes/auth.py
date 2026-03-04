from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.core.security import create_access_token
from app.schemas.auth import RegisterRequest, TokenResponse, MeResponse
from app.services.auth_service import create_user, authenticate_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=MeResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = create_user(db, email=str(payload.email), password=payload.password, full_name=payload.full_name)
    return MeResponse(email=user.email, full_name=user.full_name, role=user.role, is_active=user.is_active)


@router.post("/token", response_model=TokenResponse)
def token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    access_token = create_access_token(subject=user.email, extra={"role": user.role})
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
    )
