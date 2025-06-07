from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel, Field

from core.models.documents import Document
from core.models.prompts import GraphPromptOverrides, QueryPromptOverrides
from core.models.graph import Graph, Entity, Relationship


# --- Manual Generation Models ---
class ManualGenerationRequest(BaseModel):
    query: str = Field(..., description="The main query or task for generating the manual content.")
    image_path: Optional[str] = Field(default=None, description="Optional path to a specific pre-selected image to use.")
    image_prompt: Optional[str] = Field(default=None, description="The descriptive prompt associated with the pre-selected image, if image_path is provided. This text describes the image content for the VLM.")
    k_images: int = Field(default=1, ge=1, le=5, description="Number of relevant images to find and use if image_path is not specified.")


class ManualGenerationResponse(BaseModel):
    generated_text: str
    relevant_images_used: List[Dict[str, Any]]  # e.g., [{"image_path": "...", "prompt": "...", "respuesta": "..."}]
    query: str


class PowerPointGenerationRequest(BaseModel):
    query: str = Field(..., description="The main query or task for generating the manual content.")
    image_path: Optional[str] = Field(default=None, description="Optional path to a specific pre-selected image to use.")
    image_prompt: Optional[str] = Field(default=None, description="The descriptive prompt associated with the pre-selected image.")
    k_images: int = Field(default=3, ge=1, le=5, description="Number of relevant images to find and use if image_path is not specified.")


# --- Rule Template Models ---
class RuleTemplateRequest(BaseModel):
    name: str = Field(..., description="Name of the rule template", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="Optional description of the rule template", max_length=500)
    rules_json: str = Field(..., description="JSON string containing the rules configuration")


class RuleTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    rules_json: str
    created_at: str
    updated_at: str


# --- ERP Processing Models ---
class ERPImageProcessingRequest(BaseModel):
    image_path: str = Field(..., description="Path to the ERP image to process")
    force_reprocess: bool = Field(default=False, description="Force reprocessing even if metadata exists")


class ERPImageProcessingResponse(BaseModel):
    image_path: str
    extracted_metadata: Dict[str, Any]
    processing_status: str
    error_message: Optional[str] = None


# Frontend Graph Response Models
class GraphNode(BaseModel):
    """Node model for frontend graph visualization"""

    id: str
    label: str
    data: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """Edge model for frontend graph visualization"""

    id: str
    source: str
    target: str
    label: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class GraphResponse(BaseModel):
    """Response model for graph with frontend-compatible format"""

    id: str
    name: str
    description: Optional[str] = None
    type: Optional[str] = None
    created_at: str
    updated_at: str
    nodes_count: int = 0
    edges_count: int = 0
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    document_ids: List[str] = Field(default_factory=list)


class RetrieveRequest(BaseModel):
    """Base retrieve request model"""

    query: str = Field(..., min_length=1)
    filters: Optional[Dict[str, Any]] = None
    k: int = Field(default=4, gt=0)
    min_score: float = Field(default=0.0)
    use_reranking: Optional[bool] = None  # If None, use default from config
    use_colpali: Optional[bool] = None
    graph_name: Optional[str] = Field(
        None, description="Name of the graph to use for knowledge graph-enhanced retrieval"
    )
    hop_depth: Optional[int] = Field(1, description="Number of relationship hops to traverse in the graph", ge=1, le=3)
    include_paths: Optional[bool] = Field(False, description="Whether to include relationship paths in the response")
    folder_name: Optional[Union[str, List[str]]] = Field(
        None,
        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
    )
    end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")


class CompletionQueryRequest(RetrieveRequest):
    """Request model for completion generation"""

    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    prompt_overrides: Optional[QueryPromptOverrides] = Field(
        None,
        description="Optional customizations for entity extraction, resolution, and query prompts",
    )
    schema: Optional[Union[Type[BaseModel], Dict[str, Any]]] = Field(
        None,
        description="Schema for structured output, can be a Pydantic model or JSON schema dict",
    )


class IngestTextRequest(BaseModel):
    """Request model for ingesting text content"""

    content: str
    filename: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    rules: List[Dict[str, Any]] = Field(default_factory=list)
    use_colpali: Optional[bool] = None
    folder_name: Optional[str] = Field(None, description="Optional folder scope for the operation")
    end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")


