"""Web Push Notifications router — VAPID public key, push subscription management, and test push triggers."""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import get_current_user_optional
from ..database import get_db
from ..schemas import (
    PushSubscriptionIn,
    PushSubscriptionOut,
    VapidPublicKeyOut,
    TestPushRequest,
)
from ..services.push import (
    get_vapid_public_key,
    send_web_push,
    format_incident_push_payload,
)

logger = logging.getLogger("its_notifications")

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyOut)
async def get_public_key():
    """Return the base64url-encoded VAPID public key for Web Push subscription."""
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VAPID keys not configured on server",
        )
    return VapidPublicKeyOut(public_key=key)


@router.post("/subscribe", response_model=PushSubscriptionOut)
async def subscribe_push(
    sub: PushSubscriptionIn,
    db=Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Register or update a Web Push subscription endpoint for lockscreen alerts."""
    now = datetime.now(timezone.utc)
    user_id = current_user.get("id") if current_user else None
    username = current_user.get("username") if current_user else None

    # Upsert subscription by unique endpoint URL
    doc = {
        "endpoint": sub.endpoint,
        "keys": sub.keys.model_dump(),
        "user_id": user_id,
        "username": username,
        "lat": sub.lat,
        "lng": sub.lng,
        "radius": sub.radius if sub.radius is not None else 2.0,
        "last_active": now,
    }

    try:
        await db.push_subscriptions.update_one(
            {"endpoint": sub.endpoint},
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    except Exception as e:
        logger.error("Failed to save push subscription: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save push subscription: {str(e)}",
        )

    return PushSubscriptionOut(
        status="subscribed",
        endpoint=sub.endpoint,
        message="Web Push subscription registered successfully",
    )


@router.delete("/unsubscribe")
async def unsubscribe_push(
    endpoint: str = Query(..., description="Browser push subscription endpoint URL"),
    db=Depends(get_db),
):
    """Unregister and remove a Web Push subscription endpoint."""
    try:
        res = await db.push_subscriptions.delete_one({"endpoint": endpoint})
        deleted = res.deleted_count > 0
    except Exception as e:
        logger.error("Failed to delete push subscription: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unsubscribe: {str(e)}",
        )

    return {
        "status": "unsubscribed",
        "endpoint": endpoint,
        "deleted": deleted,
    }


@router.post("/test")
async def send_test_push(
    req: TestPushRequest,
    db=Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Dispatch a test lockscreen push notification to verify browser vibration and action buttons."""
    subscriptions = []

    if req.endpoint:
        sub_doc = await db.push_subscriptions.find_one({"endpoint": req.endpoint})
        if sub_doc:
            subscriptions.append(sub_doc)
        else:
            # Try mock format if provided
            subscriptions.append({
                "endpoint": req.endpoint,
                "keys": {"p256dh": "mock", "auth": "mock"}
            })
    elif current_user:
        cursor = db.push_subscriptions.find({"user_id": current_user.get("id")})
        subscriptions = await cursor.to_list(length=10)
    else:
        # Latest active subscription
        latest = await db.push_subscriptions.find_one(sort=[("last_active", -1)])
        if latest:
            subscriptions.append(latest)

    if not subscriptions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active push subscriptions found to test. Please enable notifications in the browser first.",
        )

    test_incident = {
        "id": req.incident_id or "inc-test-demo",
        "category": "Accident",
        "location": "Live Traffic Corridor (Nearby)",
        "full_location": "Live Traffic Corridor, Current Area",
        "severity": "High",
    }
    payload = format_incident_push_payload(test_incident, distance_meters=220)
    if req.title:
        payload["title"] = req.title
    if req.body:
        payload["body"] = req.body

    results = []
    for sub in subscriptions:
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": sub.get("keys", {}),
        }
        res = send_web_push(sub_info, payload)
        results.append({
            "endpoint": sub["endpoint"],
            "result": res,
        })
        # Clean up expired subscription if 404 or 410
        if res.get("is_expired"):
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})

    return {
        "status": "dispatched",
        "count": len(results),
        "results": results,
    }

