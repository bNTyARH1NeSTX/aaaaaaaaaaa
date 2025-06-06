import asyncio
import base64
import json
import logging
import uuid
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import arq
import jwt
import tomli
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status, UploadFile, File, Form, Header, Query # Added Query
from fastapi.middleware.cors import CORSMiddleware  # Import CORSMiddleware
from fastapi.responses import FileResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field # Added BaseModel, Field

from core.agent import MorphikAgent
from core.app_factory import lifespan
from core.auth_utils import verify_token
from core.config import get_settings
from core.database.postgres_database import PostgresDatabase
from core.dependencies import get_redis_pool
from core.limits_utils import check_and_increment_limits, estimate_pages_by_chars
from core.models.auth import AuthContext, EntityType
from core.models.completion import ChunkSource, CompletionResponse
from core.models.documents import ChunkResult, Document, DocumentResult
from core.models.folders import Folder, FolderCreate
from core.models.graph import Graph
from core.models.prompts import validate_prompt_overrides_with_http_exception
from core.models.request import (
    AgentQueryRequest,
    BatchIngestResponse,
    CompletionQueryRequest,
    CreateGraphRequest,
    GenerateUriRequest,
    GraphResponse,
    IngestTextRequest,
    RetrieveRequest,
    SetFolderRuleRequest,
    transform_graph_to_frontend_format,
    UpdateGraphRequest,
)
from core.services.telemetry import TelemetryService
from core.services_init import document_service, storage

# Import new services and models for manual generation
from core.embedding.manual_generation_embedding_model import ManualGenerationEmbeddingModel
from core.services.manual_generator_service import ManualGeneratorService
from core.models.manual_generation_document import ManualGenDocument

# Import API routers from refactored modules
from core.api.batch import router as batch_router
from core.api.cache import router as cache_router
from core.api.documents import router as documents_router
from core.api.folders import router as folders_router
from core.api.graphs import router as graphs_router
from core.api.health import router as health_router
from core.api.ingest import router as ingest_router
from core.api.manual_generation_router import manual_generation_router
from core.api.query import router as query_router
from core.api.retrieval import router as retrieval_router
from core.api.rule_templates import router as rule_templates_router
from core.api.usage import router as usage_router

# Initialize FastAPI app
logger = logging.getLogger(__name__)
# ---------------------------------------------------------------------------
# Application instance & core initialisation (moved lifespan, rest unchanged)
# ---------------------------------------------------------------------------

app = FastAPI(lifespan=lifespan)

# Add CORS middleware (same behaviour as before refactor)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise telemetry service
telemetry = TelemetryService()

# OpenTelemetry instrumentation – exclude noisy spans/headers
FastAPIInstrumentor.instrument_app(
    app,
    excluded_urls="health,health/.*",
    exclude_spans=["send", "receive"],
    http_capture_headers_server_request=None,
    http_capture_headers_server_response=None,
    tracer_provider=None,
)

# Global settings object
settings = get_settings()

# ---------------------------------------------------------------------------
# Session cookie behaviour differs between cloud / self-hosted
# ---------------------------------------------------------------------------

if settings.MODE == "cloud":
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SESSION_SECRET_KEY,
        same_site="none",
        https_only=True,
    )
else:
    app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY)


# Simple health check endpoint
@app.get("/ping")
async def ping_health():
    """Simple health check endpoint that returns 200 OK."""
    return {"status": "ok", "message": "Server is running"}


# ---------------------------------------------------------------------------
# Core singletons (database, vector store, storage, parser, models …)
# ---------------------------------------------------------------------------


# Store on app.state for later access
app.state.document_service = document_service
logger.info("Document service initialized and stored on app.state")

# Single MorphikAgent instance (tool definitions cached)
morphik_agent = MorphikAgent(document_service=document_service)


logger.info("Enterprise edition (ee) module is not used in this setup.")

# --- Pydantic Models for Manual Generation ---
class ManualGenerationRequest(BaseModel):
    query: str = Field(..., description="The main query or task for generating the manual content.")
    image_path: Optional[str] = Field(default=None, description="Optional path to a specific pre-selected image to use.")
    image_prompt: Optional[str] = Field(default=None, description="The descriptive prompt associated with the pre-selected image, if image_path is provided. This text describes the image content for the VLM.")
    k_images: int = Field(default=1, ge=1, le=5, description="Number of relevant images to find and use if image_path is not specified.")

class ManualGenerationResponse(BaseModel):
    generated_text: str
    relevant_images_used: List[Dict[str, Any]] # e.g., [{"image_path": "...", "prompt": "...", "respuesta": "..."}]
    query: str

class PowerPointGenerationRequest(BaseModel):
    query: str = Field(..., description="The main query or task for generating the manual content.")
    image_path: Optional[str] = Field(default=None, description="Optional path to a specific pre-selected image to use.")
    image_prompt: Optional[str] = Field(default=None, description="The descriptive prompt associated with the pre-selected image.")
    k_images: int = Field(default=3, ge=1, le=5, description="Number of relevant images to find and use if image_path is not specified.")

# --- Pydantic Models for Rule Templates ---
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

# --- Pydantic Models for API Requests ---
class ListDocumentsRequest(BaseModel):
    skip: int = 0
    limit: int = 10000
    filters: Optional[Dict[str, Any]] = None
    folder_name: Optional[Union[str, List[str]]] = None
    end_user_id: Optional[str] = None

# --- Dependency Providers for Manual Generation ---
_manual_gen_embedding_model_instance: Optional[ManualGenerationEmbeddingModel] = None
_manual_generator_service_instance: Optional[ManualGeneratorService] = None

def get_manual_generation_embedding_model() -> ManualGenerationEmbeddingModel:
    global _manual_gen_embedding_model_instance
    if _manual_gen_embedding_model_instance is None:
        logger.info("Initializing ManualGenerationEmbeddingModel instance.")
        _manual_gen_embedding_model_instance = ManualGenerationEmbeddingModel(settings=settings)
    return _manual_gen_embedding_model_instance

def get_manual_generator_service() -> ManualGeneratorService:
    global _manual_generator_service_instance
    if _manual_generator_service_instance is None:
        logger.info("Initializing ManualGeneratorService instance.")
        _manual_generator_service_instance = ManualGeneratorService(settings=settings)
    return _manual_generator_service_instance

