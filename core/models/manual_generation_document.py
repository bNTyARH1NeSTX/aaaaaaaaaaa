import datetime
import json # For CSV loading of JSON fields
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB 
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector 

from core.config import Settings, get_settings # Import Settings and get_settings

# ColPali model specific dimensions (from ARHVNAAG/Bnext fine-tuned model)
# This is different from the general OpenAI embedding dimensions in config
COLPALI_EMBEDDING_DIMENSION = 128  # Specific to the fine-tuned ColPali model for manual generation

# Load settings for other configurations but use specific dimensions for ColPali
try:
    settings = get_settings() # Use get_settings() to load all configurations
    # Note: We don't use settings.VECTOR_DIMENSIONS here because that's for OpenAI embeddings
    # ColPali has its own specific dimension requirements
    EMBEDDING_DIMENSION = COLPALI_EMBEDDING_DIMENSION
except Exception as e:
    print(f"Warning: Could not load settings from core.config.Settings: {e}")
    print(f"Using ColPali specific embedding dimension: {COLPALI_EMBEDDING_DIMENSION}")
    EMBEDDING_DIMENSION = COLPALI_EMBEDDING_DIMENSION # Use ColPali specific dimensions

Base = declarative_base()

class ManualGenDocument(Base):
    __tablename__ = "manual_gen_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    image_path = Column(String, unique=True, index=True, nullable=False)
    
    prompt = Column(Text, nullable=True)
    respuesta = Column(Text, nullable=True) 
    
    embedding = Column(Vector(EMBEDDING_DIMENSION), nullable=True)

    module = Column(String, nullable=True)
    section = Column(String, nullable=True)
    subsection = Column(String, nullable=True)
    function_detected = Column(String, nullable=True)
    hierarchy_level = Column(Integer, nullable=True)
    
    keywords = Column(JSONB, nullable=True) # Stored as a JSON list, e.g., ["keyword1", "keyword2"]
    additional_metadata = Column(JSONB, nullable=True) # For other structured data

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Index will be created separately to handle potential operator class issues
    # __table_args__ = (
    #     Index(
    #         'idx_manual_gen_embedding_hnsw', # Index name
    #         embedding,                       # Column to index
    #         postgresql_using='hnsw',         # Index type
    #         postgresql_ops={'embedding': 'vector_cosine_ops'},  # Specify operator class
    #         postgresql_with={                # Index parameters
    #             'm': 16,                     # Max connections per node
    #             'ef_construction': 64        # Size of dynamic candidate list for construction
    #         }
    #     ),
    # )
    # Example for IVFFlat (can be faster for very large datasets, may need tuning):
    # __table_args__ = (
    #     Index(
    #         'idx_manual_gen_embedding_ivfflat',
    #         embedding,
    #         postgresql_using='ivfflat',
    #         postgresql_with={
    #             'lists': 100  # Number of IVF lists (e.g., sqrt(N) where N is num_rows)
    #         }
    #     ),
    # )
    # You would typically add this __table_args__ to the class definition.
    # The table creation (Base.metadata.create_all(engine)) will then attempt to create this index.

    def __repr__(self):
        return f"<ManualGenDocument(id={self.id}, image_path='{self.image_path}')>"

# Utility function (optional, can be part of your app setup)
def create_manual_gen_tables(db_url: str):
    if not db_url:
        print("Database URL not provided. Cannot create tables.")
        return
    try:
        engine = create_engine(db_url)
        Base.metadata.create_all(engine)
        print(f"Table '{ManualGenDocument.__tablename__}' ensured in the database at {db_url.split('@')[-1]}.")
    except Exception as e:
        print(f"Error creating/ensuring table '{ManualGenDocument.__tablename__}': {e}")

# Example usage (typically called once during application startup if using the utility function):
# if __name__ == '__main__':
#     from core.config import get_settings # Assuming your get_settings is accessible
#     settings = get_settings()
#     if settings.MANUAL_GEN_DB_URL:
#         create_manual_gen_tables(settings.MANUAL_GEN_DB_URL)
#     else:
#         print("MANUAL_GEN_DB_URL not configured in settings.")

