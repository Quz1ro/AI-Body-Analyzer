"""Recommendation ORM model."""

import uuid

from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid():
    return str(uuid.uuid4())


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid
    )
    analysis_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analyses.id"), nullable=False, index=True
    )
    muscle_group: Mapped[str] = mapped_column(String(100), nullable=False)
    exercise: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    analysis = relationship("Analysis", back_populates="recommendations")

    def __repr__(self) -> str:
        return f"<Recommendation {self.muscle_group}: {self.exercise}>"
