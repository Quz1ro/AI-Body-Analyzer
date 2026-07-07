"""
Analysis API routes — trigger analysis, get results, list history.
"""

import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.image import Image
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisResponse, AnalysisSummaryResponse
from app.core.dependencies import get_verified_user
from pydantic import BaseModel
from app.services.cv_service import run_pose_analysis
from app.services.ai_service import analyze_body_with_gemini, generate_recommendations, _calculate_overall_rating
from app.models.recommendation import Recommendation
from app.config import settings

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


async def _get_today_scan_count(user_id: str, db: AsyncSession) -> int:
    """Count how many analyses the user has created today (UTC)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(Analysis.id))
        .where(Analysis.user_id == user_id, Analysis.created_at >= today_start)
    )
    return result.scalar() or 0


@router.get("/scan-limit")
async def get_scan_limit(
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's daily scan usage and limit."""
    used = await _get_today_scan_count(user.id, db)
    limit = settings.DAILY_SCAN_LIMIT
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    reset_seconds = int((tomorrow - now).total_seconds())
    return {
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "resets_in_seconds": reset_seconds,
    }


@router.post("", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    image_id: str,
    height: float | None = None,
    weight: float | None = None,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Run pose estimation and body analysis on an uploaded image."""
    # ── Daily scan limit check ───────────────────────────────
    used_today = await _get_today_scan_count(user.id, db)
    if used_today >= settings.DAILY_SCAN_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Денний ліміт сканувань вичерпано ({settings.DAILY_SCAN_LIMIT}/{settings.DAILY_SCAN_LIMIT}). Спробуйте завтра.",
        )

    # Verify image belongs to user
    result = await db.execute(select(Image).where(Image.id == image_id, Image.user_id == user.id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Check if analysis already exists
    existing = await db.execute(select(Analysis).where(Analysis.image_id == image_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Analysis already exists for this image")

    # Run CV analysis (first pass to get raw proportions for Gemini)
    try:
        analysis_data = await run_pose_analysis(image.file_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Analysis failed: {str(e)}")

    # Run Gemini multimodal analysis
    try:
        gemini_result = await analyze_body_with_gemini(
            image.file_path,
            analysis_data["proportions"],
            analysis_data.get("keypoints"),
            user_height=height,
            user_weight=weight
        )
    except Exception:
        gemini_result = None

    # If Gemini returns corrected coordinates, rerun CV analysis with these coordinates
    if gemini_result and gemini_result.get("corrected_keypoints"):
        legs_score = gemini_result.get("muscle_groups", {}).get("legs", {}).get("score", 0.0)
        is_torso = gemini_result.get("photo_type") == "torso_only"
        legs_visible_flag = (not is_torso) and (legs_score > 0.0)
        try:
            analysis_data = await run_pose_analysis(
                image.file_path,
                corrected_keypoints=gemini_result["corrected_keypoints"],
                legs_visible=legs_visible_flag
            )
        except Exception:
            pass

    analysis = Analysis(
        image_id=image.id,
        user_id=user.id,
        keypoints=analysis_data["keypoints"],
        proportions=analysis_data["proportions"],
        posture=analysis_data["posture"],
        weak_zones=analysis_data["weak_zones"],
        gemini_analysis=gemini_result,
        annotated_image_path=analysis_data.get("annotated_image_path"),
        height=height,
        weight=weight,
        estimated_height=gemini_result.get("estimated_height") if gemini_result else None,
        estimated_weight=gemini_result.get("estimated_weight") if gemini_result else None,
    )
    db.add(analysis)
    await db.flush()

    # Reload with recommendations and image
    result = await db.execute(
        select(Analysis)
        .where(Analysis.id == analysis.id)
        .options(selectinload(Analysis.recommendations), selectinload(Analysis.image))
    )
    analysis = result.scalar_one()
    analysis.image_path = image.file_path

    return analysis


@router.get("", response_model=list[AnalysisSummaryResponse])
async def list_analyses(
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analyses for the current user (lightweight summaries)."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single analysis with full details and recommendations."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.id == analysis_id, Analysis.user_id == user.id)
        .options(selectinload(Analysis.recommendations), selectinload(Analysis.image))
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if analysis.image:
        analysis.image_path = analysis.image.file_path
        
    return analysis


class RecalculateRequest(BaseModel):
    keypoints: dict


@router.post("/{analysis_id}/recalculate", response_model=AnalysisResponse)
async def recalculate_analysis(
    analysis_id: str,
    body: RecalculateRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Update coordinates manually, run pose estimation & update Gemini analysis."""
    # 1. Fetch analysis
    result = await db.execute(
        select(Analysis)
        .where(Analysis.id == analysis_id, Analysis.user_id == user.id)
        .options(selectinload(Analysis.recommendations), selectinload(Analysis.image))
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    # 2. Get original image
    image = analysis.image
    if not image:
        raise HTTPException(status_code=404, detail="Associated image not found")
        
    # 3. Format keypoints for run_pose_analysis
    corrected_kp = {}
    for name, kp in body.keypoints.items():
        if isinstance(kp, dict) and "x" in kp and "y" in kp:
            corrected_kp[name] = [kp["x"], kp["y"]]
        elif isinstance(kp, list) and len(kp) == 2:
            corrected_kp[name] = kp

    # Determine if legs are visible from previous Gemini analysis
    legs_score = 1.0
    is_torso = False
    if analysis.gemini_analysis:
        legs_score = analysis.gemini_analysis.get("muscle_groups", {}).get("legs", {}).get("score", 1.0)
        is_torso = analysis.gemini_analysis.get("photo_type") == "torso_only"
    legs_visible_flag = (not is_torso) and (legs_score > 0.0)

    # 4. Re-run CV analysis with custom coordinates
    try:
        analysis_data = await run_pose_analysis(
            image.file_path,
            corrected_keypoints=corrected_kp,
            legs_visible=True
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Recalculation failed: {str(e)}")

    # 5. Simply update the ratios in Gemini analysis without running API
    gemini_result = analysis.gemini_analysis or {}
    proportions = analysis_data["proportions"]
    
    gemini_result["waist_shoulder_ratio"] = proportions.get("waist_to_shoulder_ratio", 0.75)
    gemini_result["torso_leg_ratio"] = proportions.get("torso_leg_ratio", 0.55)
    
    # Recalculate overall rating using the formula
    gemini_result["overall_rating"] = _calculate_overall_rating(gemini_result, proportions)

    # 6. Update analysis records
    analysis.keypoints = analysis_data["keypoints"]
    analysis.proportions = proportions
    analysis.posture = analysis_data["posture"]
    analysis.weak_zones = analysis_data["weak_zones"]
    analysis.gemini_analysis = gemini_result
    analysis.annotated_image_path = analysis_data.get("annotated_image_path")
    
    # 7. Re-generate recommendations
    analysis.recommendations.clear()
    
    recs = await generate_recommendations(analysis_data)
    for r in recs:
        analysis.recommendations.append(
            Recommendation(
                muscle_group=r["muscle_group"],
                exercise=r["exercise"],
                description=r["description"],
                priority=r["priority"]
            )
        )
        
    await db.commit()
    
    # Attach image_path
    analysis.image_path = image.file_path
    return analysis


class UpdateMetricsRequest(BaseModel):
    height: float | None = None
    weight: float | None = None


@router.patch("/{analysis_id}/metrics", response_model=AnalysisResponse)
async def update_analysis_metrics(
    analysis_id: str,
    body: UpdateMetricsRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's height and weight for an analysis."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.id == analysis_id, Analysis.user_id == user.id)
        .options(selectinload(Analysis.recommendations), selectinload(Analysis.image))
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    if body.height is not None:
        analysis.height = body.height
    if body.weight is not None:
        analysis.weight = body.weight
        
    # Recalculate BF and dryness
    if analysis.gemini_analysis:
        from app.services.ai_service import adjust_bf_and_dryness, _calculate_overall_rating
        adjusted_gemini = adjust_bf_and_dryness(analysis.gemini_analysis, analysis.height, analysis.weight)
        # Recalculate rating
        adjusted_gemini["overall_rating"] = _calculate_overall_rating(adjusted_gemini, analysis.proportions)
        analysis.gemini_analysis = adjusted_gemini
        
    await db.commit()
    
    # Attach image_path
    if analysis.image:
        analysis.image_path = analysis.image.file_path
        
    return analysis
