import os
from collections import ChainMap
from functools import lru_cache
from typing import Any, Dict, Literal, Optional

import tomli
from dotenv import load_dotenv
from pydantic import BaseModel, Field, PostgresDsn, RedisDsn, validator, AnyHttpUrl, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict # Ensure SettingsConfigDict is imported


load_dotenv(override=True)



class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    API_DOMAIN: Optional[str] = "localhost" # Default added
    HOST: Optional[str] = "0.0.0.0"
    PORT: Optional[int] = 8000
    RELOAD: Optional[bool] = False # Default based on common practice for dev
    WORKERS: Optional[int] = None # Default added

    # Security and Authentication
    JWT_SECRET_KEY: Optional[str] = "dev-secret-key" # Placeholder default, MUST be changed for production
    SESSION_SECRET_KEY: Optional[str] = "super-secret-dev-session-key" # Placeholder default, MUST be changed for production
    JWT_ALGORITHM: Optional[str] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DEV_MODE_PERMISSIVE_ENDPOINTS: bool = False
    dev_mode: bool = True  # Habilitar modo de desarrollo
    dev_entity_type: str = "user"
    dev_entity_id: str = "dev-user"
    dev_permissions: list = ["*"]

    # Registered Models (example, adjust as needed)
    REGISTERED_MODELS: Dict[str, Any] = {}

    # Completion settings
    COMPLETION_PROVIDER: str = "litellm"
    COMPLETION_MODEL: Optional[str] = None # Made Optional

    # Agent settings
    AGENT_MODEL: Optional[str] = None # Made Optional

    # Document Analysis
    DOCUMENT_ANALYSIS_MODEL: Optional[str] = None # Made Optional

    # Database settings
    DATABASE_PROVIDER: Optional[str] = "postgres"
    DATABASE_NAME: Optional[str] = None
    POSTGRES_URI: Optional[str] = None # Ensure this is set in your environment
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_TIMEOUT: int = 10
    DB_POOL_PRE_PING: bool = True
    DB_MAX_RETRIES: int = 3
    DB_RETRY_DELAY: float = 1.0

    # Embedding settings
    EMBEDDING_PROVIDER: str = "litellm"
    EMBEDDING_MODEL: Optional[str] = None # Made Optional
    VECTOR_DIMENSIONS: Optional[int] = 1536 # Default based on log
    EMBEDDING_SIMILARITY_METRIC: Optional[str] = "cosine"

    # Parser settings
    CHUNK_SIZE: Optional[int] = 1000
    CHUNK_OVERLAP: Optional[int] = 200
    USE_UNSTRUCTURED_API: Optional[bool] = False
    UNSTRUCTURED_API_KEY: Optional[str] = None
    USE_CONTEXTUAL_CHUNKING: bool = False

    # Rules settings
    RULES_PROVIDER: str = "litellm"
    RULES_MODEL: Optional[str] = None # Made Optional
    RULES_BATCH_SIZE: int = 10

    # Graph settings
    GRAPH_PROVIDER: str = "litellm"
    GRAPH_MODEL: Optional[str] = None # Made Optional
    ENABLE_ENTITY_RESOLUTION: bool = True

    # Reranker settings
    USE_RERANKING: Optional[bool] = False
    RERANKER_PROVIDER: Optional[str] = None
    RERANKER_MODEL: Optional[str] = None
    RERANKER_QUERY_MAX_LENGTH: Optional[int] = None
    RERANKER_PASSAGE_MAX_LENGTH: Optional[int] = None
    RERANKER_USE_FP16: Optional[bool] = None
    RERANKER_DEVICE: Optional[str] = None

    # Storage settings
    STORAGE_PROVIDER: Optional[str] = "local"
    STORAGE_PATH: Optional[str] = "./storage" # Default local path
    AWS_REGION: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    AWS_ACCESS_KEY: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # Vector Store settings
    VECTOR_STORE_PROVIDER: Optional[str] = "pgvector"

    # Morphik specific settings
    ENABLE_COLPALI: Optional[bool] = False
    COLPALI_MODE: str = "local"
    MODE: str = "cloud"
    MORPHIK_EMBEDDING_API_DOMAIN: Optional[str] = "api.morphik.ai" # Default added

    # Redis settings
    REDIS_HOST: Optional[str] = "localhost"
    REDIS_PORT: Optional[int] = 6379
    REDIS_DB: Optional[int] = 0
    REDIS_PASSWORD: Optional[str] = None

    # Telemetry settings (existing ones from your snippet seem fine)
    TELEMETRY_ENABLED: bool = True
    HONEYCOMB_ENABLED: bool = True
    HONEYCOMB_ENDPOINT: str = "https://api.honeycomb.io"
    HONEYCOMB_API_KEY: Optional[str] = None # Added Optional
    HONEYCOMB_DATASET: Optional[str] = None # Added Optional
    HONEYCOMB_PROXY_ENDPOINT: str = "https://otel-proxy.onrender.com/"
    SERVICE_NAME: str = "morphik-core"
    OTLP_TIMEOUT: int = 10
    OTLP_MAX_RETRIES: int = 3
    OTLP_RETRY_DELAY: int = 1
    OTLP_MAX_EXPORT_BATCH_SIZE: int = 512
    OTLP_SCHEDULE_DELAY_MILLIS: int = 5000
    OTLP_MAX_QUEUE_SIZE: int = 2048

    # Manual Generation specific settings
    COLPALI_MODEL_NAME: Optional[str] = None # Made Optional
    MANUAL_MODEL_NAME: Optional[str] = None # Made Optional
    MANUAL_GENERATION_IMAGE_FOLDER: Optional[str] = None
    MANUAL_GENERATION_MAX_NEW_TOKENS: int = 1024
    MANUAL_GENERATION_TEMPERATURE: float = 0.7
    MANUAL_GENERATION_DO_SAMPLE: bool = True
    MANUAL_GENERATION_TOP_P: float = 0.9

    MANUAL_GEN_DB_USER: Optional[str] = None
    MANUAL_GEN_DB_PASSWORD: Optional[str] = None
    MANUAL_GEN_DB_HOST: Optional[str] = None
    MANUAL_GEN_DB_PORT: Optional[int] = None
    MANUAL_GEN_DB_NAME: Optional[str] = None
    MANUAL_GEN_DB_URL: Optional[str] = None
    MANUAL_GEN_DB_URI: Optional[str] = None

    # AssemblyAI settings
    ASSEMBLYAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    # Hugging Face settings
    HUGGING_FACE_TOKEN: Optional[str] = None


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    load_dotenv(override=True)

    # Load config.toml
    with open("morphik.toml", "rb") as f:
        config = tomli.load(f)

    em = "'{missing_value}' needed if '{field}' is set to '{value}'"
    openai_config = {}

    # load api config
    api_config = {
        "HOST": config["api"]["host"],
        "PORT": int(config["api"]["port"]),
        "RELOAD": bool(config["api"]["reload"]),
    }

    # load auth config
    auth_config = {
        "JWT_ALGORITHM": config["auth"]["jwt_algorithm"],
        "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY", "dev-secret-key"),  # Default for dev mode
        "SESSION_SECRET_KEY": os.environ.get("SESSION_SECRET_KEY", "super-secret-dev-session-key"),
        "dev_mode": config["auth"].get("dev_mode", False),
        "dev_entity_type": config["auth"].get("dev_entity_type", "developer"),
        "dev_entity_id": config["auth"].get("dev_entity_id", "dev_user"),
        "dev_permissions": config["auth"].get("dev_permissions", ["read", "write", "admin"]),
    }

    # Only require JWT_SECRET_KEY in non-dev mode
    if not auth_config["dev_mode"] and "JWT_SECRET_KEY" not in os.environ:
        raise ValueError("JWT_SECRET_KEY is required when dev_mode is disabled")
    # Also require SESSION_SECRET_KEY in non-dev mode
    if not auth_config["dev_mode"] and "SESSION_SECRET_KEY" not in os.environ:
        # Or, if we want to be more strict and always require it via ENV:
        # if "SESSION_SECRET_KEY" not in os.environ:
        #     raise ValueError("SESSION_SECRET_KEY environment variable is required.")
        # For now, align with JWT_SECRET_KEY's dev mode leniency.
        pass  # Dev mode has a default, production should use ENV.

    # Load registered models if available
    registered_models = {}
    if "registered_models" in config:
        registered_models = {"REGISTERED_MODELS": config["registered_models"]}

    # load completion config
    completion_config = {
        "COMPLETION_PROVIDER": "litellm",
    }

    # Set the model key for LiteLLM
    if "model" not in config["completion"]:
        raise ValueError("'model' is required in the completion configuration")
    completion_config["COMPLETION_MODEL"] = config["completion"]["model"]

    # load agent config
    agent_config = {"AGENT_MODEL": config["agent"]["model"]}
    if "model" not in config["agent"]:
        raise ValueError("'model' is required in the agent configuration")

    # load database config
    database_config = {
        "DATABASE_PROVIDER": config["database"]["provider"],
        "DATABASE_NAME": config["database"].get("name", None),
        # Add database connection pool settings
        "DB_POOL_SIZE": config["database"].get("pool_size", 20),
        "DB_MAX_OVERFLOW": config["database"].get("max_overflow", 30),
        "DB_POOL_RECYCLE": config["database"].get("pool_recycle", 3600),
        "DB_POOL_TIMEOUT": config["database"].get("pool_timeout", 10),
        "DB_POOL_PRE_PING": config["database"].get("pool_pre_ping", True),
        "DB_MAX_RETRIES": config["database"].get("max_retries", 3),
        "DB_RETRY_DELAY": config["database"].get("retry_delay", 1.0),
    }
    if database_config["DATABASE_PROVIDER"] != "postgres":
        prov = database_config["DATABASE_PROVIDER"]
        raise ValueError(f"Unknown database provider selected: '{prov}'")

    if "POSTGRES_URI" in os.environ:
        database_config.update({"POSTGRES_URI": os.environ["POSTGRES_URI"]})
    else:
        msg = em.format(missing_value="POSTGRES_URI", field="database.provider", value="postgres")
        raise ValueError(msg)

    # load embedding config
    embedding_config = {
        "EMBEDDING_PROVIDER": "litellm",
        "VECTOR_DIMENSIONS": config["embedding"]["dimensions"],
        "EMBEDDING_SIMILARITY_METRIC": config["embedding"]["similarity_metric"],
    }

    # Set the model key for LiteLLM
    if "model" not in config["embedding"]:
        raise ValueError("'model' is required in the embedding configuration")
    embedding_config["EMBEDDING_MODEL"] = config["embedding"]["model"]

    # load parser config
    parser_config = {
        "CHUNK_SIZE": config["parser"]["chunk_size"],
        "CHUNK_OVERLAP": config["parser"]["chunk_overlap"],
        "USE_UNSTRUCTURED_API": config["parser"]["use_unstructured_api"],
        "USE_CONTEXTUAL_CHUNKING": config["parser"].get("use_contextual_chunking", False),
    }
    if parser_config["USE_UNSTRUCTURED_API"] and "UNSTRUCTURED_API_KEY" not in os.environ:
        msg = em.format(missing_value="UNSTRUCTURED_API_KEY", field="parser.use_unstructured_api", value="true")
        raise ValueError(msg)
    elif parser_config["USE_UNSTRUCTURED_API"]:
        parser_config.update({"UNSTRUCTURED_API_KEY": os.environ["UNSTRUCTURED_API_KEY"]})

    # load reranker config
    reranker_config = {"USE_RERANKING": config["reranker"]["use_reranker"]}
    if reranker_config["USE_RERANKING"]:
        reranker_config.update(
            {
                "RERANKER_PROVIDER": config["reranker"]["provider"],
                "RERANKER_MODEL": config["reranker"]["model_name"],
                "RERANKER_QUERY_MAX_LENGTH": config["reranker"]["query_max_length"],
                "RERANKER_PASSAGE_MAX_LENGTH": config["reranker"]["passage_max_length"],
                "RERANKER_USE_FP16": config["reranker"]["use_fp16"],
                "RERANKER_DEVICE": config["reranker"]["device"],
            }
        )

    # load storage config
    storage_config = {
        "STORAGE_PROVIDER": config["storage"]["provider"],
        "STORAGE_PATH": config["storage"]["storage_path"],
    }
    match storage_config["STORAGE_PROVIDER"]:
        case "local":
            storage_config.update({"STORAGE_PATH": config["storage"]["storage_path"]})
        case "aws-s3" if all(key in os.environ for key in ["AWS_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]):
            storage_config.update(
                {
                    "AWS_REGION": config["storage"]["region"],
                    "S3_BUCKET": config["storage"]["bucket_name"],
                    "AWS_ACCESS_KEY": os.environ["AWS_ACCESS_KEY"],
                    "AWS_SECRET_ACCESS_KEY": os.environ["AWS_SECRET_ACCESS_KEY"],
                }
            )
        case "aws-s3":
            msg = em.format(missing_value="AWS credentials", field="storage.provider", value="aws-s3")
            raise ValueError(msg)
        case _:
            prov = storage_config["STORAGE_PROVIDER"]
            raise ValueError(f"Unknown storage provider selected: '{prov}'")

    # load vector store config
    vector_store_config = {"VECTOR_STORE_PROVIDER": config["vector_store"]["provider"]}
    if vector_store_config["VECTOR_STORE_PROVIDER"] != "pgvector":
        prov = vector_store_config["VECTOR_STORE_PROVIDER"]
        raise ValueError(f"Unknown vector store provider selected: '{prov}'")

    if "POSTGRES_URI" not in os.environ:
        msg = em.format(missing_value="POSTGRES_URI", field="vector_store.provider", value="pgvector")
        raise ValueError(msg)

    # load rules config
    rules_config = {
        "RULES_PROVIDER": "litellm",
        "RULES_BATCH_SIZE": config["rules"]["batch_size"],
    }

    # Set the model key for LiteLLM
    if "model" not in config["rules"]:
        raise ValueError("'model' is required in the rules configuration")
    rules_config["RULES_MODEL"] = config["rules"]["model"]

    # load document analysis config
    document_analysis_config = {}
    if "document_analysis" in config and "model" in config["document_analysis"]:
        document_analysis_config["DOCUMENT_ANALYSIS_MODEL"] = config["document_analysis"]["model"]

    # load parser config
    parser_config = {
        "CHUNK_SIZE": config["parser"]["chunk_size"],
        "CHUNK_OVERLAP": config["parser"]["chunk_overlap"],
        "USE_UNSTRUCTURED_API": config["parser"]["use_unstructured_api"],
        "USE_CONTEXTUAL_CHUNKING": config["parser"]["use_contextual_chunking"],
    }

    # load reranker config
    reranker_config = {}
    if "reranker" in config:
        reranker_config = {
            "USE_RERANKING": config["reranker"].get("use_reranker", False),
            "RERANKER_PROVIDER": config["reranker"].get("provider"),
            "RERANKER_MODEL": config["reranker"].get("model_name"),
            "RERANKER_QUERY_MAX_LENGTH": config["reranker"].get("query_max_length"),
            "RERANKER_PASSAGE_MAX_LENGTH": config["reranker"].get("passage_max_length"),
            "RERANKER_USE_FP16": config["reranker"].get("use_fp16"),
            "RERANKER_DEVICE": config["reranker"].get("device"),
        }

    # load graph config
    graph_config = {}
    if "graph" in config:
        graph_config = {
            "GRAPH_PROVIDER": "litellm",
            "ENABLE_ENTITY_RESOLUTION": config["graph"].get("enable_entity_resolution", True),
        }
        if "model" in config["graph"]:
            graph_config["GRAPH_MODEL"] = config["graph"]["model"]

    # load morphik config
    morphik_config = {
        "ENABLE_COLPALI": config["morphik"]["enable_colpali"],
        "COLPALI_MODE": config["morphik"]["colpali_mode"],
        "MODE": config["morphik"]["mode"],
        "MORPHIK_EMBEDDING_API_DOMAIN": config["morphik"]["morphik_embedding_api_domain"],
    }

    # load redis config
    redis_config = {
        "REDIS_HOST": config["redis"]["host"],
        "REDIS_PORT": config["redis"]["port"],
        "REDIS_DB": 0,
    }

    # load telemetry config
    telemetry_config = {}
    if "telemetry" in config:
        telemetry_config = {
            "TELEMETRY_ENABLED": config["telemetry"].get("enabled", True),
            "HONEYCOMB_ENABLED": config["telemetry"].get("honeycomb_enabled", True),
            "HONEYCOMB_ENDPOINT": config["telemetry"].get("honeycomb_endpoint", "https://api.honeycomb.io"),
            "HONEYCOMB_PROXY_ENDPOINT": config["telemetry"].get("honeycomb_proxy_endpoint"),
            "SERVICE_NAME": config["telemetry"].get("service_name", "morphik-core"),
            "OTLP_TIMEOUT": config["telemetry"].get("otlp_timeout", 10),
            "OTLP_MAX_RETRIES": config["telemetry"].get("otlp_max_retries", 3),
            "OTLP_RETRY_DELAY": config["telemetry"].get("otlp_retry_delay", 1),
            "OTLP_MAX_EXPORT_BATCH_SIZE": config["telemetry"].get("otlp_max_export_batch_size", 512),
            "OTLP_SCHEDULE_DELAY_MILLIS": config["telemetry"].get("otlp_schedule_delay_millis", 5000),
            "OTLP_MAX_QUEUE_SIZE": config["telemetry"].get("otlp_max_queue_size", 2048),
        }

    # load manual generation config
    manual_gen_config = {}
    if "manual_generation" in config:
        manual_gen_config = {
            "COLPALI_MODEL_NAME": config["manual_generation"].get("colpali_model_name"),
            "MANUAL_MODEL_NAME": config["manual_generation"].get("manual_model_name"),
            "MANUAL_GENERATION_IMAGE_FOLDER": config["manual_generation"].get("image_folder"),
            "MANUAL_GENERATION_MAX_NEW_TOKENS": config["manual_generation"].get("max_new_tokens", 1024),
            "MANUAL_GENERATION_TEMPERATURE": config["manual_generation"].get("temperature", 0.7),
            "MANUAL_GENERATION_DO_SAMPLE": config["manual_generation"].get("do_sample", True),
            "MANUAL_GENERATION_TOP_P": config["manual_generation"].get("top_p", 0.9),
        }

    # load manual generation database config from environment
    manual_gen_db_config = {}
    if "MANUAL_GEN_DB_URI" in os.environ:
        manual_gen_db_config["MANUAL_GEN_DB_URI"] = os.environ["MANUAL_GEN_DB_URI"]

    # load huggingface config
    huggingface_config = {
        "HUGGING_FACE_TOKEN": os.getenv("HUGGING_FACE_TOKEN"),
    }

    # load openai config
    openai_config = {
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
        "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        "ASSEMBLYAI_API_KEY": os.getenv("ASSEMBLYAI_API_KEY"),
    }
    rules_config["RULES_MODEL"] = config["rules"]["model"]

    # load morphik config
    morphik_config = {
        "ENABLE_COLPALI": config["morphik"]["enable_colpali"],
        "COLPALI_MODE": config["morphik"].get("colpali_mode", "local"),
        "MODE": config["morphik"].get("mode", "cloud"),  # Default to "cloud" mode
        # API domain for core server
        "API_DOMAIN": config["morphik"].get("api_domain", "api.morphik.ai"),
        # Domain for Morphik embedding API
        "MORPHIK_EMBEDDING_API_DOMAIN": config["morphik"].get(
            "morphik_embedding_api_domain", config["morphik"].get("api_domain", "api.morphik.ai")
        ),
    }

    # load redis config
    redis_config = {}
    if "redis" in config:
        redis_config = {
            "REDIS_HOST": config["redis"].get("host", "localhost"),
            "REDIS_PORT": int(config["redis"].get("port", 6379)),
        }

    # load graph config
    graph_config = {
        "GRAPH_PROVIDER": "litellm",
        "ENABLE_ENTITY_RESOLUTION": config["graph"].get("enable_entity_resolution", True),
    }

    # Set the model key for LiteLLM
    if "model" not in config["graph"]:
        raise ValueError("'model' is required in the graph configuration")
    graph_config["GRAPH_MODEL"] = config["graph"]["model"]

    # load document analysis config
    document_analysis_config = {}
    if "document_analysis" in config:
        document_analysis_config = {"DOCUMENT_ANALYSIS_MODEL": config["document_analysis"]["model"]}

    # load telemetry config
    telemetry_config = {}
    if "telemetry" in config:
        telemetry_config = {
            "TELEMETRY_ENABLED": config["telemetry"].get("enabled", True),
            "HONEYCOMB_ENABLED": config["telemetry"].get("honeycomb_enabled", True),
            "HONEYCOMB_ENDPOINT": config["telemetry"].get("honeycomb_endpoint", "https://api.honeycomb.io"),
            "SERVICE_NAME": config["telemetry"].get("service_name", "morphik-core"),
            "OTLP_TIMEOUT": config["telemetry"].get("otlp_timeout", 10),
            "OTLP_MAX_RETRIES": config["telemetry"].get("otlp_max_retries", 3),
            "OTLP_RETRY_DELAY": config["telemetry"].get("otlp_retry_delay", 1),
            "OTLP_MAX_EXPORT_BATCH_SIZE": config["telemetry"].get("otlp_max_export_batch_size", 512),
            "OTLP_SCHEDULE_DELAY_MILLIS": config["telemetry"].get("otlp_schedule_delay_millis", 5000),
            "OTLP_MAX_QUEUE_SIZE": config["telemetry"].get("otlp_max_queue_size", 2048),
        }

    # load manual generation config
    manual_gen_config = {
        "COLPALI_MODEL_NAME": config["manual_generation"]["colpali_model_name"],
        "MANUAL_MODEL_NAME": config["manual_generation"]["manual_model_name"],
        "MANUAL_GENERATION_IMAGE_FOLDER": config["manual_generation"].get("image_folder"),
        "MANUAL_GENERATION_MAX_NEW_TOKENS": config["manual_generation"].get("max_new_tokens", 1024),
        "MANUAL_GENERATION_TEMPERATURE": config["manual_generation"].get("temperature", 0.7),
        "MANUAL_GENERATION_DO_SAMPLE": config["manual_generation"].get("do_sample", True),
        "MANUAL_GENERATION_TOP_P": config["manual_generation"].get("top_p", 0.9),
    }

    # load manual generation database config
    manual_gen_db_config = {
        "MANUAL_GEN_DB_USER": os.getenv("MANUAL_GEN_DB_USER"),
        "MANUAL_GEN_DB_PASSWORD": os.getenv("MANUAL_GEN_DB_PASSWORD"),
        "MANUAL_GEN_DB_HOST": os.getenv("MANUAL_GEN_DB_HOST"),
        "MANUAL_GEN_DB_PORT": os.getenv("MANUAL_GEN_DB_PORT"),
        "MANUAL_GEN_DB_NAME": os.getenv("MANUAL_GEN_DB_NAME"),
        "MANUAL_GEN_DB_URL": os.getenv("MANUAL_GEN_DB_URL"),
        "MANUAL_GEN_DB_URI": os.getenv("MANUAL_GEN_DB_URI"),
    }

    # Hugging Face configuration
    huggingface_config = {
        "HUGGING_FACE_TOKEN": os.getenv("HUGGING_FACE_TOKEN"),
    }

    # Ensure HUGGING_FACE_TOKEN is loaded from environment if not already handled
    if "HUGGING_FACE_TOKEN" not in os.environ:
        raise ValueError("HUGGING_FACE_TOKEN environment variable is required.")

    settings_map = ChainMap(
        os.environ,  # Highest priority
        api_config,
        auth_config,
        registered_models, # Ensure REGISTERED_MODELS is explicitly passed
        completion_config,
        agent_config,
        document_analysis_config,
        database_config,
        embedding_config,
        parser_config,
        rules_config,
        graph_config,
        reranker_config,
        storage_config,
        vector_store_config,
        morphik_config,
        redis_config,
        telemetry_config,
        manual_gen_config,
        manual_gen_db_config,
        huggingface_config,
        openai_config
    )

    raw_settings_dict = dict(settings_map)
    
    # Filter the raw settings to only include fields defined in the Settings model
    valid_field_names = Settings.model_fields.keys()
    final_settings_kwargs = {key: value for key, value in raw_settings_dict.items() if key in valid_field_names}
    
    # Debug: Print which expected keys are missing from final_settings_kwargs
    # for field_name in valid_field_names:
    #     if field_name not in final_settings_kwargs:
    #         print(f"DEBUG: Expected field '{field_name}' is MISSING from final_settings_kwargs before Settings instantiation.")
            
    # Debug: Print a sample of what's being passed
    # print("DEBUG: final_settings_kwargs to be passed to Settings:", {k: v for i, (k, v) in enumerate(final_settings_kwargs.items()) if i < 5})


    return Settings(**final_settings_kwargs)
