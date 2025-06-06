"""
Graph management endpoints.
Handles knowledge graph operations.
"""

import logging
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.request import (
    CreateGraphRequest,
    UpdateGraphRequest,
    GraphResponse,
    transform_graph_to_frontend_format
)
from core.models.graph import Entity, Relationship
from core.services.telemetry import TelemetryService
from core.services_init import document_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Graphs"])
telemetry = TelemetryService()


@router.get("/graphs", response_model=List[GraphResponse])
@telemetry.track(operation_type="list_graphs", metadata_resolver=None)
async def list_graphs(
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
) -> List[GraphResponse]:
    """
    List all graphs the user has access to.

    This endpoint retrieves all graphs the user has access to
    and transforms them to frontend-compatible format.

    Args:
        auth: Authentication context
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        List[GraphResponse]: List of graph objects in frontend format
    """
    try:
        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            if isinstance(folder_name, list):
                system_filters["folder_name"] = folder_name
            else:
                system_filters["folder_name"] = [folder_name]
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        graphs = await document_service.db.list_graphs(auth, system_filters=system_filters)
        return [transform_graph_to_frontend_format(graph) for graph in graphs]
    except Exception as e:
        logger.error(f"Error listing graphs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/{name}", response_model=GraphResponse)
@telemetry.track(operation_type="get_graph", metadata_resolver=telemetry.get_graph_metadata)
async def get_graph(
    name: str,
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
) -> GraphResponse:
    """
    Get a specific graph by name.

    Args:
        name: Name of the graph to retrieve
        auth: Authentication context
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        GraphResponse: Graph object in frontend format
    """
    try:
        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            if isinstance(folder_name, list):
                system_filters["folder_name"] = folder_name
            else:
                system_filters["folder_name"] = [folder_name]
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        graph = await document_service.db.get_graph(name, auth, system_filters=system_filters)
        if not graph:
            raise HTTPException(status_code=404, detail="Graph not found")
        
        return transform_graph_to_frontend_format(graph)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting graph {name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/create", response_model=GraphResponse)
@telemetry.track(operation_type="create_graph", metadata_resolver=telemetry.create_graph_metadata)
async def create_graph(
    request: CreateGraphRequest,
    auth: AuthContext = Depends(verify_token),
) -> GraphResponse:
    """
    Create a new knowledge graph.

    Args:
        request: CreateGraphRequest containing:
            - name: Name of the graph
            - description: Optional description (for documentation purposes)
            - documents: Optional list of document IDs to include
            - filters: Optional metadata filters for document selection
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
            - prompt_overrides: Optional custom prompts for entity/relationship extraction
        auth: Authentication context

    Returns:
        GraphResponse: Created graph object in frontend format
    """
    try:
        # Build system filters from folder_name and end_user_id
        system_filters = {}
        if request.folder_name:
            system_filters["folder_name"] = request.folder_name
        if request.end_user_id:
            system_filters["end_user_id"] = request.end_user_id
        
        graph = await document_service.create_graph(
            name=request.name,
            auth=auth,
            filters=request.filters,
            documents=request.documents,
            prompt_overrides=request.prompt_overrides,
            system_filters=system_filters if system_filters else None,
        )
        
        return transform_graph_to_frontend_format(graph)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating graph: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/{name}/update", response_model=GraphResponse)
@telemetry.track(operation_type="update_graph", metadata_resolver=telemetry.update_graph_metadata)
async def update_graph(
    name: str,
    request: UpdateGraphRequest,
    auth: AuthContext = Depends(verify_token),
) -> GraphResponse:
    """
    Update an existing knowledge graph.

    Args:
        name: Name of the graph to update
        request: UpdateGraphRequest containing:
            - description: Optional new description
            - documents: Optional list of document IDs to add
            - filters: Optional metadata filters for document selection
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        GraphResponse: Updated graph object in frontend format
    """
    try:
        graph = await document_service.update_graph(
            name=name,
            description=request.description,
            documents=request.documents,
            filters=request.filters,
            auth=auth,
            folder_name=request.folder_name,
            end_user_id=request.end_user_id,
        )
        
        if not graph:
            raise HTTPException(status_code=404, detail="Graph not found")
        
        return transform_graph_to_frontend_format(graph)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating graph {name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/graph/{name}")
@telemetry.track(operation_type="delete_graph", metadata_resolver=telemetry.delete_graph_metadata)
async def delete_graph(
    name: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Delete a knowledge graph.

    Args:
        name: Name of the graph to delete
        auth: Authentication context

    Returns:
        Dict with success message
    """
    try:
        success = await document_service.delete_graph(name, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Graph not found")
        
        return {"status": "ok", "message": f"Graph '{name}' deleted successfully"}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting graph {name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/{name}/visualization")
@telemetry.track(operation_type="get_graph_visualization", metadata_resolver=telemetry.get_graph_metadata)
async def get_graph_visualization(
    name: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Get graph visualization data.

    Args:
        name: Name of the graph to visualize
        auth: Authentication context

    Returns:
        Graph visualization data with nodes and edges
    """
    try:
        visualization_data = await document_service.get_graph_visualization_data(name, auth)
        if not visualization_data:
            raise HTTPException(status_code=404, detail="Graph not found")
        
        return visualization_data
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting graph visualization for {name}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/workflow/{workflow_id}/status")
@telemetry.track(operation_type="get_workflow_status", metadata_resolver=telemetry.workflow_status_metadata)
async def get_workflow_status(
    workflow_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Get the status of a graph creation workflow.

    Args:
        workflow_id: ID of the workflow to check
        auth: Authentication context

    Returns:
        Workflow status information
    """
    try:
        status = await document_service.get_workflow_status(workflow_id, auth)
        if not status:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        return status
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting workflow status for {workflow_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class EntityExtractionRequest(BaseModel):
    """Request model for entity extraction"""
    content: str
    doc_id: Optional[str] = "demo_doc"
    chunk_number: Optional[int] = 0

class EntityExtractionResponse(BaseModel):
    """Response model for entity extraction"""
    entities: List[dict]
    relationships: List[dict]
    adaptive_entity_types: List[str]

@router.post("/graphs/extract-entities", response_model=EntityExtractionResponse)
@telemetry.track(operation_type="extract_entities", metadata_resolver=None)
async def extract_entities(
    request: EntityExtractionRequest,
    auth: AuthContext = Depends(verify_token),
) -> EntityExtractionResponse:
    """
    Extract entities and relationships from text using adaptive AI.
    
    This endpoint demonstrates the AI Adaptive Entity Extraction feature
    that automatically determines the most relevant entity types based
    on document content analysis.

    Args:
        request: Entity extraction request with content
        auth: Authentication context

    Returns:
        EntityExtractionResponse: Extracted entities, relationships, and adaptive types
    """
    try:
        # Get the graph service
        graph_service = document_service.graph_service
        
        # First, determine the adaptive entity types
        adaptive_types = await graph_service._determine_adaptive_entity_types(
            content=request.content,
            num_types=5
        )
        
        # Extract entities and relationships using adaptive types
        entities, relationships = await graph_service.extract_entities_from_text(
            content=request.content,
            doc_id=request.doc_id,
            chunk_number=request.chunk_number
        )
        
        # Convert entities to dict format for JSON response
        entities_dict = []
        for entity in entities:
            entities_dict.append({
                "label": entity.label,
                "type": entity.type,
                "properties": entity.properties if hasattr(entity, 'properties') else {}
            })
        
        # Convert relationships to dict format for JSON response
        relationships_dict = []
        for relationship in relationships:
            relationships_dict.append({
                "source": relationship.source,
                "target": relationship.target,
                "relationship": relationship.relationship,
                "properties": relationship.properties if hasattr(relationship, 'properties') else {}
            })
        
        return EntityExtractionResponse(
            entities=entities_dict,
            relationships=relationships_dict,
            adaptive_entity_types=adaptive_types
        )
        
    except Exception as e:
        logger.error(f"Error extracting entities: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error extracting entities: {str(e)}")
