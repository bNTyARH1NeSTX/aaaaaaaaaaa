"""
Folder management endpoints.
Handles folder operations and document organization.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.folders import Folder, FolderCreate
from core.models.request import SetFolderRuleRequest
from core.services.telemetry import TelemetryService
from core.services_init import document_service
from core.logging_config import logger

router = APIRouter(prefix="/folders", tags=["Folders"])
telemetry = TelemetryService()


@router.post("", response_model=Folder)
@telemetry.track(operation_type="create_folder", metadata_resolver=telemetry.create_folder_metadata)
async def create_folder(
    request: FolderCreate,
    auth: AuthContext = Depends(verify_token),
):
    """
    Create a new folder.

    Args:
        request: FolderCreate containing:
            - name: Name of the folder
            - description: Optional description
            - metadata: Optional metadata dictionary
        auth: Authentication context

    Returns:
        Folder: Created folder object
    """
    try:
        folder = await document_service.create_folder(
            name=request.name,
            description=request.description,
            metadata=request.metadata,
            auth=auth,
        )
        return folder
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[Folder])
@telemetry.track(operation_type="list_folders", metadata_resolver=telemetry.list_folders_metadata)
async def list_folders(
    auth: AuthContext = Depends(verify_token),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all folders accessible to the user.

    Args:
        auth: Authentication context
        skip: Number of folders to skip (pagination)
        limit: Maximum number of folders to return

    Returns:
        List[Folder]: List of folder objects
    """
    try:
        folders = await document_service.db.get_folders(auth, skip=skip, limit=limit)
        return folders
    except Exception as e:
        logger.error(f"Error listing folders: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{folder_id}", response_model=Folder)
@telemetry.track(operation_type="get_folder", metadata_resolver=telemetry.get_folder_metadata)
async def get_folder(
    folder_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Get a specific folder by ID.

    Args:
        folder_id: ID of the folder to retrieve
        auth: Authentication context

    Returns:
        Folder: Folder object
    """
    try:
        folder = await document_service.db.get_folder(folder_id, auth)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        return folder
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting folder {folder_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{folder_name}")
@telemetry.track(operation_type="delete_folder", metadata_resolver=telemetry.delete_folder_metadata)
async def delete_folder(
    folder_name: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Delete a folder by name.

    Args:
        folder_name: Name of the folder to delete
        auth: Authentication context

    Returns:
        Dict with success message
    """
    try:
        success = await document_service.delete_folder(folder_name, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        return {"status": "ok", "message": f"Folder '{folder_name}' deleted successfully"}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting folder {folder_name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{folder_id}/rules")
@telemetry.track(operation_type="set_folder_rule", metadata_resolver=telemetry.set_folder_rule_metadata)
async def set_folder_rule(
    folder_id: str,
    request: SetFolderRuleRequest,
    auth: AuthContext = Depends(verify_token),
):
    """
    Set rules for a folder.

    Args:
        folder_id: ID of the folder to update
        request: SetFolderRuleRequest containing:
            - rules: List of rules to apply to the folder
        auth: Authentication context

    Returns:
        Dict with success message
    """
    try:
        success = await document_service.set_folder_rules(
            folder_id=folder_id,
            rules=request.rules,
            auth=auth,
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        return {"status": "ok", "message": f"Rules set for folder '{folder_id}'"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error setting rules for folder {folder_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{folder_id}/documents/{document_id}")
@telemetry.track(
    operation_type="add_document_to_folder", 
    metadata_resolver=telemetry.add_document_to_folder_metadata
)
async def add_document_to_folder(
    folder_id: str,
    document_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Add a document to a folder.

    Args:
        folder_id: ID of the folder
        document_id: ID of the document to add
        auth: Authentication context

    Returns:
        Dict with success message
    """
    try:
        success = await document_service.add_document_to_folder(
            folder_id=folder_id,
            document_id=document_id,
            auth=auth,
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Folder or document not found")
        
        return {"status": "ok", "message": f"Document '{document_id}' added to folder '{folder_id}'"}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding document {document_id} to folder {folder_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{folder_id}/documents/{document_id}")
@telemetry.track(
    operation_type="remove_document_from_folder", 
    metadata_resolver=telemetry.remove_document_from_folder_metadata
)
async def remove_document_from_folder(
    folder_id: str,
    document_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Remove a document from a folder.

    Args:
        folder_id: ID of the folder
        document_id: ID of the document to remove
        auth: Authentication context

    Returns:
        Dict with success message
    """
    try:
        success = await document_service.remove_document_from_folder(
            folder_id=folder_id,
            document_id=document_id,
            auth=auth,
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Folder or document not found")
        
        return {"status": "ok", "message": f"Document '{document_id}' removed from folder '{folder_id}'"}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error removing document {document_id} from folder {folder_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
