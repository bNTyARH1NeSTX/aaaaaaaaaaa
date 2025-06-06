"""
Query and completion endpoints.
Handles query processing and AI agent interactions.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.completion import CompletionResponse
from core.models.request import CompletionQueryRequest, AgentQueryRequest
from core.models.prompts import validate_prompt_overrides_with_http_exception
from core.services.telemetry import TelemetryService
from core.services_init import document_service
from core.agent import MorphikAgent

router = APIRouter(tags=["Query"])
telemetry = TelemetryService()

# Initialize MorphikAgent
morphik_agent = MorphikAgent(document_service=document_service)


@router.post("/query", response_model=CompletionResponse)
@telemetry.track(operation_type="query", metadata_resolver=telemetry.query_metadata)
async def query_completion(
    request: CompletionQueryRequest, 
    auth: AuthContext = Depends(verify_token)
):
    """
    Process a query using the completion system.

    Args:
        request: CompletionQueryRequest containing:
            - query: The user's query text
            - filters: Optional metadata filters
            - k: Number of documents to retrieve (default: 5)
            - min_score: Minimum relevance score (default: 0.0)
            - max_tokens: Maximum tokens in response (default: 1000)
            - temperature: Sampling temperature (default: 0.0)
            - use_reranking: Whether to use reranking (default: True)
            - use_colpali: Whether to use ColPali model (default: None)
            - graph_name: Optional graph to search in
            - hop_depth: Graph traversal depth (default: 1)
            - include_paths: Include graph paths in response (default: False)
            - prompt_overrides: Custom prompt configurations
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
            - schema: Optional JSON schema for structured output
        auth: Authentication context

    Returns:
        CompletionResponse: Generated completion with sources and metadata
    """
    try:
        return await document_service.query(
            request.query,
            auth,
            request.filters,
            request.k,
            request.min_score,
            request.max_tokens,
            request.temperature,
            request.use_reranking,
            request.use_colpali,
            request.graph_name,
            request.hop_depth,
            request.include_paths,
            request.prompt_overrides,
            request.folder_name,
            request.end_user_id,
            request.schema,
        )
    except ValueError as e:
        validate_prompt_overrides_with_http_exception(operation_type="query", error=e)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/agent", response_model=CompletionResponse)
@telemetry.track(operation_type="agent", metadata_resolver=telemetry.agent_metadata)
async def agent_completion(
    request: AgentQueryRequest, 
    auth: AuthContext = Depends(verify_token)
):
    """
    Process a query using the agent system with tools.

    Args:
        request: AgentQueryRequest containing:
            - query: The user's query text
            - filters: Optional metadata filters
            - k: Number of documents to retrieve (default: 5)
            - max_tokens: Maximum tokens in response (default: 1000)
            - temperature: Sampling temperature (default: 0.0)
            - graph_name: Optional graph to search in
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        CompletionResponse: Generated completion with tools usage and sources
    """
    try:
        return await morphik_agent.query(
            request.query,
            auth,
            request.filters,
            request.k,
            request.max_tokens,
            request.temperature,
            request.graph_name,
            request.folder_name,
            request.end_user_id,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in agent query: {str(e)}")
