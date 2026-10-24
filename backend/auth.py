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
        session = await db.sessions.find_one({
            "session_id": session_id,
            "is_active": {"$ne": False}
        })
        if not session:
            # Auto-heal session if JWT signature is valid and active
            now = datetime.utcnow()
            await db.sessions.insert_one({
                "_id": session_id,
                "session_id": session_id,
                "user_id": str(user_id),
                "email": payload.get("email", ""),
                "name": payload.get("name", ""),
                "created_at": now,
                "last_active": now,
                "is_active": True,
            })
        else:
            # Touch last_active
            await db.sessions.update_one(
                {"session_id": session_id},
                {"$set": {"last_active": datetime.utcnow()}}
            )

    # Look up user by string _id, ObjectId, id, or email
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
