from fastapi import WebSocket
import json


class WebSocketManager:
    """
    Gestiona conexiones WebSocket activas y hace broadcast de eventos
    a todos los clientes conectados en tiempo real.
    """

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, payload: dict) -> None:
        """Emite un evento JSON a todos los clientes conectados."""
        message = json.dumps({"event": event_type, "data": payload})
        dead: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for ws in dead:
            self.disconnect(ws)


ws_manager = WebSocketManager()
