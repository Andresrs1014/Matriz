from fastapi import APIRouter, Header, HTTPException, status, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.config import settings
from app.core.ws_manager import ws_manager
from app.database import get_session
from app.services.project_service import create_project

router = APIRouter(prefix="/webhook", tags=["Webhook"])


class ListsWebhookPayload(BaseModel):
    """
    Payload que envía Power Automate cuando se crea/modifica un ítem en Microsoft Lists.
    Los campos deben coincidir con los que configures en el HTTP POST de Power Automate.
    owner_id debe ser el id numérico del usuario en la BD (Power Automate puede enviarlo como string, Pydantic lo coerce a int).
    """
    title: str
    description: str | None = None
    status: str | None = "nuevo"
    owner_id: int
    ms_list_id: str | None = None


@router.post("/lists")
async def receive_lists_webhook(
    payload: ListsWebhookPayload,
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    db: Session = Depends(get_session),
):
    """
    Endpoint para recibir proyectos desde Microsoft Lists via Power Automate.
    Protegido con header secreto para evitar POSTs no autorizados.
    """
    if x_webhook_secret != settings.webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook secret inválido."
        )

    data = {
        "title": payload.title,
        "description": payload.description,
        "status": payload.status or "nuevo",
        "source": "list",
        "ms_list_id": payload.ms_list_id,
    }

    project = create_project(db=db, owner_id=payload.owner_id, data=data)

    # Notificar en tiempo real al frontend — event_type debe coincidir con case en useWebSocket.ts
    await ws_manager.broadcast(
        event_type="project.webhook",
        payload={
            "project_id": project.id,
            "title": project.title,
            "owner_id": project.owner_id,
        },
    )

    return {"ok": True, "project_id": project.id}
