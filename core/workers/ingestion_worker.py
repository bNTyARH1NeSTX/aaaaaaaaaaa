import asyncio
import json
import logging
import os
import time
import urllib.parse as up
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from arq.connections import RedisSettings
from sqlalchemy import text

from core.config import get_settings
from core.database.postgres_database import PostgresDatabase
from core.embedding.colpali_api_embedding_model import ColpaliApiEmbeddingModel
from core.embedding.colpali_embedding_model import ColpaliEmbeddingModel
from core.embedding.litellm_embedding import LiteLLMEmbeddingModel
from core.limits_utils import check_and_increment_limits, estimate_pages_by_chars
from core.models.auth import AuthContext, EntityType
from core.models.rules import MetadataExtractionRule
from core.parser.morphik_parser import MorphikParser
from core.services.document_service import DocumentService
from core.services.rules_processor import RulesProcessor
from core.services.telemetry import TelemetryService
from core.storage.local_storage import LocalStorage
from core.storage.s3_storage import S3Storage
from core.vector_store.multi_vector_store import MultiVectorStore
from core.vector_store.pgvector_store import PGVectorStore

# Enterprise routing helpers
# from ee.db_router import get_database_for_app, get_vector_store_for_app

async def get_database_for_app(app_id: Optional[str]) -> PostgresDatabase:
    """Fallback implementation for enterprise routing"""
    database = PostgresDatabase(uri=settings.POSTGRES_URI)
    return database

async def get_vector_store_for_app(app_id: Optional[str]) -> Optional[PGVectorStore]:
    """Fallback implementation for enterprise routing"""
    if not hasattr(settings, 'POSTGRES_URI') or not settings.POSTGRES_URI:
        return None
    vector_store = PGVectorStore(uri=settings.POSTGRES_URI)
    return vector_store

logger = logging.getLogger(__name__)

# Initialize global settings once
settings = get_settings()

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

# Set up file handler for worker_ingestion.log
file_handler = logging.FileHandler("logs/worker_ingestion.log")
file_handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
logger.addHandler(file_handler)
# Set logger level based on settings (diff used INFO directly)
logger.setLevel(logging.INFO)


async def get_document_with_retry(document_service, document_id, auth, max_retries=3, initial_delay=0.3):
    """
    Helper function to get a document with retries to handle race conditions.

    Args:
        document_service: The document service instance
        document_id: ID of the document to retrieve
        auth: Authentication context
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay before first attempt in seconds

    Returns:
        Document if found and accessible, None otherwise
    """
    attempt = 0
    retry_delay = initial_delay

    # Add initial delay to allow transaction to commit
    if initial_delay > 0:
        await asyncio.sleep(initial_delay)

    while attempt < max_retries:
        try:
            doc = await document_service.db.get_document(document_id, auth)
            if doc:
                logger.debug(f"Successfully retrieved document {document_id} on attempt {attempt+1}")
                return doc

            # Document not found but no exception raised
            attempt += 1
            if attempt < max_retries:
                logger.warning(
                    f"Document {document_id} not found on attempt {attempt}/{max_retries}. "
                    f"Retrying in {retry_delay}s..."
                )
                await asyncio.sleep(retry_delay)
                retry_delay *= 1.5

        except Exception as e:
            attempt += 1
            error_msg = str(e)
            if attempt < max_retries:
                logger.warning(
                    f"Error retrieving document on attempt {attempt}/{max_retries}: {error_msg}. "
                    f"Retrying in {retry_delay}s..."
                )
                await asyncio.sleep(retry_delay)
                retry_delay *= 1.5
            else:
                logger.error(f"Failed to retrieve document after {max_retries} attempts: {error_msg}")
                return None

    return None


