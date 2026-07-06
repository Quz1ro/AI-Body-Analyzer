"""
Auth API routes — register, login, refresh token, email verification.
"""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_email_verification_token,
    decode_token,
)
from app.core.dependencies import get_current_user
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Rate limit for resend verification (seconds)
RESEND_COOLDOWN_SECONDS = 60


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user and return JWT tokens."""
    # Check if email is taken
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        last_verification_sent_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    # Send verification email (non-blocking via background_tasks)
    verification_token = create_email_verification_token(user.id)
    background_tasks.add_task(send_verification_email, body.email, verification_token)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        email_verified=False,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        email_verified=user.email_verified,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh the access token using a valid refresh token."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        email_verified=user.email_verified,
    )


@router.get("/verify-email")
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Verify a user's email using the token from the verification link."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "email_verify":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невірне або прострочене посилання для підтвердження",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email_verified:
        return {"message": "Email вже підтверджено", "already_verified": True}

    user.email_verified = True
    db.add(user)
    await db.flush()

    return {"message": "Email успішно підтверджено!", "already_verified": False}


@router.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend the verification email for the current user with rate-limiting."""
    if user.email_verified:
        return {"message": "Email вже підтверджено", "already_verified": True}

    # Rate-limiting: check cooldown
    now = datetime.now(timezone.utc)
    if user.last_verification_sent_at:
        last_sent = user.last_verification_sent_at
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (now - last_sent).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            remaining = int(RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Зачекайте {remaining} секунд перед повторним надсиланням",
            )

    # Update timestamp
    user.last_verification_sent_at = now
    db.add(user)
    await db.flush()

    verification_token = create_email_verification_token(user.id)
    background_tasks.add_task(send_verification_email, user.email, verification_token)

    return {"message": "Лист підтвердження надіслано повторно"}


@router.get("/verification-status")
async def verification_status(
    user: User = Depends(get_current_user),
):
    """Check the current email verification status for the authenticated user."""
    return {
        "email_verified": user.email_verified,
        "email": user.email,
    }
