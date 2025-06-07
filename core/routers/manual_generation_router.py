"""
Manual Generation API Router

This module contains all endpoints related to manual generation functionality:
- Manual text generation from ERP images
- PowerPoint presentation generation  
- ERP image processing and metadata extraction
- Batch processing of ERP images
"""

import logging
import os
import uuid
import json
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.services.telemetry import TelemetryService
from core.models.request import (
    ManualGenerationRequest,
    ManualGenerationResponse,
    PowerPointGenerationRequest,
    ERPImageProcessingRequest,
    ERPImageProcessingResponse
)
import logging
from core.embedding.manual_generation_embedding_model import ManualGenerationEmbeddingModel
from core.services.manual_generator_service import ManualGeneratorService

logger = logging.getLogger(__name__)

# Router setup
manual_generation_router = APIRouter(
    prefix="/manuals",
    tags=["Manual Generation"],
    responses={404: {"description": "Not found"}},
)

# Initialize telemetry service
telemetry = TelemetryService()

# Dependency providers
_manual_gen_embedding_model_instance: Optional[ManualGenerationEmbeddingModel] = None
_manual_generator_service_instance: Optional[ManualGeneratorService] = None

def get_manual_generation_embedding_model() -> ManualGenerationEmbeddingModel:
    """Get or create the manual generation embedding model instance."""
    global _manual_gen_embedding_model_instance
    if _manual_gen_embedding_model_instance is None:
        from core.config import get_settings
        settings = get_settings()
        logger.info("Initializing ManualGenerationEmbeddingModel instance.")
        _manual_gen_embedding_model_instance = ManualGenerationEmbeddingModel(settings=settings)
    return _manual_gen_embedding_model_instance

def get_manual_generator_service() -> ManualGeneratorService:
    """Get or create the manual generator service instance."""
    global _manual_generator_service_instance
    if _manual_generator_service_instance is None:
        from core.config import get_settings
        settings = get_settings()
        logger.info("Initializing ManualGeneratorService instance.")
        _manual_generator_service_instance = ManualGeneratorService(settings=settings)
    return _manual_generator_service_instance


@manual_generation_router.post(
    "/generate_manual",
    response_model=ManualGenerationResponse,
    summary="Generate manual text based on a query and relevant ERP images."
)
@telemetry.track(operation_type="generate_manual", metadata_resolver=None)
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
    relevant_images_metadata = []

    if request.image_path:
        if not request.image_prompt:
            logger.warning("image_path provided without image_prompt for manual generation.")
            raise HTTPException(status_code=400, detail="If image_path is provided, image_prompt (description of the image content) must also be provided.")
        logger.info(f"Using provided image: {request.image_path} for manual generation.")
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
        logger.error("No image metadata available to generate manual after processing request.")
        raise HTTPException(status_code=404, detail="No image metadata available to generate manual. Please check your query or provided image path.")

    try:
        logger.info(f"Generating manual text for query: '{request.query}' using {len(relevant_images_metadata)} image(s).")
        generated_text_result = await generator_service.generate_manual_text(
            query=request.query,
            images_metadata=relevant_images_metadata,
        )
        logger.info(f"Successfully generated manual text for query: '{request.query}'.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating manual text: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred during manual text generation: {str(e)}")

    return ManualGenerationResponse(
        generated_text=generated_text_result,
        relevant_images_used=relevant_images_metadata,
        query=request.query,
    )


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
            images_metadata=relevant_images_metadata,
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
    Process a single ERP image to extract metadata using the ERPMetadataExtractionRule.
    
    Args:
        request: ERPImageProcessingRequest containing image path and processing options
        auth: Authentication context
        embedding_model: Manual generation embedding model instance
        
    Returns:
        ERPImageProcessingResponse with extracted metadata and processing status
    """
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


# Additional models for batch processing
from pydantic import BaseModel, Field

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
    from core.rules.erp_metadata_extraction_rule import ERPMetadataExtractionRule
    from core.models.chunk import Chunk
    
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


# Additional models for process_erp_images endpoint
class ERPImageProcessingRequestExtended(BaseModel):
    folder_path: Optional[str] = Field(default=None, description="Path to folder with ERP images")
    force_reprocess: bool = Field(default=False, description="Force reprocessing of existing images")
    max_images: Optional[int] = Field(default=None, description="Maximum number of images to process")
    batch_size: int = Field(default=10, description="Number of images to process per batch")

class ERPImageProcessingResponseExtended(BaseModel):
    total_images_found: int
    total_images_processed: int
    total_images_skipped: int
    errors: List[str]
    processing_time_seconds: float
    status: str


@manual_generation_router.post(
    "/process_erp_images",
    response_model=ERPImageProcessingResponseExtended,
    summary="Process and index ERP screenshots using Morphik rules and ColPali"
)
@telemetry.track(operation_type="process_erp_images", metadata_resolver=None)
async def process_erp_images_endpoint(
    request: ERPImageProcessingRequestExtended,
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
    from core.config import get_settings
    
    settings = get_settings()
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
        
        return ERPImageProcessingResponseExtended(
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
        
        context_str = " - ".join(context_parts) if context_parts else "Sistema ERP"
        
        metadata["prompt"] = f"{context_str}: {filename_no_ext}"
        if metadata["function_detected"]:
            metadata["respuesta"] = f"Pantalla del ERP para {metadata['function_detected'].lower()} en {context_str}"
        else:
            metadata["respuesta"] = f"Pantalla del sistema ERP: {context_str}"
        
        # Add hierarchy information
        metadata["additional_metadata"] = {
            "path_hierarchy": path_parts,
            "filename_original": filename,
            "auto_extracted": True,
            "extraction_method": "path_analysis"
        }
        
        return metadata
        
    except Exception as e:
        logger.error(f"Error extracting metadata from path {relative_path}: {str(e)}")
        # Return minimal metadata on error
        return {
            "module": None,
            "section": None,
            "subsection": None,
            "function_detected": None,
            "hierarchy_level": 0,
            "keywords": [],
            "prompt": f"ERP Image: {os.path.basename(relative_path)}",
            "respuesta": "Sistema ERP",
            "additional_metadata": {"extraction_error": str(e)}
        }


def _generate_embedding_text(metadata: Dict[str, Any], relative_path: str) -> str:
    """
    Generate text for embedding based on extracted metadata.
    This creates a rich text representation that ColPali can understand.
    """
    text_parts = []
    
    # Add module information
    if metadata.get("module"):
        text_parts.append(f"Módulo: {metadata['module']}")
    
    # Add section and subsection
    if metadata.get("section"):
        text_parts.append(f"Sección: {metadata['section']}")
    if metadata.get("subsection"):
        text_parts.append(f"Subsección: {metadata['subsection']}")
    
    # Add function information
    if metadata.get("function_detected"):
        text_parts.append(f"Función: {metadata['function_detected']}")
    
    # Add keywords
    if metadata.get("keywords"):
        text_parts.append(f"Palabras clave: {', '.join(metadata['keywords'])}")
    
    # Add filename context
    filename = os.path.basename(relative_path)
    text_parts.append(f"Archivo: {filename}")
    
    # Add path context
    path_parts = relative_path.split(os.sep)
    if len(path_parts) > 1:
        path_context = " > ".join(path_parts[:-1])  # Exclude filename
        text_parts.append(f"Ubicación: {path_context}")
    
    # Combine all parts
    embedding_text = " | ".join(text_parts)
    
    # Add the prompt as primary text
    if metadata.get("prompt"):
        embedding_text = f"{metadata['prompt']} | {embedding_text}"
    
    return embedding_text