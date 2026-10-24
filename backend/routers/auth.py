"""Auth router — register and login endpoints."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from ..database import get_db
from ..auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- request schemas ----------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------- response schemas ----------

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ---------- endpoints ----------

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db = Depends(get_db)):
    """Create a new user account."""
    # Normalise email
    email = body.email.strip().lower()

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_id = uuid.uuid4().hex
    user_doc = {
        "_id": user_id,
        "name": body.name.strip(),
        "full_name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        "member_since": datetime.utcnow().strftime("%b %Y"),
        "reliability_score": 3.0,
        "reliability_label": "New Member",
        "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(user_doc)

    token = create_access_token({"sub": user_id, "email": email, "name": body.name.strip()})
    return TokenResponse(
        access_token=token,
        user=_safe_user(user_doc),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db = Depends(get_db)):
    """Authenticate an existing user and return a JWT."""
    email = body.email.strip().lower()

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
    })
    return TokenResponse(
        access_token=token,
        user=_safe_user(user),
    )


# ---------- helper ----------

def _safe_user(user: dict) -> dict:
    """Strip the password hash before returning user data to the client."""
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "fullName": user.get("full_name", ""),
        "email": user.get("email", ""),
        "memberSince": user.get("member_since", ""),
        "reliabilityScore": user.get("reliability_score", 3.0),
        "reliabilityLabel": user.get("reliability_label", "New Member"),
    }
