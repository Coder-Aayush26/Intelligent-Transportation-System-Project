"""Auth utilities — password hashing with native bcrypt, JWT creation, and MongoDB session tracking."""
import os
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .database import get_db

# ---------- config ----------
SECRET_KEY = os.getenv("JWT_SECRET", "its-super-secret-key-change-in-production")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days default

bearer = HTTPBearer()


# ---------- password helpers (native bcrypt) ----------

def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pwd_bytes = plain.encode('utf-8')[:72]
        return bcrypt.checkpw(pwd_bytes, hashed.encode('utf-8'))
    except Exception:
        return False


# ---------- JWT helpers ----------

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------- FastAPI dependency with MongoDB Session verification ----------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db = Depends(get_db),
):
    """FastAPI dependency — validates JWT token and confirms active session in MongoDB."""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    session_id = payload.get("session_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # If session_id is present, verify active session in MongoDB
    if session_id:
        session = await db.sessions.find_one({"session_id": session_id, "is_active": True})
        if not session:
            session = await db.sessions.find_one({"session_id": session_id})
            if session and session.get("is_active") is False:
                session = None
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session has ended. Please log in again."
            )
        # Touch last_active
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"last_active": datetime.utcnow()}}
        )

    # 1. First check separate authority personnel table: db.authorities
    authority_user = await db.authorities.find_one({"_id": user_id})
    if not authority_user:
        authority_user = await db.authorities.find_one({"id": user_id})
    if not authority_user and payload.get("email"):
        authority_user = await db.authorities.find_one({"email": payload.get("email")})
    if not authority_user and payload.get("officer_id"):
        authority_user = await db.authorities.find_one({"officer_id": payload.get("officer_id")})

    if authority_user:
        authority_user["is_authority"] = True
        return authority_user

    # 2. Otherwise look up in citizens collection: db.users
    user = await db.users.find_one({"_id": user_id})
    if not user:
        try:
            from bson import ObjectId
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not user:
        user = await db.users.find_one({"id": user_id})
    if not user and payload.get("email"):
        user = await db.users.find_one({"email": payload.get("email")})

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
    db = Depends(get_db),
):
    """Returns the user document if token is valid, otherwise None."""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def is_authority_user(user: dict) -> bool:
    """Check if the user is an authorized official, traffic police officer, or administrator."""
    if not user:
        return False
    role = str(user.get("role", "")).lower()
    if role in ("official", "admin", "authority", "traffic_police", "police", "operator"):
        return True
    email = str(user.get("email", "")).lower()
    if any(k in email for k in ("admin", "official", "gov.in", "police", "its-admin")):
        return True
    return False


async def get_current_authority_user(
    current_user: dict = Depends(get_current_user),
):
    """Enforces that the current authenticated user has official or administrative authority privileges."""
    if not is_authority_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted. Only authorized municipal city officials, traffic police, and administrators may access authority operations.",
        )
    return current_user
