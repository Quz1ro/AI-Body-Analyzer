"""Pydantic schemas for analysis results."""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class AnalysisResponse(BaseModel):
    id: UUID
    image_id: UUID
    keypoints: dict
    proportions: dict
    posture: dict
    weak_zones: list
    gemini_analysis: dict | None = None
    annotated_image_path: str | None = None
    image_path: str | None = None
    height: float | None = None
    weight: float | None = None
    estimated_height: float | None = None
    estimated_weight: float | None = None
    recommendations: list["RecommendationResponse"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationResponse(BaseModel):
    id: UUID
    muscle_group: str
    exercise: str
    description: str
    priority: int

    model_config = {"from_attributes": True}


class AnalysisSummaryResponse(BaseModel):
    """Lightweight version for history lists."""
    id: UUID
    image_id: UUID
    proportions: dict
    weak_zones: list
    gemini_analysis: dict | None = None
    height: float | None = None
    weight: float | None = None
    estimated_height: float | None = None
    estimated_weight: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
