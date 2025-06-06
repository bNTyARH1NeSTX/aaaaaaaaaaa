"""
Document and chunk retrieval endpoints.
Handles semantic search and retrieval operations.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from core.auth_utils import verify_token
from core.models.user import AuthContext
from core.models.retrieval import RetrieveRequest, DocumentResult, ChunkResult
from core.services.document_service import DocumentService
from core.dependencies import get_document_service
from core.telemetry import TelemetryService
from core.logging_config import logger

router = APIRouter(prefix="/retrieve", tags=["Retrieval"])
telemetry = TelemetryService()


@router.post("/docs", response_model=List[DocumentResult])
@telemetry.track(operation_type="retrieve_docs", metadata_resolver=None)
async def retrieve_docs(
    request: RetrieveRequest,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
) -> List[DocumentResult]:
    """
    Retrieve documents based on a query.

    Args:
        request: Retrieval request
        auth: Authentication context

    Returns:
        List[DocumentResult]: List of retrieved documents
    """
    # Parse request
    query = request.query
    filters = request.filters or {}
    limit = request.limit or 5
    rerank = request.rerank if request.rerank is not None else True

    try:
        # Get user permissions
        end_user_id = None
        folder_filters = []

        # Get document results
        result = await document_service.retrieve_docs(
            query, 
            auth, 
            filters, 
            limit, 
            rerank=rerank,
            end_user_id=end_user_id,
            folder_filters=folder_filters,
        )
        
        return result
    except Exception as e:
        logger.error(f"Error retrieving documents: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving documents: {str(e)}")


@router.post("/chunks", response_model=List[ChunkResult])
@telemetry.track(operation_type="retrieve_chunks", metadata_resolver=None)
async def retrieve_chunks(
    request: RetrieveRequest,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
) -> List[ChunkResult]:
    """
    Retrieve chunks based on a query.

    Args:
        request: Retrieval request
        auth: Authentication context

    Returns:
        List[ChunkResult]: List of retrieved chunks
    """
    # Parse request
    query = request.query
    filters = request.filters or {}
    limit = request.limit or 5
    rerank = request.rerank if request.rerank is not None else True

    try:
        # Get document results
        result = await document_service.retrieve_chunks(
            query, 
            auth, 
            filters, 
            limit, 
            rerank=rerank
        )
        
        return result
    except Exception as e:
        logger.error(f"Error retrieving chunks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving chunks: {str(e)}")
