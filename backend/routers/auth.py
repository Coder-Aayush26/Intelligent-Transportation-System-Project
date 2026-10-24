"""Auth router — register, login, session validation, and logout endpoints with MongoDB session storage."""
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..database import get_db
from ..auth import hash_password, verify_password, create_access_token, decode_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


# ---------- request schemas ----------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: Optional[str] = None
    login_id: Optional[str] = None
    username: Optional[str] = None
    identifier: Optional[str] = None
    password: str


# ---------- response schemas ----------

class TokenResponse(BaseModel):
    access_token: str
    session_id: str
    token_type: str = "bearer"
    user: dict


# ---------- helpers ----------

def _safe_user(user: dict) -> dict:
    """Strip password hash before returning user to client."""
    return {
        "id": str(user.get("_id", "")),
        "name": user.get("name", ""),
        "fullName": user.get("full_name", user.get("name", "")),
        "email": user.get("email", ""),
        "avatarUrl": user.get("avatar_url") or user.get("avatarUrl") or None,
        "memberSince": user.get("member_since", ""),
        "reliabilityScore": user.get("reliability_score", 3.0),
        "reliabilityLabel": user.get("reliability_label", "New Member"),
    }


async def _create_user_session(db, user: dict) -> tuple[str, str]:
    """Insert an active session record in MongoDB and return (token, session_id)."""
    session_id = uuid.uuid4().hex
    now = datetime.utcnow()
    
    session_doc = {
        "_id": session_id,
        "session_id": session_id,
        "user_id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "created_at": now,
        "last_active": now,
        "is_active": True,
    }
    await db.sessions.insert_one(session_doc)

    token = create_access_token({
        "sub": str(user["_id"]),
        "session_id": session_id,
        "email": user.get("email", ""),
        "name": user.get("name", ""),
    })
    return token, session_id


# ---------- endpoints ----------

@router.post("/register", response_model=TokenResponse, status_code=201)
@router.post("/register/", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db = Depends(get_db)):
    """Create a new user account and open an active session."""
    email = body.email.strip().lower()
    name = body.name.strip()

    if not email or not body.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required.",
        )

    safe_name_pattern = f"^{re.escape(name)}$"
    existing_user = await db.users.find_one({
        "$or": [
            {"email": email},
            {"name": {"$regex": safe_name_pattern, "$options": "i"}},
        ]
    })
    if existing_user:
        if existing_user.get("email", "").lower() == email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already taken. Please choose another name or sign in.",
            )

    user_id = uuid.uuid4().hex
    user_doc = {
        "_id": user_id,
        "name": name,
        "full_name": name,
        "email": email,
        "password_hash": hash_password(body.password),
        "member_since": datetime.utcnow().strftime("%b %Y"),
        "reliability_score": 3.0,
        "reliability_label": "New Member",
        "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(user_doc)

    token, session_id = await _create_user_session(db, user_doc)
    return TokenResponse(
        access_token=token,
        session_id=session_id,
        user=_safe_user(user_doc),
    )


@router.post("/login", response_model=TokenResponse)
@router.post("/login/", response_model=TokenResponse)
async def login(body: LoginRequest, db = Depends(get_db)):
    """Authenticate an existing user via email or Login ID / username, and start a session."""
    raw_ident = (body.identifier or body.login_id or body.username or body.email or "").strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your email address or Login ID.",
        )

    if not body.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter your password.",
        )

    # Allow login by email or by username/name (case-insensitive, regex-safe)
    safe_pattern = f"^{re.escape(raw_ident)}$"
    user = await db.users.find_one({
        "$or": [
            {"email": raw_ident.lower()},
            {"email": {"$regex": safe_pattern, "$options": "i"}},
            {"name": {"$regex": safe_pattern, "$options": "i"}},
            {"full_name": {"$regex": safe_pattern, "$options": "i"}},
        ]
    })

    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Login ID / email or password.",
        )

    token, session_id = await _create_user_session(db, user)
    return TokenResponse(
        access_token=token,
        session_id=session_id,
        user=_safe_user(user),
    )


@router.get("/session")
@router.get("/session/")
async def check_session(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """Confirm active session status and return current user details."""
    return {
        "authenticated": True,
        "user": _safe_user(current_user),
    }


@router.post("/logout")
@router.post("/logout/")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db = Depends(get_db),
):
    """Terminate the active session in MongoDB."""
    try:
        payload = decode_token(credentials.credentials)
        session_id = payload.get("session_id")
        if session_id:
            await db.sessions.delete_one({"session_id": session_id})
    except Exception:
        pass
    return {"status": "ok", "message": "Logged out successfully"}
