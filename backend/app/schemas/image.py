"""Pydantic schemas for images."""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class ImageResponse(BaseModel):
    id: UUID
    file_path: str
    thumbnail_path: str | None = None
    mime_type: str
    file_size: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}
