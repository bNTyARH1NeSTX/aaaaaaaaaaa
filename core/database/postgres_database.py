import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Column, Index, String, Integer, Text, and_, or_, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import get_settings

from ..models.auth import AuthContext, EntityType
from ..models.documents import Document, StorageFileInfo
from ..models.folders import Folder
from ..models.graph import Graph
from .base_database import BaseDatabase

logger = logging.getLogger(__name__)
Base = declarative_base()


class DocumentModel(Base):
    """SQLAlchemy model for document metadata."""

    __tablename__ = "documents"

    external_id = Column(String, primary_key=True)
    owner = Column(JSONB)
    content_type = Column(String)
    filename = Column(String, nullable=True)
    doc_metadata = Column(JSONB, default=dict)
    storage_info = Column(JSONB, default=dict)
    system_metadata = Column(JSONB, default=dict)
    additional_metadata = Column(JSONB, default=dict)
    access_control = Column(JSONB, default=dict)
    chunk_ids = Column(JSONB, default=list)
    storage_files = Column(JSONB, default=list)

    # Create indexes
    __table_args__ = (
        Index("idx_owner_id", "owner", postgresql_using="gin"),
        Index("idx_access_control", "access_control", postgresql_using="gin"),
        Index("idx_system_metadata", "system_metadata", postgresql_using="gin"),
        Index("idx_doc_metadata_gin", "doc_metadata", postgresql_using="gin"),
        Index("idx_doc_owner_text_id", text("(owner->>'id')")),
        Index("idx_doc_system_metadata_app_id", text("(system_metadata->>'app_id')")),
        Index("idx_doc_access_control_user_id", text("(access_control->>'user_id')")),
        Index("idx_doc_system_metadata_folder_name", text("(system_metadata->>'folder_name')")),
        Index("idx_doc_system_metadata_end_user_id", text("(system_metadata->>'end_user_id')")),
    )


class GraphModel(Base):
    """SQLAlchemy model for graph data."""

    __tablename__ = "graphs"

    id = Column(String, primary_key=True)
    name = Column(String, index=True)  # Not unique globally anymore
    entities = Column(JSONB, default=list)
    relationships = Column(JSONB, default=list)
    graph_metadata = Column(JSONB, default=dict)  # Renamed from 'metadata' to avoid conflict
    system_metadata = Column(JSONB, default=dict)  # For folder_name and end_user_id
    document_ids = Column(JSONB, default=list)
    filters = Column(JSONB, nullable=True)
    created_at = Column(String)  # ISO format string
    updated_at = Column(String)  # ISO format string
    owner = Column(JSONB)
    access_control = Column(JSONB, default=dict)

    # Create indexes
    __table_args__ = (
        Index("idx_graph_name", "name"),
        Index("idx_graph_owner", "owner", postgresql_using="gin"),
        Index("idx_graph_access_control", "access_control", postgresql_using="gin"),
        Index("idx_graph_system_metadata", "system_metadata", postgresql_using="gin"),
        # Create a unique constraint on name scoped by owner ID
        Index("idx_graph_owner_name", "name", text("(owner->>'id')"), unique=True),
    )


