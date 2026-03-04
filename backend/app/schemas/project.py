from datetime import datetime
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default="nuevo", max_length=50)
    source: str | None = Field(default="manual", max_length=50)
    ms_list_id: str | None = Field(default=None, max_length=100)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = Field(default=None, max_length=50)


class ProjectRead(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    owner_email: str
    source: str
    ms_list_id: str | None
    created_at: datetime
    updated_at: datetime
