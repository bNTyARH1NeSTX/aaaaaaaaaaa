import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status, Query
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field

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

# Manual generation services are imported in the router

# Import API routers from refactored modules
from core.routers.batch import router as batch_router
from core.routers.cache import router as cache_router
from core.routers.chat import chat_router
from core.routers.documents import router as documents_router
from core.routers.folders import router as folders_router
from core.routers.graphs import router as graphs_router
from core.routers.health import router as health_router
from core.routers.ingest import router as ingest_router
from core.routers.manual_generation_router import manual_generation_router
from core.routers.query import router as query_router
from core.routers.retrieval import router as retrieval_router
from core.routers.rule_templates import router as rule_templates_router
from core.routers.usage import router as usage_router

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


# ---------------------------------------------------------------------------
# Core singletons (database, vector store, storage, parser, models …)
# ---------------------------------------------------------------------------


# Store on app.state for later access
app.state.document_service = document_service
logger.info("Document service initialized and stored on app.state")

# Single MorphikAgent instance (tool definitions cached)
morphik_agent = MorphikAgent(document_service=document_service)


logger.info("Enterprise edition (ee) module is not used in this setup.")

# --- Pydantic Models for API Requests ---
class ListDocumentsRequest(BaseModel):
    skip: int = 0
    limit: int = 10000
    filters: Optional[Dict[str, Any]] = None
    folder_name: Optional[Union[str, List[str]]] = None
    end_user_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Manual Generation endpoints - MOVED TO /core/routers/manual_generation_router.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Documents endpoints - MOVED TO /core/routers/documents.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Retrieval endpoints - MOVED TO /core/routers/retrieval.py  
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Graphs endpoints - MOVED TO /core/routers/graphs.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Ingest endpoints - MOVED TO /core/routers/ingest.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Query endpoints - MOVED TO /core/routers/query.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Batch endpoints - MOVED TO /core/routers/batch.py
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# NOTE: All other endpoints have been moved to modular routers
# Previous duplicate endpoints have been removed to prevent conflicts
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Router Inclusions - All endpoints are now modularized
# ---------------------------------------------------------------------------

# Include all API routers (deduplicated and organized)
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(retrieval_router)
app.include_router(ingest_router)
app.include_router(query_router)
app.include_router(batch_router)
app.include_router(graphs_router)
app.include_router(folders_router)
app.include_router(manual_generation_router)
app.include_router(chat_router)
app.include_router(rule_templates_router)
app.include_router(usage_router)
app.include_router(cache_router)