@manual_generation_router.post(
    "/generate_powerpoint",
    summary="Generate PowerPoint presentation from manual content"
)
@telemetry.track(operation_type="generate_powerpoint", metadata_resolver=None)
async def generate_powerpoint_endpoint(
    request: PowerPointGenerationRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
    generator_service: ManualGeneratorService = Depends(get_manual_generator_service),
):
    """
    Generates a PowerPoint presentation based on manual content and relevant ERP images.
    
    - First generates manual text using the same logic as generate_manual
    - Then creates a PowerPoint presentation with the content and images
    - Returns the PowerPoint file for download
    """
    logger.info(f"Generating PowerPoint for query: '{request.query}'")
    
    # First, get the manual content using same logic as generate_manual_endpoint
    relevant_images_metadata = []

    if request.image_path:
        if not request.image_prompt:
            logger.warning("image_path provided without image_prompt for PowerPoint generation.")
            raise HTTPException(status_code=400, detail="If image_path is provided, image_prompt must also be provided.")
        logger.info(f"Using provided image: {request.image_path} for PowerPoint generation.")
        relevant_images_metadata.append(
            {"image_path": request.image_path, "prompt": request.image_prompt, "respuesta": ""}
        )
    else:
        logger.info(f"Finding relevant images for query: '{request.query}' with k={request.k_images}")
        try:
            found_docs = await embedding_model.find_relevant_images(
                query=request.query,
                k=request.k_images,
            )
            if not found_docs:
                logger.warning(f"No relevant images found for query: '{request.query}'")
                raise HTTPException(status_code=404, detail="No relevant images found for the query.")

            for doc in found_docs:
                relevant_images_metadata.append(
                    {"image_path": doc.image_path, "prompt": doc.prompt, "respuesta": doc.respuesta}
                )
            logger.info(f"Found {len(relevant_images_metadata)} relevant images.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error finding relevant images: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"An error occurred while finding relevant images: {str(e)}")

    if not relevant_images_metadata:
        logger.error("No image metadata available to generate PowerPoint.")
        raise HTTPException(status_code=404, detail="No image metadata available to generate PowerPoint.")

    try:
        # Generate manual text
        logger.info(f"Generating manual text for PowerPoint: '{request.query}' using {len(relevant_images_metadata)} image(s).")
        generated_text_result = await generator_service.generate_manual_text(
            query=request.query,
            image_metadata_list=relevant_images_metadata,
        )
        
        # Generate PowerPoint
        logger.info("Generating PowerPoint presentation...")
        powerpoint_path = await generator_service.generate_powerpoint(
            query=request.query,
            manual_text=generated_text_result,
            image_metadata_list=relevant_images_metadata
        )
        
        logger.info(f"Successfully generated PowerPoint for query: '{request.query}'")
        
        # Return file for download
        import os
        filename = os.path.basename(powerpoint_path)
        return FileResponse(
            path=powerpoint_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PowerPoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred during PowerPoint generation: {str(e)}")

# --- Additional Models for ERP Processing ---
class ERPImageProcessingRequest(BaseModel):
    image_path: str = Field(..., description="Path to the ERP image to process")
    force_reprocess: bool = Field(default=False, description="Force reprocessing even if metadata exists")

class ERPImageProcessingResponse(BaseModel):
    image_path: str
    extracted_metadata: Dict[str, Any]
    processing_status: str
    error_message: Optional[str] = None

@manual_generation_router.post(
    "/process_erp_image",
    response_model=ERPImageProcessingResponse,
    summary="Process ERP image to extract structural and visual metadata"
)
@telemetry.track(operation_type="process_erp_image", metadata_resolver=None)
async def process_erp_image_endpoint(
    request: ERPImageProcessingRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
):
    """
    Process an ERP image to extract both structural metadata (from path) and visual metadata (using AI).
    
    This endpoint uses the ERPMetadataExtractionRule to:
    1. Extract structural metadata from the image path (module, section, navigation path, etc.)
    2. Analyze the image content using the fine-tuned Qwen model to detect functions, buttons, screen type
    3. Store the combined metadata in the manual generation database
    
    Args:
        request: ERPImageProcessingRequest containing image path and processing options
        auth: Authentication context
        embedding_model: Manual generation embedding model instance
        
    Returns:
        ERPImageProcessingResponse with extracted metadata and processing status
    """
    import os
    from pathlib import Path
    from core.rules.erp_metadata_extraction_rule import ERPMetadataExtractionRule
    from core.models.chunk import Chunk
    
    try:
        # Validate image path
        if not os.path.exists(request.image_path):
            raise HTTPException(status_code=404, detail=f"Image file not found: {request.image_path}")
        
        if not request.image_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            raise HTTPException(status_code=400, detail="File must be a valid image format (PNG, JPG, JPEG)")
        
        # Verify it's an ERP screenshot
        if "/ERP_screenshots/" not in request.image_path:
            raise HTTPException(status_code=400, detail="Image must be in the ERP_screenshots directory")
        
        logger.info(f"Processing ERP image: {request.image_path}")
        
        # Create a chunk object to simulate the processing workflow
        chunk = Chunk(
            id=str(uuid.uuid4()),
            content=f"ERP Image: {Path(request.image_path).name}",
            metadata={
                "is_image": True,
                "source_path": request.image_path,
                "file_type": "image",
                "processed_by_erp_rule": False
            }
        )
        
        # Initialise the ERP metadata extraction rule
        erp_rule = ERPMetadataExtractionRule()
        
        # Apply the rule to extract metadata
        logger.info("Applying ERP metadata extraction rule...")
        extracted_metadata, modified_content = await erp_rule.apply(
            content=chunk.content,
            existing_metadata=chunk.metadata
        )
        
        # Check if we already have this image in the database
        existing_doc = None
        if not request.force_reprocess:
            existing_docs = await embedding_model.find_by_image_path(request.image_path)
            if existing_docs:
                existing_doc = existing_docs[0]
                logger.info(f"Found existing document for image: {request.image_path}")
        
        if existing_doc and not request.force_reprocess:
            logger.info("Using existing metadata, skipping reprocessing")
            return ERPImageProcessingResponse(
                image_path=request.image_path,
                extracted_metadata=existing_doc.metadata,
                processing_status="already_processed",
                error_message=None
            )
        
        # Create or update document with extracted metadata
        try:
            # Create document data
            doc_data = {
                "image_path": request.image_path,
                "prompt": extracted_metadata.get("ai_analysis", {}).get("descripcion_general", ""),
                "respuesta": json.dumps(extracted_metadata.get("ai_analysis", {})),
                "metadata": extracted_metadata
            }
            
            if existing_doc:
                # Update existing document
                logger.info(f"Updating existing document: {existing_doc.id}")
                await embedding_model.update_document(existing_doc.id, doc_data)
                processing_status = "reprocessed"
            else:
                # Create new document
                logger.info("Creating new document in database")
                await embedding_model.add_document(doc_data)
                processing_status = "newly_processed"
            
            logger.info(f"Successfully processed ERP image: {request.image_path}")
            
            return ERPImageProcessingResponse(
                image_path=request.image_path,
                extracted_metadata=extracted_metadata,
                processing_status=processing_status,
                error_message=None
            )
            
        except Exception as db_error:
            logger.error(f"Database error while storing metadata: {str(db_error)}", exc_info=True)
            return ERPImageProcessingResponse(
                image_path=request.image_path,
                extracted_metadata=extracted_metadata,
                processing_status="processed_but_not_stored",
                error_message=f"Metadata extracted but database storage failed: {str(db_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing ERP image {request.image_path}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while processing the ERP image: {str(e)}"
        )


class ERPBatchProcessingRequest(BaseModel):
    directory_path: str = Field(..., description="Path to directory containing ERP images")
    recursive: bool = Field(default=True, description="Process subdirectories recursively")
    force_reprocess: bool = Field(default=False, description="Force reprocessing of existing images")
    file_extensions: List[str] = Field(default=[".png", ".jpg", ".jpeg"], description="File extensions to process")

class ERPBatchProcessingResponse(BaseModel):
    total_images_found: int
    successfully_processed: int
    already_processed: int
    failed_processing: int
    processing_details: List[Dict[str, Any]]
    directory_path: str

@manual_generation_router.post(
    "/process_erp_batch",
    response_model=ERPBatchProcessingResponse,
    summary="Batch process all ERP images in a directory"
)
@telemetry.track(operation_type="process_erp_batch", metadata_resolver=None)
async def process_erp_batch_endpoint(
    request: ERPBatchProcessingRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
):
    """
    Batch process all ERP images in a directory to extract metadata and populate the database.
    
    This endpoint will:
    1. Scan the specified directory for image files
    2. Process each image using the ERPMetadataExtractionRule
    3. Store the extracted metadata in the manual generation database
    4. Provide detailed processing statistics
    
    Args:
        request: ERPBatchProcessingRequest with directory path and processing options
        auth: Authentication context
        embedding_model: Manual generation embedding model instance
        
    Returns:
        ERPBatchProcessingResponse with processing statistics and details
    """
    import os
    from pathlib import Path
    
    try:
        # Validate directory path
        if not os.path.exists(request.directory_path):
            raise HTTPException(status_code=404, detail=f"Directory not found: {request.directory_path}")
        
        if not os.path.isdir(request.directory_path):
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {request.directory_path}")
        
        logger.info(f"Starting batch processing of ERP images in: {request.directory_path}")
        
        # Find all image files
        image_files = []
        directory = Path(request.directory_path)
        
        if request.recursive:
            for ext in request.file_extensions:
                image_files.extend(directory.rglob(f"*{ext}"))
        else:
            for ext in request.file_extensions:
                image_files.extend(directory.glob(f"*{ext}"))
        
        image_files = [str(img) for img in image_files]
        total_images = len(image_files)
        
        if total_images == 0:
            logger.warning(f"No image files found in {request.directory_path}")
            return ERPBatchProcessingResponse(
                total_images_found=0,
                successfully_processed=0,
                already_processed=0,
                failed_processing=0,
                processing_details=[],
                directory_path=request.directory_path
            )
        
        logger.info(f"Found {total_images} image files to process")
        
        # Process each image
        successfully_processed = 0
        already_processed = 0
        failed_processing = 0
        processing_details = []
        
        for i, image_path in enumerate(image_files, 1):
            try:
                logger.info(f"Processing image {i}/{total_images}: {image_path}")
                
                # Create individual processing request
                individual_request = ERPImageProcessingRequest(
                    image_path=image_path,
                    force_reprocess=request.force_reprocess
                )
                
                # Process the image
                response = await process_erp_image_endpoint(
                    request=individual_request,
                    auth=auth,
                    embedding_model=embedding_model
                )
                
                # Update counters based on processing status
                if response.processing_status == "already_processed":
                    already_processed += 1
                elif response.processing_status in ["newly_processed", "reprocessed"]:
                    successfully_processed += 1
                else:
                    failed_processing += 1
                
                processing_details.append({
                    "image_path": image_path,
                    "status": response.processing_status,
                    "error": response.error_message,
                    "metadata_keys": list(response.extracted_metadata.keys()) if response.extracted_metadata else []
                })
                
            except Exception as e:
                failed_processing += 1
                error_msg = f"Failed to process {image_path}: {str(e)}"
                logger.error(error_msg)
                processing_details.append({
                    "image_path": image_path,
                    "status": "failed",
                    "error": error_msg,
                    "metadata_keys": []
                })
        
        logger.info(f"Batch processing completed. Processed: {successfully_processed}, "
                   f"Already processed: {already_processed}, Failed: {failed_processing}")
        
        return ERPBatchProcessingResponse(
            total_images_found=total_images,
            successfully_processed=successfully_processed,
            already_processed=already_processed,
            failed_processing=failed_processing,
            processing_details=processing_details,
            directory_path=request.directory_path
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch processing: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during batch processing: {str(e)}"
        )
        
        # Store metadata in the manual generation database if extraction was successful
        if extracted_metadata.get("erp_processed", False):
            logger.info("Storing ERP metadata in database...")
            
            # Prepare data for storage
            prompt = extracted_metadata.get("erp_manual_prompt", f"ERP Image: {Path(request.image_path).name}")
            keywords = extracted_metadata.get("erp_all_keywords", [])
            
            # Store in manual generation database
            success = await embedding_model.store_image_metadata(
                image_path=request.image_path,
                prompt=prompt,
                respuesta=extracted_metadata.get("erp_screen_type", ""),
                embedding_text=prompt,  # Generate embedding from the prompt
                module=extracted_metadata.get("erp_module"),
                section=extracted_metadata.get("erp_section"),
                subsection=extracted_metadata.get("erp_subsection"),
                function_detected=extracted_metadata.get("erp_function"),
                hierarchy_level=extracted_metadata.get("erp_hierarchy_level"),
                keywords=keywords,
                additional_metadata={
                    "visual_analysis": {
                        "detected_functions": extracted_metadata.get("erp_detected_functions", []),
                        "visible_buttons": extracted_metadata.get("erp_visible_buttons", []),
                        "navigation_elements": extracted_metadata.get("erp_navigation_elements", []),
                        "form_fields": extracted_metadata.get("erp_form_fields", []),
                        "main_actions": extracted_metadata.get("erp_main_actions", [])
                    },
                    "structural_analysis": {
                        "navigation_path": extracted_metadata.get("erp_navigation_path", []),
                        "analysis_model": extracted_metadata.get("erp_analysis_model")
                    }
                },
                overwrite=request.force_reprocess
            )
            
            if success:
                logger.info(f"Successfully stored metadata for {request.image_path}")
                processing_status = "success"
            else:
                logger.warning(f"Failed to store metadata for {request.image_path}")
                processing_status = "metadata_extracted_but_storage_failed"
        else:
            processing_status = "extraction_failed"
            logger.error(f"Failed to extract metadata for {request.image_path}")
        
        return ERPImageProcessingResponse(
            image_path=request.image_path,
            extracted_metadata=extracted_metadata,
            processing_status=processing_status,
            error_message=extracted_metadata.get("erp_error") if extracted_metadata.get("erp_error") else None
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error processing ERP image {request.image_path}: {str(e)}", exc_info=True)
        return ERPImageProcessingResponse(
            image_path=request.image_path,
            extracted_metadata={},
            processing_status="error",
            error_message=str(e)
        )

@manual_generation_router.post(
    "/process_all_erp_images",
    summary="Process all ERP images in the screenshots directory"
)
@telemetry.track(operation_type="process_all_erp_images", metadata_resolver=None)
async def process_all_erp_images_endpoint(
    force_reprocess: bool = Query(default=False, description="Force reprocessing of all images"),
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
):
    """
    Process all ERP images in the screenshots directory to extract metadata.
    
    This endpoint will:
    1. Scan the ERP_screenshots directory for all image files
    2. Process each image using the ERPMetadataExtractionRule
    3. Store the extracted metadata in the manual generation database
    
    Args:
        force_reprocess: Whether to reprocess images that already have metadata
        auth: Authentication context
        embedding_model: Manual generation embedding model instance
        
    Returns:
        Summary of processing results
    """
    import os
    from pathlib import Path
    
    try:
        erp_screenshots_dir = "/root/.ipython/ERP_screenshots"
        
        if not os.path.exists(erp_screenshots_dir):
            raise HTTPException(status_code=404, detail="ERP_screenshots directory not found")
        
        # Find all image files
        image_files = []
        for root, dirs, files in os.walk(erp_screenshots_dir):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    image_files.append(os.path.join(root, file))
        
        if not image_files:
            raise HTTPException(status_code=404, detail="No image files found in ERP_screenshots directory")
        
        logger.info(f"Found {len(image_files)} ERP images to process")
        
        # Process images in batches to avoid overwhelming the system
        processed_count = 0
        failed_count = 0
        skipped_count = 0
        results = []
        
        from core.rules.erp_metadata_extraction_rule import ERPMetadataExtractionRule
        from core.models.chunk import Chunk
        
        erp_rule = ERPMetadataExtractionRule()
        
        for image_path in image_files:
            try:
                logger.info(f"Processing {processed_count + 1}/{len(image_files)}: {Path(image_path).name}")
                
                # Create chunk for this image
                chunk = Chunk(
                    id=str(uuid.uuid4()),
                    content=f"ERP Image: {Path(image_path).name}",
                    metadata={
                        "is_image": True,
                        "source_path": image_path,
                        "file_type": "image"
                    }
                )
                
                # Apply ERP rule
                extracted_metadata, _ = await erp_rule.apply(
                    content=chunk.content,
                    existing_metadata=chunk.metadata
                )
                
                if extracted_metadata.get("erp_processed", False):
                    # Store metadata
                    prompt = extracted_metadata.get("erp_manual_prompt", f"ERP Image: {Path(image_path).name}")
                    keywords = extracted_metadata.get("erp_all_keywords", [])
                    
                    success = await embedding_model.store_image_metadata(
                        image_path=image_path,
                        prompt=prompt,
                        respuesta=extracted_metadata.get("erp_screen_type", ""),
                        embedding_text=prompt,
                        module=extracted_metadata.get("erp_module"),
                        section=extracted_metadata.get("erp_section"),
                        subsection=extracted_metadata.get("erp_subsection"),
                        function_detected=extracted_metadata.get("erp_function"),
                        hierarchy_level=extracted_metadata.get("erp_hierarchy_level"),
                        keywords=keywords,
                        additional_metadata={
                            "visual_analysis": {
                                "detected_functions": extracted_metadata.get("erp_detected_functions", []),
                                "visible_buttons": extracted_metadata.get("erp_visible_buttons", []),
                                "navigation_elements": extracted_metadata.get("erp_navigation_elements", []),
                                "form_fields": extracted_metadata.get("erp_form_fields", []),
                                "main_actions": extracted_metadata.get("erp_main_actions", [])
                            }
                        },
                        overwrite=force_reprocess
                    )
                    
                    if success:
                        processed_count += 1
                        results.append({
                            "image_path": image_path,
                            "status": "success",
                            "metadata_keys": list(extracted_metadata.keys())
                        })
                    else:
                        skipped_count += 1
                        results.append({
                            "image_path": image_path,
                            "status": "storage_failed",
                            "error": "Failed to store in database"
                        })
                else:
                    failed_count += 1
                    results.append({
                        "image_path": image_path,
                        "status": "extraction_failed",
                        "error": extracted_metadata.get("erp_error", "Unknown extraction error")
                    })
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Error processing {image_path}: {str(e)}")
                results.append({
                    "image_path": image_path,
                    "status": "error",
                    "error": str(e)
                })
        
        return {
            "summary": {
                "total_images": len(image_files),
                "processed_successfully": processed_count,
                "failed": failed_count,
                "skipped": skipped_count
            },
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch ERP processing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing ERP images: {str(e)}")

# --- New Endpoint for Processing ERP Images with Morphik Rules ---
@manual_generation_router.post(
    "/process_erp_images",
    response_model=ERPImageProcessingResponse,
    summary="Process and index ERP screenshots using Morphik rules and ColPali"
)
@telemetry.track(operation_type="process_erp_images", metadata_resolver=None)
async def process_erp_images_endpoint(
    request: ERPImageProcessingRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
):
    """
    Process ERP screenshots and generate metadata using Morphik rules, then index with ColPali.
    
    This endpoint:
    1. Scans the ERP screenshots folder
    2. Applies Morphik rules to extract metadata from images
    3. Generates embeddings using ColPali fine-tuned model
    4. Stores everything in the manual_gen_documents table
    """
    import time
    import os
    from PIL import Image
    
    start_time = time.time()
    errors = []
    total_images_found = 0
    total_images_processed = 0
    total_images_skipped = 0
    
    # Determine folder to process
    folder_path = request.folder_path or settings.MANUAL_GENERATION_IMAGE_FOLDER
    if not folder_path or not os.path.exists(folder_path):
        raise HTTPException(status_code=400, detail=f"Folder path not found: {folder_path}")
    
    logger.info(f"Starting ERP image processing for folder: {folder_path}")
    
    try:
        # Get all image files recursively
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff')
        image_files = []
        
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.lower().endswith(image_extensions):
                    full_path = os.path.join(root, file)
                    relative_path = os.path.relpath(full_path, folder_path)
                    image_files.append((full_path, relative_path))
        
        total_images_found = len(image_files)
        logger.info(f"Found {total_images_found} images to process")
        
        # Limit images if specified
        if request.max_images and request.max_images < total_images_found:
            image_files = image_files[:request.max_images]
            logger.info(f"Limited to {request.max_images} images")
        
        # Process images in batches
        for i in range(0, len(image_files), request.batch_size):
            batch = image_files[i:i + request.batch_size]
            logger.info(f"Processing batch {i//request.batch_size + 1}/{(len(image_files) + request.batch_size - 1)//request.batch_size}")
            
            for full_path, relative_path in batch:
                try:
                    # Check if already processed (unless force_reprocess)
                    if not request.force_reprocess:
                        from core.models.manual_generation_document import ManualGenDocument
                        db_session = embedding_model.get_manual_gen_db_session()
                        if db_session:
                            existing = db_session.query(ManualGenDocument).filter_by(image_path=relative_path).first()
                            db_session.close()
                            if existing:
                                total_images_skipped += 1
                                logger.debug(f"Skipping already processed image: {relative_path}")
                                continue
                    
                    # Extract metadata from image path using rules-like logic
                    metadata = await _extract_metadata_from_path(relative_path, full_path)
                    
                    # Generate embedding text for ColPali
                    embedding_text = _generate_embedding_text(metadata, relative_path)
                    
                    # Store the image metadata and embedding
                    success = await embedding_model.store_image_metadata(
                        image_path=relative_path,
                        prompt=metadata.get('prompt'),
                        respuesta=metadata.get('respuesta'),
                        embedding_text=embedding_text,
                        module=metadata.get('module'),
                        section=metadata.get('section'),
                        subsection=metadata.get('subsection'),
                        function_detected=metadata.get('function_detected'),
                        hierarchy_level=metadata.get('hierarchy_level'),
                        keywords=metadata.get('keywords'),
                        additional_metadata=metadata.get('additional_metadata'),
                        overwrite=request.force_reprocess
                    )
                    
                    if success:
                        total_images_processed += 1
                        logger.info(f"✅ Processed: {relative_path}")
                    else:
                        total_images_skipped += 1
                        errors.append(f"Failed to store metadata for: {relative_path}")
                
                except Exception as e:
                    error_msg = f"Error processing {relative_path}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
        
        processing_time = time.time() - start_time
        status = "completed" if not errors else "completed_with_errors"
        
        logger.info(f"ERP image processing completed: {total_images_processed} processed, {total_images_skipped} skipped, {len(errors)} errors")
        
        return ERPImageProcessingResponse(
            total_images_found=total_images_found,
            total_images_processed=total_images_processed,
            total_images_skipped=total_images_skipped,
            errors=errors,
            processing_time_seconds=round(processing_time, 2),
            status=status
        )
        
    except Exception as e:
        logger.error(f"Error during ERP image processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing ERP images: {str(e)}")


async def _extract_metadata_from_path(relative_path: str, full_path: str) -> Dict[str, Any]:
    """
    Extract metadata from image path using Morphik rules-like logic.
    This simulates what the original n.py script did but using intelligent path parsing.
    """
    metadata = {
        "module": None,
        "section": None,
        "subsection": None,
        "function_detected": None,
        "hierarchy_level": 0,
        "keywords": [],
        "prompt": "",
        "respuesta": "",
        "additional_metadata": {}
    }
    
    try:
        # Parse path components
        path_parts = relative_path.split(os.sep)
        filename = os.path.basename(relative_path)
        filename_no_ext = os.path.splitext(filename)[0]
        
        # Extract hierarchy info
        metadata["hierarchy_level"] = len(path_parts)
        
        # Map common ERP module patterns
        erp_modules = {
            "catalogos": "Catálogos",
            "ventas": "Ventas", 
            "compras": "Compras",
            "inventario": "Inventario",
            "contabilidad": "Contabilidad",
            "pantalla principal": "Pantalla Principal",
            "configuracion": "Configuración",
            "reportes": "Reportes",
            "usuarios": "Usuarios"
        }
        
        # Extract module from path
        for part in path_parts:
            part_lower = part.lower()
            for key, value in erp_modules.items():
                if key in part_lower:
                    metadata["module"] = value
                    break
            if metadata["module"]:
                break
        
        # Extract section and subsection
        if len(path_parts) >= 2:
            metadata["section"] = path_parts[1] if len(path_parts) > 1 else None
        if len(path_parts) >= 3:
            metadata["subsection"] = path_parts[2] if len(path_parts) > 2 else None
        
        # Detect function from filename
        function_patterns = {
            "agregar": "Agregar nuevo registro",
            "editar": "Editar registro existente", 
            "eliminar": "Eliminar registro",
            "buscar": "Buscar y filtrar",
            "listar": "Visualizar lista",
            "configurar": "Configuración",
            "imprimir": "Generar reporte/impresión",
            "exportar": "Exportar datos",
            "importar": "Importar datos",
            "pantalla": "Visualización de pantalla",
            "modulo": "Acceso a módulo"
        }
        
        filename_lower = filename_no_ext.lower()
        for pattern, function in function_patterns.items():
            if pattern in filename_lower:
                metadata["function_detected"] = function
                metadata["keywords"].append(pattern)
                break
        
        # Generate contextual prompt and respuesta
        context_parts = []
        if metadata["module"]:
            context_parts.append(f"Módulo {metadata['module']}")
        if metadata["section"]:
            context_parts.append(f"Sección {metadata['section']}")
        if metadata["subsection"]:
            context_parts.append(f"Subsección {metadata['subsection']}")
        
        context_str = " > ".join(context_parts) if context_parts else "Interfaz ERP"
        
        metadata["prompt"] = f"Pantalla de {context_str}"
        if metadata["function_detected"]:
            metadata["prompt"] += f" - {metadata['function_detected']}"
        
        metadata["respuesta"] = f"Interfaz para {metadata['function_detected'] or 'gestión'} en {context_str}"
        
        # Add keywords from path parts
        for part in path_parts:
            if len(part) > 2 and part.lower() not in ["screenshot", "image", "img"]:
                metadata["keywords"].append(part.lower())
        
        # Store additional metadata
        metadata["additional_metadata"] = {
            "filename": filename,
            "path_parts": path_parts,
            "file_size": os.path.getsize(full_path) if os.path.exists(full_path) else 0
        }
        
    except Exception as e:
        logger.error(f"Error extracting metadata from path {relative_path}: {e}")
    
    return metadata


def _generate_embedding_text(metadata: Dict[str, Any], image_path: str) -> str:
    """
    Generate text for embedding that combines all relevant metadata.
    This will be used by ColPali to create searchable embeddings.
    """
    parts = []
    
    # Add structured information
    if metadata.get("module"):
        parts.append(f"Módulo: {metadata['module']}")
    
    if metadata.get("section"):
        parts.append(f"Sección: {metadata['section']}")
        
    if metadata.get("subsection"):
        parts.append(f"Subsección: {metadata['subsection']}")
        
    if metadata.get("function_detected"):
        parts.append(f"Función: {metadata['function_detected']}")
    
    # Add descriptive prompt
    if metadata.get("prompt"):
        parts.append(f"Descripción: {metadata['prompt']}")
    
    # Add keywords
    if metadata.get("keywords"):
        keywords_str = ", ".join(metadata["keywords"])
        parts.append(f"Palabras clave: {keywords_str}")
    
    # Add path context for navigation understanding
    path_context = image_path.replace("/", " > ").replace("\\", " > ")
    parts.append(f"Ruta de navegación: {path_context}")
    
    embedding_text = " | ".join(parts)
    return embedding_text

@manual_generation_router.get(
    "/images_status",
    summary="Get status of processed ERP images"
)
@telemetry.track(operation_type="get_images_status", metadata_resolver=None)
async def get_images_status_endpoint(
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
):
    """
    Get statistics about processed ERP images in the database.
    """
    try:
        from core.models.manual_generation_document import ManualGenDocument
        db_session = embedding_model.get_manual_gen_db_session()
        if not db_session:
            raise HTTPException(status_code=500, detail="Database session not available")
        
        try:
            total_count = db_session.query(ManualGenDocument).count()
            
            # Count by module
            module_counts = db_session.execute(
                text("SELECT module, COUNT(*) as count FROM manual_gen_documents WHERE module IS NOT NULL GROUP BY module ORDER BY count DESC")
            ).fetchall()
            
            # Count by function
            function_counts = db_session.execute(
                text("SELECT function_detected, COUNT(*) as count FROM manual_gen_documents WHERE function_detected IS NOT NULL GROUP BY function_detected ORDER BY count DESC")
            ).fetchall()
            
            # Recent additions
            recent_additions = db_session.execute(
                text("SELECT image_path, created_at FROM manual_gen_documents ORDER BY created_at DESC LIMIT 10")
            ).fetchall()
            
            return {
                "total_images": total_count,
                "modules": [{"module": row[0], "count": row[1]} for row in module_counts],
                "functions": [{"function": row[0], "count": row[1]} for row in function_counts],
                "recent_additions": [{"image_path": row[0], "created_at": row[1]} for row in recent_additions],
                "database_ready": total_count > 0
            }
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting images status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting images status: {str(e)}")

# ---------------------------------------------------------------------------
# Router for /documents endpoints
# ---------------------------------------------------------------------------

@app.post("/documents", response_model=List[Document])
@telemetry.track(operation_type="list_documents", metadata_resolver=None)
async def list_documents(
    request: ListDocumentsRequest,
    auth: AuthContext = Depends(verify_token),
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


@app.get("/documents/{document_id}", response_model=Document)
@telemetry.track(operation_type="get_document", metadata_resolver=None)
async def get_document(document_id: str, auth: AuthContext = Depends(verify_token)):
    """Get document by ID."""
    return await document_service.db.get_document(document_id, auth)


@app.get("/documents/{document_id}/status", response_model=Dict[str, Any])
@telemetry.track(operation_type="get_document_status", metadata_resolver=None)
async def get_document_status(document_id: str, auth: AuthContext = Depends(verify_token)):
    """Get document status by ID."""
    return await document_service.get_document_status(document_id, auth)


@app.delete("/documents/{document_id}")
@telemetry.track(operation_type="delete_document", metadata_resolver=None)
async def delete_document(document_id: str, auth: AuthContext = Depends(verify_token)):
    """Delete document by ID."""
    await document_service.db.delete_document(document_id, auth)
    return {"status": "ok", "message": "Document deleted successfully"}


@app.get("/documents/filename/{filename}", response_model=Document)
@telemetry.track(operation_type="get_document_by_filename", metadata_resolver=None)
async def get_document_by_filename(filename: str, auth: AuthContext = Depends(verify_token)):
    """Get document by filename."""
    document = await document_service.db.get_document_by_filename(filename, auth)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.post("/documents/{document_id}/update_text", response_model=Document)
@telemetry.track(operation_type="update_document_text", metadata_resolver=telemetry.document_update_text_metadata)
async def update_document_text(
    document_id: str,
    request: IngestTextRequest,
    update_strategy: str = "add",
    auth: AuthContext = Depends(verify_token),
):
    """
    Update a document with new text content using the specified strategy.

    Args:
        document_id: ID of the document to update
        request: Text content and metadata for the update
        update_strategy: Strategy for updating the document (default: 'add')

    Returns:
        Document: Updated document metadata
    """
    try:
        doc = await document_service.update_document(
            document_id=document_id,
            auth=auth,
            content=request.content,
            file=None,
            filename=request.filename,
            metadata=request.metadata,
            rules=request.rules,
            update_strategy=update_strategy,
            use_colpali=request.use_colpali,
        )

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found or update failed")

        return doc
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/documents/{document_id}/update_file", response_model=Document)
@telemetry.track(operation_type="update_document_file", metadata_resolver=telemetry.document_update_file_metadata)
async def update_document_file(
    document_id: str,
    file: UploadFile,
    metadata: str = Form("{}"),
    rules: str = Form("[]"),
    update_strategy: str = Form("add"),
    use_colpali: Optional[bool] = Form(None),
    auth: AuthContext = Depends(verify_token),
):
    """
    Update a document with content from a file using the specified strategy.

    Args:
        document_id: ID of the document to update
        file: File to add to the document
        metadata: JSON string of metadata to merge with existing metadata
        rules: JSON string of rules to apply to the content
        update_strategy: Strategy for updating the document (default: 'add')
        use_colpali: Whether to use multi-vector embedding

    Returns:
        Document: Updated document metadata
    """
    try:
        metadata_dict = json.loads(metadata)
        rules_list = json.loads(rules)

        doc = await document_service.update_document(
            document_id=document_id,
            auth=auth,
            content=None,
            file=file,
            filename=file.filename,
            metadata=metadata_dict,
            rules=rules_list,
            update_strategy=update_strategy,
            use_colpali=use_colpali,
        )

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found or update failed")

        return doc
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/documents/{document_id}/update_metadata", response_model=Document)
@telemetry.track(
    operation_type="update_document_metadata",
    metadata_resolver=telemetry.document_update_metadata_resolver,
)
async def update_document_metadata(
    document_id: str, metadata: Dict[str, Any], auth: AuthContext = Depends(verify_token)
):
    """
    Update only a document's metadata.

    Args:
        document_id: ID of the document to update
        metadata: New metadata to merge with existing metadata

    Returns:
        Document: Updated document metadata
    """
    try:
        doc = await document_service.update_document(
            document_id=document_id,
            auth=auth,
            content=None,
            file=None,
            filename=None,
            metadata=metadata,
            rules=[],
            update_strategy="add",
            use_colpali=None,
        )

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found or update failed")

        return doc
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ---------------------------------------------------------------------------
# Router for /retrieve endpoints
# ---------------------------------------------------------------------------

@app.post("/retrieve/docs", response_model=List[DocumentResult])
@telemetry.track(operation_type="retrieve_docs", metadata_resolver=None)
async def retrieve_docs(
    request: RetrieveRequest,
    auth: AuthContext = Depends(verify_token),
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


@app.post("/retrieve/chunks", response_model=List[ChunkResult])
@telemetry.track(operation_type="retrieve_chunks", metadata_resolver=None)
async def retrieve_chunks(
    request: RetrieveRequest,
    auth: AuthContext = Depends(verify_token),
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

# ---------------------------------------------------------------------------
# Router for /graphs endpoints
# ---------------------------------------------------------------------------

@app.get("/graphs", response_model=List[GraphResponse])
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
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        graphs = await document_service.db.list_graphs(auth, system_filters=system_filters)
        return [transform_graph_to_frontend_format(graph) for graph in graphs]
    except Exception as e:
        logger.error(f"Error listing graphs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Ingest endpoints
# ---------------------------------------------------------------------------

@app.post("/ingest/text", response_model=Document)
@telemetry.track(operation_type="ingest_text", metadata_resolver=telemetry.ingest_text_metadata)
async def ingest_text(
    request: IngestTextRequest,
    auth: AuthContext = Depends(verify_token),
) -> Document:
    """
    Ingest a text document.

    Args:
        request: IngestTextRequest containing:
            - content: Text content to ingest
            - filename: Optional filename to help determine content type
            - metadata: Optional metadata dictionary
            - rules: Optional list of rules. Each rule should be either:
                   - MetadataExtractionRule: {"type": "metadata_extraction", "schema": {...}}
                   - NaturalLanguageRule: {"type": "natural_language", "prompt": "..."}
            - folder_name: Optional folder to scope the document to
            - end_user_id: Optional end-user ID to scope the document to
        auth: Authentication context

    Returns:
        Document: Metadata of ingested document
    """
    try:
        # Verify limits before processing - this will call the function from limits_utils
        if settings.MODE == "cloud" and auth.user_id:
            num_pages_estimated = estimate_pages_by_chars(len(request.content))
            await check_and_increment_limits(
                auth,
                "ingest",
                num_pages_estimated,
                verify_only=True,  # This initial check in API remains verify_only=True
                # Final recording will be done in DocumentService.ingest_text
            )

        return await document_service.ingest_text(
            content=request.content,
            filename=request.filename,
            metadata=request.metadata,
            rules=request.rules,
            use_colpali=request.use_colpali,
            auth=auth,
            folder_name=request.folder_name,
            end_user_id=request.end_user_id,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/ingest/file", response_model=Document)
@telemetry.track(operation_type="queue_ingest_file", metadata_resolver=telemetry.ingest_file_metadata)
async def ingest_file(
    file: UploadFile,
    metadata: str = Form("{}"),
    rules: str = Form("[]"),
    auth: AuthContext = Depends(verify_token),
    use_colpali: Optional[bool] = Form(None),
    folder_name: Optional[str] = Form(None),
    end_user_id: Optional[str] = Form(None),
    redis: arq.ArqRedis = Depends(get_redis_pool),
) -> Document:
    """
    Ingest a file document asynchronously.

    Args:
        file: File to ingest
        metadata: JSON string of metadata
        rules: JSON string of rules list. Each rule should be either:
               - MetadataExtractionRule: {"type": "metadata_extraction", "schema": {...}}
               - NaturalLanguageRule: {"type": "natural_language", "prompt": "..."}
        auth: Authentication context
        use_colpali: Whether to use ColPali embedding model
        folder_name: Optional folder to scope the document to
        end_user_id: Optional end-user ID to scope the document to
        redis: Redis connection pool for background tasks

    Returns:
        Document with processing status that can be used to check progress
    """
    try:
        # Parse metadata and rules
        metadata_dict = json.loads(metadata)
        rules_list = json.loads(rules)

        # Fix bool conversion: ensure string "false" is properly converted to False
        def str2bool(v):
            return v if isinstance(v, bool) else str(v).lower() in {"true", "1", "yes"}

        use_colpali_bool = str2bool(use_colpali)  # Renamed to avoid conflict

        # Ensure user has write permission
        if "write" not in auth.permissions:
            raise PermissionError("User does not have write permission")

        logger.debug(f"API: Queueing file ingestion with use_colpali: {use_colpali_bool}")

        # Create a document with processing status
        doc = Document(
            content_type=file.content_type,
            filename=file.filename,
            metadata=metadata_dict,
            owner={"type": auth.entity_type.value, "id": auth.entity_id},
            access_control={
                "readers": [auth.entity_id],
                "writers": [auth.entity_id],
                "admins": [auth.entity_id],
                "user_id": [auth.user_id if auth.user_id else []],
                "app_access": ([auth.app_id] if auth.app_id else []),
            },
            system_metadata={"status": "processing"},
        )

        # Add folder_name and end_user_id to system_metadata if provided
        if folder_name:
            doc.system_metadata["folder_name"] = folder_name
        if end_user_id:
            doc.system_metadata["end_user_id"] = end_user_id
        if auth.app_id:
            doc.system_metadata["app_id"] = auth.app_id

        # Set processing status
        doc.system_metadata["status"] = "processing"

        # Store the document in the *per-app* database that verify_token has
        # already routed to (document_service.db).  Using the global
        # *database* here would put the row into the control-plane DB and the
        # ingestion worker – which connects to the per-app DB – would never
        # find it.
        app_db = document_service.db

        success = await app_db.store_document(doc)
        if not success:
            raise Exception("Failed to store document metadata")

        # If folder_name is provided, ensure the folder exists and add document to it
        if folder_name:
            try:
                await document_service._ensure_folder_exists(folder_name, doc.external_id, auth)
                logger.debug(f"Ensured folder '{folder_name}' exists and contains document {doc.external_id}")
            except Exception as e:
                # Log error but don't raise - we want document ingestion to continue even if folder operation fails
                logger.error(f"Error ensuring folder exists: {e}")

        # Read file content
        file_content = await file.read()

        # --------------------------------------------
        # Enforce storage limits (file & size) early
        # This check remains verify_only=True here, final recording in worker.
        # --------------------------------------------
        if settings.MODE == "cloud" and auth.user_id:
            await check_and_increment_limits(auth, "storage_file", 1, verify_only=True)
            await check_and_increment_limits(auth, "storage_size", len(file_content), verify_only=True)
            # Ingest limit pre-check will be done in the worker after parsing.

        # Generate a unique key for the file
        file_key = f"ingest_uploads/{uuid.uuid4()}/{file.filename}"

        # Store the file in the dedicated bucket for this app (if any)
        file_content_base64 = base64.b64encode(file_content).decode()

        bucket_override = await document_service._get_bucket_for_app(auth.app_id)

        bucket, stored_key = await storage.upload_from_base64(
            file_content_base64,
            file_key,
            file.content_type,
            bucket=bucket_override or "",
        )
        logger.debug(f"Stored file in bucket {bucket} with key {stored_key}")

        # Update document with storage info
        doc.storage_info = {"bucket": bucket, "key": stored_key}

        # Initialise storage_files array with the first file
        from datetime import UTC, datetime

        from core.models.documents import StorageFileInfo

        # Create a StorageFileInfo for the initial file
        initial_file_info = StorageFileInfo(
            bucket=bucket,
            key=stored_key,
            version=1,
            filename=file.filename,
            content_type=file.content_type,
            timestamp=datetime.now(UTC),
        )
        doc.storage_files = [initial_file_info]

        # Log storage files
        logger.debug(f"Initial storage_files for {doc.external_id}: {doc.storage_files}")

        # Update both storage_info and storage_files
        await app_db.update_document(
            document_id=doc.external_id,
            updates={"storage_info": doc.storage_info, "storage_files": doc.storage_files},
            auth=auth,
        )

        # ------------------------------------------------------------------
        # Record storage usage now that the upload succeeded (cloud mode)
        # ------------------------------------------------------------------
        if settings.MODE == "cloud" and auth.user_id:
            try:
                await check_and_increment_limits(auth, "storage_file", 1)
                await check_and_increment_limits(auth, "storage_size", len(file_content))
            except Exception as rec_exc:  # noqa: BLE001
                logger.error("Failed to record storage usage in ingest_file: %s", rec_exc)

        # Convert auth context to a dictionary for serialization
        auth_dict = {
            "entity_type": auth.entity_type.value,
            "entity_id": auth.entity_id,
            "app_id": auth.app_id,
            "permissions": list(auth.permissions),
            "user_id": auth.user_id,
        }

        # Enqueue the background job
        job = await redis.enqueue_job(
            "process_ingestion_job",
            document_id=doc.external_id,
            file_key=stored_key,
            bucket=bucket,
            original_filename=file.filename,
            content_type=file.content_type,
            metadata_json=metadata,
            auth_dict=auth_dict,
            rules_list=rules_list,
            use_colpali=use_colpali_bool,  # Pass the boolean
            folder_name=folder_name,
            end_user_id=end_user_id,
        )

        logger.info(f"File ingestion job queued with ID: {job.job_id} for document: {doc.external_id}")

        return doc
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error during file ingestion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error during file ingestion: {str(e)}")


@app.post("/ingest/files", response_model=BatchIngestResponse)
@telemetry.track(operation_type="queue_batch_ingest", metadata_resolver=telemetry.batch_ingest_metadata)
async def batch_ingest_files(
    metadata: str = Form("{}"),
    rules: str = Form("[]"),
    use_colpali: Optional[bool] = Form(None),  # Keep Optional[bool] for Form
    parallel: Optional[bool] = Form(True),
    folder_name: Optional[str] = Form(None),
    end_user_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...), # Moved files to be after other Form fields
    auth: AuthContext = Depends(verify_token),
    redis: arq.ArqRedis = Depends(get_redis_pool),
) -> BatchIngestResponse:
    """
    Batch ingest multiple files using the task queue.

    Args:
        metadata: JSON string of metadata (either a single dict or list of dicts)
        rules: JSON string of rules list. Can be either:
               - A single list of rules to apply to all files
               - A list of rule lists, one per file
        use_colpali: Whether to use ColPali-style embedding
        parallel: Whether to run ingestion jobs in parallel (not fully implemented for true parallelism yet)
        folder_name: Optional folder to scope the documents to
        end_user_id: Optional end-user ID to scope the documents to
        files: List of files to ingest
        auth: Authentication context
        redis: Redis connection pool for background tasks

    Returns:
        BatchIngestResponse containing:
            - documents: List of created documents with processing status
            - errors: List of errors that occurred during the batch operation
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for batch ingestion")

    try:
        metadata_value = json.loads(metadata)
        rules_list = json.loads(rules)

        # Fix bool conversion: ensure string "false" is properly converted to False
        def str2bool(v):
            return str(v).lower() in {"true", "1", "yes"}

        use_colpali_bool = str2bool(use_colpali)  # Renamed for clarity

        # Ensure user has write permission
        if "write" not in auth.permissions:
            raise PermissionError("User does not have write permission")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    # Validate metadata if it's a list
    if isinstance(metadata_value, list) and len(metadata_value) != len(files):
        raise HTTPException(
            status_code=400,
            detail=f"Number of metadata items ({len(metadata_value)}) must match number of files ({len(files)})",
        )

    # Validate rules if it's a list of lists
    if isinstance(rules_list, list) and rules_list and isinstance(rules_list[0], list):
        if len(rules_list) != len(files):
            raise HTTPException(
                status_code=400,
                detail=f"Number of rule lists ({len(rules_list)}) must match number of files ({len(files)})",
            )

    # Convert auth context to a dictionary for serialization
    auth_dict = {
        "entity_type": auth.entity_type.value,
        "entity_id": auth.entity_id,
        "app_id": auth.app_id,
        "permissions": list(auth.permissions),
        "user_id": auth.user_id,
    }

    created_documents = []

    try:
        for i, file in enumerate(files):
            # Get the metadata and rules for this file
            metadata_item = metadata_value[i] if isinstance(metadata_value, list) else metadata_value
            file_rules = (
                rules_list[i]
                if isinstance(rules_list, list) and rules_list and isinstance(rules_list[0], list)
                else rules_list
            )

            # Create a document with processing status
            doc = Document(
                content_type=file.content_type,
                filename=file.filename,
                metadata=metadata_item,
                owner={"type": auth.entity_type.value, "id": auth.entity_id},
                access_control={
                    "readers": [auth.entity_id],
                    "writers": [auth.entity_id],
                    "admins": [auth.entity_id],
                    "user_id": [auth.user_id] if auth.user_id else [],
                    "app_access": ([auth.app_id] if auth.app_id else []),
                },
            )

            # Add folder_name and end_user_id to system_metadata if provided
            if folder_name:
                doc.system_metadata["folder_name"] = folder_name
            if end_user_id:
                doc.system_metadata["end_user_id"] = end_user_id
            if auth.app_id:
                doc.system_metadata["app_id"] = auth.app_id

            # Set processing status
            doc.system_metadata["status"] = "processing"

            # Store the document in the *per-app* database that verify_token has
            # already routed to (document_service.db).  Using the global
            # *database* here would put the row into the control-plane DB and the
            # ingestion worker – which connects to the per-app DB – would never
            # find it.
            app_db = document_service.db

            success = await app_db.store_document(doc)
            if not success:
                raise Exception(f"Failed to store document metadata for {file.filename}")

            # If folder_name is provided, ensure the folder exists and add document to it
            if folder_name:
                try:
                    await document_service._ensure_folder_exists(folder_name, doc.external_id, auth)
                    logger.debug(f"Ensured folder '{folder_name}' exists and contains document {doc.external_id}")
                except Exception as e:
                    # Log error but don't raise - we want document ingestion to continue even if folder operation fails
                    logger.error(f"Error ensuring folder exists: {e}")

            # Read file content
            file_content = await file.read()

            # --------------------------------------------
            # Enforce storage limits (file & size) early
            # This check remains verify_only=True here.
            # --------------------------------------------
            if settings.MODE == "cloud" and auth.user_id:
                await check_and_increment_limits(auth, "storage_file", 1, verify_only=True)
                await check_and_increment_limits(auth, "storage_size", len(file_content), verify_only=True)
                # Ingest limit pre-check will be done in the worker after parsing for each file.

            # Generate a unique key for the file
            file_key = f"ingest_uploads/{uuid.uuid4()}/{file.filename}"

            # Store the file in the dedicated bucket for this app (if any)
            file_content_base64 = base64.b64encode(file_content).decode()

            bucket_override = await document_service._get_bucket_for_app(auth.app_id)

            bucket, stored_key = await storage.upload_from_base64(
                file_content_base64,
                file_key,
                file.content_type,
                bucket=bucket_override or "",
            )
            logger.debug(f"Stored file in bucket {bucket} with key {stored_key}")

            # Update document with storage info
            doc.storage_info = {"bucket": bucket, "key": stored_key}
            await app_db.update_document(
                document_id=doc.external_id, updates={"storage_info": doc.storage_info}, auth=auth
            )

            # ------------------------------------------------------------------
            # Record storage usage now that the upload succeeded (cloud mode)
            # ------------------------------------------------------------------
            if settings.MODE == "cloud" and auth.user_id:
                try:
                    await check_and_increment_limits(auth, "storage_file", 1)
                    await check_and_increment_limits(auth, "storage_size", len(file_content))
                except Exception as rec_exc:  # noqa: BLE001
                    logger.error("Failed to record storage usage in ingest_file: %s", rec_exc)

            # Convert metadata to JSON string for job
            metadata_json = json.dumps(metadata_item)

            # Enqueue the background job
            job = await redis.enqueue_job(
                "process_ingestion_job",
                document_id=doc.external_id,
                file_key=stored_key,
                bucket=bucket,
                original_filename=file.filename,
                content_type=file.content_type,
                metadata_json=metadata_json,
                auth_dict=auth_dict,
                rules_list=file_rules,
                use_colpali=use_colpali_bool,  # Pass the boolean
                folder_name=folder_name,
                end_user_id=end_user_id,
            )

            logger.info(f"File ingestion job queued with ID: {job.job_id} for document: {doc.external_id}")

            # Add document to the list
            created_documents.append(doc)

        # Return information about created documents
        return BatchIngestResponse(documents=created_documents, errors=[])

    except Exception as e:
        logger.error(f"Error queueing batch file ingestion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error queueing batch file ingestion: {str(e)}")


# ---------------------------------------------------------------------------
# Missing Core Endpoints - Query and Agent
# ---------------------------------------------------------------------------

@app.post("/query", response_model=CompletionResponse)
@telemetry.track(operation_type="query", metadata_resolver=telemetry.query_metadata)
async def query_completion(request: CompletionQueryRequest, auth: AuthContext = Depends(verify_token)):
    """
    Generate completion using relevant chunks as context.

    When graph_name is provided, the query will leverage the knowledge graph
    to enhance retrieval by finding relevant entities and their connected documents.

    Args:
        request: CompletionQueryRequest containing:
            - query: Query text
            - filters: Optional metadata filters
            - k: Number of chunks to use as context (default: 4)
            - min_score: Minimum similarity threshold (default: 0.0)
            - max_tokens: Maximum tokens in completion
            - temperature: Model temperature
            - use_reranking: Whether to use reranking
            - use_colpali: Whether to use ColPali-style embedding model
            - graph_name: Optional name of the graph to use for knowledge graph-enhanced retrieval
            - hop_depth: Number of relationship hops to traverse in the graph (1-3)
            - include_paths: Whether to include relationship paths in the response
            - prompt_overrides: Optional customizations for entity extraction, resolution, and query prompts
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
            - schema: Optional schema for structured output
        auth: Authentication context

    Returns:
        CompletionResponse: Generated text completion or structured output
    """
    try:
        # Validate prompt overrides before proceeding
        if request.prompt_overrides:
            validate_prompt_overrides_with_http_exception(request.prompt_overrides, operation_type="query")

        # Check query limits if in cloud mode
        if settings.MODE == "cloud" and auth.user_id:
            # Check limits before proceeding
            await check_and_increment_limits(auth, "query", 1)

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


@app.post("/agent", response_model=Dict[str, Any])
@telemetry.track(operation_type="agent_query")
async def agent_query(request: AgentQueryRequest, auth: AuthContext = Depends(verify_token)):
    """
    Process a natural language query using the MorphikAgent and return the response.
    """
    # Check free-tier agent call limits in cloud mode
    if settings.MODE == "cloud" and auth.user_id:
        await check_and_increment_limits(auth, "agent", 1)
    # Use the shared MorphikAgent instance; per-run state is now isolated internally
    response = await morphik_agent.run(request.query, auth)
    # Return the complete response dictionary
    return response


# ---------------------------------------------------------------------------
# Missing Batch Endpoints
# ---------------------------------------------------------------------------

@app.post("/batch/documents", response_model=List[Document])
async def batch_documents(
    request: List[str],
    auth: AuthContext = Depends(verify_token),
):
    """
    Retrieve multiple documents by their IDs.
    
    Args:
        request: List of document IDs
        auth: Authentication context
        
    Returns:
        List[Document]: List of documents
    """
    documents = []
    for doc_id in request:
        try:
            doc = await document_service.db.get_document(doc_id, auth)
            if doc:
                documents.append(doc)
        except Exception as e:
            logger.warning(f"Failed to retrieve document {doc_id}: {str(e)}")
            continue
    return documents


@app.post("/batch/chunks", response_model=List[ChunkResult])
async def batch_chunks(
    request: List[RetrieveRequest],
    auth: AuthContext = Depends(verify_token),
):
    """
    Retrieve chunks for multiple queries.
    
       
    
    Args:
        request: List of RetrieveRequest objects
        auth: Authentication context
        
    Returns:
        List[ChunkResult]: List of chunk results
    """
    all_chunks = []
    for retrieve_req in request:
        try:
            chunks = await document_service.retrieve(
                retrieve_req.query,
                auth,
                retrieve_req.filters,
                retrieve_req.k,
                retrieve_req.min_score,
                retrieve_req.use_reranking,
                retrieve_req.use_colpali,
                retrieve_req.folder_name,
                retrieve_req.end_user_id,
            )
            all_chunks.extend(chunks)
        except Exception as e:
            logger.warning(f"Failed to retrieve chunks for query '{retrieve_req.query}': {str(e)}")
            continue
    return all_chunks


# ---------------------------------------------------------------------------
# NOTE: All endpoints below have been moved to modular routers
# Previous duplicate endpoints have been removed to prevent conflicts
# ---------------------------------------------------------------------------

@app.get("/graphs", response_model=List[GraphResponse])
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
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id
        if auth.app_id:
            system_filters["app_id"] = auth.app_id

        graphs = await document_service.db.list_graphs(auth, system_filters=system_filters)
        return [transform_graph_to_frontend_format(graph) for graph in graphs]
    except Exception as e:
        logger.error(f"Error listing graphs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Router Inclusions - All endpoints are now modularized
# ---------------------------------------------------------------------------

# Include all API routers
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(retrieval_router)
app.include_router(ingest_router)
app.include_router(query_router)
app.include_router(batch_router)
app.include_router(graphs_router)
app.include_router(folders_router)
app.include_router(models_router)
app.include_router(manual_generation_router)
app.include_router(rule_templates_router)
app.include_router(usage_router)
app.include_router(cache_router)

