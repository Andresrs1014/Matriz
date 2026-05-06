from pydantic import BaseModel, Field


class WorkAreaRead(BaseModel):
    id: int
    name: str
    sort_order: int


class WorkSiteRead(BaseModel):
    id: int
    name: str
    sort_order: int


class WorkAreaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class WorkSiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0
