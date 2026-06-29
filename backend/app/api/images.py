"""
Images API routes — upload, list, delete.
"""

import uuid
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image as PILImage

from app.database import get_db
from app.models.user import User
from app.models.image import Image
from app.schemas.image import ImageResponse
from app.core.dependencies import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/images", tags=["images"])

ALLOWED_TYPES = {"image/jpeg", "image/png"}
THUMB_SIZE = (256, 256)


def _upload_dir(user_id: str) -> Path:
    p = Path(settings.UPLOAD_DIR) / str(user_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


@router.post("", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a body photo (JPG/PNG, max 10 MB)."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG and PNG files are allowed")

    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit")

    # Save original
    ext = "jpg" if file.content_type == "image/jpeg" else "png"
    file_id = str(uuid.uuid4())
    user_dir = _upload_dir(user.id)
    file_path = user_dir / f"{file_id}.{ext}"
    file_path.write_bytes(contents)

    # Generate thumbnail
    thumb_path = user_dir / f"{file_id}_thumb.{ext}"
    try:
        pil_img = PILImage.open(file_path)
        pil_img.thumbnail(THUMB_SIZE)
        pil_img.save(thumb_path)
    except Exception:
        thumb_path = None

    image = Image(
        id=file_id,
        user_id=user.id,
        file_path=str(file_path),
        thumbnail_path=str(thumb_path) if thumb_path else None,
        mime_type=file.content_type,
        file_size=len(contents),
    )
    db.add(image)
    await db.flush()

    return image


@router.get("", response_model=list[ImageResponse])
async def list_images(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all images uploaded by the current user."""
    result = await db.execute(
        select(Image).where(Image.user_id == user.id).order_by(Image.uploaded_at.desc())
    )
    return result.scalars().all()


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded image (only the owner can delete)."""
    result = await db.execute(select(Image).where(Image.id == image_id, Image.user_id == user.id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete files from disk
    for path_str in [image.file_path, image.thumbnail_path]:
        if path_str:
            try:
                os.remove(path_str)
            except OSError:
                pass

    await db.delete(image)
    await db.flush()
