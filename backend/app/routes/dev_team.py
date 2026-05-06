from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.dependencies import get_db, require_superadmin
from app.models.user import User
from app.schemas.dev_team import DevTeamMemberCreate, DevTeamMemberRead
from app.services.dev_team_service import (
    add_team_member,
    get_team_members,
    remove_team_member,
)

router = APIRouter(prefix="/settings/dev-team", tags=["DevTeam"])


@router.get("", response_model=list[DevTeamMemberRead])
def list_team(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    pairs = get_team_members(db)
    return [
        DevTeamMemberRead(
            id=cast(int, m.id),
            user_id=m.user_id,
            user_email=u.email,
            user_full_name=u.full_name,
            added_at=m.added_at,
        )
        for m, u in pairs
    ]


@router.post("", response_model=DevTeamMemberRead, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: DevTeamMemberCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    member = add_team_member(db, payload.user_id)
    return DevTeamMemberRead(
        id=cast(int, member.id),
        user_id=member.user_id,
        user_email=user.email,
        user_full_name=user.full_name,
        added_at=member.added_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    if not remove_team_member(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Miembro no encontrado.")