class FolderModel(Base):
    """SQLAlchemy model for folder data."""

    __tablename__ = "folders"

    id = Column(String, primary_key=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    owner = Column(JSONB)
    document_ids = Column(JSONB, default=list)
    system_metadata = Column(JSONB, default=dict)
    access_control = Column(JSONB, default=dict)
    rules = Column(JSONB, default=list)

    # Create indexes
    __table_args__ = (
        Index("idx_folder_name", "name"),
        Index("idx_folder_owner", "owner", postgresql_using="gin"),
        Index("idx_folder_access_control", "access_control", postgresql_using="gin"),
        # Index to filter folders by app_id in system_metadata
        Index("idx_folder_system_metadata_app_id", text("(system_metadata->>'app_id')")),
    )


class RuleTemplateModel(Base):
    """SQLAlchemy model for rule template data."""

    __tablename__ = "rule_templates"

    id = Column(String, primary_key=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    rules_json = Column(JSONB)
    owner = Column(JSONB)
    access_control = Column(JSONB, default=dict)
    system_metadata = Column(JSONB, default=dict)
    created_at = Column(String)  # ISO format string
    updated_at = Column(String)  # ISO format string

    # Create indexes
    __table_args__ = (
        Index("idx_rule_template_name", "name"),
        Index("idx_rule_template_owner", "owner", postgresql_using="gin"),
        Index("idx_rule_template_access_control", "access_control", postgresql_using="gin"),
        Index("idx_rule_template_system_metadata_app_id", text("(system_metadata->>'app_id')")),
    )


class ChatFeedbackModel(Base):
    """SQLAlchemy model for chat feedback (thumbs up/down)."""

    __tablename__ = "chat_feedback"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False, index=True)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    rating = Column(String, nullable=False)  # 'up' or 'down'
    comment = Column(Text, nullable=True)
    user_id = Column(String, nullable=True, index=True)
    model_used = Column(String, nullable=True)
    relevant_images = Column(Integer, nullable=True)
    timestamp = Column(String, nullable=False)  # ISO format string

    # Create indexes
    __table_args__ = (
        Index("idx_chat_feedback_conversation_id", "conversation_id"),
        Index("idx_chat_feedback_user_id", "user_id"),
        Index("idx_chat_feedback_rating", "rating"),
        Index("idx_chat_feedback_timestamp", "timestamp"),
        Index("idx_chat_feedback_model_used", "model_used"),
    )


def _serialize_datetime(obj: Any) -> Any:
    """Helper function to serialize datetime objects to ISO format strings."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: _serialize_datetime(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [_serialize_datetime(item) for item in obj]
    return obj


class PostgresDatabase(BaseDatabase):
    """PostgreSQL implementation for document metadata storage."""

    async def delete_folder(self, folder_id: str, auth: AuthContext) -> bool:
        """Delete a folder row if user has admin access."""
        try:
            # Fetch the folder to check permissions
            folder = await self.get_folder(folder_id, auth)
            if not folder:
                logger.error(f"Folder {folder_id} not found or user does not have access")
                return False
            if not self._check_folder_access(folder, auth, "admin"):
                logger.error(f"User does not have admin access to folder {folder_id}")
                return False
            async with self.async_session() as session:
                folder_model = await session.get(FolderModel, folder_id)
                if not folder_model:
                    logger.error(f"Folder {folder_id} not found in database")
                    return False
                await session.delete(folder_model)
                await session.commit()
                logger.info(f"Deleted folder {folder_id}")
                return True
        except Exception as e:
            logger.error(f"Error deleting folder: {e}")
            return False

    def __init__(
        self,
        uri: str,
    ):
        """Initialize PostgreSQL connection for document storage."""
        # Load settings from config
        settings = get_settings()

        # Get database pool settings from config with defaults
        pool_size = getattr(settings, "DB_POOL_SIZE", 20)
        max_overflow = getattr(settings, "DB_MAX_OVERFLOW", 30)
        pool_recycle = getattr(settings, "DB_POOL_RECYCLE", 3600)
        pool_timeout = getattr(settings, "DB_POOL_TIMEOUT", 10)
        pool_pre_ping = getattr(settings, "DB_POOL_PRE_PING", True)

        logger.info(
            f"Initializing PostgreSQL connection pool with size={pool_size}, "
            f"max_overflow={max_overflow}, pool_recycle={pool_recycle}s"
        )

        # Create async engine with explicit pool settings
        self.engine = create_async_engine(
            uri,
            # Prevent connection timeouts by keeping connections alive
            pool_pre_ping=pool_pre_ping,
            # Increase pool size to handle concurrent operations
            pool_size=pool_size,
            # Maximum overflow connections allowed beyond pool_size
            max_overflow=max_overflow,
            # Keep connections in the pool for up to 60 minutes
            pool_recycle=pool_recycle,
            # Time to wait for a connection from the pool (10 seconds)
            pool_timeout=pool_timeout,
            # Echo SQL for debugging (set to False in production)
            echo=False,
        )
        self.async_session = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        self._initialized = False

    async def initialize(self):
        """Initialize database tables and indexes."""
        if self._initialized:
            return True

        try:
            logger.info("Initializing PostgreSQL database tables and indexes...")
            # Create ORM models
            async with self.engine.begin() as conn:
                # Explicitly create all tables with checkfirst=True to avoid errors if tables already exist
                await conn.run_sync(lambda conn: Base.metadata.create_all(conn, checkfirst=True))

                # No need to manually create graphs table again since SQLAlchemy does it
                logger.info("Created database tables successfully")

                # Create caches table if it doesn't exist (kept as direct SQL for backward compatibility)
                await conn.execute(
                    text(
                        """
                    CREATE TABLE IF NOT EXISTS caches (
                        name TEXT PRIMARY KEY,
                        metadata JSONB NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """
                    )
                )

                # Check if storage_files column exists
                result = await conn.execute(
                    text(
                        """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'documents' AND column_name = 'storage_files'
                    """
                    )
                )
                if not result.first():
                    # Add storage_files column to documents table
                    await conn.execute(
                        text(
                            """
                        ALTER TABLE documents
                        ADD COLUMN IF NOT EXISTS storage_files JSONB DEFAULT '[]'::jsonb
                        """
                        )
                    )
                    logger.info("Added storage_files column to documents table")

                # Create folders table if it doesn't exist
                await conn.execute(
                    text(
                        """
                    CREATE TABLE IF NOT EXISTS folders (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        description TEXT,
                        owner JSONB,
                        document_ids JSONB DEFAULT '[]',
                        system_metadata JSONB DEFAULT '{}',
                        access_control JSONB DEFAULT '{}'
                    );
                    """
                    )
                )

                # Add rules column to folders table if it doesn't exist
                result = await conn.execute(
                    text(
                        """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'folders' AND column_name = 'rules'
                    """
                    )
                )
                if not result.first():
                    # Add rules column to folders table
                    await conn.execute(
                        text(
                            """
                        ALTER TABLE folders
                        ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb
                        """
                        )
                    )
                    logger.info("Added rules column to folders table")

                # Create indexes for folders table
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_folder_name ON folders (name);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_folder_owner ON folders USING gin (owner);"))
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS idx_folder_access_control ON folders USING gin (access_control);")
                )

                # Check if system_metadata column exists in graphs table
                result = await conn.execute(
                    text(
                        """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'graphs' AND column_name = 'system_metadata'
                    """
                    )
                )
                if not result.first():
                    # Add system_metadata column to graphs table
                    await conn.execute(
                        text(
                            """
                        ALTER TABLE graphs
                        ADD COLUMN IF NOT EXISTS system_metadata JSONB DEFAULT '{}'::jsonb
                        """
                        )
                    )
                    logger.info("Added system_metadata column to graphs table")

                # Create indexes for folder_name and end_user_id in system_metadata for graphs
                await conn.execute(
                    text(
                        """
                    CREATE INDEX IF NOT EXISTS idx_graph_system_metadata_folder_name
                    ON graphs ((system_metadata->>'folder_name'));
                    """
                    )
                )

                await conn.execute(
                    text(
                        """
                    CREATE INDEX IF NOT EXISTS idx_graph_system_metadata_end_user_id
                    ON graphs ((system_metadata->>'end_user_id'));
                    """
                    )
                )

                # Create index for app_id in system_metadata for graphs to optimize developer-scoped queries
                await conn.execute(
                    text(
                        """
                    CREATE INDEX IF NOT EXISTS idx_graph_system_metadata_app_id
                    ON graphs ((system_metadata->>'app_id'));
                    """
                    )
                )

                logger.info("Created indexes for folder_name, end_user_id, and app_id in system_metadata")

                # Create rule_templates table if it doesn't exist
                await conn.execute(
                    text(
                        """
                    CREATE TABLE IF NOT EXISTS rule_templates (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        description TEXT,
                        rules_json JSONB NOT NULL,
                        owner JSONB,
                        access_control JSONB DEFAULT '{}',
                        system_metadata JSONB DEFAULT '{}',
                        created_at TEXT,
                        updated_at TEXT
                    );
                    """
                    )
                )

                # Create indexes for rule_templates table
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rule_template_name ON rule_templates (name);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rule_template_owner ON rule_templates USING gin (owner);"))
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS idx_rule_template_access_control ON rule_templates USING gin (access_control);")
                )
                await conn.execute(
                    text(
                        """
                    CREATE INDEX IF NOT EXISTS idx_rule_template_system_metadata_app_id
                    ON rule_templates ((system_metadata->>'app_id'));
                    """
                    )
                )

                logger.info("Created rule_templates table and indexes")

                # Create chat_feedback table if it doesn't exist
                await conn.execute(
                    text(
                        """
                    CREATE TABLE IF NOT EXISTS chat_feedback (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        query TEXT NOT NULL,
                        response TEXT NOT NULL,
                        rating TEXT NOT NULL,
                        comment TEXT,
                        user_id TEXT,
                        model_used TEXT,
                        relevant_images INTEGER,
                        timestamp TEXT NOT NULL
                    );
                    """
                    )
                )

                # Create indexes for chat_feedback table
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_feedback_conversation_id ON chat_feedback (conversation_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_feedback_user_id ON chat_feedback (user_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating ON chat_feedback (rating);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_feedback_timestamp ON chat_feedback (timestamp);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_chat_feedback_model_used ON chat_feedback (model_used);"))

                logger.info("Created chat_feedback table and indexes")

            logger.info("PostgreSQL tables and indexes created successfully")
            self._initialized = True
            return True

        except Exception as e:
            logger.error(f"Error creating PostgreSQL tables and indexes: {str(e)}")
            return False

    async def store_document(self, document: Document) -> bool:
        """Store document metadata."""
        try:
            doc_dict = document.model_dump()

            # Rename metadata to doc_metadata
            if "metadata" in doc_dict:
                doc_dict["doc_metadata"] = doc_dict.pop("metadata")
            doc_dict["doc_metadata"]["external_id"] = doc_dict["external_id"]

            # Ensure system metadata
            if "system_metadata" not in doc_dict:
                doc_dict["system_metadata"] = {}
            doc_dict["system_metadata"]["created_at"] = datetime.now(UTC)
            doc_dict["system_metadata"]["updated_at"] = datetime.now(UTC)

            # Handle storage_files
            if "storage_files" in doc_dict and doc_dict["storage_files"]:
                # Convert storage_files to the expected format for storage
                doc_dict["storage_files"] = [file.model_dump() for file in doc_dict["storage_files"]]

            # Serialize datetime objects to ISO format strings
            doc_dict = _serialize_datetime(doc_dict)

            async with self.async_session() as session:
                doc_model = DocumentModel(**doc_dict)
                session.add(doc_model)
                await session.commit()
            return True

        except Exception as e:
            logger.error(f"Error storing document metadata: {str(e)}")
            return False

    async def get_document(self, document_id: str, auth: AuthContext) -> Optional[Document]:
        """Retrieve document metadata by ID if user has access."""
        try:
            async with self.async_session() as session:
                # Build access filter
                access_filter = self._build_access_filter(auth)

                # Query document
                query = (
                    select(DocumentModel)
                    .where(DocumentModel.external_id == document_id)
                    .where(text(f"({access_filter})"))
                )

                result = await session.execute(query)
                doc_model = result.scalar_one_or_none()

                if doc_model:
                    # Convert doc_metadata back to metadata
                    # Also convert storage_files from dict to StorageFileInfo
                    storage_files = []
                    if doc_model.storage_files:
                        for file_info in doc_model.storage_files:
                            if isinstance(file_info, dict):
                                storage_files.append(StorageFileInfo(**file_info))
                            else:
                                storage_files.append(file_info)

                    doc_dict = {
                        "external_id": doc_model.external_id,
                        "owner": doc_model.owner,
                        "content_type": doc_model.content_type,
                        "filename": doc_model.filename,
                        "metadata": doc_model.doc_metadata,
                        "storage_info": doc_model.storage_info,
                        "system_metadata": doc_model.system_metadata,
                        "additional_metadata": doc_model.additional_metadata,
                        "access_control": doc_model.access_control,
                        "chunk_ids": doc_model.chunk_ids,
                        "storage_files": storage_files,
                    }
                    return Document(**doc_dict)
                return None

        except Exception as e:
            logger.error(f"Error retrieving document metadata: {str(e)}")
            return None

    async def get_document_by_filename(
        self, filename: str, auth: AuthContext, system_filters: Optional[Dict[str, Any]] = None
    ) -> Optional[Document]:
        """Retrieve document metadata by filename if user has access.
        If multiple documents have the same filename, returns the most recently updated one.

        Args:
            filename: The filename to search for
            auth: Authentication context
            system_filters: Optional system metadata filters (e.g. folder_name, end_user_id)
        """
        try:
            async with self.async_session() as session:
                # Build access filter
                access_filter = self._build_access_filter(auth)
                system_metadata_filter = self._build_system_metadata_filter(system_filters)
                filename = filename.replace("'", "''")
                # Construct where clauses
                where_clauses = [
                    f"({access_filter})",
                    f"filename = '{filename}'",  # Escape single quotes
                ]

                if system_metadata_filter:
                    where_clauses.append(f"({system_metadata_filter})")

                final_where_clause = " AND ".join(where_clauses)

                # Query document with system filters
                query = (
                    select(DocumentModel).where(text(final_where_clause))
                    # Order by updated_at in system_metadata to get the most recent document
                    .order_by(text("system_metadata->>'updated_at' DESC"))
                )

                logger.debug(f"Querying document by filename with system filters: {system_filters}")

                result = await session.execute(query)
                doc_model = result.scalar_one_or_none()

                if doc_model:
                    # Convert doc_metadata back to metadata
                    # Also convert storage_files from dict to StorageFileInfo
                    storage_files = []
                    if doc_model.storage_files:
                        for file_info in doc_model.storage_files:
                            if isinstance(file_info, dict):
                                storage_files.append(StorageFileInfo(**file_info))
                            else:
                                storage_files.append(file_info)

                    doc_dict = {
                        "external_id": doc_model.external_id,
                        "owner": doc_model.owner,
                        "content_type": doc_model.content_type,
                        "filename": doc_model.filename,
                        "metadata": doc_model.doc_metadata,
                        "storage_info": doc_model.storage_info,
                        "system_metadata": doc_model.system_metadata,
                        "additional_metadata": doc_model.additional_metadata,
                        "access_control": doc_model.access_control,
                        "chunk_ids": doc_model.chunk_ids,
                        "storage_files": storage_files,
                    }
                    return Document(**doc_dict)
                return None

        except Exception as e:
            logger.error(f"Error retrieving document metadata by filename: {str(e)}")
            return None

    async def get_documents_by_id(
        self,
        document_ids: List[str],
        auth: AuthContext,
        system_filters: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """
        Retrieve multiple documents by their IDs in a single batch operation.
        Only returns documents the user has access to.
        Can filter by system metadata fields like folder_name and end_user_id.

        Args:
            document_ids: List of document IDs to retrieve
            auth: Authentication context
            system_filters: Optional filters for system metadata fields

        Returns:
            List of Document objects that were found and user has access to
        """
        try:
            if not document_ids:
                return []

            async with self.async_session() as session:
                # Build access filter
                access_filter = self._build_access_filter(auth)
                system_metadata_filter = self._build_system_metadata_filter(system_filters)

                # Construct where clauses
                document_ids_linked = ", ".join([("'" + doc_id + "'") for doc_id in document_ids])
                where_clauses = [f"({access_filter})", f"external_id IN ({document_ids_linked})"]

                if system_metadata_filter:
                    where_clauses.append(f"({system_metadata_filter})")

                final_where_clause = " AND ".join(where_clauses)

                # Query documents with document IDs, access check, and system filters in a single query
                query = select(DocumentModel).where(text(final_where_clause))

                logger.info(f"Batch retrieving {len(document_ids)} documents with a single query")

                # Execute batch query
                result = await session.execute(query)
                doc_models = result.scalars().all()

                documents = []
                for doc_model in doc_models:
                    # Convert doc_metadata back to metadata
                    doc_dict = {
                        "external_id": doc_model.external_id,
                        "owner": doc_model.owner,
                        "content_type": doc_model.content_type,
                        "filename": doc_model.filename,
                        "metadata": doc_model.doc_metadata,
                        "storage_info": doc_model.storage_info,
                        "system_metadata": doc_model.system_metadata,
                        "additional_metadata": doc_model.additional_metadata,
                        "access_control": doc_model.access_control,
                        "chunk_ids": doc_model.chunk_ids,
                        "storage_files": doc_model.storage_files or [],
                    }
                    documents.append(Document(**doc_dict))

                logger.info(f"Found {len(documents)} documents in batch retrieval")
                return documents

        except Exception as e:
            logger.error(f"Error batch retrieving documents: {str(e)}")
            return []

    async def get_documents(
        self,
        auth: AuthContext,
        skip: int = 0,
        limit: int = 10000,
        filters: Optional[Dict[str, Any]] = None,
        system_filters: Optional[Dict[str, Any]] = None,
    ) -> List[Document]:
        """List documents the user has access to."""
        try:
            async with self.async_session() as session:
                # Build query
                access_filter = self._build_access_filter(auth)
                metadata_filter = self._build_metadata_filter(filters)
                system_metadata_filter = self._build_system_metadata_filter(system_filters)

                where_clauses = [f"({access_filter})"]

                if metadata_filter:
                    where_clauses.append(f"({metadata_filter})")

                if system_metadata_filter:
                    where_clauses.append(f"({system_metadata_filter})")

                final_where_clause = " AND ".join(where_clauses)
                query = select(DocumentModel).where(text(final_where_clause))

                query = query.offset(skip).limit(limit)

                result = await session.execute(query)
                doc_models = result.scalars().all()

                return [
                    Document(
                        external_id=doc.external_id,
                        owner=doc.owner,
                        content_type=doc.content_type,
                        filename=doc.filename,
                        metadata=doc.doc_metadata,
                        storage_info=doc.storage_info,
                        system_metadata=doc.system_metadata,
                        additional_metadata=doc.additional_metadata,
                        access_control=doc.access_control,
                        chunk_ids=doc.chunk_ids,
                        storage_files=doc.storage_files or [],
                    )
                    for doc in doc_models
                ]

        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            return []

    async def update_document(self, document_id: str, updates: Dict[str, Any], auth: AuthContext) -> bool:
        """Update document metadata if user has write access."""
        try:
            if not await self.check_access(document_id, auth, "write"):
                return False

            # Get existing document to preserve system_metadata
            existing_doc = await self.get_document(document_id, auth)
            if not existing_doc:
                return False

            # Update system metadata
            updates.setdefault("system_metadata", {})

            # Merge with existing system_metadata instead of just preserving specific fields
            if existing_doc.system_metadata:
                # Start with existing system_metadata
                merged_system_metadata = dict(existing_doc.system_metadata)
                # Update with new values
                merged_system_metadata.update(updates["system_metadata"])
                # Replace with merged result
                updates["system_metadata"] = merged_system_metadata
                logger.debug("Merged system_metadata during document update, preserving existing fields")

            # Always update the updated_at timestamp
            updates["system_metadata"]["updated_at"] = datetime.now(UTC)

            # Serialize datetime objects to ISO format strings
            updates = _serialize_datetime(updates)

            async with self.async_session() as session:
                result = await session.execute(select(DocumentModel).where(DocumentModel.external_id == document_id))
                doc_model = result.scalar_one_or_none()

                if doc_model:
                    # Log what we're updating
                    logger.info(f"Document update: updating fields {list(updates.keys())}")

                    # Special handling for metadata/doc_metadata conversion
                    if "metadata" in updates and "doc_metadata" not in updates:
                        logger.info("Converting 'metadata' to 'doc_metadata' for database update")
                        updates["doc_metadata"] = updates.pop("metadata")

                    # Set all attributes
                    for key, value in updates.items():
                        if key == "storage_files" and isinstance(value, list):
                            serialized_value = [
                                _serialize_datetime(
                                    item.model_dump()
                                    if hasattr(item, "model_dump")
                                    else (item.dict() if hasattr(item, "dict") else item)
                                )
                                for item in value
                            ]
                            logger.debug("Serializing storage_files before setting attribute")
                            setattr(doc_model, key, serialized_value)
                        else:
                            logger.debug(f"Setting document attribute {key} = {value}")
                            setattr(doc_model, key, value)

                    await session.commit()
                    logger.info(f"Document {document_id} updated successfully")
                    return True
                return False

        except Exception as e:
            logger.error(f"Error updating document metadata: {str(e)}")
            return False

    async def delete_document(self, document_id: str, auth: AuthContext) -> bool:
        """Delete document if user has write access."""
        try:
            if not await self.check_access(document_id, auth, "write"):
                return False

            async with self.async_session() as session:
                result = await session.execute(select(DocumentModel).where(DocumentModel.external_id == document_id))
                doc_model = result.scalar_one_or_none()

                if doc_model:
                    await session.delete(doc_model)
                    await session.commit()
                    return True
                return False

        except Exception as e:
            logger.error(f"Error deleting document: {str(e)}")
            return False

    async def find_authorized_and_filtered_documents(
        self,
        auth: AuthContext,
        filters: Optional[Dict[str, Any]] = None,
        system_filters: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """Find document IDs matching filters and access permissions."""
        try:
            async with self.async_session() as session:
                # Build query
                access_filter = self._build_access_filter(auth)
                metadata_filter = self._build_metadata_filter(filters)
                system_metadata_filter = self._build_system_metadata_filter(system_filters)

                logger.debug(f"Access filter: {access_filter}")
                logger.debug(f"Metadata filter: {metadata_filter}")
                logger.debug(f"System metadata filter: {system_metadata_filter}")
                logger.debug(f"Original filters: {filters}")
                logger.debug(f"System filters: {system_filters}")

                where_clauses = [f"({access_filter})"]

                if metadata_filter:
                    where_clauses.append(f"({metadata_filter})")

                if system_metadata_filter:
                    where_clauses.append(f"({system_metadata_filter})")

                final_where_clause = " AND ".join(where_clauses)
                query = select(DocumentModel.external_id).where(text(final_where_clause))

                logger.debug(f"Final query: {query}")

                result = await session.execute(query)
                doc_ids = [row[0] for row in result.all()]
                logger.debug(f"Found document IDs: {doc_ids}")
                return doc_ids

        except Exception as e:
            logger.error(f"Error finding authorized documents: {str(e)}")
            return []

    async def check_access(self, document_id: str, auth: AuthContext, required_permission: str = "read") -> bool:
        """Check if user has required permission for document."""
        try:
            async with self.async_session() as session:
                result = await session.execute(select(DocumentModel).where(DocumentModel.external_id == document_id))
                doc_model = result.scalar_one_or_none()

                if not doc_model:
                    return False

                # Check owner access
                owner = doc_model.owner
                if owner.get("type") == auth.entity_type and owner.get("id") == auth.entity_id:
                    return True

                # Check permission-specific access
                access_control = doc_model.access_control
                permission_map = {"read": "readers", "write": "writers", "admin": "admins"}
                permission_set = permission_map.get(required_permission)

                if not permission_set:
                    return False

                return auth.entity_id in access_control.get(permission_set, [])

        except Exception as e:
            logger.error(f"Error checking document access: {str(e)}")
            return False

    def _build_access_filter(self, auth: AuthContext) -> str:
        """Build PostgreSQL filter for access control.

        For developer-scoped tokens (i.e. those that include an ``app_id``) we *must* ensure
        that the caller only ever sees documents that belong to that application.  Simply
        checking the developer entity ID is **insufficient**, because multiple apps created
        by the same developer share the same entity ID.  Therefore, when an ``app_id`` is
        present, we additionally scope the filter by the ``app_id`` that is stored either
        in ``system_metadata.app_id`` or in the ``access_control->app_access`` list.
        """

        # Base clauses that will always be AND-ed with any additional application scoping.
        base_clauses = [
            f"owner @> '{{\"id\": \"{auth.entity_id}\"}}'::jsonb",  # Check owner using @>
            f"access_control->'readers' ? '{auth.entity_id}'",
            f"access_control->'writers' ? '{auth.entity_id}'",
            f"access_control->'admins' ? '{auth.entity_id}'",
        ]

        # Developer token with app_id → restrict strictly by that app_id.
        if auth.entity_type == EntityType.DEVELOPER and auth.app_id:
            filters = [f"system_metadata @> '{{\"app_id\": \"{auth.app_id}\"}}'::jsonb"]  # Check app_id using @>
        else:
            filters = base_clauses.copy()

        # In cloud mode further restrict by user_id when available (used for multi-tenant
        # end-user isolation).
        if auth.user_id:
            if get_settings().MODE == "cloud":
                # access_control.user_id is a list in the DocumentModel, so `?` is correct and uses the GIN index.
                filters.append(f"access_control->'user_id' ? '{auth.user_id}'")

        return " OR ".join(filters)

    def _build_metadata_filter(self, filters: Dict[str, Any]) -> str:
        """Build PostgreSQL filter for metadata."""
        if not filters:
            return ""

        filter_conditions = []
        for key, value in filters.items():
            # Handle list of values (IN operator)
            if isinstance(value, list):
                if not value:  # Skip empty lists
                    continue

                # New approach for lists: OR together multiple @> conditions
                # This allows each item in the list to be checked for containment.
                or_clauses_for_list = []
                for item_in_list in value:
                    json_filter_object = {key: item_in_list}
                    json_string_for_sql = json.dumps(json_filter_object)
                    sql_escaped_json_string = json_string_for_sql.replace("'", "''")
                    or_clauses_for_list.append(f"doc_metadata @> '{sql_escaped_json_string}'::jsonb")
                if or_clauses_for_list:
                    filter_conditions.append(f"({' OR '.join(or_clauses_for_list)})")

            else:
                # Handle single value (equality)
                # New approach for single value: Use JSONB containment operator @>
                json_filter_object = {key: value}
                json_string_for_sql = json.dumps(json_filter_object)
                sql_escaped_json_string = json_string_for_sql.replace("'", "''")
                filter_conditions.append(f"doc_metadata @> '{sql_escaped_json_string}'::jsonb")

        return " AND ".join(filter_conditions)

    def _build_system_metadata_filter(self, system_filters: Optional[Dict[str, Any]]) -> str:
        """Build PostgreSQL filter for system metadata.

        This helper supports two storage patterns for JSONB values:
        1. Scalar values – e.g. ``{"folder_name": "folder1"}``
        2. Array values  – e.g. ``{"folder_name": ["folder1", "folder2"]}``

        For robust folder / end-user scoping we need to correctly match either
        pattern.  Therefore for every supplied *value* we generate a predicate
        that checks **either** a scalar equality **or** membership of the value
        in a JSON array using the `?` operator.  Multiple values for the same
        key are OR-ed together, while predicates for different keys are AND-ed.
        """
        if not system_filters:
            return ""

        key_clauses: List[str] = []

        for key, value in system_filters.items():
            if value is None:
                continue

            # Normalise to a list for uniform processing.
            values = value if isinstance(value, list) else [value]
            if not values:
                continue

            value_clauses = []
            for item in values:
                # New approach: Use JSONB containment operator @>
                # This allows matching native JSON types (boolean, number, string)
                # and leverages the GIN index on the system_metadata column.
                json_filter_object = {key: item}
                # json.dumps will correctly format item as a JSON string, number, or boolean
                json_string_for_sql = json.dumps(json_filter_object)
                # Escape single quotes within the generated JSON string for SQL literal
                sql_escaped_json_string = json_string_for_sql.replace("'", "''")
                
                value_clauses.append(f"system_metadata @> '{sql_escaped_json_string}'::jsonb")

            # OR all alternative values for this key, wrap in parentheses.
            key_clauses.append("(" + " OR ".join(value_clauses) + ")")

        # AND across different keys
        return " AND ".join(key_clauses)

    async def store_cache_metadata(self, name: str, metadata: Dict[str, Any]) -> bool:
        """Store metadata for a cache in PostgreSQL.

        Args:
            name: Name of the cache
            metadata: Cache metadata including model info and storage location

        Returns:
            bool: Whether the operation was successful
        """
        try:
            async with self.async_session() as session:
                await session.execute(
                    text(
                        """
                        INSERT INTO caches (name, metadata, updated_at)
                        VALUES (:name, :metadata, CURRENT_TIMESTAMP)
                        ON CONFLICT (name)
                        DO UPDATE SET
                            metadata = :metadata,
                            updated_at = CURRENT_TIMESTAMP
                        """
                    ),
                    {"name": name, "metadata": json.dumps(metadata)},
                )
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to store cache metadata: {e}")
            return False

    async def get_cache_metadata(self, name: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a cache from PostgreSQL.

        Args:
            name: Name of the cache

        Returns:
            Optional[Dict[str, Any]]: Cache metadata if found, None otherwise
        """
        try:
            async with self.async_session() as session:
                result = await session.execute(text("SELECT metadata FROM caches WHERE name = :name"), {"name": name})
                row = result.first()
                return row[0] if row else None
        except Exception as e:
            logger.error(f"Failed to get cache metadata: {e}")
            return None

    async def store_graph(self, graph: Graph) -> bool:
        """Store a graph in PostgreSQL.

        This method stores the graph metadata, entities, and relationships
        in a PostgreSQL table.

        Args:
            graph: Graph to store

        Returns:
            bool: Whether the operation was successful
        """
        # Ensure database is initialized
        if not self._initialized:
            await self.initialize()

        try:
            # First serialize the graph model to dict
            graph_dict = graph.model_dump()

            # Change 'metadata' to 'graph_metadata' to match our model
            if "metadata" in graph_dict:
                graph_dict["graph_metadata"] = graph_dict.pop("metadata")

            # Serialize datetime objects to ISO format strings
            graph_dict = _serialize_datetime(graph_dict)

            # Store the graph metadata in PostgreSQL
            async with self.async_session() as session:
                # Store graph metadata in our table
                graph_model = GraphModel(**graph_dict)
                session.add(graph_model)
                await session.commit()
                logger.info(
                    f"Stored graph '{graph.name}' with {len(graph.entities)} entities "
                    f"and {len(graph.relationships)} relationships"
                )

            return True

        except Exception as e:
            logger.error(f"Error storing graph: {str(e)}")
            return False

    async def get_graph(
        self, name: str, auth: AuthContext, system_filters: Optional[Dict[str, Any]] = None
    ) -> Optional[Graph]:
        """Get a graph by name.

        Args:
            name: Name of the graph
            auth: Authentication context
            system_filters: Optional system metadata filters (e.g. folder_name, end_user_id)

        Returns:
            Optional[Graph]: Graph if found and accessible, None otherwise
        """
        # Ensure database is initialized
        if not self._initialized:
            await self.initialize()

        try:
            async with self.async_session() as session:
                # Build access filter
                access_filter = self._build_access_filter(auth)

                # We need to check if the documents in the graph match the system filters
                # First get the graph without system filters
                query = select(GraphModel).where(GraphModel.name == name).where(text(f"({access_filter})"))

                result = await session.execute(query)
                graph_model = result.scalar_one_or_none()

                if graph_model:
                    # If system filters are provided, we need to filter the document_ids
                    document_ids = graph_model.document_ids

                    if system_filters and document_ids:
                        # Apply system_filters to document_ids
                        system_metadata_filter = self._build_system_metadata_filter(system_filters)

                        if system_metadata_filter:
                            # Get document IDs with system filters
                            doc_id_placeholders = ", ".join([f"'{doc_id}'" for doc_id in document_ids])
                            filter_query = f"""
                                SELECT external_id FROM documents
                                WHERE external_id IN ({doc_id_placeholders})
                                AND ({system_metadata_filter})
                            """

                            filter_result = await session.execute(text(filter_query))
                            filtered_doc_ids = [row[0] for row in filter_result.all()]

                            # If no documents match system filters, return None
                            if not filtered_doc_ids:
                                return None

                            # Update document_ids with filtered results
                            document_ids = filtered_doc_ids

                    # Convert to Graph model
                    graph_dict = {
                        "id": graph_model.id,
                        "name": graph_model.name,
                        "entities": graph_model.entities,
                        "relationships": graph_model.relationships,
                        "metadata": graph_model.graph_metadata,  # Reference the renamed column
                        "system_metadata": graph_model.system_metadata or {},  # Include system_metadata
                        "document_ids": document_ids,  # Use possibly filtered document_ids
                        "filters": graph_model.filters,
                        "created_at": graph_model.created_at,
                        "updated_at": graph_model.updated_at,
                        "owner": graph_model.owner,
                        "access_control": graph_model.access_control,
                    }
                    return Graph(**graph_dict)

                return None

        except Exception as e:
            logger.error(f"Error retrieving graph: {str(e)}")
            return None

    async def list_graphs(self, auth: AuthContext, system_filters: Optional[Dict[str, Any]] = None) -> List[Graph]:
        """List all graphs the user has access to.

        Args:
            auth: Authentication context
            system_filters: Optional system metadata filters (e.g. folder_name, end_user_id)

        Returns:
            List[Graph]: List of graphs
        """
        # Ensure database is initialized
        if not self._initialized:
            await self.initialize()

        try:
            async with self.async_session() as session:
                # Build access filter
                access_filter = self._build_access_filter(auth)

                # Query graphs
                query = select(GraphModel).where(text(f"({access_filter})"))

                result = await session.execute(query)
                graph_models = result.scalars().all()

                graphs = []

                # If system filters are provided, we need to filter each graph's document_ids
                if system_filters:
                    system_metadata_filter = self._build_system_metadata_filter(system_filters)

                    for graph_model in graph_models:
                        document_ids = graph_model.document_ids

                        if document_ids and system_metadata_filter:
                            # Get document IDs with system filters
                            doc_id_placeholders = ", ".join([f"'{doc_id}'" for doc_id in document_ids])
                            filter_query = f"""
                                SELECT external_id FROM documents
                                WHERE external_id IN ({doc_id_placeholders})
                                AND ({system_metadata_filter})
                            """

                            filter_result = await session.execute(text(filter_query))
                            filtered_doc_ids = [row[0] for row in filter_result.all()]

                            # Only include graphs that have documents matching the system filters
                            if filtered_doc_ids:
                                graph = Graph(
                                    id=graph_model.id,
                                    name=graph_model.name,
                                    entities=graph_model.entities,
                                    relationships=graph_model.relationships,
                                    metadata=graph_model.graph_metadata,  # Reference the renamed column
                                    system_metadata=graph_model.system_metadata or {},  # Include system_metadata
                                    document_ids=filtered_doc_ids,  # Use filtered document_ids
                                    filters=graph_model.filters,
                                    created_at=graph_model.created_at,
                                    updated_at=graph_model.updated_at,
                                    owner=graph_model.owner,
                                    access_control=graph_model.access_control,
                                )
                                graphs.append(graph)
                else:
                    # No system filters, include all graphs
                    graphs = [
                        Graph(
                            id=graph.id,
                            name=graph.name,
                            entities=graph.entities,
                            relationships=graph.relationships,
                            metadata=graph.graph_metadata,  # Reference the renamed column
                            system_metadata=graph.system_metadata or {},  # Include system_metadata
                            document_ids=graph.document_ids,
                            filters=graph.filters,
                            created_at=graph.created_at,
                            updated_at=graph.updated_at,
                            owner=graph.owner,
                            access_control=graph.access_control,
                        )
                        for graph in graph_models
                    ]

                return graphs

        except Exception as e:
            logger.error(f"Error listing graphs: {str(e)}")
            return []

    async def update_graph(self, graph: Graph) -> bool:
        """Update an existing graph in PostgreSQL.

        This method updates the graph metadata, entities, and relationships
        in the PostgreSQL table.

        Args:
            graph: Graph to update

        Returns:
            bool: Whether the operation was successful
        """
        # Ensure database is initialized
        if not self._initialized:
            await self.initialize()

        try:
            # First serialize the graph model to dict
            graph_dict = graph.model_dump()

            # Change 'metadata' to 'graph_metadata' to match our model
            if "metadata" in graph_dict:
                graph_dict["graph_metadata"] = graph_dict.pop("metadata")

            # Serialize datetime objects to ISO format strings
            graph_dict = _serialize_datetime(graph_dict)

            # Update the graph in PostgreSQL
            async with self.async_session() as session:
                # Check if the graph exists
                result = await session.execute(select(GraphModel).where(GraphModel.id == graph.id))
                graph_model = result.scalar_one_or_none()

                if not graph_model:
                    logger.error(f"Graph '{graph.name}' with ID {graph.id} not found for update")
                    return False

                # Update the graph model with new values
                for key, value in graph_dict.items():
                    setattr(graph_model, key, value)

                await session.commit()
                logger.info(
                    f"Updated graph '{graph.name}' with {len(graph.entities)} entities "
                    f"and {len(graph.relationships)} relationships"
                )

            return True

        except Exception as e:
            logger.error(f"Error updating graph: {str(e)}")
            return False

    async def create_folder(self, folder: Folder) -> bool:
        """Create a new folder."""
        try:
            async with self.async_session() as session:
                folder_dict = folder.model_dump()

                # Convert datetime objects to strings for JSON serialization
                folder_dict = _serialize_datetime(folder_dict)

                # Check if a folder with this name already exists for this owner, scoped by app_id (if present)
                app_id_val = folder_dict.get("system_metadata", {}).get("app_id")
                params = {"name": folder.name, "entity_id": folder.owner["id"], "entity_type": folder.owner["type"]}
                sql = """
                    SELECT id FROM folders
                    WHERE name = :name
                    AND owner->>'id' = :entity_id
                    AND owner->>'type' = :entity_type
                    """
                if app_id_val is not None:
                    sql += """
                    AND system_metadata->>'app_id' = :app_id
                    """
                    params["app_id"] = app_id_val
                stmt = text(sql).bindparams(**params)

                result = await session.execute(stmt)
                existing_folder = result.scalar_one_or_none()

                if existing_folder:
                    logger.info(
                        f"Folder '{folder.name}' already exists with ID {existing_folder}, not creating a duplicate"
                    )
                    # Update the provided folder's ID to match the existing one
                    # so the caller gets the correct ID
                    folder.id = existing_folder
                    return True

                # Create a new folder model
                access_control = folder_dict.get("access_control", {})

                # Log access control to debug any issues
                if "user_id" in access_control:
                    logger.info(f"Storing folder with user_id: {access_control['user_id']}")
                else:
                    logger.info("No user_id found in folder access_control")

                folder_model = FolderModel(
                    id=folder.id,
                    name=folder.name,
                    description=folder.description,
                    owner=folder_dict["owner"],
                    document_ids=folder_dict.get("document_ids", []),
                    system_metadata=folder_dict.get("system_metadata", {}),
                    access_control=access_control,
                    rules=folder_dict.get("rules", []),
                )

                session.add(folder_model)
                await session.commit()

                logger.info(f"Created new folder '{folder.name}' with ID {folder.id}")
                return True

        except Exception as e:
            logger.error(f"Error creating folder: {e}")
            return False

    async def get_folder(self, folder_id: str, auth: AuthContext) -> Optional[Folder]:
        """Get a folder by ID."""
        try:
            async with self.async_session() as session:
                # Get the folder
                logger.info(f"Getting folder with ID: {folder_id}")
                result = await session.execute(select(FolderModel).where(FolderModel.id == folder_id))
                folder_model = result.scalar_one_or_none()

                if not folder_model:
                    logger.error(f"Folder with ID {folder_id} not found in database")
                    return None

                # Convert to Folder object
                folder_dict = {
                    "id": folder_model.id,
                    "name": folder_model.name,
                    "description": folder_model.description,
                    "owner": folder_model.owner,
                    "document_ids": folder_model.document_ids,
                    "system_metadata": folder_model.system_metadata,
                    "access_control": folder_model.access_control,
                    "rules": folder_model.rules,
                }

                folder = Folder(**folder_dict)

                # Check if the user has access to the folder
                if not self._check_folder_access(folder, auth, "read"):
                    return None

                return folder

        except Exception as e:
            logger.error(f"Error getting folder: {e}")
            return None

    async def get_folder_by_name(self, name: str, auth: AuthContext) -> Optional[Folder]:
        """Get a folder by name."""
        try:
            async with self.async_session() as session:
                # First try to get a folder owned by this entity
                if auth.entity_type and auth.entity_id:
                    stmt = text(
                        """
                        SELECT * FROM folders
                        WHERE name = :name
                        AND (owner->>'id' = :entity_id)
                        AND (owner->>'type' = :entity_type)
                        """
                    ).bindparams(name=name, entity_id=auth.entity_id, entity_type=auth.entity_type.value)

                    result = await session.execute(stmt)
                    folder_row = result.fetchone()

                    if folder_row:
                        # Convert to Folder object
                        folder_dict = {
                            "id": folder_row.id,
                            "name": folder_row.name,
                            "description": folder_row.description,
                            "owner": folder_row.owner,
                            "document_ids": folder_row.document_ids,
                            "system_metadata": folder_row.system_metadata,
                            "access_control": folder_row.access_control,
                            "rules": folder_row.rules,
                        }

                        folder = Folder(**folder_dict)
                        # Enforce app_id scoping
                        if self._check_folder_access(folder, auth, "read"):
                            return folder
                        else:
                            return None

                # If not found, try to find any accessible folder with that name
                stmt = text(
                    """
                    SELECT * FROM folders
                    WHERE name = :name
                    AND (
                        (owner->>'id' = :entity_id AND owner->>'type' = :entity_type)
                        OR (access_control->'readers' ? :entity_id)
                        OR (access_control->'writers' ? :entity_id)
                        OR (access_control->'admins' ? :entity_id)
                        OR (access_control->'user_id' ? :user_id)
                    )
                    """
                ).bindparams(
                    name=name,
                    entity_id=auth.entity_id,
                    entity_type=auth.entity_type.value,
                    user_id=auth.user_id if auth.user_id else "",
                )

                result = await session.execute(stmt)
                folder_row = result.fetchone()

                if folder_row:
                    # Convert to Folder object
                    folder_dict = {
                        "id": folder_row.id,
                        "name": folder_row.name,
                        "description": folder_row.description,
                        "owner": folder_row.owner,
                        "document_ids": folder_row.document_ids,
                        "system_metadata": folder_row.system_metadata,
                        "access_control": folder_row.access_control,
                        "rules": folder_row.rules,
                    }

                    folder = Folder(**folder_dict)
                    # Enforce app_id scoping
                    if self._check_folder_access(folder, auth, "read"):
                        return folder
                    else:
                        return None

                return None

        except Exception as e:
            logger.error(f"Error getting folder by name: {e}")
            return None

    async def list_folders(self, auth: AuthContext) -> List[Folder]:
        """List all folders the user has access to by building a dynamic SQL query."""
        try:
            where_filters = []  # For top-level AND conditions (e.g., app_id)
            core_access_conditions = []  # For OR conditions (owner, reader_acl, admin_acl)
            current_params = {}

            # 1. Developer App ID Scoping (always applied as an AND condition if auth context specifies it)
            if auth.entity_type == EntityType.DEVELOPER and auth.app_id:
                where_filters.append(text("system_metadata->>'app_id' = :app_id_val"))
                current_params["app_id_val"] = auth.app_id

            # 2. Build Core Access Conditions (Owner, Reader ACL, Admin ACL)
            # These are OR'd together. The user must satisfy one of these, AND the app_id scope if applicable.

            # Condition 2a: User is the owner of the folder
            if auth.entity_type and auth.entity_id:
                owner_sub_conditions_text = []

                owner_sub_conditions_text.append("owner->>'type' = :owner_type_val")
                current_params["owner_type_val"] = auth.entity_type.value

                owner_sub_conditions_text.append("owner->>'id' = :owner_id_val")
                current_params["owner_id_val"] = auth.entity_id

                if auth.user_id and get_settings().MODE == "cloud":
                    owner_sub_conditions_text.append("access_control->'user_id' ? :owner_user_id_val")
                    current_params["owner_user_id_val"] = auth.user_id

                # Combine owner sub-conditions with AND
                core_access_conditions.append(text(f"({' AND '.join(owner_sub_conditions_text)})"))

            # Condition 2b & 2c: User is in the folder's 'readers' or 'admins' access control list
            if auth.entity_type and auth.entity_id:
                entity_qualifier_for_acl = f"{auth.entity_type.value}:{auth.entity_id}"
                current_params["acl_qualifier"] = entity_qualifier_for_acl  # Used for both readers and admins

                core_access_conditions.append(text("access_control->'readers' ? :acl_qualifier"))
                core_access_conditions.append(
                    text("access_control->'admins' ? :acl_qualifier")
                )  # Added folder admins ACL check

            # Combine core access conditions with OR, and add this group to the main AND filters
            if core_access_conditions:
                where_filters.append(or_(*core_access_conditions))
            else:
                # If there are no core ways to grant access (e.g., anonymous user without entity_id/type),
                # this effectively means this part of the condition is false.
                where_filters.append(text("1=0"))  # Effectively False if no ownership or ACL grant possible

            # Build and execute query
            async with self.async_session() as session:  # Ensure session is correctly established
                query = select(FolderModel)
                if where_filters:
                    # If any filters were constructed
                    query = query.where(and_(*where_filters))
                else:
                    # To be absolutely safe: if no filters ended up in where_filters, deny all access.
                    query = query.where(text("1=0"))  # Default to no access if no filters constructed

                result = await session.execute(query, current_params)
                folder_models = result.scalars().all()

                folders = []
                for folder_model in folder_models:
                    folder_dict = {
                        "id": folder_model.id,
                        "name": folder_model.name,
                        "description": folder_model.description,
                        "owner": folder_model.owner,
                        "document_ids": folder_model.document_ids,
                        "system_metadata": folder_model.system_metadata,
                        "access_control": folder_model.access_control,
                        "rules": folder_model.rules,
                    }
                    folders.append(Folder(**folder_dict))
                return folders

        except Exception as e:
            logger.error(f"Error listing folders: {e}")
            return []

    async def add_document_to_folder(self, folder_id: str, document_id: str, auth: AuthContext) -> bool:
        """Add a document to a folder."""
        try:
            # First, check if the user has access to the folder
            folder = await self.get_folder(folder_id, auth)
            if not folder:
                logger.error(f"Folder {folder_id} not found or user does not have access")
                return False

            # Check if user has write access to the folder
            if not self._check_folder_access(folder, auth, "write"):
                logger.error(f"User does not have write access to folder {folder_id}")
                return False

            # Check if the document exists and user has access
            document = await self.get_document(document_id, auth)
            if not document:
                logger.error(f"Document {document_id} not found or user does not have access")
                return False

            # Check if the document is already in the folder
            if document_id in folder.document_ids:
                logger.info(f"Document {document_id} is already in folder {folder_id}")
                return True

            # Add the document to the folder
            async with self.async_session() as session:
                # Add document_id to document_ids array
                new_document_ids = folder.document_ids + [document_id]

                folder_model = await session.get(FolderModel, folder_id)
                if not folder_model:
                    logger.error(f"Folder {folder_id} not found in database")
                    return False

                folder_model.document_ids = new_document_ids

                # Also update the document's system_metadata to include the folder_name
                folder_name_json = json.dumps(folder.name)
                stmt = text(
                    f"""
                    UPDATE documents
                    SET system_metadata = jsonb_set(system_metadata, '{{folder_name}}', '{folder_name_json}'::jsonb)
                    WHERE external_id = :document_id
                    """
                ).bindparams(document_id=document_id)

                await session.execute(stmt)
                await session.commit()

                logger.info(f"Added document {document_id} to folder {folder_id}")
                return True

        except Exception as e:
            logger.error(f"Error adding document to folder: {e}")
            return False

    async def remove_document_from_folder(self, folder_id: str, document_id: str, auth: AuthContext) -> bool:
        """Remove a document from a folder."""
        try:
            # First, check if the user has access to the folder
            folder = await self.get_folder(folder_id, auth)
            if not folder:
                logger.error(f"Folder {folder_id} not found or user does not have access")
                return False

            # Check if user has write access to the folder
            if not self._check_folder_access(folder, auth, "write"):
                logger.error(f"User does not have write access to folder {folder_id}")
                return False

            # Check if the document is in the folder
            if document_id not in folder.document_ids:
                logger.warning(f"Tried to delete document {document_id} not in folder {folder_id}")
                return True

            # Remove the document from the folder
            async with self.async_session() as session:
                # Remove document_id from document_ids array
                new_document_ids = [doc_id for doc_id in folder.document_ids if doc_id != document_id]

                folder_model = await session.get(FolderModel, folder_id)
                if not folder_model:
                    logger.error(f"Folder {folder_id} not found in database")
                    return False

                folder_model.document_ids = new_document_ids

                # Also update the document's system_metadata to remove the folder_name
                stmt = text(
                    """
                    UPDATE documents
                    SET system_metadata = jsonb_set(system_metadata, '{folder_name}', 'null'::jsonb)
                    WHERE external_id = :document_id
                    """
                ).bindparams(document_id=document_id)

                await session.execute(stmt)
                await session.commit()

                logger.info(f"Removed document {document_id} from folder {folder_id}")
                return True

        except Exception as e:
            logger.error(f"Error removing document from folder: {e}")
            return False

    # Rule Template CRUD Methods
    async def create_rule_template(
        self, 
        name: str, 
        description: Optional[str], 
        rules_json: str, 
        auth: AuthContext,
        template_id: Optional[str] = None
    ) -> Optional[RuleTemplateModel]:
        """Create a new rule template."""
        try:
            # Generate UUID if not provided
            if template_id is None:
                template_id = str(uuid.uuid4())
                
            async with self.async_session() as session:
                # Check if a template with the same name already exists for this user/app
                existing = await session.execute(
                    select(RuleTemplateModel).where(
                        and_(
                            RuleTemplateModel.name == name,
                            text(f"owner->>'id' = '{auth.entity_id}'"),
                            text(f"owner->>'type' = '{auth.entity_type.value}'")
                        )
                    )
                )
                
                if existing.scalar_one_or_none():
                    logger.warning(f"Rule template with name '{name}' already exists for user {auth.entity_id}")
                    return None

                # Create owner and access control
                owner = {
                    "type": auth.entity_type.value,
                    "id": auth.entity_id
                }
                
                access_control = {
                    "readers": [auth.entity_id],
                    "writers": [auth.entity_id],
                    "admins": [auth.entity_id]
                }
                
                # Add user_id to access_control if available
                if auth.user_id:
                    access_control["user_id"] = [auth.user_id]

                system_metadata = {}
                if auth.app_id:
                    system_metadata["app_id"] = auth.app_id

                now = datetime.now(UTC).isoformat()
                
                # Create the rule template
                template = RuleTemplateModel(
                    id=template_id,
                    name=name,
                    description=description,
                    rules_json=json.loads(rules_json),  # Store as JSONB
                    owner=owner,
                    access_control=access_control,
                    system_metadata=system_metadata,
                    created_at=now,
                    updated_at=now
                )
                
                session.add(template)
                await session.commit()
                await session.refresh(template)  # Refresh to get updated data
                
                logger.info(f"Created rule template '{name}' with ID {template_id}")
                return template
                
        except Exception as e:
            logger.error(f"Error creating rule template: {e}")
            return None

    async def get_rule_templates(self, auth: AuthContext) -> List[Dict[str, Any]]:
        """Get all rule templates accessible to the user."""
        try:
            async with self.async_session() as session:
                # Build access filter for rule templates
                where_clauses = []
                
                # Owner check
                where_clauses.append(
                    f"(owner->>'id' = '{auth.entity_id}' AND owner->>'type' = '{auth.entity_type.value}')"
                )
                
                # Access control checks
                where_clauses.append(f"access_control->'readers' ? '{auth.entity_id}'")
                where_clauses.append(f"access_control->'writers' ? '{auth.entity_id}'")
                where_clauses.append(f"access_control->'admins' ? '{auth.entity_id}'")
                
                # User ID check for cloud mode
                if auth.user_id:
                    where_clauses.append(f"access_control->'user_id' ? '{auth.user_id}'")
                
                # Developer-scoped tokens: restrict by app_id
                if auth.entity_type == EntityType.DEVELOPER and auth.app_id:
                    app_filter = f"system_metadata->>'app_id' = '{auth.app_id}'"
                    access_filter = " OR ".join(where_clauses)
                    final_filter = f"({access_filter}) AND ({app_filter})"
                else:
                    final_filter = " OR ".join(where_clauses)
                
                query = select(RuleTemplateModel).where(text(final_filter)).order_by(RuleTemplateModel.created_at.desc())
                
                result = await session.execute(query)
                templates = result.scalars().all()
                
                # Convert to dict format expected by API
                template_list = []
                for template in templates:
                    template_dict = {
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "rules_json": json.dumps(template.rules_json),  # Convert back to JSON string
                        "created_at": template.created_at,
                        "updated_at": template.updated_at
                    }
                    template_list.append(template_dict)
                
                logger.info(f"Found {len(template_list)} rule templates for user {auth.entity_id}")
                return template_list
                
        except Exception as e:
            logger.error(f"Error getting rule templates: {e}")
            return []

    async def delete_rule_template(self, template_id: str, auth: AuthContext) -> bool:
        """Delete a rule template if user has admin access."""
        try:
            async with self.async_session() as session:
                # Get the template first
                result = await session.execute(
                    select(RuleTemplateModel).where(RuleTemplateModel.id == template_id)
                )
                template = result.scalar_one_or_none()
                
                if not template:
                    logger.warning(f"Rule template {template_id} not found")
                    return False
                
                # Check if user has admin access
                if not self._check_rule_template_access(template, auth, "admin"):
                    logger.warning(f"User {auth.entity_id} does not have admin access to template {template_id}")
                    return False
                
                # Delete the template
                await session.delete(template)
                await session.commit()
                
                logger.info(f"Deleted rule template {template_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting rule template: {e}")
            return False

    def _check_rule_template_access(self, template: RuleTemplateModel, auth: AuthContext, permission: str = "read") -> bool:
        """Check if user has required permission for rule template."""
        # Developer-scoped tokens: restrict by app_id
        if auth.entity_type == EntityType.DEVELOPER and auth.app_id:
            if template.system_metadata.get("app_id") != auth.app_id:
                return False
        
        # Admin always has access
        if "admin" in auth.permissions:
            return True
        
        # Check if template is owned by the user
        owner = template.owner or {}
        if (owner.get("type") == auth.entity_type.value and 
            owner.get("id") == auth.entity_id):
            
            # In cloud mode, also verify user_id if present
            if auth.user_id and get_settings().MODE == "cloud":
                template_user_ids = template.access_control.get("user_id", [])
                if auth.user_id not in template_user_ids:
                    return False
            return True
        
        # Check access control lists
        access_control = template.access_control or {}
        
        if permission == "read":
            readers = access_control.get("readers", [])
            if auth.entity_id in readers:
                return True
        
        if permission == "write":
            writers = access_control.get("writers", [])
            if auth.entity_id in writers:
                return True
        
        if permission == "admin":
            admins = access_control.get("admins", [])
            if auth.entity_id in admins:
                return True
        
        # Check user_id access in cloud mode
        if auth.user_id:
            user_ids = access_control.get("user_id", [])
            if auth.user_id in user_ids:
                return True
        
        return False

    async def delete_graph(self, name: str, auth: AuthContext, system_filters: Optional[Dict[str, Any]] = None) -> bool:
        """Delete a graph if user has admin access."""
        try:
            # First check if graph exists and user has access
            graph = await self.get_graph(name, auth, system_filters)
            if not graph:
                logger.warning(f"Graph '{name}' not found or user does not have access")
                return False

            # Check if user has admin access
            if not self._check_graph_access(graph, auth, "admin"):
                logger.warning(f"User {auth.entity_id} does not have admin access to graph '{name}'")
                return False

            async with self.async_session() as session:
                # Build access filter and system filters
                access_filter = self._build_access_filter(auth)
                
                where_clauses = [f"({access_filter})", "name = :name"]
                params = {"name": name}
                
                if system_filters:
                    # Apply system filters to ensure we only delete graphs in the right scope
                    if system_filters.get("folder_name"):
                        where_clauses.append("system_metadata->>'folder_name' = :folder_name")
                        params["folder_name"] = system_filters["folder_name"]
                    if system_filters.get("end_user_id"):
                        where_clauses.append("system_metadata->>'end_user_id' = :end_user_id")
                        params["end_user_id"] = system_filters["end_user_id"]

                where_clause = " AND ".join(where_clauses)
                query = select(GraphModel).where(text(where_clause))
                
                result = await session.execute(query, params)
                graph_model = result.scalar_one_or_none()
                
                if not graph_model:
                    logger.warning(f"Graph '{name}' not found with specified filters")
                    return False
                
                # Delete the graph
                await session.delete(graph_model)
                await session.commit()
                
                logger.info(f"Deleted graph '{name}' (ID: {graph_model.id})")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting graph '{name}': {e}")
            return False

    def _check_graph_access(self, graph: Graph, auth: AuthContext, permission: str = "read") -> bool:
        """Check if user has required permission for graph."""
        try:
            # For now, allow access to all users
            # TODO: Implement proper permission checking based on graph ownership/sharing
            return True
            
        except Exception as e:
            logger.error(f"Error checking graph access: {e}")
            return False

    # Chat Feedback Methods
    async def store_chat_feedback(
        self,
        feedback_id: str,
        conversation_id: str,
        query: str,
        response: str,
        rating: str,
        comment: Optional[str] = None,
        user_id: Optional[str] = None,
        model_used: Optional[str] = None,
        relevant_images: Optional[int] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """Store chat feedback in the database."""
        try:
            if not timestamp:
                timestamp = datetime.now(UTC).isoformat()

            async with self.async_session() as session:
                feedback_model = ChatFeedbackModel(
                    id=feedback_id,
                    conversation_id=conversation_id,
                    query=query,
                    response=response,
                    rating=rating,
                    comment=comment,
                    user_id=user_id,
                    model_used=model_used,
                    relevant_images=relevant_images,
                    timestamp=timestamp
                )
                
                session.add(feedback_model)
                await session.commit()
                
                logger.info(f"Stored chat feedback with ID {feedback_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error storing chat feedback: {e}")
            return False

    async def get_chat_feedback(
        self,
        auth: AuthContext,
        skip: int = 0,
        limit: int = 100,
        rating_filter: Optional[str] = None,
        model_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get chat feedback entries with optional filters."""
        try:
            async with self.async_session() as session:
                # Build query with filters
                where_clauses = []
                params = {}
                
                # Filter by user_id if available (for user isolation)
                if auth.user_id:
                    where_clauses.append("user_id = :user_id")
                    params["user_id"] = auth.user_id
                
                # Rating filter
                if rating_filter and rating_filter in ['up', 'down']:
                    where_clauses.append("rating = :rating")
                    params["rating"] = rating_filter
                
                # Model filter
                if model_filter:
                    where_clauses.append("model_used = :model_used")
                    params["model_used"] = model_filter
                
                # Build final query
                base_query = "SELECT * FROM chat_feedback"
                if where_clauses:
                    base_query += " WHERE " + " AND ".join(where_clauses)
                base_query += " ORDER BY timestamp DESC"
                base_query += f" OFFSET :skip LIMIT :limit"
                
                params["skip"] = skip
                params["limit"] = limit
                
                result = await session.execute(text(base_query), params)
                feedback_rows = result.fetchall()
                
                # Convert to dict format
                feedback_list = []
                for row in feedback_rows:
                    feedback_dict = {
                        "id": row.id,
                        "conversation_id": row.conversation_id,
                        "query": row.query,
                        "response": row.response,
                        "rating": row.rating,
                        "comment": row.comment,
                        "user_id": row.user_id,
                        "model_used": row.model_used,
                        "relevant_images": row.relevant_images,
                        "timestamp": row.timestamp
                    }
                    feedback_list.append(feedback_dict)
                
                logger.info(f"Retrieved {len(feedback_list)} chat feedback entries")
                return feedback_list
                
        except Exception as e:
            logger.error(f"Error getting chat feedback: {e}")
            return []

    async def get_chat_feedback_stats(self, auth: AuthContext) -> Dict[str, Any]:
        """Get statistics about chat feedback."""
        try:
            async with self.async_session() as session:
                # Build base condition for user isolation
                user_condition = ""
                params = {}
                if auth.user_id:
                    user_condition = "WHERE user_id = :user_id"
                    params["user_id"] = auth.user_id
                
                # Get total count
                total_query = f"SELECT COUNT(*) as total FROM chat_feedback {user_condition}"
                total_result = await session.execute(text(total_query), params)
                total_count = total_result.scalar()
                
                # Get rating breakdown
                rating_query = f"""
                    SELECT rating, COUNT(*) as count 
                    FROM chat_feedback {user_condition}
                    GROUP BY rating
                """
                rating_result = await session.execute(text(rating_query), params)
                rating_breakdown = {row.rating: row.count for row in rating_result.fetchall()}
                
                # Get model breakdown
                model_query = f"""
                    SELECT model_used, COUNT(*) as count 
                    FROM chat_feedback {user_condition}
                    WHERE model_used IS NOT NULL
                    GROUP BY model_used
                """
                model_result = await session.execute(text(model_query), params)
                model_breakdown = {row.model_used: row.count for row in model_result.fetchall()}
                
                stats = {
                    "total_feedback": total_count or 0,
                    "rating_breakdown": rating_breakdown,
                    "model_breakdown": model_breakdown,
                    "thumbs_up": rating_breakdown.get("up", 0),
                    "thumbs_down": rating_breakdown.get("down", 0)
                }
                
                logger.info(f"Retrieved chat feedback stats: {stats}")
                return stats
                
        except Exception as e:
            logger.error(f"Error getting chat feedback stats: {e}")
            return {
                "total_feedback": 0,
                "rating_breakdown": {},
                "model_breakdown": {},
                "thumbs_up": 0,
                "thumbs_down": 0
            }

    async def delete_chat_feedback(self, feedback_id: str, auth: AuthContext) -> bool:
        """Delete a chat feedback entry."""
        try:
            async with self.async_session() as session:
                # Get the feedback first to check ownership
                result = await session.execute(
                    select(ChatFeedbackModel).where(ChatFeedbackModel.id == feedback_id)
                )
                feedback = result.scalar_one_or_none()
                
                if not feedback:
                    logger.warning(f"Chat feedback {feedback_id} not found")
                    return False
                
                # Check if user can delete this feedback (owner or admin)
                if auth.user_id and feedback.user_id != auth.user_id:
                    if "admin" not in auth.permissions:
                        logger.warning(f"User {auth.user_id} not authorized to delete feedback {feedback_id}")
                        return False
                
                # Delete the feedback
                await session.delete(feedback)
                await session.commit()
                
                logger.info(f"Deleted chat feedback {feedback_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting chat feedback: {e}")
            return False
