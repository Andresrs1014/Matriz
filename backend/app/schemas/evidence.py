# backend/app/schemas/evidence.py
from datetime import datetime
from pydantic import BaseModel


class EvidenceRead(BaseModel):
    id: int
    project_id: int
    uploaded_by: int
    uploader_name: str
    uploader_role: str
    filename: str
    mime_type: str
    extension: str
    size_bytes: int
    sha256: str
    description: str | None
    created_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}


class EvidenceUpdateInput(BaseModel):
    description: str | None = None
