"""
Pydantic models for the Morphik API.
Contains all request/response models used across different API endpoints.
"""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field


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


# --- ERP Processing Models ---
class ERPImageProcessingRequest(BaseModel):
    image_path: str = Field(..., description="Path to the ERP image to process")
    force_reprocess: bool = Field(default=False, description="Force reprocessing even if metadata exists")


class ERPImageProcessingResponse(BaseModel):
    image_path: str
    extracted_metadata: Dict[str, Any]
    processing_status: str
    error_message: Optional[str] = None


class ERPBatchProcessingRequest(BaseModel):
    directory_path: str = Field(..., description="Path to directory containing ERP images")
    force_reprocess: bool = Field(default=False, description="Force reprocessing even if metadata exists")
    max_files: int = Field(default=100, ge=1, le=1000, description="Maximum number of files to process")


class ERPBatchProcessingResponse(BaseModel):
    total_files: int
    processed_files: int
    failed_files: int
    results: List[ERPImageProcessingResponse]
    processing_summary: Dict[str, Any]


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


# --- API Request Models ---
class ListDocumentsRequest(BaseModel):
    skip: int = 0
    limit: int = 10000
    filters: Optional[Dict[str, Any]] = None
    folder_name: Optional[Union[str, List[str]]] = None
    end_user_id: Optional[str] = None


# --- Batch Processing Models ---
class BatchIngestRequest(BaseModel):
    files: List[str] = Field(..., description="List of file paths to ingest")
    folder_name: Optional[str] = Field(None, description="Optional folder to organize documents")
    end_user_id: Optional[str] = Field(None, description="Optional end user ID for multi-tenant support")


class BatchIngestResponse(BaseModel):
    message: str
    task_ids: List[str]
    total_files: int
    status: str


class BatchDocumentsRequest(BaseModel):
    document_ids: List[str] = Field(..., description="List of document IDs to retrieve")
    include_content: bool = Field(default=True, description="Whether to include document content")


class BatchChunksRequest(BaseModel):
    chunk_ids: List[str] = Field(..., description="List of chunk IDs to retrieve")
    include_content: bool = Field(default=True, description="Whether to include chunk content")


# --- Folder Management Models ---
class CreateFolderRequest(BaseModel):
    folder_name: str = Field(..., description="Name of the folder to create", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="Optional description of the folder")


class FolderResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    document_count: int
    created_at: str
    updated_at: str


# --- Graph Models ---
class GraphResponse(BaseModel):
    name: str
    status: str
    description: Optional[str] = None
    created_at: Optional[str] = None
    node_count: Optional[int] = None
    edge_count: Optional[int] = None


class CreateGraphRequest(BaseModel):
    name: str = Field(..., description="Name of the graph", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="Optional description of the graph")
    document_ids: Optional[List[str]] = Field(None, description="Optional list of document IDs to include")


class UpdateGraphRequest(BaseModel):
    description: Optional[str] = Field(None, description="Updated description")
    add_document_ids: Optional[List[str]] = Field(None, description="Document IDs to add to the graph")
    remove_document_ids: Optional[List[str]] = Field(None, description="Document IDs to remove from the graph")


# --- Usage Tracking Models ---
class UsageStatsResponse(BaseModel):
    total_queries: int
    total_documents: int
    total_chunks: int
    total_graphs: int
    last_activity: Optional[str] = None


class RecentUsageResponse(BaseModel):
    recent_queries: List[Dict[str, Any]]
    recent_documents: List[Dict[str, Any]]
    activity_summary: Dict[str, Any]


# --- Cache Models ---
class CacheQueryRequest(BaseModel):
    query: str = Field(..., description="Query to check in cache")
    max_results: int = Field(default=10, ge=1, le=100, description="Maximum number of results to return")


class CacheQueryResponse(BaseModel):
    cache_hit: bool
    results: Optional[List[Dict[str, Any]]] = None
    cache_key: Optional[str] = None
