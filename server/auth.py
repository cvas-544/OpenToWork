"""
OpenToWork — Auth utilities
JWT creation/validation + password hashing
"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET  = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGO    = "HS256"
JWT_EXPIRY  = 30  # days

bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        data["sub"] = int(data["sub"])
        return data
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(bearer)) -> dict:
    return decode_token(credentials.credentials)


def require_admin(credentials: HTTPAuthorizationCredentials = Security(bearer)) -> dict:
    user = decode_token(credentials.credentials)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user
