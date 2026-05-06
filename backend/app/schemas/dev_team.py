from datetime import datetime

from pydantic import BaseModel


class DevTeamMemberRead(BaseModel):
    id: int
    user_id: int
    user_email: str
    user_full_name: str | None
    added_at: datetime


class DevTeamMemberCreate(BaseModel):
    user_id: int


class DevTeamMemberRemove(BaseModel):
    user_id: int
