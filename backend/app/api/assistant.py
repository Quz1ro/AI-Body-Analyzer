"""
AI Assistant API — chat with context of user profile and analysis.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.analysis import Analysis
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageResponse
from app.core.dependencies import get_verified_user
from fastapi.responses import StreamingResponse
from app.services.ai_service import generate_chat_reply, stream_chat_reply

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI assistant and get a response."""
    # Optionally load analysis context
    analysis_context = None
    if body.analysis_id:
        result = await db.execute(
            select(Analysis).where(
                Analysis.id == body.analysis_id, Analysis.user_id == user.id
            )
        )
        analysis = result.scalar_one_or_none()
        if analysis:
            analysis_context = {
                "proportions": analysis.proportions,
                "posture": analysis.posture,
                "weak_zones": analysis.weak_zones,
                "gemini_analysis": analysis.gemini_analysis,
            }

    # Load recent chat history (last 10 messages) for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # Save user message
    user_msg = ChatMessage(
        user_id=user.id,
        analysis_id=str(body.analysis_id) if body.analysis_id else None,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Generate AI reply
    reply_text = await generate_chat_reply(
        user_message=body.message,
        user_name=user.name,
        analysis_context=analysis_context,
        chat_history=[(m.role, m.content) for m in history],
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        user_id=user.id,
        analysis_id=str(body.analysis_id) if body.analysis_id else None,
        role="assistant",
        content=reply_text,
    )
    db.add(assistant_msg)
    await db.flush()

    return ChatResponse(reply=reply_text, message_id=assistant_msg.id)


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI assistant and stream the response in real-time."""
    # Optionally load analysis context
    analysis_context = None
    if body.analysis_id:
        result = await db.execute(
            select(Analysis).where(
                Analysis.id == body.analysis_id, Analysis.user_id == user.id
            )
        )
        analysis = result.scalar_one_or_none()
        if analysis:
            analysis_context = {
                "proportions": analysis.proportions,
                "posture": analysis.posture,
                "weak_zones": analysis.weak_zones,
                "gemini_analysis": analysis.gemini_analysis,
            }

    # Load recent chat history (last 10 messages) for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = list(reversed(history_result.scalars().all()))

    # Save user message
    user_msg = ChatMessage(
        user_id=user.id,
        analysis_id=str(body.analysis_id) if body.analysis_id else None,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.commit()

    async def event_generator():
        full_reply = []
        try:
            async for chunk in stream_chat_reply(
                user_message=body.message,
                user_name=user.name,
                analysis_context=analysis_context,
                chat_history=[(m.role, m.content) for m in history],
            ):
                full_reply.append(chunk)
                yield chunk
        except Exception as e:
            err_msg = f"\n[Помилка генерації: {str(e)}]"
            full_reply.append(err_msg)
            yield err_msg
        finally:
            reply_text = "".join(full_reply)
            if reply_text:
                # Save assistant message in a dedicated local session since request DB session is cleaned up
                from app.database import async_session
                async with async_session() as local_db:
                    assistant_msg = ChatMessage(
                        user_id=user.id,
                        analysis_id=str(body.analysis_id) if body.analysis_id else None,
                        role="assistant",
                        content=reply_text,
                    )
                    local_db.add(assistant_msg)
                    await local_db.commit()

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=list[ChatMessageResponse])
async def get_history(
    analysis_id: str | None = None,
    limit: int = 50,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the chat history for the current user, optionally filtered by analysis context."""
    query = select(ChatMessage).where(ChatMessage.user_id == user.id)
    if analysis_id:
        query = query.where(ChatMessage.analysis_id == analysis_id)
    else:
        query = query.where(ChatMessage.analysis_id.is_(None))

    result = await db.execute(
        query.order_by(ChatMessage.created_at.desc()).limit(min(limit, 100))
    )
    return list(reversed(result.scalars().all()))
