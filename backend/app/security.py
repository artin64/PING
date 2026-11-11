from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import ACCESS_TOKEN_MINUTES, JWT_ALGORITHM, JWT_SECRET
from app.db import get_db, set_tenant_scope
from app.models import AuthSession, User, utc_now


password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)
DUMMY_PASSWORD_HASH = password_hash.hash("pingo-login-timing-placeholder")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def verify_unknown_user(password: str) -> None:
    password_hash.verify(password, DUMMY_PASSWORD_HASH)


def create_access_token(user_id: str, session_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": user_id, "sid": session_id, "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to continue",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "sid", "exp"]},
        )
        user_id = payload.get("sub")
        session_id = payload.get("sid")
    except InvalidTokenError:
        raise unauthorized
    if not isinstance(user_id, str) or not user_id or not isinstance(session_id, str) or not session_id:
        raise unauthorized
    set_tenant_scope(db, user_id)
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.owner_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utc_now(),
        )
    )
    if session is None:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user

