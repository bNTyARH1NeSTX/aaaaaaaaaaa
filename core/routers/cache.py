"""Cache management endpoints."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.config import get_settings
from core.limits_utils import check_and_increment_limits
from core.models.completion import CompletionResponse
from core.services.telemetry import TelemetryService
from core.services_init import document_service

logger = logging.getLogger(__name__)
settings = get_settings()
telemetry = TelemetryService()

router = APIRouter(prefix="/cache", tags=["cache"])


@router.post("/create")
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
    except Exception as e:
        logger.error(f"Error creating cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{name}")
@telemetry.track(operation_type="get_cache", metadata_resolver=telemetry.cache_get_metadata)
async def get_cache(name: str, auth: AuthContext = Depends(verify_token)) -> Dict[str, Any]:
    """Get cache configuration by name."""
    try:
        exists = await document_service.load_cache(name)
        return {"exists": exists}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{name}/update")
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
    except Exception as e:
        logger.error(f"Error updating cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{name}/add_docs")
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
    except Exception as e:
        logger.error(f"Error adding docs to cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{name}/query")
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
    except Exception as e:
        logger.error(f"Error querying cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))