async def process_ingestion_job(
    ctx: Dict[str, Any],
    document_id: str,
    file_key: str,
    bucket: str,
    original_filename: str,
    content_type: str,
    metadata_json: str,
    auth_dict: Dict[str, Any],
    rules_list: List[Dict[str, Any]],
    use_colpali: bool,
    folder_name: Optional[str] = None,
    end_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Background worker task that processes file ingestion jobs.

    Args:
        ctx: The ARQ context dictionary
        file_key: The storage key where the file is stored
        bucket: The storage bucket name
        original_filename: The original file name
        content_type: The file's content type/MIME type
        metadata_json: JSON string of metadata
        auth_dict: Dict representation of AuthContext
        rules_list: List of rules to apply (already converted to dictionaries)
        use_colpali: Whether to use ColPali embedding model
        folder_name: Optional folder to scope the document to
        end_user_id: Optional end-user ID to scope the document to

    Returns:
        A dictionary with the document ID and processing status
    """
    try:
        # Start performance timer
        job_start_time = time.time()
        phase_times = {}
        # 1. Log the start of the job
        logger.info(f"Starting ingestion job for file: {original_filename}")

        # 2. Deserialize metadata and auth
        deserialize_start = time.time()
        metadata = json.loads(metadata_json) if metadata_json else {}
        auth = AuthContext(
            entity_type=EntityType(auth_dict.get("entity_type", "unknown")),
            entity_id=auth_dict.get("entity_id", ""),
            app_id=auth_dict.get("app_id"),
            permissions=set(auth_dict.get("permissions", ["read"])),
            user_id=auth_dict.get("user_id", auth_dict.get("entity_id", "")),
        )
        phase_times["deserialize_auth"] = time.time() - deserialize_start

        # ------------------------------------------------------------------
        # Per-app routing for database and vector store
        # ------------------------------------------------------------------

        # Resolve a dedicated database/vector-store using the JWT *app_id*.
        # When app_id is None we fall back to the control-plane resources.

        database = await get_database_for_app(auth.app_id)
        await database.initialize()

        vector_store = await get_vector_store_for_app(auth.app_id)
        if vector_store and hasattr(vector_store, "initialize"):
            # PGVectorStore.initialize is *async*
            try:
                await vector_store.initialize()
            except Exception as init_err:
                logger.warning(f"Vector store initialization failed for app {auth.app_id}: {init_err}")

        # Initialise a per-app MultiVectorStore for ColPali when needed
        colpali_vector_store = None
        if use_colpali:
            try:
                # Use render_as_string(hide_password=False) so the URI keeps the
                # password – str(engine.url) masks it with "***" which breaks
                # authentication for psycopg.  Also append sslmode=require when
                # missing to satisfy Neon.
                from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

                uri_raw = database.engine.url.render_as_string(hide_password=False)

                parsed = urlparse(uri_raw)
                query = parse_qs(parsed.query)
                if "sslmode" not in query and settings.MODE == "cloud":
                    query["sslmode"] = ["require"]
                    parsed = parsed._replace(query=urlencode(query, doseq=True))

                uri_final = urlunparse(parsed)

                colpali_vector_store = MultiVectorStore(uri=uri_final)
                await asyncio.to_thread(colpali_vector_store.initialize)
            except Exception as e:
                logger.warning(f"Failed to initialise ColPali MultiVectorStore for app {auth.app_id}: {e}")

        # Build a fresh DocumentService scoped to this job/app so we don't
        # mutate the shared instance kept in *ctx* (avoids cross-talk between
        # concurrent jobs for different apps).
        document_service = DocumentService(
            storage=ctx["storage"],
            database=database,
            vector_store=vector_store,
            embedding_model=ctx["embedding_model"],
            parser=ctx["parser"],
            cache_factory=None,
            enable_colpali=use_colpali,
            colpali_embedding_model=ctx.get("colpali_embedding_model"),
            colpali_vector_store=colpali_vector_store,
        )

        # 3. Download the file from storage
        logger.info(f"Downloading file from {bucket}/{file_key}")
        download_start = time.time()
        file_content = await document_service.storage.download_file(bucket, file_key)

        # Ensure file_content is bytes
        if hasattr(file_content, "read"):
            file_content = file_content.read()
        download_time = time.time() - download_start
        phase_times["download_file"] = download_time
        logger.info(f"File download took {download_time:.2f}s for {len(file_content)/1024/1024:.2f}MB")

        # 4. Parse file to text
        # Use the filename derived from the storage key so the parser
        # receives the correct extension (.txt, .pdf, etc.).  Passing the UI
        # provided original_filename (often .pdf) can mislead the parser when
        # the stored object is a pre-extracted text file (e.g. .pdf.txt).
        parse_filename = os.path.basename(file_key) if file_key else original_filename

        parse_start = time.time()
        additional_metadata, text = await document_service.parser.parse_file_to_text(file_content, parse_filename)
        logger.debug(f"Parsed file into text of length {len(text)} (filename used: {parse_filename})")
        parse_time = time.time() - parse_start
        phase_times["parse_file"] = parse_time

        # NEW -----------------------------------------------------------------
        # Estimate pages early for pre-check
        num_pages_estimated = estimate_pages_by_chars(len(text))

        # 4.b Enforce tier limits (pages ingested) for cloud/free tier users
        if settings.MODE == "cloud" and auth.user_id:
            # Calculate approximate pages using same heuristic as DocumentService
            try:
                # Dry-run verification before heavy processing
                await check_and_increment_limits(
                    auth,
                    "ingest",
                    num_pages_estimated,
                    document_id,
                    verify_only=True,
                )
            except Exception as limit_exc:
                logger.error("User %s exceeded ingest limits: %s", auth.user_id, limit_exc)
                raise
        # ---------------------------------------------------------------------

        # === Apply post_parsing rules ===
        rules_start = time.time()
        document_rule_metadata = {}
        if rules_list:
            logger.info("Applying post-parsing rules...")
            document_rule_metadata, text = await document_service.rules_processor.process_document_rules(
                text, rules_list
            )
            metadata.update(document_rule_metadata)  # Merge metadata into main doc metadata
            logger.info(f"Document metadata after post-parsing rules: {metadata}")
            logger.info(f"Content length after post-parsing rules: {len(text)}")
        rules_time = time.time() - rules_start
        phase_times["apply_post_parsing_rules"] = rules_time
        if rules_list:
            logger.info(f"Post-parsing rules processing took {rules_time:.2f}s")

        # 6. Retrieve the existing document
        retrieve_start = time.time()
        logger.debug(f"Retrieving document with ID: {document_id}")
        logger.debug(
            f"Auth context: entity_type={auth.entity_type}, entity_id={auth.entity_id}, permissions={auth.permissions}"
        )

        # Use the retry helper function with initial delay to handle race conditions
        doc = await get_document_with_retry(document_service, document_id, auth, max_retries=5, initial_delay=1.0)
        retrieve_time = time.time() - retrieve_start
        phase_times["retrieve_document"] = retrieve_time
        logger.info(f"Document retrieval took {retrieve_time:.2f}s")

        if not doc:
            logger.error(f"Document {document_id} not found in database after multiple retries")
            logger.error(
                f"Details - file: {original_filename}, content_type: {content_type}, bucket: {bucket}, key: {file_key}"
            )
            logger.error(
                f"Auth: entity_type={auth.entity_type}, entity_id={auth.entity_id}, permissions={auth.permissions}"
            )
            raise ValueError(f"Document {document_id} not found in database after multiple retries")

        # Prepare updates for the document
        # Merge new metadata with existing metadata to preserve external_id
        merged_metadata = {**doc.metadata, **metadata}
        # Make sure external_id is preserved in the metadata
        merged_metadata["external_id"] = doc.external_id

        updates = {
            "metadata": merged_metadata,
            "additional_metadata": additional_metadata,
            "system_metadata": {**doc.system_metadata, "content": text},
        }

        # Add folder_name and end_user_id to system_metadata if provided
        if folder_name:
            updates["system_metadata"]["folder_name"] = folder_name
        if end_user_id:
            updates["system_metadata"]["end_user_id"] = end_user_id

        # Update the document in the database
        update_start = time.time()
        success = await document_service.db.update_document(document_id=document_id, updates=updates, auth=auth)
        update_time = time.time() - update_start
        phase_times["update_document_parsed"] = update_time
        logger.info(f"Initial document update took {update_time:.2f}s")

        if not success:
            raise ValueError(f"Failed to update document {document_id}")

        # Refresh document object with updated data
        doc = await document_service.db.get_document(document_id, auth)
        logger.debug("Updated document in database with parsed content")

        # 7. Split text into chunks
        chunking_start = time.time()
        parsed_chunks = await document_service.parser.split_text(text)
        if not parsed_chunks:
            # No text was extracted from the file.  In many cases (e.g. pure images)
            # we can still proceed if ColPali multivector chunks are produced later.
            # Therefore we defer the fatal check until after ColPali chunk creation.
            logger.warning(
                "No text chunks extracted after parsing. Will attempt to continue "
                "and rely on image-based chunks if available."
            )
        chunking_time = time.time() - chunking_start
        phase_times["split_into_chunks"] = chunking_time
        logger.info(f"Text chunking took {chunking_time:.2f}s to create {len(parsed_chunks)} chunks")

        # Decide whether we need image chunks either for ColPali embedding or because
        # there are image-based rules (use_images=True) that must process them.
        has_image_rules = any(
            r.get("stage", "post_parsing") == "post_chunking"
            and r.get("type") == "metadata_extraction"
            and r.get("use_images", False)
            for r in rules_list or []
        )

        using_colpali = (
            use_colpali and document_service.colpali_embedding_model and document_service.colpali_vector_store
        )

        should_create_image_chunks = has_image_rules or using_colpali

        # Start timer for optional image chunk creation / multivector processing
        colpali_processing_start = time.time()

        chunks_multivector = []
        if should_create_image_chunks:
            import base64

            import filetype

            file_type = filetype.guess(file_content)
            file_content_base64 = base64.b64encode(file_content).decode()

            # Use the parsed chunks for ColPali/image rules – this will create image chunks if appropriate
            chunks_multivector = document_service._create_chunks_multivector(
                file_type, file_content_base64, file_content, parsed_chunks
            )
            logger.debug(
                f"Created {len(chunks_multivector)} multivector/image chunks "
                f"(has_image_rules={has_image_rules}, using_colpali={using_colpali})"
            )
        colpali_create_chunks_time = time.time() - colpali_processing_start
        phase_times["colpali_create_chunks"] = colpali_create_chunks_time
        if using_colpali:
            logger.info(f"Colpali chunk creation took {colpali_create_chunks_time:.2f}s")

        # If we still have no chunks at all (neither text nor image) abort early
        if not parsed_chunks and not chunks_multivector:
            raise ValueError("No content chunks (text or image) could be extracted from the document")

        # Determine the final page count for recording usage
        final_page_count = num_pages_estimated  # Default to estimate
        if using_colpali and chunks_multivector:
            final_page_count = len(chunks_multivector)
        final_page_count = max(1, final_page_count)  # Ensure at least 1 page
        logger.info(
            f"Determined final page count for usage recording: {final_page_count} pages (ColPali used: {using_colpali})"
        )

        colpali_count_for_limit_fn = len(chunks_multivector) if using_colpali else None

        # 9. Apply post_chunking rules and aggregate metadata
        processed_chunks = []
        processed_chunks_multivector = []
        aggregated_chunk_metadata: Dict[str, Any] = {}  # Initialize dict for aggregated metadata
        chunk_contents = []  # Initialize list to collect chunk contents as we process them

        if rules_list:
            logger.info("Applying post-chunking rules...")

            # Partition rules by type
            text_rules = []
            image_rules = []

            for rule_dict in rules_list:
                rule = document_service.rules_processor._parse_rule(rule_dict)
                if rule.stage == "post_chunking":
                    if isinstance(rule, MetadataExtractionRule) and rule.use_images:
                        image_rules.append(rule_dict)
                    else:
                        text_rules.append(rule_dict)

            logger.info(f"Partitioned rules: {len(text_rules)} text rules, {len(image_rules)} image rules")

            # Process regular text chunks with text rules only
            if text_rules:
                logger.info(f"Applying {len(text_rules)} text rules to text chunks...")
                for chunk_obj in parsed_chunks:
                    # Get metadata *and* the potentially modified chunk
                    chunk_rule_metadata, processed_chunk = await document_service.rules_processor.process_chunk_rules(
                        chunk_obj, text_rules
                    )
                    processed_chunks.append(processed_chunk)
                    chunk_contents.append(processed_chunk.content)  # Collect content as we process
                    # Aggregate the metadata extracted from this chunk
                    aggregated_chunk_metadata.update(chunk_rule_metadata)
            else:
                processed_chunks = parsed_chunks  # No text rules, use original chunks

            # Process colpali image chunks with image rules if they exist
            if chunks_multivector and image_rules:
                logger.info(f"Applying {len(image_rules)} image rules to image chunks...")
                for chunk_obj in chunks_multivector:
                    # Only process if it's an image chunk - pass the image content to the rule
                    if chunk_obj.metadata.get("is_image", False):
                        # Get metadata *and* the potentially modified chunk
                        chunk_rule_metadata, processed_chunk = (
                            await document_service.rules_processor.process_chunk_rules(chunk_obj, image_rules)
                        )
                        processed_chunks_multivector.append(processed_chunk)
                        # Aggregate the metadata extracted from this chunk
                        aggregated_chunk_metadata.update(chunk_rule_metadata)
                    else:
                        # Non-image chunks from multivector don't need further processing
                        processed_chunks_multivector.append(chunk_obj)

                logger.info(f"Finished applying image rules to {len(processed_chunks_multivector)} image chunks.")
            elif chunks_multivector:
                # No image rules, use original multivector chunks
                processed_chunks_multivector = chunks_multivector

            logger.info(f"Finished applying post-chunking rules to {len(processed_chunks)} regular chunks.")
            logger.info(f"Aggregated metadata from all chunks: {aggregated_chunk_metadata}")

            # Update the document content with the stitched content from processed chunks
            if processed_chunks:
                logger.info("Updating document content with processed chunks...")
                stitched_content = "\n".join(chunk_contents)
                doc.system_metadata["content"] = stitched_content
                logger.info(f"Updated document content with stitched chunks (length: {len(stitched_content)})")
        else:
            processed_chunks = parsed_chunks  # No rules, use original chunks
            processed_chunks_multivector = chunks_multivector  # No rules, use original multivector chunks

        # 10. Generate embeddings for processed chunks
        embedding_start = time.time()
        embeddings = await document_service.embedding_model.embed_for_ingestion(processed_chunks)
        logger.debug(f"Generated {len(embeddings)} embeddings")
            
        embedding_time = time.time() - embedding_start
        phase_times["generate_embeddings"] = embedding_time
        embeddings_per_second = len(embeddings) / embedding_time if embedding_time > 0 else 0
        logger.info(
            f"Embedding generation took {embedding_time:.2f}s for {len(embeddings)} embeddings "
            f"({embeddings_per_second:.2f} embeddings/s)"
        )

        # 11. Create chunk objects with potentially modified chunk content and metadata
        chunk_objects_start = time.time()
        chunk_objects = document_service._create_chunk_objects(doc.external_id, processed_chunks, embeddings)
        logger.debug(f"Created {len(chunk_objects)} chunk objects")
        chunk_objects_time = time.time() - chunk_objects_start
        phase_times["create_chunk_objects"] = chunk_objects_time
        logger.debug(f"Creating chunk objects took {chunk_objects_time:.2f}s")

        # 12. Handle ColPali embeddings
        colpali_embed_start = time.time()
        chunk_objects_multivector = []
        if using_colpali:
            colpali_embeddings = await document_service.colpali_embedding_model.embed_for_ingestion(
                processed_chunks_multivector
            )
            logger.debug(f"Generated {len(colpali_embeddings)} embeddings for multivector embedding")

            chunk_objects_multivector = document_service._create_chunk_objects(
                doc.external_id, processed_chunks_multivector, colpali_embeddings
            )
        colpali_embed_time = time.time() - colpali_embed_start
        phase_times["colpali_generate_embeddings"] = colpali_embed_time
        if using_colpali:
            embeddings_per_second = len(colpali_embeddings) / colpali_embed_time if colpali_embed_time > 0 else 0
            logger.info(
                f"Colpali embedding took {colpali_embed_time:.2f}s for {len(colpali_embeddings)} embeddings "
                f"({embeddings_per_second:.2f} embeddings/s)"
            )

        # === Merge aggregated chunk metadata into document metadata ===
        if aggregated_chunk_metadata:
            logger.info("Merging aggregated chunk metadata into document metadata...")
            # Make sure doc.metadata exists
            if not hasattr(doc, "metadata") or doc.metadata is None:
                doc.metadata = {}
            doc.metadata.update(aggregated_chunk_metadata)
            logger.info(f"Final document metadata after merge: {doc.metadata}")
        # ===========================================================

        # Update document status to completed before storing
        doc.system_metadata["status"] = "completed"
        doc.system_metadata["updated_at"] = datetime.now(timezone.utc)

        # 11. Store chunks and update document with is_update=True
        store_start = time.time()
        await document_service._store_chunks_and_doc(
            chunk_objects, doc, use_colpali, chunk_objects_multivector, is_update=True, auth=auth
        )
        store_time = time.time() - store_start
        phase_times["store_chunks_and_update_doc"] = store_time
        logger.info(f"Storing chunks and final document update took {store_time:.2f}s for {len(chunk_objects)} chunks")

        logger.debug(f"Successfully completed processing for document {doc.external_id}")

        # 13. Log successful completion
        logger.info(f"Successfully completed ingestion for {original_filename}, document ID: {doc.external_id}")
        # Performance summary
        total_time = time.time() - job_start_time

        # Log performance summary
        logger.info("=== Ingestion Performance Summary ===")
        logger.info(f"Total processing time: {total_time:.2f}s")
        for phase, duration in sorted(phase_times.items(), key=lambda x: x[1], reverse=True):
            percentage = (duration / total_time) * 100 if total_time > 0 else 0
            logger.info(f"  - {phase}: {duration:.2f}s ({percentage:.1f}%)")
        logger.info("=====================================")

        # Record ingest usage *after* successful completion using the final page count
        if settings.MODE == "cloud" and auth.user_id:
            try:
                await check_and_increment_limits(
                    auth,
                    "ingest",
                    final_page_count,
                    document_id,
                    use_colpali=using_colpali,
                    colpali_chunks_count=colpali_count_for_limit_fn,
                )
            except Exception as rec_exc:
                # Log error but don't fail the job at this point
                logger.error("Failed to record ingest usage after completion: %s", rec_exc)

        # 14. Return document ID
        return {
            "document_id": doc.external_id,
            "status": "completed",
            "filename": original_filename,
            "content_type": content_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error processing ingestion job for file {original_filename}: {str(e)}")

        # ------------------------------------------------------------------
        # Ensure we update the *per-app* database where the document lives.
        # Falling back to the control-plane DB (ctx["database"]) can silently
        # fail because the row doesn't exist there.
        # ------------------------------------------------------------------

        try:
            database: Optional[PostgresDatabase] = None

            # Prefer the tenant-specific database
            if auth.app_id is not None:
                try:
                    database = await get_database_for_app(auth.app_id)
                    await database.initialize()
                except Exception as db_err:
                    logger.warning(
                        "Failed to obtain per-app database in error handler: %s. Falling back to default.",
                        db_err,
                    )

            # Fallback to the default database kept in the worker context
            if database is None:
                database = ctx.get("database")

            # Proceed only if we have a database object
            if database:
                # Try to get the document
                doc = await database.get_document(document_id, auth)

                if doc:
                    # Update the document status to failed
                    await database.update_document(
                        document_id=document_id,
                        updates={
                            "system_metadata": {
                                **doc.system_metadata,
                                "status": "failed",
                                "error": str(e),
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                        auth=auth,
                    )
                    logger.info(f"Updated document {document_id} status to failed")
        except Exception as inner_e:
            logger.error(f"Failed to update document status: {inner_e}")

        # Note: We don't record usage if the job failed.

        # Return error information
        return {
            "status": "failed",
            "filename": original_filename,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


async def startup(ctx: Dict[str, Any]):
    """Initialize resources when the worker starts."""
    logger.info("Worker starting up...")
    # Initialize services and store them in the context for reuse in tasks
    # This avoids re-initializing for every job

    # Initialize TelemetryService
    ctx["telemetry"] = TelemetryService()

    # Initialize storage based on settings
    if settings.STORAGE_PROVIDER == "s3":
        storage_instance = S3Storage(
            bucket_name=settings.S3_BUCKET,
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=getattr(settings, 'S3_ENDPOINT_URL', None),
        )
    else:
        storage_instance = LocalStorage(storage_path=settings.STORAGE_PATH)
    ctx["storage"] = storage_instance
    logger.info(f"Storage initialized: {settings.STORAGE_PROVIDER}")

    # Initialize embedding model
    ctx["embedding_model"] = LiteLLMEmbeddingModel(model_key=settings.EMBEDDING_MODEL)
    logger.info("Embedding model initialized")

    # Initialize ColPali embedding model if configured
    colpali_embedding_model = None
    if hasattr(settings, 'COLPALI_API_URL') and settings.COLPALI_API_URL:
        colpali_embedding_model = ColpaliApiEmbeddingModel(
            api_url=settings.COLPALI_API_URL, 
            model_name=getattr(settings, 'COLPALI_EMBEDDING_MODEL', 'vidore/colpali')
        )
    elif hasattr(settings, 'ENABLE_COLPALI') and settings.ENABLE_COLPALI:
        # Use local ColPali model
        colpali_embedding_model = ColpaliEmbeddingModel()
    ctx["colpali_embedding_model"] = colpali_embedding_model
    logger.info(f"ColPali embedding model initialized: {colpali_embedding_model is not None}")

    # Initialize parser
    ctx["parser"] = MorphikParser()
    logger.info("Parser initialized")

    # Initialize rules processor  
    ctx["rules_processor"] = RulesProcessor()
    logger.info("Rules processor initialized")

    # Initialize main database
    db = PostgresDatabase(uri=settings.POSTGRES_URI)
    await db.initialize()
    ctx["database"] = db
    logger.info("Main database connected.")

    # Initialize main vector store
    vector_store = PGVectorStore(uri=settings.POSTGRES_URI)
    await vector_store.initialize()
    ctx["vector_store"] = vector_store
    logger.info("Main vector store connected.")

    # Initialize ColPali vector store if configured
    colpali_vector_store = None
    if ctx["colpali_embedding_model"]:
        try:
            # Use MultiVectorStore for ColPali
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            
            # Get database URI for MultiVectorStore
            uri_raw = db.engine.url.render_as_string(hide_password=False)
            parsed = urlparse(uri_raw)
            query = parse_qs(parsed.query)
            if "sslmode" not in query and settings.MODE == "cloud":
                query["sslmode"] = ["require"]
                parsed = parsed._replace(query=urlencode(query, doseq=True))
            uri_final = urlunparse(parsed)
            
            colpali_vector_store = MultiVectorStore(uri=uri_final)
            await asyncio.to_thread(colpali_vector_store.initialize)
            logger.info("ColPali vector store connected.")
        except Exception as e:
            logger.warning(f"Failed to initialize ColPali vector store: {e}")
    ctx["colpali_vector_store"] = colpali_vector_store

    logger.info("Worker startup complete.")


async def shutdown(ctx: Dict[str, Any]):
    """Clean up resources when the worker shuts down."""
    logger.info("Worker shutting down...")
    
    db = ctx.get("database")
    if db and hasattr(db, 'disconnect'):
        try:
            await db.disconnect()
            logger.info("Main database disconnected.")
        except Exception as e:
            logger.warning(f"Error disconnecting database: {e}")

    vector_store = ctx.get("vector_store")
    if vector_store and hasattr(vector_store, 'disconnect'):
        try:
            await vector_store.disconnect()
            logger.info("Main vector store disconnected.")
        except Exception as e:
            logger.warning(f"Error disconnecting vector store: {e}")

    colpali_vector_store = ctx.get("colpali_vector_store")
    if colpali_vector_store and hasattr(colpali_vector_store, 'disconnect'):
        try:
            await colpali_vector_store.disconnect()
            logger.info("ColPali vector store disconnected.")
        except Exception as e:
            logger.warning(f"Error disconnecting ColPali vector store: {e}")
            
    logger.info("Worker shutdown complete.")


async def get_services_for_app(app_id: Optional[str], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dynamically gets or creates database and vector store connections based on app_id.
    If app_id is None or ee routing is disabled, uses main connections from ctx.
    """
    if not app_id or not settings.MORPHEUS_MODE_ENABLED: # MORPHEUS_MODE_ENABLED implies EE
        # Fallback to pre-initialized main services if not in EE mode or no app_id
        # This part needs to ensure that the main services are initialized if not already
        # For simplicity, we'll assume they are initialized during startup and available in ctx
        # However, a robust solution might involve initializing them here if not found.

        if "db" not in ctx or "vector_store" not in ctx:
            # Initialize main database if not already in context
            main_db = PostgresDatabase(
                db_url=settings.DATABASE_URL,
                vector_db_url=settings.VECTOR_DB_URL,
                redis_url=settings.REDIS_URL,
            )
            await main_db.connect()
            ctx["db"] = main_db # Store for potential reuse within the same job context

            # Initialize main vector store if not already in context
            main_vector_store = PGVectorStore(
                db_url=settings.VECTOR_DB_URL,
                table_name=settings.PGVECTOR_TABLE_NAME,
                embedding_model=LiteLLMEmbeddingModel(model_key=settings.EMBEDDING_MODEL),
            )
            await main_vector_store.connect()
            ctx["vector_store"] = main_vector_store # Store for potential reuse

            # Initialize ColPali vector store if configured
            colpali_vector_store = None
            if settings.COLPALI_API_URL and settings.COLPALI_EMBEDDING_MODEL:
                colpali_embedding_model = ColpaliApiEmbeddingModel(
                    api_url=settings.COLPALI_API_URL, model_name=settings.COLPALI_EMBEDDING_MODEL
                )
                colpali_vector_store = PGVectorStore(
                    db_url=settings.VECTOR_DB_URL,
                    table_name=settings.COLPALI_PGVECTOR_TABLE_NAME,
                    embedding_model=colpali_embedding_model,
                )
                await colpali_vector_store.connect()
            ctx["colpali_vector_store"] = colpali_vector_store


        db_instance = ctx["db"]
        vector_store_instance = ctx["vector_store"]
        colpali_vs_instance = ctx.get("colpali_vector_store")

    # else:
    #     # EE mode: Get app-specific connections
    #     db_instance = await get_database_for_app(app_id)
    #     # For vector store, decide if it needs to be app-specific or can use a shared one
    #     # This example assumes it might also be app-specific via a similar getter
    #     vector_store_instance = await get_vector_store_for_app(app_id, LiteLLMEmbeddingModel(model_key=settings.EMBEDDING_MODEL))
    #     # Handle ColPali vector store similarly if it needs to be app-specific
    #     colpali_vs_instance = None # Placeholder, adjust if ColPali is app-specific in EE
    #     if settings.COLPALI_API_URL and settings.COLPALI_EMBEDDING_MODEL:
    #         colpali_embedding_model = ColpaliApiEmbeddingModel(
    #             api_url=settings.COLPALI_API_URL, model_name=settings.COLPALI_EMBEDDING_MODEL
    #         )
    #         # This might also need an app-specific version or a shared one
    #         colpali_vs_instance = await get_vector_store_for_app(
    #             app_id,
    #             colpali_embedding_model,
    #             table_name_suffix="_colpali" # Example: differentiate table
    #         )


    # Re-create DocumentService with the potentially app-specific db and vector_store
    # Storage and telemetry can often be shared
    document_service_instance = DocumentService(
        db=db_instance,
        storage=ctx["storage"], # Shared storage
        vector_store=vector_store_instance,
        colpali_vector_store=colpali_vs_instance,
        telemetry=ctx["telemetry"], # Shared telemetry
    )

    parser_instance = MorphikParser(
        document_service=document_service_instance, storage=ctx["storage"], telemetry=ctx["telemetry"]
    )
    rules_processor_instance = RulesProcessor(document_service=document_service_instance, telemetry=ctx["telemetry"])

    return {
        "db": db_instance,
        "vector_store": vector_store_instance,
        "colpali_vector_store": colpali_vs_instance,
        "document_service": document_service_instance,
        "parser": parser_instance,
        "rules_processor": rules_processor_instance,
        "storage": ctx["storage"], # Pass along shared services
        "telemetry": ctx["telemetry"],
    }


async def ingest_file_content(ctx: Dict[str, Any], document_id: str, auth_context_dict: Dict[str, Any]):
    """
    Ingests the file content for a document.

    This function handles the ingestion of file content for a given document ID.
    It retrieves the document, processes the file content through parsing and
    embedding, and updates the document with the new content and metadata.

    Args:
        ctx: The ARQ context dictionary
        document_id: The ID of the document to ingest
        auth_context_dict: The authentication context as a dictionary

    Returns:
        A dictionary with the document ID and processing status
    """
    # Extract auth context from the provided dictionary
    auth_context = AuthContext(
        entity_type=EntityType(auth_context_dict.get("entity_type", "unknown")),
        entity_id=auth_context_dict.get("entity_id", ""),
        app_id=auth_context_dict.get("app_id"),
        permissions=set(auth_context_dict.get("permissions", ["read"])),
        user_id=auth_context_dict.get("user_id", auth_context_dict.get("entity_id", "")),
    )

    # Forcing the use of ColPali in this specific ingestion flow
    use_colpali = True

    # Directly call the processing function with the extracted parameters
    result = await process_ingestion_job(
        ctx=ctx,
        document_id=document_id,
        file_key="",  # File key is not used in this direct ingestion flow
        bucket="",    # Bucket is not used in this direct ingestion flow
        original_filename="",  # Original filename is not used in this direct ingestion flow
        content_type="",  # Content type is not used in this direct ingestion flow
        metadata_json="{}",  # Empty metadata JSON
        auth_dict=auth_context_dict,
        rules_list=[],  # No rules applied in this direct ingestion flow
        use_colpali=use_colpali,
    )

    logger.info(f"Ingestion complete for document {document_id}")
    return result


# Define WorkerSettings class for ARQ
class WorkerSettings:
    functions = [process_ingestion_job, ingest_file_content]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        database=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
    )
    # Add other worker settings as needed, e.g., max_jobs, job_timeout, etc.
    # Example: job_timeout = 300  # 5 minutes
