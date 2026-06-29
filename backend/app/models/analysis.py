"""Analysis ORM model."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    image_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("images.id"), unique=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    keypoints: Mapped[dict] = mapped_column(JSON, nullable=False)
    proportions: Mapped[dict] = mapped_column(JSON, nullable=False)
    posture: Mapped[dict] = mapped_column(JSON, nullable=False)
    weak_zones: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    gemini_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    annotated_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now
    )

    # Relationships
    image = relationship("Image", back_populates="analysis")
    user = relationship("User", back_populates="analyses")
    recommendations = relationship("Recommendation", back_populates="analysis", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Analysis {self.id}>"
