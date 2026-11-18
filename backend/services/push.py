"""Web Push (VAPID) service for browser lockscreen push notifications."""
import base64
import json
import logging
import math
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from pywebpush import webpush, WebPushException

logger = logging.getLogger("its_push")

# Paths and Defaults
BACKEND_DIR = Path(__file__).resolve().parent.parent
VAPID_KEYS_FILE = BACKEND_DIR / "vapid_keys.json"

DEFAULT_CLAIM_EMAIL = "mailto:support@intelligent-transportation-system.org"

_vapid_public_key: Optional[str] = None
_vapid_private_pem: Optional[str] = None
_vapid_claim_email: str = os.getenv("VAPID_CLAIM_EMAIL", DEFAULT_CLAIM_EMAIL)


def _init_vapid_keys():
    """Load or generate persistent VAPID EC P-256 keys."""
    global _vapid_public_key, _vapid_private_pem, _vapid_claim_email

    env_pub = os.getenv("VAPID_PUBLIC_KEY")
    env_priv = os.getenv("VAPID_PRIVATE_KEY")

    if env_pub and env_priv:
        _vapid_public_key = env_pub
        _vapid_private_pem = env_priv
        logger.info("Loaded VAPID keys from environment variables")
        return

    # Check if saved to vapid_keys.json
    if VAPID_KEYS_FILE.exists():
        try:
            with open(VAPID_KEYS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("public_key") and data.get("private_pem"):
                    _vapid_public_key = data["public_key"]
                    _vapid_private_pem = data["private_pem"]
                    logger.info("Loaded persistent VAPID keys from %s", VAPID_KEYS_FILE)
                    return
        except Exception as e:
            logger.warning("Could not read vapid_keys.json: %s", e)

    # Generate new persistent keys
    logger.info("Generating new VAPID keypair...")
    vapid = Vapid()
    vapid.generate_keys()

    # Raw uncompressed point encoded to base64url without padding
    raw_pub = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    b64_pub = base64.urlsafe_b64encode(raw_pub).decode().rstrip("=")
    pem_priv = vapid.private_pem().decode()

    _vapid_public_key = b64_pub
    _vapid_private_pem = pem_priv

    try:
        with open(VAPID_KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "public_key": b64_pub,
                "private_pem": pem_priv,
                "claim_email": _vapid_claim_email,
            }, f, indent=2)
        logger.info("Saved generated VAPID keys to %s", VAPID_KEYS_FILE)
    except Exception as e:
        logger.warning("Could not persist vapid_keys.json: %s", e)


def get_vapid_public_key() -> str:
    """Return the base64url-encoded VAPID public key for browser push subscriptions."""
    if _vapid_public_key is None:
        _init_vapid_keys()
    return _vapid_public_key or ""


def get_vapid_private_pem() -> str:
    """Return the private key in PEM format."""
    if _vapid_private_pem is None:
        _init_vapid_keys()
    return _vapid_private_pem or ""


def format_incident_push_payload(incident: Dict[str, Any], distance_meters: Optional[float] = None) -> Dict[str, Any]:
    """Format standardized JSON payload for Web Push notifications with lockscreen actions."""
    inc_id = incident.get("id", "inc-alert")
    category = incident.get("category", "Hazard")
    location = incident.get("location") or incident.get("full_location") or "Nearby Road"
    severity = incident.get("severity", "High")

    dist_str = f" (~{int(distance_meters)}m away)" if distance_meters is not None else ""

    title = f"🚨 {category} Alert{dist_str}"
    body = f"{severity} severity reported at {location}. Tap to verify road status or clear."

    return {
        "title": title,
        "body": body,
        "icon": "/vite.svg",
        "badge": "/vite.svg",
        "tag": f"incident-{inc_id}",
        "data": {
            "incidentId": inc_id,
            "category": category,
            "location": location,
            "severity": severity,
            "url": f"/app/incidents/{inc_id}",
        },
        "actions": [
            {
                "action": "confirm",
                "title": "Confirm Active",
            },
            {
                "action": "view",
                "title": "View on Map",
            },
        ],
        "vibrate": [200, 100, 200, 100, 200],
    }


