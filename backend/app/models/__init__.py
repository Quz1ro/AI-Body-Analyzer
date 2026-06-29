"""ORM models package — import all models so Alembic picks them up."""

from app.models.user import User
from app.models.image import Image
from app.models.analysis import Analysis
from app.models.recommendation import Recommendation
from app.models.chat_message import ChatMessage

__all__ = ["User", "Image", "Analysis", "Recommendation", "ChatMessage"]
