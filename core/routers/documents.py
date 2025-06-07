"""
Document management endpoints.
Handles CRUD operations for documents.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.documents import Document
from core.services.document_service import DocumentService
from core.dependencies import get_document_service
from core.services.telemetry import TelemetryService
from core.routers.models import ListDocumentsRequest

router = APIRouter(prefix="/documents", tags=["Documents"])
telemetry = TelemetryService()


@router.post("", response_model=List[Document])
@telemetry.track(operation_type="list_documents", metadata_resolver=None)
async def list_documents(
    request: ListDocumentsRequest,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """
    List accessible documents.

    Args:
        request: Request body containing:
            - skip: Number of documents to skip
            - limit: Maximum number of documents to return  
            - filters: Optional metadata filters
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        List[Document]: List of accessible documents
    """
    # Create system filters for folder and user scoping
    system_filters = {}
    if request.folder_name:
        system_filters["folder_name"] = request.folder_name
    if request.end_user_id:
        system_filters["end_user_id"] = request.end_user_id
    if auth.app_id:
        system_filters["app_id"] = auth.app_id

    return await document_service.db.get_documents(auth, request.skip, request.limit, request.filters, system_filters)


@router.get("/{document_id}", response_model=Document)
@telemetry.track(operation_type="get_document", metadata_resolver=None)
async def get_document(
    document_id: str,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Get document by ID."""
    return await document_service.db.get_document(document_id, auth)


@router.get("/{document_id}/status", response_model=Dict[str, Any])
@telemetry.track(operation_type="get_document_status", metadata_resolver=None)
async def get_document_status(
    document_id: str,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Get document status by ID."""
    return await document_service.get_document_status(document_id, auth)


@router.delete("/{document_id}")
@telemetry.track(operation_type="delete_document", metadata_resolver=None)
async def delete_document(
    document_id: str,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Delete document by ID."""
    await document_service.db.delete_document(document_id, auth)
    return {"status": "ok", "message": "Document deleted successfully"}


@router.get("/filename/{filename}", response_model=Document)
@telemetry.track(operation_type="get_document_by_filename", metadata_resolver=None)
async def get_document_by_filename(
    filename: str,
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Get document by filename."""
    document = await document_service.db.get_document_by_filename(filename, auth)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


# Document update endpoints
@router.post("/{document_id}/update_text")
@telemetry.track(operation_type="update_document_text", metadata_resolver=None)
async def update_document_text(
    document_id: str,
    request: Dict[str, Any],  # Should contain "new_content"
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Update document text content."""
    try:
        new_content = request.get("new_content")
        if not new_content:
            raise HTTPException(status_code=400, detail="new_content is required")
        
        success = await document_service.db.update_document_text(document_id, new_content, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or insufficient permissions")
        
        return {"status": "success", "message": "Document text updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/update_file")
@telemetry.track(operation_type="update_document_file", metadata_resolver=None)
async def update_document_file(
    document_id: str,
    request: Dict[str, Any],  # Should contain "file_path"
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Update document with new file."""
    try:
        file_path = request.get("file_path")
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")
        
        success = await document_service.db.update_document_file(document_id, file_path, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or insufficient permissions")
        
        return {"status": "success", "message": "Document file updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/update_metadata")
@telemetry.track(operation_type="update_document_metadata", metadata_resolver=None)
async def update_document_metadata(
    document_id: str,
    request: Dict[str, Any],  # Should contain "metadata"
    auth: AuthContext = Depends(verify_token),
    document_service: DocumentService = Depends(get_document_service),
):
    """Update document metadata."""
    try:
        metadata = request.get("metadata")
        if metadata is None:
            raise HTTPException(status_code=400, detail="metadata is required")
        
        success = await document_service.db.update_document_metadata(document_id, metadata, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or insufficient permissions")
        
        return {"status": "success", "message": "Document metadata updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
