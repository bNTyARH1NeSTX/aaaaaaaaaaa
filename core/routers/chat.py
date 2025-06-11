"""
Chat Router for manual generation functionality using RAG with ColPali.
Handles chat interactions with AI models and image retrieval using ColPali embeddings.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth_utils import verify_token
from core.config import get_settings
from core.models.auth import AuthContext
from core.models.chat import ChatMessage, ChatConversation
from core.services.telemetry import TelemetryService
from core.embedding.manual_generation_embedding_model import ManualGenerationEmbeddingModel
from core.services.chat_service import ChatService
from core.services.manual_generator_service import ManualGeneratorService
from core.models.chat_feedback import ChatFeedbackRequest, ChatFeedbackResponse, ChatFeedbackSummary
from core.services_init import database

logger = logging.getLogger(__name__)

# Router setup
chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
    responses={404: {"description": "Not found"}},
)

# Initialize telemetry service
telemetry = TelemetryService()

# Dependency providers
_manual_gen_embedding_model_instance: Optional[ManualGenerationEmbeddingModel] = None
_manual_generator_service_instance: Optional[ManualGeneratorService] = None
_chat_service_instance: Optional[ChatService] = None

def get_manual_generation_embedding_model() -> ManualGenerationEmbeddingModel:
    """Get or create the manual generation embedding model instance."""
    global _manual_gen_embedding_model_instance
    if _manual_gen_embedding_model_instance is None:
        settings = get_settings()
        logger.info("Initializing ManualGenerationEmbeddingModel instance for chat.")
        _manual_gen_embedding_model_instance = ManualGenerationEmbeddingModel(settings=settings)
    return _manual_gen_embedding_model_instance

def get_manual_generator_service() -> ManualGeneratorService:
    """Get or create the manual generator service instance."""
    global _manual_generator_service_instance
    if _manual_generator_service_instance is None:
        settings = get_settings()
        logger.info("Initializing ManualGeneratorService instance for chat.")
        _manual_generator_service_instance = ManualGeneratorService(settings=settings)
    return _manual_generator_service_instance

def get_chat_service() -> ChatService:
    """Get or create the chat service instance."""
    global _chat_service_instance
    if _chat_service_instance is None:
        settings = get_settings()
        logger.info("Initializing ChatService instance.")
        _chat_service_instance = ChatService()
        
        # Initialize chat service with manual generation model components
        generator_service = get_manual_generator_service()
        if hasattr(generator_service, 'model') and hasattr(generator_service, 'processor') and hasattr(generator_service, 'image_folder'):
            _chat_service_instance.initialize(
                model=generator_service.model,
                processor=generator_service.processor,
                image_folder=generator_service.image_folder
            )
        else:
            logger.warning("Manual generator service not properly initialized, chat service may not work correctly.")
    return _chat_service_instance

# Pydantic Models for Chat API
class ChatRequest(BaseModel):
    """Chat request model."""
    query: str = Field(..., description="User message/query")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for continuity")
    k_images: Optional[int] = Field(3, description="Number of relevant images to retrieve")
    temperature: Optional[float] = Field(0.7, description="Sampling temperature for AI model")
    max_tokens: Optional[int] = Field(1000, description="Maximum tokens in response")
    model_type: Optional[str] = Field("manual_generation", description="Model type: 'manual_generation' (default) or 'openai'")
    use_images: Optional[bool] = Field(True, description="Whether to use ColPali image retrieval")

class ChatResponse(BaseModel):
    """Chat response model."""
    response: str = Field(..., description="AI response message")
    conversation_id: str = Field(..., description="Conversation ID")
    response_id: str = Field(..., description="Unique ID for this specific response (for feedback)")
    relevant_images: Optional[List[Dict[str, Any]]] = Field(None, description="Relevant images found")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class ConversationHistoryResponse(BaseModel):
    """Conversation history response model."""
    conversation_id: str
    messages: List[ChatMessage]
    created_at: str
    updated_at: str

@chat_router.post("/query", response_model=ChatResponse)
@telemetry.track(operation_type="chat_query", metadata_resolver=None)
async def chat_query(
    request: ChatRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
    chat_service: ChatService = Depends(get_chat_service),
):
    """
    Process a chat query using RAG with ColPali image retrieval and AI model generation.
    
    This endpoint:
    1. Uses ColPali to find relevant ERP images based on the query
    2. Uses the fine-tuned Qwen model (or specified model) to generate a response
    3. Maintains conversation history
    4. Returns AI response with relevant images and metadata
    """
    try:
        # Generate or use existing conversation ID
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        logger.info(f"Processing chat query: '{request.query[:100]}...' for conversation {conversation_id}")
        
        relevant_images_metadata = []
        
        # Step 1: Retrieve relevant images using ColPali if enabled
        if request.use_images:
            try:
                logger.info(f"Finding relevant images for query: '{request.query}' with k={request.k_images}")
                found_docs = await embedding_model.find_relevant_images(
                    query=request.query,
                    k=request.k_images or 3,
                )
                
                if found_docs:
                    for doc in found_docs:
                        relevant_images_metadata.append({
                            "image_path": doc.image_path,
                            "prompt": doc.prompt or "",
                            "respuesta": doc.respuesta or "",
                            "module": doc.module,
                            "section": doc.section,
                            "function_detected": doc.function_detected,
                        })
                    logger.info(f"Found {len(relevant_images_metadata)} relevant images for chat query.")
                else:
                    logger.info("No relevant images found for chat query.")
                    
            except Exception as e:
                logger.warning(f"Error finding relevant images for chat: {str(e)}")
                # Continue without images if there's an error
        
        # Step 2: Generate AI response using the appropriate model
        try:
            # Determine which model to use
            model_type = request.model_type or "manual_generation"
            
            if model_type == "manual_generation":
                # Use chat service with Qwen2.5-VL (default)
                logger.info("Generating chat response using manual generation model (Qwen2.5-VL)")
                
                # Get conversation history for context
                conversation_history = []
                # Note: In a real implementation, you'd retrieve conversation history from database
                # For now, we'll just use the current query
                
                ai_response = await chat_service.generate_chat_response(
                    query=request.query,
                    images_metadata=relevant_images_metadata,
                    conversation_history=conversation_history
                )
                    
                used_model = "Qwen2.5-VL-3B-Instruct (Fine-tuned)"
                
            elif model_type == "openai":
                # Use OpenAI model via document service
                logger.info("Generating response using OpenAI model")
                
                # Import document service for OpenAI fallback
                from core.services_init import document_service
                from core.models.request import CompletionQueryRequest
                
                # Create completion request for OpenAI
                completion_request = CompletionQueryRequest(
                    query=request.query,
                    k=request.k_images or 3,
                    temperature=request.temperature or 0.7,
                    max_tokens=request.max_tokens or 1000,
                )
                
                # Use document service for OpenAI completion
                completion_response = await document_service.query(
                    query=completion_request.query,
                    auth=auth,  # Pass auth context
                    filters=None,
                    k=completion_request.k,
                    temperature=completion_request.temperature,
                    max_tokens=completion_request.max_tokens,
                )
                
                ai_response = completion_response.completion
                used_model = "OpenAI GPT-4o-mini"
                
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
                
        except Exception as e:
            logger.error(f"Error generating chat response: {str(e)}", exc_info=True)
            ai_response = "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo."
            used_model = f"Error with {request.model_type or 'manual_generation'}"
        
        # Step 3: Prepare response metadata
        response_metadata = {
            "model_used": used_model,
            "model_type": model_type,
            "images_found": len(relevant_images_metadata),
            "use_images": request.use_images,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # TODO: Store conversation history in database if needed
        # For now, we just return the response
        
        # Generate unique response ID for feedback linking
        response_id = str(uuid.uuid4())
        
        logger.info(f"Chat query processed successfully for conversation {conversation_id}, response_id: {response_id}")
        
        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
            response_id=response_id,
            relevant_images=relevant_images_metadata if request.use_images else None,
            metadata=response_metadata,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing chat query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing chat query: {str(e)}")

@chat_router.get("/conversation/{conversation_id}", response_model=ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Get conversation history for a specific conversation ID.
    
    Note: This is a placeholder implementation. In a real system, you would
    store and retrieve conversation history from a database.
    """
    try:
        # TODO: Implement actual conversation storage and retrieval
        # For now, return empty history
        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            messages=[],
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        logger.error(f"Error retrieving conversation history: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation history: {str(e)}")

