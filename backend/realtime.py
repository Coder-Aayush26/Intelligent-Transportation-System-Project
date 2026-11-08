"""Real-time streaming broker supporting WebSockets and Server-Sent Events (SSE).

Broadcasts real-time events:
- incident_created: New crowdsourced report submitted
- incident_verified: Community verification received / confidence changed
- incident_resolved: City official updated incident status or clearance
"""
import asyncio
import json
import logging
from typing import Set, List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("its.realtime")

class ConnectionManager:
    def __init__(self):
        self.active_websockets: Set[WebSocket] = set()
        self.sse_subscribers: List[asyncio.Queue] = []

    async def connect_websocket(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_websockets)}")
        # Send initial handshake confirmation
        try:
            await websocket.send_text(json.dumps({
                "type": "connected",
                "message": "Connected to ITS Live Incident Stream",
                "transport": "websocket"
            }))
        except Exception:
            self.disconnect_websocket(websocket)

    def disconnect_websocket(self, websocket: WebSocket):
        self.active_websockets.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_websockets)}")

    async def subscribe_sse(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.sse_subscribers.append(queue)
        logger.info(f"SSE client subscribed. Active SSE subscribers: {len(self.sse_subscribers)}")
        return queue

    def unsubscribe_sse(self, queue: asyncio.Queue):
        if queue in self.sse_subscribers:
            self.sse_subscribers.remove(queue)
        logger.info(f"SSE client unsubscribed. Remaining SSE subscribers: {len(self.sse_subscribers)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast an event to all connected WebSockets and SSE queues."""
        payload = {
            "type": event_type,
            "data": data,
        }
        msg_text = json.dumps(payload, default=str)

        # 1. Distribute to WebSockets
        dead_websockets = []
        for ws in list(self.active_websockets):
            try:
                await ws.send_text(msg_text)
            except Exception as e:
                logger.warning(f"Error sending to WebSocket client: {e}")
                dead_websockets.append(ws)

        for dead_ws in dead_websockets:
            self.disconnect_websocket(dead_ws)

        # 2. Distribute to SSE queues
        dead_queues = []
        sse_text = f"event: {event_type}\ndata: {msg_text}\n\n"
        for queue in list(self.sse_subscribers):
            try:
                queue.put_nowait(sse_text)
            except asyncio.QueueFull:
                dead_queues.append(queue)
            except Exception as e:
                logger.warning(f"Error queueing SSE message: {e}")
                dead_queues.append(queue)

        for dead_q in dead_queues:
            self.unsubscribe_sse(dead_q)


realtime_manager = ConnectionManager()
