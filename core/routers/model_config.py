"""
Model configuration router for managing AI models used in different components.
Handles selection and configuration of completion, graph, embedding, and agent models.
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import get_settings
from core.models.auth import AuthContext
from core.auth_utils import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["Model Configuration"])


# Request/Response Models
class RegisteredModel(BaseModel):
    """Registered model configuration"""
    model_name: str
    provider: str = "litellm"
    api_base: str = None
    api_version: str = None
    deployment_id: str = None
    vision: bool = False


class ModelConfiguration(BaseModel):
    """Current model configuration"""
    completion_model: str
    graph_model: str
    embedding_model: str
    agent_model: str
    registered_models: Dict[str, RegisteredModel]


class ModelSelectionRequest(BaseModel):
    """Request to update model selection"""
    model_type: str = Field(..., description="Type of model (completion, graph, embedding, agent)")
    model_key: str = Field(..., description="Key of the registered model to use")


class ModelSelectionResponse(BaseModel):
    """Response after updating model selection"""
    success: bool
    message: str
    updated_model: str
    model_type: str


@router.get("/configuration", response_model=ModelConfiguration)
async def get_available_models(
    auth: AuthContext = Depends(verify_token)
) -> ModelConfiguration:
    """
    Get all available models and current configuration.
    
    Returns:
        ModelConfiguration: Current model configuration and available models
    """
    try:
        settings = get_settings()
        
        # Convert registered models to the response format
        registered_models = {}
        for key, config in settings.REGISTERED_MODELS.items():
            registered_models[key] = RegisteredModel(
                model_name=config.get("model_name", key),
                provider=config.get("provider", "litellm"),
                api_base=config.get("api_base"),
                api_version=config.get("api_version"),
                deployment_id=config.get("deployment_id"),
                vision=config.get("vision", False)
            )
        
        return ModelConfiguration(
            completion_model=settings.COMPLETION_MODEL or "",
            graph_model=settings.GRAPH_MODEL or "",
            embedding_model=settings.EMBEDDING_MODEL or "",
            agent_model=settings.AGENT_MODEL or "",
            registered_models=registered_models
        )
        
    except Exception as e:
        logger.error(f"Error fetching model configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching model configuration: {str(e)}")


@router.get("/current", response_model=ModelConfiguration)
async def get_current_model_configuration(
    auth: AuthContext = Depends(verify_token)
) -> ModelConfiguration:
    """
    Get current model configuration.
    
    Returns:
        ModelConfiguration: Current active model configuration
    """
    # For now, this is the same as get_available_models
    # In the future, this could be different if we have runtime model switching
    return await get_available_models(auth)


@router.post("/update", response_model=ModelSelectionResponse)
async def update_model_selection(
    request: ModelSelectionRequest,
    auth: AuthContext = Depends(verify_token)
) -> ModelSelectionResponse:
    """
    Update model selection for a specific component.
    
    Note: This endpoint currently logs the change but doesn't persist it.
    In a production environment, this would update the configuration file or database.
    
    Args:
        request: Model selection request
        
    Returns:
        ModelSelectionResponse: Result of the update operation
    """
    try:
        settings = get_settings()
        
        # Validate model type
        valid_types = ["completion", "graph", "embedding", "agent"]
        if request.model_type not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid model type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Validate model key exists in registered models
        if request.model_key not in settings.REGISTERED_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"Model key '{request.model_key}' not found in registered models"
            )
        
        # Log the model change
        logger.info(f"Model selection updated: {request.model_type} -> {request.model_key}")
        logger.info(f"User: {auth.user_id}, Entity: {auth.entity_id}")
        
        # TODO: In production, persist this change to configuration
        # This could involve:
        # 1. Updating the morphik.toml file
        # 2. Storing user preferences in database
        # 3. Runtime model switching without restart
        
        return ModelSelectionResponse(
            success=True,
            message=f"Model selection updated successfully. {request.model_type} model is now {request.model_key}",
            updated_model=request.model_key,
            model_type=request.model_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating model selection: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating model selection: {str(e)}")


@router.get("/registered", response_model=Dict[str, RegisteredModel])
async def get_registered_models(
    auth: AuthContext = Depends(verify_token)
) -> Dict[str, RegisteredModel]:
    """
    Get all registered models.
    
    Returns:
        Dict[str, RegisteredModel]: Dictionary of registered models
    """
    try:
        settings = get_settings()
        
        registered_models = {}
        for key, config in settings.REGISTERED_MODELS.items():
            registered_models[key] = RegisteredModel(
                model_name=config.get("model_name", key),
                provider=config.get("provider", "litellm"),
                api_base=config.get("api_base"),
                api_version=config.get("api_version"),
                deployment_id=config.get("deployment_id"),
                vision=config.get("vision", False)
            )
        
        return registered_models
        
    except Exception as e:
        logger.error(f"Error fetching registered models: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching registered models: {str(e)}")


@router.get("/health")
async def model_router_health():
    """Health check endpoint for model router"""
    return {"status": "healthy", "router": "models"}
