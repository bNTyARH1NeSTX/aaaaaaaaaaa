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
from core.services.manual_generator_service import ManualGeneratorService

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
    generator_service: ManualGeneratorService = Depends(get_manual_generator_service),
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
                # Use manual generator service with Qwen2.5-VL (default)
                logger.info("Generating response using manual generation model (Qwen2.5-VL)")
                
                if relevant_images_metadata:
                    # Use RAG with images
                    generated_result = await generator_service.generate_manual_text(
                        query=request.query,
                        images_metadata=relevant_images_metadata,
                    )
                else:
                    # Text-only generation with manual generator
                    generated_result = await generator_service.generate_manual_text(
                        query=request.query,
                        images_metadata=[],  # Empty list for text-only generation
                    )
                
                if isinstance(generated_result, dict):
                    ai_response = generated_result.get('manual_text', str(generated_result))
                else:
                    ai_response = str(generated_result)
                    
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
            logger.error(f"Error generating AI response: {str(e)}", exc_info=True)
            ai_response = f"Lo siento, ocurrió un error al generar la respuesta: {str(e)}"
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
        
        logger.info(f"Chat query processed successfully for conversation {conversation_id}")
        
        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
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
