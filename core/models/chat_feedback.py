"""
Chat feedback models for storing user ratings and feedback on chat responses.
"""

from datetime import UTC, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatFeedback(BaseModel):
    """Model for chat feedback (thumbs up/down)."""
    
    id: Optional[str] = None
    conversation_id: str = Field(..., description="ID of the conversation")
    query: str = Field(..., description="Original user query")
    response: str = Field(..., description="AI response that was rated")
    rating: Literal["up", "down"] = Field(..., description="User rating: up (positive) or down (negative)")
    comment: Optional[str] = Field(None, description="Optional user comment")
    user_id: Optional[str] = Field(None, description="User who provided the feedback")
    model_used: Optional[str] = Field(None, description="AI model that generated the response")
    relevant_images: Optional[int] = Field(None, description="Number of relevant images found")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ChatFeedbackRequest(BaseModel):
    """Request model for submitting chat feedback."""
    
    conversation_id: str = Field(..., description="ID of the conversation")
    query: str = Field(..., description="Original user query")
    response: str = Field(..., description="AI response being rated")
    rating: Literal["up", "down"] = Field(..., description="User rating")
    comment: Optional[str] = Field(None, description="Optional user comment")
    model_used: Optional[str] = Field(None, description="AI model that generated the response")
    relevant_images: Optional[int] = Field(None, description="Number of relevant images found")


class ChatFeedbackResponse(BaseModel):
    """Response model for feedback operations."""
    
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Success or error message")
    feedback_id: Optional[str] = Field(None, description="ID of the created/updated feedback")


class ChatFeedbackSummary(BaseModel):
    """Summary statistics for chat feedback."""
    
    total_feedback: int = Field(..., description="Total number of feedback entries")
    positive_feedback: int = Field(..., description="Number of positive ratings")
    negative_feedback: int = Field(..., description="Number of negative ratings")
    positive_percentage: float = Field(..., description="Percentage of positive feedback")
    most_recent_feedback: Optional[ChatFeedback] = Field(None, description="Most recent feedback entry")