class CreateGraphRequest(BaseModel):
    """Request model for creating a graph"""

    name: str = Field(..., description="Name of the graph to create")
    filters: Optional[Dict[str, Any]] = Field(
        None, description="Optional metadata filters to determine which documents to include"
    )
    documents: Optional[List[str]] = Field(None, description="Optional list of specific document IDs to include")
    prompt_overrides: Optional[GraphPromptOverrides] = Field(
        None,
        description="Optional customizations for entity extraction and resolution prompts",
        json_schema_extra={
            "example": {
                "entity_extraction": {
                    "prompt_template": "Extract entities from the following text: {content}\n{examples}",
                    "examples": [{"label": "Example", "type": "ENTITY"}],
                }
            }
        },
    )
    folder_name: Optional[Union[str, List[str]]] = Field(
        None,
        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
    )
    end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")


class UpdateGraphRequest(BaseModel):
    """Request model for updating a graph"""

    additional_filters: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional additional metadata filters to determine which new documents to include",
    )
    additional_documents: Optional[List[str]] = Field(
        None, description="Optional list of additional document IDs to include"
    )
    prompt_overrides: Optional[GraphPromptOverrides] = Field(
        None, description="Optional customizations for entity extraction and resolution prompts"
    )
    folder_name: Optional[Union[str, List[str]]] = Field(
        None,
        description="Optional folder scope for the operation. Accepts a single folder name or a list of folder names.",
    )
    end_user_id: Optional[str] = Field(None, description="Optional end-user scope for the operation")


class BatchIngestResponse(BaseModel):
    """Response model for batch ingestion"""

    documents: List[Document]
    errors: List[Dict[str, str]]


class BatchIngestJobResponse(BaseModel):
    """Response model for batch ingestion jobs"""

    status: str = Field(..., description="Status of the batch operation")
    documents: List[Document] = Field(..., description="List of created documents with processing status")
    timestamp: str = Field(..., description="ISO-formatted timestamp")


class GenerateUriRequest(BaseModel):
    """Request model for generating a cloud URI"""

    app_id: str = Field(..., description="ID of the application")
    name: str = Field(..., description="Name of the application")
    user_id: str = Field(..., description="ID of the user who owns the app")
    expiry_days: int = Field(default=30, description="Number of days until the token expires")


# Add these classes before the extract_folder_data endpoint
class MetadataExtractionRuleRequest(BaseModel):
    """Request model for metadata extraction rule"""

    type: str = "metadata_extraction"  # Only metadata_extraction supported for now
    schema: Dict[str, Any]


class SetFolderRuleRequest(BaseModel):
    """Request model for setting folder rules"""

    rules: List[MetadataExtractionRuleRequest]


class AgentQueryRequest(BaseModel):
    """Request model for agent queries"""

    query: str = Field(..., description="Natural language query for the Morphik agent")


def transform_graph_to_frontend_format(graph: Graph) -> GraphResponse:
    """Transform internal Graph model to frontend-compatible format"""

    # Transform entities to nodes
    nodes = []
    for entity in graph.entities:
        node = GraphNode(
            id=entity.id,
            label=entity.label,
            data={
                "type": entity.type,
                "properties": entity.properties,
                "document_ids": entity.document_ids,
                "chunk_sources": entity.chunk_sources,
            },
        )
        nodes.append(node)

    # Transform relationships to edges
    edges = []
    for relationship in graph.relationships:
        edge = GraphEdge(
            id=relationship.id,
            source=relationship.source_id,
            target=relationship.target_id,
            label=relationship.type,
            data={
                "document_ids": relationship.document_ids,
                "chunk_sources": relationship.chunk_sources,
            },
        )
        edges.append(edge)

    return GraphResponse(
        id=graph.id,
        name=graph.name,
        description=graph.metadata.get("description"),
        type=graph.metadata.get("type"),
        created_at=graph.created_at.isoformat(),
        updated_at=graph.updated_at.isoformat(),
        nodes_count=len(nodes),
        edges_count=len(edges),
        nodes=nodes,
        edges=edges,
        metadata=graph.metadata,
        document_ids=graph.document_ids,
    )
