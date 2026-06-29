"""Pydantic schemas for user profile."""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    avatar_url: str | None = None
