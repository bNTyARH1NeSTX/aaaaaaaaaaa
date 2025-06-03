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

# Enterprise-only routes (optional)
# try:
#     from ee.routers import init_app as _init_ee_app  # type: ignore  # noqa: E402
#
#     _init_ee_app(app)  # noqa: SLF001 – runtime extension
# except ModuleNotFoundError as exc:
#     logger.debug("Enterprise package not found – running in community mode.")
#     logger.error("ModuleNotFoundError: %s", exc, exc_info=True)
# except ImportError as exc:
#     logger.error("Failed to import init_app from ee.routers: %s", exc, exc_info=True)
# except Exception as exc:  # noqa: BLE001
#     logger.error("An unexpected error occurred during EE app initialization: %s", exc, exc_info=True)
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

# --- Manual Generation Router ---
manual_generation_router = APIRouter(
    prefix="/manuals",
    tags=["Manual Generation"],
    responses={404: {"description": "Not found"}},
)

@manual_generation_router.post(
    "/generate_manual",
    response_model=ManualGenerationResponse,
    summary="Generate manual text based on a query and relevant ERP images."
)
@telemetry.track(operation_type="generate_manual", metadata_resolver=None) # TODO: Implement resolve_manual_generation_metadata on TelemetryService
async def generate_manual_endpoint(
    request: ManualGenerationRequest,
    auth: AuthContext = Depends(verify_token),
    embedding_model: ManualGenerationEmbeddingModel = Depends(get_manual_generation_embedding_model),
    generator_service: ManualGeneratorService = Depends(get_manual_generator_service),
):
    """
    Generates textual content for a manual.

    - If **image_path** and **image_prompt** are provided, the specified image and its description are used.
    - Otherwise, relevant images are found based on the **query** using the ColPali model.
    - The **query** is then used with the selected image(s) and their descriptive prompts to generate
      manual content using a fine-tuned Vision Language Model (VLM).
    """
    # Example permission check (adjust as needed)
    # if "generate_manual" not in auth.permissions:
    #     raise HTTPException(status_code=403, detail="User does not have permission to generate manuals.")

    relevant_images_metadata = []

    if request.image_path:
        if not request.image_prompt:
            logger.warning("image_path provided without image_prompt for manual generation.")
            raise HTTPException(status_code=400, detail="If image_path is provided, image_prompt (description of the image content) must also be provided.")
        logger.info(f"Using provided image: {request.image_path} for manual generation.")
        relevant_images_metadata.append(
            {"image_path": request.image_path, "prompt": request.image_prompt, "respuesta": ""} # 'respuesta' might be unknown or not applicable here
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
            raise # Re-raise HTTPException directly
        except Exception as e:
            logger.error(f"Error finding relevant images: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"An error occurred while finding relevant images: {str(e)}")

    if not relevant_images_metadata:
        logger.error("No image metadata available to generate manual after processing request.") # Should have been caught earlier
        raise HTTPException(status_code=404, detail="No image metadata available to generate manual. Please check your query or provided image path.")

    try:
        logger.info(f"Generating manual text for query: '{request.query}' using {len(relevant_images_metadata)} image(s).")
        generated_text_result = await generator_service.generate_manual_text(
            query=request.query, # This is the user's task/question for the manual
            image_metadata_list=relevant_images_metadata, # This contains image_path and their descriptive prompts
        )
        logger.info(f"Successfully generated manual text for query: '{request.query}'.")
    except HTTPException:
        raise # Re-raise HTTPException directly
    except Exception as e:
        logger.error(f"Error generating manual text: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred during manual text generation: {str(e)}")

    return ManualGenerationResponse(
        generated_text=generated_text_result,
        relevant_images_used=relevant_images_metadata,
        query=request.query,
    )

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
        
        # Initialize the ERP metadata extraction rule
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
                        failed_count += 1
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

# Include the manual generation router in the main FastAPI app
app.include_router(manual_generation_router)


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

        # Initialize storage_files array with the first file
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


@app.post("/retrieve/chunks", response_model=List[ChunkResult])
@telemetry.track(operation_type="retrieve_chunks", metadata_resolver=telemetry.retrieve_chunks_metadata)
async def retrieve_chunks(request: RetrieveRequest, auth: AuthContext = Depends(verify_token)):
    """
    Retrieve relevant chunks.

    Args:
        request: RetrieveRequest containing:
            - query: Search query text
            - filters: Optional metadata filters
            - k: Number of results (default: 4)
            - min_score: Minimum similarity threshold (default: 0.0)
            - use_reranking: Whether to use reranking
            - use_colpali: Whether to use ColPali-style embedding model
            - folder_name: Optional folder to scope the search to
            - end_user_id: Optional end-user ID to scope the search to
        auth: Authentication context

    Returns:
        List[ChunkResult]: List of relevant chunks
    """
    try:
        return await document_service.retrieve_chunks(
            request.query,
            auth,
            request.filters,
            request.k,
            request.min_score,
            request.use_reranking,
            request.use_colpali,
            request.folder_name,
            request.end_user_id,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/retrieve/docs", response_model=List[DocumentResult])
@telemetry.track(operation_type="retrieve_docs", metadata_resolver=telemetry.retrieve_docs_metadata)
async def retrieve_documents(request: RetrieveRequest, auth: AuthContext = Depends(verify_token)):
    """
    Retrieve relevant documents.

    Args:
        request: RetrieveRequest containing:
            - query: Search query text
            - filters: Optional metadata filters
            - k: Number of results (default: 4)
            - min_score: Minimum similarity threshold (default: 0.0)
            - use_reranking: Whether to use reranking
            - use_colpali: Whether to use ColPali-style embedding model
            - folder_name: Optional folder to scope the search to
            - end_user_id: Optional end-user ID to scope the search to
        auth: Authentication context

    Returns:
        List[DocumentResult]: List of relevant documents
    """
    try:
        return await document_service.retrieve_docs(
            request.query,
            auth,
            request.filters,
            request.k,
            request.min_score,
            request.use_reranking,
            request.use_colpali,
            request.folder_name,
            request.end_user_id,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/batch/documents", response_model=List[Document])
@telemetry.track(operation_type="batch_get_documents", metadata_resolver=telemetry.batch_documents_metadata)
async def batch_get_documents(request: Dict[str, Any], auth: AuthContext = Depends(verify_token)):
    """
    Retrieve multiple documents by their IDs in a single batch operation.

    Args:
        request: Dictionary containing:
            - document_ids: List of document IDs to retrieve
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        List[Document]: List of documents matching the IDs
    """
    try:
        # Extract document_ids from request
        document_ids = request.get("document_ids", [])
        folder_name = request.get("folder_name")
        end_user_id = request.get("end_user_id")

        if not document_ids:
            return []

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


@app.post("/batch/chunks", response_model=List[ChunkResult])
@telemetry.track(operation_type="batch_get_chunks", metadata_resolver=telemetry.batch_chunks_metadata)
async def batch_get_chunks(request: Dict[str, Any], auth: AuthContext = Depends(verify_token)):
    """
    Retrieve specific chunks by their document ID and chunk number in a single batch operation.

    Args:
        request: Dictionary containing:
            - sources: List of ChunkSource objects (with document_id and chunk_number)
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        List[ChunkResult]: List of chunk results
    """
    try:
        # Extract sources from request
        sources = request.get("sources", [])
        folder_name = request.get("folder_name")
        end_user_id = request.get("end_user_id")
        use_colpali = request.get("use_colpali")

        if not sources:
            return []

        # Convert sources to ChunkSource objects if needed
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


@app.post("/documents", response_model=List[Document])
async def list_documents(
    auth: AuthContext = Depends(verify_token),
    skip: int = 0,
    limit: int = 10000,
    filters: Optional[Dict[str, Any]] = None,
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
):
    """
    List accessible documents.

    Args:
        auth: Authentication context
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        filters: Optional metadata filters
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        List[Document]: List of accessible documents
    """
    # Create system filters for folder and user scoping
    system_filters = {}
    if folder_name:
        system_filters["folder_name"] = folder_name
    if end_user_id:
        system_filters["end_user_id"] = end_user_id
    if auth.app_id:
        system_filters["app_id"] = auth.app_id

    return await document_service.db.get_documents(auth, skip, limit, filters, system_filters)


@app.get("/documents/{document_id}", response_model=Document)
async def get_document(document_id: str, auth: AuthContext = Depends(verify_token)):
    """Get document by ID."""
    try:
        doc = await document_service.db.get_document(document_id, auth)
        logger.debug(f"Found document: {doc}")
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc
    except HTTPException as e:
        logger.error(f"Error getting document: {e}")
        raise e


@app.get("/documents/{document_id}/status", response_model=Dict[str, Any])
async def get_document_status(document_id: str, auth: AuthContext = Depends(verify_token)):
    """
    Get the processing status of a document.

    Args:
        document_id: ID of the document to check
        auth: Authentication context

    Returns:
        Dict containing status information for the document
    """
    try:
        doc = await document_service.db.get_document(document_id, auth)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # Extract status information
        status = doc.system_metadata.get("status", "unknown")

        response = {
            "document_id": doc.external_id,
            "status": status,
            "filename": doc.filename,
            "created_at": doc.system_metadata.get("created_at"),
            "updated_at": doc.system_metadata.get("updated_at"),
        }

        # Add error information if failed
        if status == "failed":
            response["error"] = doc.system_metadata.get("error", "Unknown error")

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting document status: {str(e)}")


@app.delete("/documents/{document_id}")
@telemetry.track(operation_type="delete_document", metadata_resolver=telemetry.document_delete_metadata)
async def delete_document(document_id: str, auth: AuthContext = Depends(verify_token)):
    """
    Delete a document and all associated data.

    This endpoint deletes a document and all its associated data, including:
    - Document metadata
    - Document content in storage
    - Document chunks and embeddings in vector store

    Args:
        document_id: ID of the document to delete
        auth: Authentication context (must have write access to the document)

    Returns:
        Deletion status
    """
    try:
        success = await document_service.delete_document(document_id, auth)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or delete failed")
        return {"status": "success", "message": f"Document {document_id} deleted successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.get("/documents/filename/{filename}", response_model=Document)
async def get_document_by_filename(
    filename: str,
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
):
    """
    Get document by filename.

    Args:
        filename: Filename of the document to retrieve
        auth: Authentication context
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        Document: Document metadata if found and accessible
    """
    try:
        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id

        doc = await document_service.db.get_document_by_filename(filename, auth, system_filters)
        logger.debug(f"Found document by filename: {doc}")
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document with filename '{filename}' not found")
        return doc
    except HTTPException as e:
        logger.error(f"Error getting document by filename: {e}")
        raise e


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


# Usage tracking endpoints
@app.get("/usage/stats")
@telemetry.track(operation_type="get_usage_stats", metadata_resolver=telemetry.usage_stats_metadata)
async def get_usage_stats(auth: AuthContext = Depends(verify_token)) -> Dict[str, int]:
    """Get usage statistics for the authenticated user."""
    if not auth.permissions or "admin" not in auth.permissions:
        return telemetry.get_user_usage(auth.entity_id)
    return telemetry.get_user_usage(auth.entity_id)


@app.get("/usage/recent")
@telemetry.track(operation_type="get_recent_usage", metadata_resolver=telemetry.recent_usage_metadata)
async def get_recent_usage(
    auth: AuthContext = Depends(verify_token),
    operation_type: Optional[str] = None,
    since: Optional[datetime] = None,
    status: Optional[str] = None,
) -> List[Dict]:
    """Get recent usage records."""
    if not auth.permissions or "admin" not in auth.permissions:
        records = telemetry.get_recent_usage(
            user_id=auth.entity_id, operation_type=operation_type, since=since, status=status
        )
    else:
        records = telemetry.get_recent_usage(operation_type=operation_type, since=since, status=status)

    return [
        {
            "timestamp": record.timestamp,
            "operation_type": record.operation_type,
            "tokens_used": record.tokens_used,
            "user_id": record.user_id,
            "duration_ms": record.duration_ms,
            "status": record.status,
            "metadata": record.metadata,
        }
        for record in records
    ]


# Rule Template endpoints
@app.get("/rule-templates", response_model=List[RuleTemplateResponse])
@telemetry.track(operation_type="get_rule_templates")
async def get_rule_templates(auth: AuthContext = Depends(verify_token)) -> List[RuleTemplateResponse]:
    """Get all rule templates accessible to the authenticated user."""
    try:
        db: PostgresDatabase = document_service.db
        templates = await db.get_rule_templates(auth)
        
        return [
            RuleTemplateResponse(
                id=str(template["id"]),
                name=template["name"],
                description=template["description"],
                rules_json=template["rules_json"],  # Already converted to JSON string
                created_at=template["created_at"],
                updated_at=template["updated_at"]
            )
            for template in templates
        ]
    except Exception as e:
        logger.error(f"Error getting rule templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rule-templates", response_model=RuleTemplateResponse)
@telemetry.track(operation_type="create_rule_template")
async def create_rule_template(
    request: RuleTemplateRequest,
    auth: AuthContext = Depends(verify_token)
) -> RuleTemplateResponse:
    """Create a new rule template."""
    try:
        # Validate that rules_json is valid JSON
        try:
            json.loads(request.rules_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="rules_json must be valid JSON")
        
        db: PostgresDatabase = document_service.db
        template = await db.create_rule_template(
            name=request.name,
            description=request.description,
            rules_json=request.rules_json,
            auth=auth
        )
        
        if not template:
            raise HTTPException(status_code=400, detail="Rule template with this name already exists")
        
        return RuleTemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            rules_json=json.dumps(template.rules_json),  # Convert JSONB back to string
            created_at=template.created_at,
            updated_at=template.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rule template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/rule-templates/{template_id}")
@telemetry.track(operation_type="delete_rule_template")
async def delete_rule_template(
    template_id: str,
    auth: AuthContext = Depends(verify_token)
) -> Dict[str, str]:
    """Delete a rule template by ID."""
    try:
        db: PostgresDatabase = document_service.db
        success = await db.delete_rule_template(template_id, auth)
        
        if not success:
            raise HTTPException(status_code=404, detail="Rule template not found or insufficient permissions")
        
        return {"status": "success", "message": f"Rule template {template_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Cache endpoints
@app.post("/cache/create")
@telemetry.track(operation_type="create_cache", metadata_resolver=telemetry.cache_create_metadata)
async def create_cache(
    name: str,
    model: str,
    gguf_file: str,
    filters: Optional[Dict[str, Any]] = None,
    docs: Optional[List[str]] = None,
    auth: AuthContext = Depends(verify_token),
) -> Dict[str, Any]:
    """Create a new cache with specified configuration."""
    try:
        # Check cache creation limits if in cloud mode
        if settings.MODE == "cloud" and auth.user_id:
            # Check limits before proceeding
            await check_and_increment_limits(auth, "cache", 1)

        filter_docs = set(await document_service.db.get_documents(auth, filters=filters))
        additional_docs = (
            {await document_service.db.get_document(document_id=doc_id, auth=auth) for doc_id in docs}
            if docs
            else set()
        )
        docs_to_add = list(filter_docs.union(additional_docs))
        if not docs_to_add:
            raise HTTPException(status_code=400, detail="No documents to add to cache")
        response = await document_service.create_cache(name, model, gguf_file, docs_to_add, filters)
        return response
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.get("/cache/{name}")
@telemetry.track(operation_type="get_cache", metadata_resolver=telemetry.cache_get_metadata)
async def get_cache(name: str, auth: AuthContext = Depends(verify_token)) -> Dict[str, Any]:
    """Get cache configuration by name."""
    try:
        exists = await document_service.load_cache(name)
        return {"exists": exists}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/cache/{name}/update")
@telemetry.track(operation_type="update_cache", metadata_resolver=telemetry.cache_update_metadata)
async def update_cache(name: str, auth: AuthContext = Depends(verify_token)) -> Dict[str, bool]:
    """Update cache with new documents matching its filter."""
    try:
        if name not in document_service.active_caches:
            exists = await document_service.load_cache(name)
            if not exists:
                raise HTTPException(status_code=404, detail=f"Cache '{name}' not found")
        cache = document_service.active_caches[name]
        docs = await document_service.db.get_documents(auth, filters=cache.filters)
        docs_to_add = [doc for doc in docs if doc.id not in cache.docs]
        return cache.add_docs(docs_to_add)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/cache/{name}/add_docs")
@telemetry.track(operation_type="add_docs_to_cache", metadata_resolver=telemetry.cache_add_docs_metadata)
async def add_docs_to_cache(name: str, docs: List[str], auth: AuthContext = Depends(verify_token)) -> Dict[str, bool]:
    """Add specific documents to the cache."""
    try:
        cache = document_service.active_caches[name]
        docs_to_add = [
            await document_service.db.get_document(doc_id, auth) for doc_id in docs if doc_id not in cache.docs
        ]
        return cache.add_docs(docs_to_add)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/cache/{name}/query")
@telemetry.track(operation_type="query_cache", metadata_resolver=telemetry.cache_query_metadata)
async def query_cache(
    name: str,
    query: str,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    auth: AuthContext = Depends(verify_token),
) -> CompletionResponse:
    """Query the cache with a prompt."""
    try:
        # Check cache query limits if in cloud mode
        if settings.MODE == "cloud" and auth.user_id:
            # Check limits before proceeding
            await check_and_increment_limits(auth, "cache_query", 1)

        cache = document_service.active_caches[name]
        logger.info(f"Cache state: {cache.state.n_tokens}")
        return cache.query(query)  # , max_tokens, temperature)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/graph/create", response_model=Graph)
@telemetry.track(operation_type="create_graph", metadata_resolver=telemetry.create_graph_metadata)
async def create_graph(
    request: CreateGraphRequest,
    auth: AuthContext = Depends(verify_token),
) -> Graph:
    """
    Create a graph from documents **asynchronously**.

    Instead of blocking on the potentially slow entity/relationship extraction, we immediately
    create a placeholder graph with `status = "processing"`. A background task then fills in
    entities/relationships and marks the graph as completed.
    """
    try:
        # Validate prompt overrides before proceeding
        if request.prompt_overrides:
            validate_prompt_overrides_with_http_exception(request.prompt_overrides, operation_type="graph")

        # Enforce usage limits (cloud mode)
        if settings.MODE == "cloud" and auth.user_id:
            await check_and_increment_limits(auth, "graph", 1)

        # --------------------
        # Build system filters
        # --------------------
        system_filters: Dict[str, Any] = {}
        if request.folder_name:
            system_filters["folder_name"] = request.folder_name
        if request.end_user_id:
            system_filters["end_user_id"] = request.end_user_id

        # --------------------
        # Create stub graph
        # --------------------
        import uuid
        from datetime import UTC, datetime

        from core.models.graph import Graph

        access_control = {
            "readers": [auth.entity_id],
            "writers": [auth.entity_id],
            "admins": [auth.entity_id],
        }
        if auth.user_id:
            access_control["user_id"] = [auth.user_id]

        graph_stub = Graph(
            id=str(uuid.uuid4()),
            name=request.name,
            filters=request.filters,
            owner={"type": auth.entity_type.value, "id": auth.entity_id},
            access_control=access_control,
        )

        # Persist scoping info in system metadata
        if system_filters.get("folder_name"):
            graph_stub.system_metadata["folder_name"] = system_filters["folder_name"]
        if system_filters.get("end_user_id"):
            graph_stub.system_metadata["end_user_id"] = system_filters["end_user_id"]
        if auth.app_id:
            graph_stub.system_metadata["app_id"] = auth.app_id

        # Mark graph as processing
        graph_stub.system_metadata["status"] = "processing"
        graph_stub.system_metadata["created_at"] = datetime.now(UTC)
        graph_stub.system_metadata["updated_at"] = datetime.now(UTC)

        # Store the stub graph so clients can poll for status
        success = await document_service.db.store_graph(graph_stub)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create graph stub")

        # --------------------
        # Background processing
        # --------------------
        async def _build_graph_async():
            try:
                await document_service.update_graph(
                    name=request.name,
                    auth=auth,
                    additional_filters=None,  # original filters already on stub
                    additional_documents=request.documents,
                    prompt_overrides=request.prompt_overrides,
                    system_filters=system_filters,
                    is_initial_build=True,  # Indicate this is the initial build
                )
            except Exception as e:
                logger.error(f"Graph creation failed for {request.name}: {e}")
                # Update graph status to failed
                existing = await document_service.db.get_graph(request.name, auth, system_filters=system_filters)
                if existing:
                    existing.system_metadata["status"] = "failed"
                    existing.system_metadata["error"] = str(e)
                    existing.system_metadata["updated_at"] = datetime.now(UTC)
                    await document_service.db.update_graph(existing)

        import asyncio

        asyncio.create_task(_build_graph_async())

        # Return the stub graph immediately
        return graph_stub
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        validate_prompt_overrides_with_http_exception(operation_type="graph", error=e)


@app.post("/folders", response_model=Folder)
@telemetry.track(operation_type="create_folder", metadata_resolver=telemetry.create_folder_metadata)
async def create_folder(
    folder_create: FolderCreate,
    auth: AuthContext = Depends(verify_token),
) -> Folder:
    """
    Create a new folder.

    Args:
        folder_create: Folder creation request containing name and optional description
        auth: Authentication context

    Returns:
        Folder: Created folder
    """
    try:
        # Create a folder object with explicit ID
        import uuid

        folder_id = str(uuid.uuid4())
        logger.info(f"Creating folder with ID: {folder_id}, auth.user_id: {auth.user_id}")

        # Set up access control with user_id
        access_control = {
            "readers": [auth.entity_id],
            "writers": [auth.entity_id],
            "admins": [auth.entity_id],
        }

        if auth.user_id:
            access_control["user_id"] = [auth.user_id]
            logger.info(f"Adding user_id {auth.user_id} to folder access control")

        folder = Folder(
            id=folder_id,
            name=folder_create.name,
            description=folder_create.description,
            owner={
                "type": auth.entity_type.value,
                "id": auth.entity_id,
            },
            access_control=access_control,
        )

        # Scope folder to the application ID for developer tokens
        if auth.app_id:
            folder.system_metadata["app_id"] = auth.app_id

        # Store in database
        success = await document_service.db.create_folder(folder)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create folder")

        return folder
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/folders", response_model=List[Folder])
@telemetry.track(operation_type="list_folders", metadata_resolver=telemetry.list_folders_metadata)
async def list_folders(
    auth: AuthContext = Depends(verify_token),
) -> List[Folder]:
    """
    List all folders the user has access to.

    Args:
        auth: Authentication context

    Returns:
        List[Folder]: List of folders
    """
    try:
        folders = await document_service.db.list_folders(auth)
        return folders
    except Exception as e:
        logger.error(f"Error listing folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/folders/{folder_id}", response_model=Folder)
@telemetry.track(operation_type="get_folder", metadata_resolver=telemetry.get_folder_metadata)
async def get_folder(
    folder_id: str,
    auth: AuthContext = Depends(verify_token),
) -> Folder:
    """
    Get a folder by ID.

    Args:
        folder_id: ID of the folder
        auth: Authentication context

    Returns:
        Folder: Folder if found and accessible
    """
    try:
        folder = await document_service.db.get_folder(folder_id, auth)

        if not folder:
            raise HTTPException(status_code=404, detail=f"Folder {folder_id} not found")

        return folder
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/folders/{folder_name}")
@telemetry.track(operation_type="delete_folder", metadata_resolver=telemetry.delete_folder_metadata)
async def delete_folder(
    folder_name: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Delete a folder and all associated documents.

    Args:
        folder_name: Name of the folder to delete
        auth: Authentication context (must have write access to the folder)

    Returns:
        Deletion status
    """
    try:
        folder = await document_service.db.get_folder_by_name(folder_name, auth)
        folder_id = folder.id
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        document_ids = folder.document_ids
        tasks = [remove_document_from_folder(folder_id, document_id, auth) for document_id in document_ids]
        results = await asyncio.gather(*tasks)
        stati = [res.get("status", False) for res in results]
        if not all(stati):
            failed = [doc for doc, stat in zip(document_ids, stati) if not stat]
            msg = "Failed to remove the following documents from folder: " + ", ".join(failed)
            logger.error(msg)
            raise HTTPException(status_code=500, detail=msg)

        # folder is empty now
        delete_tasks = [document_service.db.delete_document(document_id, auth) for document_id in document_ids]
        stati = await asyncio.gather(*delete_tasks)
        if not all(stati):
            failed = [doc for doc, stat in zip(document_ids, stati) if not stat]
            msg = "Failed to delete the following documents: " + ", ".join(failed)
            logger.error(msg)
            raise HTTPException(status_code=500, detail=msg)

        db: PostgresDatabase = document_service.db
        # just remove the folder too now.
        status = await db.delete_folder(folder_id, auth)
        if not status:
            logger.error(f"Failed to delete folder {folder_id}")
            raise HTTPException(status_code=500, detail=f"Failed to delete folder {folder_id}")
        return {"status": "success", "message": f"Folder {folder_id} deleted successfully"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/folders/{folder_id}/documents/{document_id}")
@telemetry.track(operation_type="add_document_to_folder", metadata_resolver=telemetry.add_document_to_folder_metadata)
async def add_document_to_folder(
    folder_id: str,
    document_id: str,
    auth: AuthContext = Depends(verify_token),
):
    """
    Add a document to a folder.

    Args:
        folder_id: ID of the folder
        document_id: ID of the document
        auth: Authentication context

    Returns:
        Success status
    """
    try:
        success = await document_service.db.add_document_to_folder(folder_id, document_id, auth)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to add document to folder")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error adding document to folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/folders/{folder_id}/documents/{document_id}")
@telemetry.track(
    operation_type="remove_document_from_folder", metadata_resolver=telemetry.remove_document_from_folder_metadata
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
        document_id: ID of the document
        auth: Authentication context

    Returns:
        Success status
    """
    try:
        success = await document_service.db.remove_document_from_folder(folder_id, document_id, auth)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to remove document from folder")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error removing document from folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/{name}", response_model=GraphResponse)
@telemetry.track(operation_type="get_graph", metadata_resolver=telemetry.get_graph_metadata)
async def get_graph(
    name: str,
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
) -> GraphResponse:
    """
    Get a graph by name.

    This endpoint retrieves a graph by its name if the user has access to it
    and transforms it to a frontend-compatible format.

    Args:
        name: Name of the graph to retrieve
        auth: Authentication context
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        GraphResponse: The requested graph object in frontend format
    """
    try:
        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id

        graph = await document_service.db.get_graph(name, auth, system_filters)
        if not graph:
            raise HTTPException(status_code=404, detail=f"Graph '{name}' not found")
        
        # Transform to frontend format
        return transform_graph_to_frontend_format(graph)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graphs", response_model=List[GraphResponse])
@telemetry.track(operation_type="list_graphs", metadata_resolver=telemetry.list_graphs_metadata)
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

        graphs = await document_service.db.list_graphs(auth, system_filters)
        
        # Transform each graph to frontend format
        return [transform_graph_to_frontend_format(graph) for graph in graphs]
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/{name}/visualization", response_model=Dict[str, Any])
@telemetry.track(operation_type="get_graph_visualization", metadata_resolver=telemetry.get_graph_metadata)
async def get_graph_visualization(
    name: str,
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Obtener datos de visualización del grafo.

    Este endpoint recupera los nodos y enlaces necesarios para la visualización del grafo.
    Funciona tanto con servicios de grafo locales como basados en API.

    Args:
        name: Nombre del grafo a visualizar
        auth: Contexto de autenticación
        folder_name: Carpeta opcional para delimitar la operación
        end_user_id: ID de usuario final opcional para delimitar la operación

    Returns:
        Dict: Datos de visualización que contienen arrays de nodos y enlaces
    """
    try:
        return await document_service.get_graph_visualization_data(
            name=name,
            auth=auth,
            folder_name=folder_name,
            end_user_id=end_user_id,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error obteniendo datos de visualización del grafo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graph/{name}/update", response_model=Graph)
@telemetry.track(operation_type="update_graph", metadata_resolver=telemetry.update_graph_metadata)
async def update_graph(
    name: str,
    request: UpdateGraphRequest,
    auth: AuthContext = Depends(verify_token),
) -> Graph:
    """
    Update an existing graph with new documents.

    This endpoint processes additional documents based on the original graph filters
    and/or new filters/document IDs, extracts entities and relationships, and
    updates the graph with new information.

    Args:
        name: Name of the graph to update
        request: UpdateGraphRequest containing:
            - additional_filters: Optional additional metadata filters to determine which new documents to include
            - additional_documents: Optional list of additional document IDs to include
            - prompt_overrides: Optional customizations for entity extraction and resolution prompts
            - folder_name: Optional folder to scope the operation to
            - end_user_id: Optional end-user ID to scope the operation to
        auth: Authentication context

    Returns:
        Graph: The updated graph object
    """
    try:
        # Validate prompt overrides before proceeding
        if request.prompt_overrides:
            validate_prompt_overrides_with_http_exception(request.prompt_overrides, operation_type="graph")

        # Create system filters for folder and user scoping
        system_filters = {}
        if request.folder_name:
            system_filters["folder_name"] = request.folder_name
        if request.end_user_id:
            system_filters["end_user_id"] = request.end_user_id

        return await document_service.update_graph(
            name=name,
            auth=auth,
            additional_filters=request.additional_filters,
            additional_documents=request.additional_documents,
            prompt_overrides=request.prompt_overrides,
            system_filters=system_filters,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        validate_prompt_overrides_with_http_exception(operation_type="graph", error=e)
    except Exception as e:
        logger.error(f"Error updating graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/graph/{name}")
@telemetry.track(operation_type="delete_graph", metadata_resolver=telemetry.delete_graph_metadata)
async def delete_graph(
    name: str,
    auth: AuthContext = Depends(verify_token),
    folder_name: Optional[Union[str, List[str]]] = None,
    end_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Delete a graph by name.

    This endpoint deletes a graph by its name if the user has permission to do so.

    Args:
        name: Name of the graph to delete
        auth: Authentication context
        folder_name: Optional folder to scope the operation to
        end_user_id: Optional end-user ID to scope the operation to

    Returns:
        Dict[str, Any]: Success message
    """
    try:
        # Create system filters for folder and user scoping
        system_filters = {}
        if folder_name:
            system_filters["folder_name"] = folder_name
        if end_user_id:
            system_filters["end_user_id"] = end_user_id

        success = await document_service.db.delete_graph(name, auth, system_filters)
        if not success:
            raise HTTPException(status_code=404, detail=f"Graph '{name}' not found or could not be deleted")
        
        return {"status": "success", "message": f"Graph '{name}' deleted successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/workflow/{workflow_id}/status", response_model=Dict[str, Any])
@telemetry.track(operation_type="check_workflow_status", metadata_resolver=telemetry.get_graph_metadata)
async def check_workflow_status(
    workflow_id: str,
    run_id: Optional[str] = None,
    auth: AuthContext = Depends(verify_token),
) -> Dict[str, Any]:
    """
    Verificar el estado de un flujo de trabajo de construcción/actualización de grafo.

    Este endpoint consulta la API externa de grafos para verificar el estado de una operación asíncrona.

    Args:
        workflow_id: El ID del flujo de trabajo devuelto de operaciones de construcción/actualización
        run_id: ID de ejecución opcional para la ejecución específica del flujo de trabajo
        auth: Contexto de autenticación

    Returns:
        Dict que contiene estado ('running', 'completed', o 'failed') y resultado opcional
    """
    try:
        # Obtener el servicio de grafos (ya sea local o basado en API)
        graph_service = document_service.graph_service

        # Verificar si es el servicio MorphikGraphService
        from core.services.morphik_graph_service import MorphikGraphService

        if isinstance(graph_service, MorphikGraphService):
            # Usar el método check_workflow_status
            result = await graph_service.check_workflow_status(workflow_id=workflow_id, run_id=run_id, auth=auth)

            # Si el flujo de trabajo está completado, actualizar el estado del grafo correspondiente
            if result.get("status") == "completed":
                # Extraer graph_id del workflow_id (formato: "build-update-{graph_name}-...")
                # Esta es una heurística simple, ajustar según el formato real del workflow_id
                parts = workflow_id.split("-")
                if len(parts) >= 3:
                    graph_name = parts[2]
                    try:
                        # Buscar y actualizar el grafo
                        graphs = await document_service.db.list_graphs(auth)
                        for graph in graphs:
                            if graph.name == graph_name or workflow_id in graph.system_metadata.get("workflow_id", ""):
                                graph.system_metadata["status"] = "completed"
                                await document_service.db.update_graph(graph, auth)
                    except Exception as e:
                        logger.warning(f"No se pudo actualizar el estado del grafo: {e}")

            return result
        else:
            logger.warning("Tipo de servicio de grafo no compatible con verificación de flujo de trabajo")
            return {"status": "not_supported", "message": "Este servicio de grafo no admite verificación de flujo de trabajo"}

    except Exception as e:
        logger.error(f"Error al verificar estado del flujo de trabajo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === API DE RECOMENDACIONES ===
