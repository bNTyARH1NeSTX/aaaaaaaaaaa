"""
Batch processing endpoints.
Handles batch operations for documents and chunks.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.documents import Document, ChunkResult
from core.models.completion import ChunkSource
from core.services.telemetry import TelemetryService
from core.services_init import document_service

router = APIRouter(prefix="/batch", tags=["Batch Operations"])
telemetry = TelemetryService()


@router.post("/documents", response_model=List[Document])
@telemetry.track(operation_type="batch_get_documents", metadata_resolver=telemetry.batch_documents_metadata)
async def batch_get_documents(
    request: Dict[str, Any], 
    auth: AuthContext = Depends(verify_token)
):
    """
    Retrieve multiple documents by their IDs.

    Args:
        request: Dictionary containing:
            - document_ids: List of document IDs to retrieve
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        List[Document]: List of retrieved documents
    """
    try:
        document_ids = request.get("document_ids", [])
        folder_name = request.get("folder_name")
        end_user_id = request.get("end_user_id")

        if not document_ids:
            raise HTTPException(status_code=400, detail="document_ids is required")

        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        return await document_service.batch_retrieve_documents(document_ids, auth, folder_name, end_user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/chunks", response_model=List[ChunkResult])
@telemetry.track(operation_type="batch_get_chunks", metadata_resolver=telemetry.batch_chunks_metadata)
async def batch_get_chunks(
    request: Dict[str, Any], 
    auth: AuthContext = Depends(verify_token)
):
    """
    Retrieve multiple chunks by their sources.

    Args:
        request: Dictionary containing:
            - sources: List of chunk sources to retrieve
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
            - use_colpali: Whether to use ColPali model
        auth: Authentication context

    Returns:
        List[ChunkResult]: List of retrieved chunks
    """
    try:
        sources = request.get("sources", [])
        folder_name = request.get("folder_name")
        end_user_id = request.get("end_user_id")
        use_colpali = request.get("use_colpali", False)

        if not sources:
            raise HTTPException(status_code=400, detail="sources is required")

        # Convert sources to ChunkSource objects
        chunk_sources = []
        for source in sources:
            if isinstance(source, dict):
                chunk_sources.append(ChunkSource(**source))
            else:
                chunk_sources.append(source)

        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        return await document_service.batch_retrieve_chunks(chunk_sources, auth, folder_name, end_user_id, use_colpali)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