def send_web_push(subscription_info: Dict[str, Any], payload_data: Dict[str, Any]) -> Dict[str, Any]:
    """Send an encrypted Web Push notification payload using VAPID authentication."""
    priv_pem = get_vapid_private_pem()
    if not priv_pem:
        return {"success": False, "status_code": 500, "error": "VAPID private key uninitialized"}

    endpoint = subscription_info.get("endpoint", "")
    if endpoint.startswith("local-") or endpoint.startswith("mock") or not endpoint.startswith("http"):
        return {"success": True, "status_code": 200, "simulated": True}

    try:
        response = webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload_data),
            vapid_private_key=priv_pem,
            vapid_claims={"sub": _vapid_claim_email},
            ttl=120,
        )
        status_code = response.status_code if response is not None else 200
        return {"success": True, "status_code": status_code}
    except WebPushException as ex:
        status_code = ex.response.status_code if ex.response is not None else 500
        return {
            "success": False,
            "status_code": status_code,
            "error": str(ex),
            "is_expired": status_code in (404, 410),
        }
    except Exception as ex:
        return {"success": False, "status_code": 500, "error": str(ex), "is_expired": False}


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate exact great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


async def dispatch_incident_push_notifications(
    db,
    incident: Dict[str, Any],
    exclude_user_id: Optional[str] = None,
    max_radius_km: float = 2.0,
) -> int:
    """
    Spatial Dispatcher:
    Finds push subscribers located within range of the incident and asynchronously dispatches
    native lockscreen Web Push notifications with quick verification actions.
    Automatically prunes expired subscriptions (404/410 Gone).
    """
    inc_lat = incident.get("lat")
    inc_lng = incident.get("lng")
    if inc_lat is None or inc_lng is None:
        return 0

    try:
        cursor = db.push_subscriptions.find({})
        subscriptions = await cursor.to_list(length=500)
    except Exception as e:
        logger.warning("Could not query push subscriptions: %s", e)
        return 0

    if not subscriptions:
        return 0

    now = datetime.now(timezone.utc)
    cooldown_threshold = now - timedelta(minutes=5)
    dispatched_count = 0

    for sub in subscriptions:
        sub_lat = sub.get("lat")
        sub_lng = sub.get("lng")
        if sub_lat is None or sub_lng is None:
            continue

        # Exclude reporter's own device
        if exclude_user_id and sub.get("user_id") and str(sub.get("user_id")) == str(exclude_user_id):
            continue

        # Calculate exact distance
        try:
            dist_m = haversine_meters(float(inc_lat), float(inc_lng), float(sub_lat), float(sub_lng))
        except (ValueError, TypeError):
            continue

        # Check user's alert radius (default 2km)
        user_radius_m = float(sub.get("radius", max_radius_km)) * 1000.0
        if dist_m > user_radius_m:
            continue

        # Check anti-spam frequency cap
        last_pushed = sub.get("last_pushed_at")
        if last_pushed:
            if isinstance(last_pushed, str):
                try:
                    last_pushed = datetime.fromisoformat(last_pushed)
                except Exception:
                    last_pushed = None
            if last_pushed and last_pushed.tzinfo is None:
                last_pushed = last_pushed.replace(tzinfo=timezone.utc)
            if last_pushed and last_pushed > cooldown_threshold:
                continue

        # Format payload with exact distance
        payload = format_incident_push_payload(incident, distance_meters=dist_m)
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": sub.get("keys", {}),
        }

        # Send Web Push
        res = send_web_push(sub_info, payload)
        if res.get("success"):
            dispatched_count += 1
            try:
                await db.push_subscriptions.update_one(
                    {"endpoint": sub["endpoint"]},
                    {"$set": {"last_pushed_at": now}}
                )
            except Exception:
                pass
        elif res.get("is_expired"):
            try:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
            except Exception:
                pass

    return dispatched_count

