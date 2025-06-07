"""
Document ingestion endpoints.
Handles text and file ingestion operations.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import arq

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.models.documents import Document
from core.models.request import IngestTextRequest, BatchIngestResponse
from core.services.telemetry import TelemetryService
from core.services_init import document_service
from core.dependencies import get_redis_pool
from core.config import get_settings
from core.limits_utils import check_and_increment_limits, estimate_pages_by_chars

router = APIRouter(prefix="/ingest", tags=["Ingestion"])
telemetry = TelemetryService()
settings = get_settings()


@router.post("/text", response_model=Document)
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
            estimated_pages = estimate_pages_by_chars(len(request.content))
            await check_and_increment_limits(auth.user_id, estimated_pages)

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


@router.post("/file", response_model=Document)
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
        if isinstance(use_colpali, str):
            use_colpali = use_colpali.lower() == "true"

        return await document_service.ingest_file(
            file=file,
            metadata=metadata_dict,
            rules=rules_list,
            use_colpali=use_colpali,
            auth=auth,
            folder_name=folder_name,
            end_user_id=end_user_id,
            redis=redis,
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ingesting file: {str(e)}")


@router.post("/files", response_model=BatchIngestResponse)
@telemetry.track(operation_type="queue_batch_ingest", metadata_resolver=telemetry.batch_ingest_metadata)
async def batch_ingest_files(
    metadata: str = Form("{}"),
    rules: str = Form("[]"),
    use_colpali: Optional[bool] = Form(None),
    parallel: Optional[bool] = Form(True),
    folder_name: Optional[str] = Form(None),
    end_user_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    auth: AuthContext = Depends(verify_token),
    redis: arq.ArqRedis = Depends(get_redis_pool),
) -> BatchIngestResponse:
    """
    Batch ingest multiple files asynchronously.

    Args:
        metadata: JSON string of metadata to apply to all files
        rules: JSON string of rules list to apply to all files
        use_colpali: Whether to use ColPali embedding model
        parallel: Whether to process files in parallel
        folder_name: Optional folder to scope the documents to
        end_user_id: Optional end-user ID to scope the documents to
        files: List of files to ingest
        auth: Authentication context
        redis: Redis connection pool for background tasks

    Returns:
        BatchIngestResponse with task IDs and processing information
    """
    try:
        # Parse metadata and rules
        metadata_dict = json.loads(metadata)
        rules_list = json.loads(rules)

        # Fix bool conversion for form fields
        if isinstance(use_colpali, str):
            use_colpali = use_colpali.lower() == "true"
        if isinstance(parallel, str):
            parallel = parallel.lower() == "true"

        return await document_service.batch_ingest_files(
            files=files,
            metadata=metadata_dict,
            rules=rules_list,
            use_colpali=use_colpali,
            parallel=parallel,
            auth=auth,
            folder_name=folder_name,
            end_user_id=end_user_id,
            redis=redis,
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error batch ingesting files: {str(e)}")