@chat_router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """Delete a conversation and its history."""
    try:
        # TODO: Implement actual conversation deletion
        # For now, just return success
        logger.info(f"Conversation {conversation_id} deleted (placeholder implementation)")
        return {"message": f"Conversation {conversation_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(e)}")

@chat_router.post("/models/switch")
async def switch_chat_model(
    model_name: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Switch the AI model used for chat responses.
    
    Note: This is a placeholder for future implementation of dynamic model switching.
    """
    try:
        # TODO: Implement dynamic model switching
        logger.info(f"Model switch requested to: {model_name} (placeholder implementation)")
        return {"message": f"Model switched to {model_name} (placeholder)", "current_model": model_name}
    except Exception as e:
        logger.error(f"Error switching model: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error switching model: {str(e)}")

# Chat Feedback Endpoints

@chat_router.post("/feedback", response_model=ChatFeedbackResponse)
@telemetry.track(operation_type="chat_feedback", metadata_resolver=None)
async def submit_chat_feedback(
    request: ChatFeedbackRequest,
    auth: AuthContext = Depends(verify_token),
):
    """
    Submit feedback (thumbs up/down) for a chat response.
    
    This endpoint allows users to rate chat responses and provide optional comments.
    The feedback is stored in the database for analysis and improvement.
    """
    try:
        # Generate feedback ID
        import uuid
        feedback_id = str(uuid.uuid4())
        
        # Store feedback in database
        success = await database.store_chat_feedback(
            feedback_id=feedback_id,
            conversation_id=request.conversation_id,
            query=request.query,
            response=request.response,
            rating=request.rating,
            comment=request.comment,
            user_id=auth.user_id,
            model_used=request.model_used,
            relevant_images=request.relevant_images
        )
        
        if success:
            logger.info(f"Stored chat feedback {feedback_id} for conversation {request.conversation_id}")
            return ChatFeedbackResponse(
                success=True,
                message="Feedback submitted successfully",
                feedback_id=feedback_id
            )
        else:
            logger.error(f"Failed to store chat feedback for conversation {request.conversation_id}")
            return ChatFeedbackResponse(
                success=False,
                message="Failed to submit feedback",
                feedback_id=None
            )
            
    except Exception as e:
        logger.error(f"Error submitting chat feedback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")

@chat_router.get("/feedback", response_model=List[Dict[str, Any]])
async def get_chat_feedback(
    auth: AuthContext = Depends(verify_token),
    skip: int = 0,
    limit: int = 100,
    rating_filter: Optional[str] = None,
    model_filter: Optional[str] = None,
):
    """
    Get chat feedback entries with optional filtering.
    
    This endpoint returns a list of feedback entries that can be filtered by:
    - Rating (up/down)
    - Model used
    - Pagination (skip/limit)
    """
    try:
        # Validate rating filter
        if rating_filter and rating_filter not in ['up', 'down']:
            raise HTTPException(status_code=400, detail="rating_filter must be 'up' or 'down'")
        
        # Get feedback from database
        feedback_list = await database.get_chat_feedback(
            auth=auth,
            skip=skip,
            limit=limit,
            rating_filter=rating_filter,
            model_filter=model_filter
        )
        
        logger.info(f"Retrieved {len(feedback_list)} feedback entries for user {auth.user_id}")
        return feedback_list
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving chat feedback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving feedback: {str(e)}")

@chat_router.get("/feedback/stats", response_model=Dict[str, Any])
async def get_chat_feedback_stats(
    auth: AuthContext = Depends(verify_token),
):
    """
    Get statistics about chat feedback.
    
    Returns aggregated data about user feedback including:
    - Total feedback count
    - Thumbs up/down breakdown
    - Model performance statistics
    """
    try:
        stats = await database.get_chat_feedback_stats(auth=auth)
        
        logger.info(f"Retrieved feedback stats for user {auth.user_id}: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Error retrieving feedback stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving feedback stats: {str(e)}")

@chat_router.delete("/feedback/{feedback_id}")
async def delete_chat_feedback(
    feedback_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Delete a specific feedback entry.
    
    Users can only delete their own feedback entries unless they have admin permissions.
    """
    try:
        success = await database.delete_chat_feedback(
            feedback_id=feedback_id,
            auth=auth
        )
        
        if success:
            logger.info(f"Deleted chat feedback {feedback_id}")
            return {"message": "Feedback deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Feedback not found or not authorized to delete")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat feedback: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting feedback: {str(e)}")
