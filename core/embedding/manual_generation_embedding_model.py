import base64
import io
import logging
import time
import os
import json  # For CSV loading
import csv  # For CSV loading
import datetime  # For updated_at timestamp
from typing import List, Tuple, Union, Optional

import numpy as np
import torch
from PIL.Image import Image
from PIL.Image import open as open_image
from sqlalchemy import create_engine, text 
from sqlalchemy.orm import sessionmaker, Session as SQLAlchemySession 
from sqlalchemy.exc import IntegrityError

from core.config import get_settings, Settings
from core.embedding.base_embedding_model import BaseEmbeddingModel
from core.models.chunk import Chunk 
from core.models.manual_generation_document import ManualGenDocument, EMBEDDING_DIMENSION, Base as ManualGenBase

# Import ColPali for manual generation
try:
    from colpali_engine.models import ColPali, ColPaliProcessor
    COLPALI_AVAILABLE = True
except ImportError:
    logger = logging.getLogger(__name__)
    logger.warning("colpali_engine not available. Manual generation embedding model will not work properly.")
    COLPALI_AVAILABLE = False

# Placeholder for DEVICE - this should be determined as in ColpaliEmbeddingModel
DEVICE = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"

logger = logging.getLogger(__name__)

class ManualGenerationEmbeddingModel(BaseEmbeddingModel):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.image_folder = self.settings.MANUAL_GENERATION_IMAGE_FOLDER
        if not self.image_folder or not os.path.isdir(self.image_folder):
            logger.warning(f"MANUAL_GENERATION_IMAGE_FOLDER ('{self.image_folder}') is not configured or not a valid directory. Parent image search might not work as expected.")
            self.image_folder = None

        self.manual_gen_db_engine = None
        self.ManualGenSessionLocal: Optional[sessionmaker[SQLAlchemySession]] = None
        if self.settings.MANUAL_GEN_DB_URI:
            try:
                self.manual_gen_db_engine = create_engine(self.settings.MANUAL_GEN_DB_URI, pool_pre_ping=True)
                self.ManualGenSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.manual_gen_db_engine)
                logger.info(f"Successfully connected to manual generation database: {self.settings.MANUAL_GEN_DB_URI.split('@')[-1]}") 
                # Create tables if they don't exist (idempotent) - do this in a separate method
                self._ensure_tables()
            except Exception as e:
                logger.error(f"Failed to connect to manual generation database ({self.settings.MANUAL_GEN_DB_URI.split('@')[-1]}) or ensure table: {e}")
                self.manual_gen_db_engine = None
                self.ManualGenSessionLocal = None
        else:
            logger.warning("Manual generation database URI not configured. Database operations will not be available.")

        device = DEVICE 
        logger.info(f"Initializing ManualGenerationEmbeddingModel with device: {device}")
        logger.info(f"Loading ColPali model for manual generation: {self.settings.COLPALI_MODEL_NAME}")
        start_time = time.time()

        self.colpali_model = None
        self.colpali_processor = None
        self.device = device

        if COLPALI_AVAILABLE:
            try:
                # Load ColPali model and processor
                self.colpali_model = ColPali.from_pretrained(
                    self.settings.COLPALI_MODEL_NAME,
                    torch_dtype=torch.bfloat16,
                    device_map=device,
                    token=self.settings.HUGGING_FACE_TOKEN if self.settings.HUGGING_FACE_TOKEN else None,
                ).eval()
                
                self.colpali_processor = ColPaliProcessor.from_pretrained(
                    self.settings.COLPALI_MODEL_NAME,
                    token=self.settings.HUGGING_FACE_TOKEN if self.settings.HUGGING_FACE_TOKEN else None,
                )
                
                total_init_time = time.time() - start_time
                logger.info(f"ManualGeneration ColPali model initialization time: {total_init_time:.2f} seconds")
            except Exception as e:
                logger.error(f"Failed to load ColPali model: {e}")
                self.colpali_model = None
                self.colpali_processor = None
        else:
            logger.error("ColPali not available. Manual generation will not work properly.")

    def _ensure_tables(self):
        """Ensure database tables exist - separate method to avoid async issues"""
        try:
            if self.manual_gen_db_engine:
                ManualGenBase.metadata.create_all(bind=self.manual_gen_db_engine)
                logger.info(f"Ensured table '{ManualGenDocument.__tablename__}' exists in manual gen DB.")
                
                # Create vector index separately
                self._create_vector_index()
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")

    def _create_vector_index(self):
        """Create vector index separately to handle operator class issues"""
        try:
            if self.manual_gen_db_engine:
                with self.manual_gen_db_engine.connect() as conn:
                    # Check if index already exists
                    result = conn.execute(text("""
                        SELECT 1 FROM pg_indexes 
                        WHERE tablename = 'manual_gen_documents' 
                        AND indexname = 'idx_manual_gen_embedding_hnsw'
                    """))
                    
                    if not result.fetchone():
                        # Create the HNSW index with proper operator class
                        conn.execute(text("""
                            CREATE INDEX idx_manual_gen_embedding_hnsw 
                            ON manual_gen_documents 
                            USING hnsw (embedding vector_cosine_ops) 
                            WITH (m = 16, ef_construction = 64)
                        """))
                        conn.commit()
                        logger.info("Created HNSW index for manual_gen_documents.embedding")
                    else:
                        logger.info("HNSW index already exists for manual_gen_documents.embedding")
        except Exception as e:
            logger.warning(f"Could not create vector index (table still functional): {e}")
            # Try creating a simpler index
            try:
                if self.manual_gen_db_engine:
                    with self.manual_gen_db_engine.connect() as conn:
                        conn.execute(text("""
                            CREATE INDEX IF NOT EXISTS idx_manual_gen_embedding_simple 
                            ON manual_gen_documents 
                            USING btree (id)
                        """))
                        conn.commit()
                        logger.info("Created simple index as fallback")
            except Exception as e2:
                logger.warning(f"Could not create fallback index: {e2}")

    async def embed_for_ingestion(self, chunks: Union[str, List[str], Chunk, List[Chunk]]) -> List[np.ndarray]:
        """
        Generates embeddings for given texts or Chunk objects.
        This can be used to create embeddings for the 'embedding_text' column 
        when populating the manual_gen_documents table.
        """
        logger.info("embed_for_ingestion called for ManualGenerationEmbeddingModel.")
        
        texts_to_embed: List[str] = []
        if isinstance(chunks, Chunk):
            texts_to_embed = [str(chunks.text)] if chunks.text else []
        elif isinstance(chunks, list) and all(isinstance(c, Chunk) for c in chunks):
            texts_to_embed = [str(c.text) for c in chunks if c.text]
        elif isinstance(chunks, str):
            texts_to_embed = [chunks]
        elif isinstance(chunks, list) and all(isinstance(c, str) for c in chunks):
            texts_to_embed = chunks
        else:
            logger.warning("embed_for_ingestion received unexpected type for chunks or empty content. Returning empty list.")
            return []
        
        if not texts_to_embed:
            logger.info("No non-empty texts to embed.")
            return []

        logger.info(f"Generating embeddings for {len(texts_to_embed)} items for manual_gen ingestion.")
        
        # Use the ColPali processor to process queries for embedding generation
        if not self.colpali_processor or not self.colpali_model:
            logger.error("ColPali model or processor not loaded. Cannot generate embeddings.")
            return [np.array([]) for _ in texts_to_embed]
            
        try:
            inputs = self.colpali_processor.process_queries(texts_to_embed).to(self.device)
        except Exception as e:
            logger.error(f"Error during colpali_processor.process_queries in embed_for_ingestion: {e}")
            return [np.array([]) for _ in texts_to_embed]

        with torch.no_grad():
            try:
                output = self.colpali_model(**inputs)
                # For ColPali, the output is typically the embedding tensor
                # Convert to the expected format
                embeddings_tensor = output
                
                if hasattr(output, 'last_hidden_state'):
                    # If it's a transformer output with last_hidden_state, use mean pooling
                    embeddings_tensor = output.last_hidden_state.mean(dim=1)
                elif hasattr(output, 'pooler_output'):
                    # If it has pooler_output, use that
                    embeddings_tensor = output.pooler_output
                elif torch.is_tensor(output):
                    # If output is already a tensor, use it directly
                    embeddings_tensor = output
                else:
                    logger.error("Cannot determine embedding tensor from ColPali model output.")
                    return [np.array([]) for _ in texts_to_embed]

                embeddings = embeddings_tensor.to(torch.float32).cpu().numpy()
            except Exception as e:
                logger.error(f"Error during model inference or embedding extraction in embed_for_ingestion: {e}")
                return [np.array([]) for _ in texts_to_embed]
        
        if embeddings.ndim == 1: # If a single embedding was returned and it's 1D
            embeddings = np.expand_dims(embeddings, axis=0)

        if embeddings.shape[1] != EMBEDDING_DIMENSION:
            logger.error(f"Generated embedding dimension ({embeddings.shape[1]}) does not match expected ({EMBEDDING_DIMENSION}). Check model and EMBEDDING_DIMENSION.")
            return [np.array([]) for _ in texts_to_embed]

        return [emb for emb in embeddings]

    async def embed_for_query(self, text: str) -> np.ndarray:
        """Generate query embedding for similarity search."""
        if not self.colpali_processor or not self.colpali_model:
            logger.error("ColPali model or processor not loaded. Cannot generate query embedding.")
            return np.array([])
            
        logger.info(f"Generating query embedding for: {text[:50]}...")
        try:
            inputs = self.colpali_processor.process_queries([text]).to(self.device)
            with torch.no_grad():
                output = self.colpali_model(**inputs)
                
                # Handle different output formats from ColPali
                if hasattr(output, 'last_hidden_state'):
                    query_vector = output.last_hidden_state.mean(dim=1).squeeze()
                elif hasattr(output, 'pooler_output'):
                    query_vector = output.pooler_output.squeeze()
                elif torch.is_tensor(output):
                    query_vector = output.squeeze()
                else:
                    logger.error("Cannot determine embedding tensor from ColPali model output for query.")
                    return np.array([])
                    
                query_vector = query_vector.to(torch.float32).cpu().numpy()

            if query_vector.ndim == 2 and query_vector.shape[0] == 1:
                return query_vector[0]
            elif query_vector.ndim == 3: # Should not happen for single query
                return query_vector.mean(axis=1).squeeze()
            return query_vector # Should be 1D array
        except Exception as e:
            logger.error(f"Error generating query embedding: {e}")
            return np.array([])


    # Your helper functions, adapted as methods or static methods:

    def get_manual_gen_db_session(self) -> Optional[SQLAlchemySession]:
        if not self.ManualGenSessionLocal:
            logger.error("Manual generation database not initialized. Cannot get session.")
            return None
        db = self.ManualGenSessionLocal()
        try:
            # You could yield db here if this were a context manager
            return db
        except Exception as e:
            logger.error(f"Error creating manual gen DB session: {e}")
            db.close() # Ensure session is closed on error if not yielded
            return None
        # finally:
            # db.close() # If not yielded, close here or ensure caller closes

    async def find_relevant_images(self, query: str, k: int = 3) -> List[ManualGenDocument]:
        """
        Busca imágenes relevantes en la base de datos usando ColPali.
        
        Args:
            query: String con la consulta del usuario
            k: Número máximo de resultados a devolver (compatible con API)
            
        Returns:
            Lista de ManualGenDocument objects
        """
        logger.info(f"🔎 Buscando imágenes relevantes para: {query}")

        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot find relevant images: Manual generation database session not available.")
            return []
        
        try:
            # Generate query vector using the class's ColPali model and processor
            if not self.colpali_processor or not self.colpali_model:
                logger.error("ColPali model or processor not loaded. Cannot find relevant images.")
                return []
                
            inputs = self.colpali_processor.process_queries([query]).to(self.device)
            with torch.no_grad():
                output = self.colpali_model(**inputs)
                
                # Handle different output formats from ColPali
                if hasattr(output, 'last_hidden_state'):
                    query_vector = output.last_hidden_state.mean(dim=1).squeeze()
                elif hasattr(output, 'pooler_output'):
                    query_vector = output.pooler_output.squeeze()
                elif torch.is_tensor(output):
                    query_vector = output.squeeze()
                else:
                    logger.error("Cannot determine embedding tensor from ColPali model output.")
                    return []
                    
                query_vector = query_vector.to(torch.float32).cpu().numpy()

                if query_vector.ndim == 2 and query_vector.shape[0] == 1:
                    query_vector = query_vector[0]
                elif query_vector.ndim == 3: # Should not happen for single query
                    query_vector = query_vector.mean(axis=1).squeeze()
                # Ensure query_vector is 1D
                if query_vector.ndim != 1:
                    logger.error(f"Query vector has unexpected dimensions: {query_vector.shape}")
                    query_vector = query_vector.reshape(-1)

            # Ejecutar búsqueda semántica
            results = db_session.execute(
                text('''
                    SELECT id, image_path, prompt, respuesta
                    FROM manual_gen_documents  -- Querying the new dedicated table
                    ORDER BY embedding <-> CAST(:query_vec AS vector)
                    LIMIT :limit
                '''),
                {"query_vec": query_vector.tolist(), "limit": k}
            ).fetchall()
            
            if not results:
                logger.info("❌ No se encontraron imágenes relevantes.")
                return []
                
            relevant_docs = []
            for result in results:
                logger.info(f"🎯 Imagen encontrada: {result.image_path}")
                # Create ManualGenDocument objects from query results
                doc = ManualGenDocument(
                    id=result.id,
                    image_path=result.image_path,
                    prompt=result.prompt,
                    respuesta=result.respuesta
                )
                relevant_docs.append(doc)
                
            return relevant_docs
        except Exception as e:
            logger.error(f"Error during find_relevant_images: {e}")
            return []
        finally:
            if db_session:
                db_session.close()

    # Placeholder for a method to add/update image metadata and embeddings
    # to the manual_gen_documents table
    async def store_image_metadata(
        self,
        image_path: str,
        prompt: Optional[str] = None,
        respuesta: Optional[str] = None,
        embedding_text: Optional[str] = None, 
        embedding_override: Optional[np.ndarray] = None, 
        module: Optional[str] = None,
        section: Optional[str] = None,
        subsection: Optional[str] = None,
        function_detected: Optional[str] = None,
        hierarchy_level: Optional[int] = None,
        keywords: Optional[List[str]] = None, 
        additional_metadata: Optional[dict] = None,
        overwrite: bool = False
    ) -> bool:
        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot store image metadata: Manual generation database session not available.")
            return False

        final_embedding_list: Optional[List[float]] = None
        if embedding_override is not None:
            if embedding_override.ndim == 1 and embedding_override.shape[0] == EMBEDDING_DIMENSION:
                final_embedding_list = embedding_override.tolist()
            else:
                logger.warning(f"Provided embedding_override for {image_path} has incorrect shape ({embedding_override.shape}). Expected ({EMBEDDING_DIMENSION},). Skipping embedding.")
        elif embedding_text:
            try:
                # Use embed_for_ingestion as it handles lists and returns a list of embeddings
                # We expect a single text, so we take the first result.
                embedding_results = await self.embed_for_ingestion([embedding_text])
                if embedding_results and embedding_results[0].ndim == 1 and embedding_results[0].shape[0] == EMBEDDING_DIMENSION:
                    final_embedding_list = embedding_results[0].tolist()
                else:
                    logger.warning(f"Failed to generate valid embedding for text: '{embedding_text[:50]}...'")
            except Exception as e:
                logger.error(f"Failed to generate embedding for '{embedding_text[:50]}...': {e}")

        try:
            existing_doc: Optional[ManualGenDocument] = db_session.query(ManualGenDocument).filter_by(image_path=image_path).first()

            if existing_doc and not overwrite:
                logger.info(f"Metadata for image '{image_path}' already exists and overwrite is False. Skipping.")
                return True 

            update_values = {
                "prompt": prompt,
                "respuesta": respuesta,
                "embedding": final_embedding_list if final_embedding_list is not None else (existing_doc.embedding if existing_doc else None),
                "module": module,
                "section": section,
                "subsection": subsection,
                "function_detected": function_detected,
                "hierarchy_level": hierarchy_level,
                "keywords": keywords,
                "additional_metadata": additional_metadata,
                "updated_at": datetime.datetime.utcnow()
            }
            # Filter out None values for update, so we don't nullify existing fields unintentionally
            # unless the new value is explicitly set to something (even if that something is None for nullable fields)
            # For create, all provided values will be used.

            if existing_doc:
                logger.info(f"Updating existing metadata for image: {image_path}")
                for key, value in update_values.items():
                    # Only update if the new value is not None, OR if the field was None and now has a value.
                    # If you want to explicitly set a field to None, that should be handled by passing None.
                    if value is not None:
                        setattr(existing_doc, key, value)
                    # If you want to allow clearing a field by passing None, you would remove `if value is not None`
                    # but then you need to be careful about which fields are being updated.
                    # A more robust way is to pass a dict of fields_to_update.
                    # For now, this logic means if `prompt` is None, existing_doc.prompt won't be changed.
                db_session.add(existing_doc)
            else:
                logger.info(f"Storing new metadata for image: {image_path}")
                # For new documents, we can directly pass the values, None will be stored as NULL if column allows
                new_doc_data = {k: v for k, v in update_values.items() if v is not None} # Only include non-None for new doc
                new_doc_data['image_path'] = image_path # image_path is mandatory
                if 'embedding' not in new_doc_data and final_embedding_list is not None:
                     new_doc_data['embedding'] = final_embedding_list
                
                new_doc = ManualGenDocument(**new_doc_data)
                db_session.add(new_doc)
            
            db_session.commit()
            return True
        except IntegrityError as e:
            logger.error(f"Database integrity error for {image_path} (e.g., unique constraint violation): {e}")
            if db_session:
                db_session.rollback()
            return False
        except Exception as e:
            logger.error(f"Error storing image metadata for {image_path}: {e}")
            if db_session:
                db_session.rollback()
            return False
        finally:
            if db_session:
                db_session.close()

    async def load_metadata_from_csv(self, csv_file_path: str, overwrite_existing: bool = False):
        import csv # Already imported at top level
        import json # Already imported at top level
        logger.info(f"Loading image metadata from CSV: {csv_file_path}")
        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot load metadata from CSV: Manual generation database session not available.")
            return False

        try:
            with open(csv_file_path, mode='r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    # Assuming the CSV has columns: image_path, prompt, respuesta, embedding (as JSON array), module, section, subsection, function_detected, hierarchy_level, keywords (as JSON array)
                    image_path = row.get('image_path')
                    if not image_path:
                        logger.warning("Row skipped, missing image_path: {}".format(row))
                        continue
                    
                    # Convert embedding and keywords from JSON string to Python object
                    embedding = json.loads(row['embedding']) if row.get('embedding') else None
                    keywords = json.loads(row['keywords']) if row.get('keywords') else None

                    # For other fields, direct assignment
                    prompt = row.get('prompt')
                    respuesta = row.get('respuesta')
                    module = row.get('module')
                    section = row.get('section')
                    subsection = row.get('subsection')
                    function_detected = row.get('function_detected')
                    hierarchy_level = int(row['hierarchy_level']) if row.get('hierarchy_level') else None

                    # Store image metadata, overwrite if exists or if specified
                    await self.store_image_metadata(
                        image_path=image_path,
                        prompt=prompt,
                        respuesta=respuesta,
                        embedding_override=embedding, # Use embedding_override for direct embedding assignment
                        module=module,
                        section=section,
                        subsection=subsection,
                        function_detected=function_detected,
                        hierarchy_level=hierarchy_level,
                        keywords=keywords,
                        additional_metadata=None, # No additional metadata from CSV in this example
                        overwrite=overwrite_existing # Overwrite existing metadata if specified
                    )
            return True
        except Exception as e:
            logger.error(f"Error loading metadata from CSV: {e}")
            return False
        finally:
            if db_session:
                db_session.close()


    @staticmethod
    def extract_context_from_path(image_path: str) -> dict:
        """
        Extrae información contextual de la ruta de la imagen.
        """
        context = {
            "module": None,
            "section": None,
            "subsection": None,
            "function": None,
            "hierarchy_level": 0
        }
        
        path_parts = image_path.split("/")
        filename = os.path.basename(image_path).replace(".png", "").replace(".jpg", "").replace(".jpeg", "")
        
        if len(path_parts) >= 1:
            if "Catalogos" in path_parts:
                context["module"] = "Catálogos"
                cat_index = path_parts.index("Catalogos")
                if len(path_parts) > cat_index + 1:
                    context["section"] = path_parts[cat_index + 1]
                    if len(path_parts) > cat_index + 2:
                        context["subsection"] = path_parts[cat_index + 2]
            elif "pantalla principal" in path_parts: # Assuming "pantalla principal" is a folder name
                context["module"] = "Pantalla Principal"
                # Check filename for more specific module info if path is generic
                if "modulo" in filename.lower() or "Modulo" in filename: # "Modulo X" in filename
                    module_name_parts = filename.split("_")[-1] if "_" in filename else filename.split(" ")[-1] if " " in filename else filename
                    module_name = module_name_parts.replace("modulo", "", 1).replace("Modulo", "", 1).strip()
                    context["section"] = f"Módulo {module_name}" if module_name else "Módulo Desconocido"


        context["hierarchy_level"] = len(path_parts) -1 # Depth of folders
        
        if "pantalla" in filename.lower():
            context["function"] = "Visualización"
        elif "catalogo" in filename.lower():
            context["function"] = "Administración de catálogos"
        elif "modulo" in filename.lower() and "pantalla principal" not in image_path.lower() : # Avoid double "Modulo"
             context["function"] = "Acceso a módulo"
        
        return context

    @staticmethod
    def find_parent_images(image_path: str, df, max_parent_images: int = 2, base_image_folder: Optional[str] = None) -> List[Tuple[str, str, str]]:
        """
        Encuentra imágenes en carpetas padres para dar contexto adicional.
        """
        path_parts = image_path.split("/")[:-1]
        parent_images = []

        if not base_image_folder:
            logger.warning("Base image folder not provided to find_parent_images. Cannot search for parent images.")
            return []
        
        for i in range(len(path_parts), 0, -1):
            if len(parent_images) >= max_parent_images:
                break
                
            current_folder_to_scan_rel = "/".join(path_parts[:i])
            # IMAGE_FOLDER needs to be defined or passed
            abs_folder_to_scan = os.path.join(base_image_folder, current_folder_to_scan_rel) 
            
            if not os.path.isdir(abs_folder_to_scan):
                continue
                
            for file_in_folder in sorted(os.listdir(abs_folder_to_scan)):
                if file_in_folder.lower().endswith((".png", ".jpg", ".jpeg")):
                    rel_path_candidate = os.path.join(current_folder_to_scan_rel, file_in_folder).replace("\\", "/") # Normalize path
                    
                    if os.path.normpath(rel_path_candidate) == os.path.normpath(image_path):
                        continue
                    
                    is_duplicate = any(os.path.normpath(p_img_path) == os.path.normpath(rel_path_candidate) for p_img_path, _, _ in parent_images)
                    if is_duplicate:
                        continue

                    context = ManualGenerationEmbeddingModel.extract_context_from_path(rel_path_candidate)
                    
                    metadata_found = False
                    if df is not None: # df is pandas DataFrame
                        # Ensure image_path in df uses consistent path separators
                        df_path_col = df["image_path"].str.replace("\\", "/") 
                        metadata_rows = df[df_path_col == rel_path_candidate]
                        if not metadata_rows.empty:
                            row = metadata_rows.iloc[0]
                            prompt = f"{row.get('funciones_detectadas', 'Función no especificada')} - {context['module']} > {context['section']}" if context.get('section') else row.get('funciones_detectadas', 'Función no especificada')
                            parent_images.append((rel_path_candidate, prompt, row.get('tipo_pantalla', 'Tipo no especificado')))
                            metadata_found = True
                            logger.info(f"👨‍👦 Imagen padre encontrada (con metadata): {rel_path_candidate}")
                    
                    if not metadata_found:
                        folder_description = f"{context['module']} > {context['section']}" if context.get('section') else current_folder_to_scan_rel
                        prompt = f"Imagen de contexto en {folder_description}"
                        parent_images.append((rel_path_candidate, prompt, f"Pantalla de {context['function'] if context.get('function') else 'contexto general'}"))
                        logger.info(f"👨‍👦 Imagen padre encontrada (sin metadata): {rel_path_candidate}")
                        
                    if len(parent_images) >= max_parent_images:
                        break
        
        parent_images.sort(key=lambda x: len(x[0].split("/")))
        return parent_images

    @staticmethod
    def analyze_model_usage(manual_text: str, image_paths: List[str]) -> str:
        """
        Analiza si el modelo realmente está utilizando la información de las imágenes.
        """
        analysis = "\n\n## Análisis de uso de información por el modelo\n\n"
        
        info_usage_section = False
        if "utiliz" in manual_text.lower() and "imag" in manual_text.lower():
            info_usage_section = True
        
        path_references = []
        for img_path in image_paths:
            path_parts = img_path.split('/')
            for part in path_parts:
                # Check for part (folder/file name without extension)
                name_without_ext, _ = os.path.splitext(part)
                if len(name_without_ext) > 3 and name_without_ext.lower() in manual_text.lower():
                    path_references.append(name_without_ext)
        
        path_references = list(set(path_references)) # Unique references

        if info_usage_section:
            analysis += "✅ El modelo ha incluido una sección explicando cómo utilizó la información proporcionada.\n"
        else:
            analysis += "❌ El modelo no ha incluido una sección explícita sobre cómo utilizó la información.\n"
        
        if path_references:
            analysis += f"✅ Se encontraron {len(path_references)} referencias a elementos específicos de las rutas de imágenes.\n"
            analysis += f"   Referencias encontradas: {', '.join(path_references[:5])}\n" # Show up to 5
        else:
            analysis += "❌ No se encontraron referencias a elementos específicos de las rutas de imágenes.\n"
        
        effectiveness_score = (1 if info_usage_section else 0) + min(1, len(path_references) / 2.0) # Normalize path_references contribution
        if effectiveness_score > 1.0: # Max score of 2
            analysis += "\n**Conclusión**: El modelo está utilizando efectivamente la información proporcionada.\n"
        elif effectiveness_score > 0.5:
            analysis += "\n**Conclusión**: El modelo está utilizando parcialmente la información proporcionada.\n"
        else:
            analysis += "\n**Conclusión**: El modelo parece no estar utilizando la información proporcionada con efectividad.\n"
            
        return analysis

    async def find_by_image_path(self, image_path: str) -> List[ManualGenDocument]:
        """Find documents by image path."""
        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot find by image path: Manual generation database session not available.")
            return []
        
        try:
            docs = db_session.query(ManualGenDocument).filter_by(image_path=image_path).all()
            return docs
        except Exception as e:
            logger.error(f"Error finding documents by image path '{image_path}': {e}")
            return []
        finally:
            db_session.close()

    async def add_document(self, doc_data: dict) -> Optional[str]:
        """Add a new document to the database."""
        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot add document: Manual generation database session not available.")
            return None
        
        try:
            # Create new document
            new_doc = ManualGenDocument(
                id=str(uuid.uuid4()),
                image_path=doc_data.get("image_path"),
                prompt=doc_data.get("prompt"),
                respuesta=doc_data.get("respuesta"),
                embedding=None,  # Will be generated if needed
                module=doc_data.get("metadata", {}).get("structural", {}).get("module"),
                section=doc_data.get("metadata", {}).get("structural", {}).get("section"),
                subsection=doc_data.get("metadata", {}).get("structural", {}).get("subsection"),
                function_detected=doc_data.get("metadata", {}).get("ai_analysis", {}).get("funciones_detectadas"),
                hierarchy_level=doc_data.get("metadata", {}).get("structural", {}).get("hierarchy_level"),
                keywords=doc_data.get("metadata", {}).get("ai_analysis", {}).get("elementos_interfaz", []),
                metadata=doc_data.get("metadata", {})
            )
            
            db_session.add(new_doc)
            db_session.commit()
            logger.info(f"Successfully added document for image: {doc_data.get('image_path')}")
            return new_doc.id
            
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            db_session.rollback()
            return None
        finally:
            db_session.close()

    async def update_document(self, doc_id: str, doc_data: dict) -> bool:
        """Update an existing document in the database."""
        db_session = self.get_manual_gen_db_session()
        if not db_session:
            logger.error("Cannot update document: Manual generation database session not available.")
            return False
        
        try:
            # Find existing document
            doc = db_session.query(ManualGenDocument).filter_by(id=doc_id).first()
            if not doc:
                logger.error(f"Document with ID {doc_id} not found")
                return False
            
            # Update fields
            if "prompt" in doc_data:
                doc.prompt = doc_data["prompt"]
            if "respuesta" in doc_data:
                doc.respuesta = doc_data["respuesta"]
            if "metadata" in doc_data:
                doc.metadata = doc_data["metadata"]
                # Update extracted fields from metadata
                metadata = doc_data["metadata"]
                if "structural" in metadata:
                    structural = metadata["structural"]
                    doc.module = structural.get("module")
                    doc.section = structural.get("section")
                    doc.subsection = structural.get("subsection")
                    doc.hierarchy_level = structural.get("hierarchy_level")
                if "ai_analysis" in metadata:
                    ai_analysis = metadata["ai_analysis"]
                    doc.function_detected = ai_analysis.get("funciones_detectadas")
                    doc.keywords = ai_analysis.get("elementos_interfaz", [])
            
            db_session.commit()
            logger.info(f"Successfully updated document: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating document {doc_id}: {e}")
            db_session.rollback()
            return False
        finally:
            db_session.close()

# Example of how you might get settings and instantiate:
# settings = get_settings()
# manual_generator_colpali = ManualGenerationEmbeddingModel(settings)

# The generate_manual function would likely be outside this class,
