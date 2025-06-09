#!/usr/bin/env python3
"""
Script to fix the manual generation database dimensions
Drops the existing table and recreates it with correct ColPali dimensions (128)
"""
import psycopg2
from sqlalchemy.engine.url import make_url
from core.config import get_settings

def fix_manual_db_dimensions():
    """Fix the database table to use correct ColPali dimensions (128 instead of 1536)"""
    
    settings = get_settings()
    
    # Use the manual generation database URI
    db_uri = settings.MANUAL_GEN_DB_URI
    if not db_uri:
        print("❌ MANUAL_GEN_DB_URI not configured in .env")
        print("💡 Make sure you have: MANUAL_GEN_DB_URI=\"postgresql+psycopg2://manual_user:manual_password@localhost:5432/manual_db\"")
        return
    
    # Convert SQLAlchemy URI to psycopg2 format
    try:
        url = make_url(db_uri)
        psycopg2_conn_str = f"host={url.host} port={url.port} dbname={url.database} user={url.username} password={url.password}"
        print(f"🔧 Connecting to database: {url.host}:{url.port}/{url.database}")
    except Exception as e:
        print(f"❌ Error parsing database URI: {e}")
        return
    
    try:
        conn = psycopg2.connect(psycopg2_conn_str)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("📊 Checking current table structure...")
        
        # Check if table exists and get its structure
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'manual_gen_documents' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        if columns:
            print("✅ Table 'manual_gen_documents' exists with columns:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]}")
        else:
            print("❌ Table 'manual_gen_documents' does not exist")
            return
        
        # Check current vector dimension
        cursor.execute("""
            SELECT pg_type.typname, pg_type.typlen
            FROM pg_attribute 
            JOIN pg_type ON pg_attribute.atttypid = pg_type.oid
            WHERE pg_attribute.attrelid = 'manual_gen_documents'::regclass 
            AND pg_attribute.attname = 'embedding'
        """)
        
        embedding_info = cursor.fetchone()
        if embedding_info:
            print(f"📏 Current embedding column type: {embedding_info}")
        
        print("\n⚠️  Dropping existing table and recreating with correct dimensions...")
        
        # Drop the table
        cursor.execute("DROP TABLE IF EXISTS manual_gen_documents CASCADE;")
        print("🗑️  Dropped existing table")
        
        # Recreate the table with correct dimensions (128 for ColPali)
        create_table_sql = """
        CREATE TABLE manual_gen_documents (
            id SERIAL PRIMARY KEY,
            image_path VARCHAR UNIQUE NOT NULL,
            prompt TEXT,
            respuesta TEXT,
            embedding vector(128),  -- ColPali specific dimension
            module VARCHAR,
            section VARCHAR,
            subsection VARCHAR,
            function_detected VARCHAR,
            hierarchy_level INTEGER,
            keywords JSONB,
            additional_metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        cursor.execute(create_table_sql)
        print("✅ Created new table with 128 dimensions")
        
        # Create index for image_path
        cursor.execute("CREATE INDEX idx_manual_gen_image_path ON manual_gen_documents(image_path);")
        print("📁 Created image_path index")
        
        # Create HNSW vector index
        try:
            cursor.execute("""
                CREATE INDEX idx_manual_gen_embedding_hnsw 
                ON manual_gen_documents 
                USING hnsw (embedding vector_cosine_ops) 
                WITH (m = 16, ef_construction = 64);
            """)
            print("🔍 Created HNSW vector index")
        except Exception as e:
            print(f"⚠️  Could not create HNSW index (continuing anyway): {e}")
            # Create a simple btree index as fallback
            cursor.execute("CREATE INDEX idx_manual_gen_simple ON manual_gen_documents(id);")
            print("📝 Created simple fallback index")
        
        # Create trigger for updated_at
        cursor.execute("""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        """)
        
        cursor.execute("""
            CREATE TRIGGER update_manual_gen_documents_updated_at 
            BEFORE UPDATE ON manual_gen_documents 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """)
        print("⏰ Created updated_at trigger")
        
        # Verify the new table structure
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'manual_gen_documents' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        
        new_columns = cursor.fetchall()
        print("\n✅ New table structure:")
        for col in new_columns:
            print(f"  - {col[0]}: {col[1]}")
        
        print("\n🎉 Database fixed successfully!")
        print("💡 The table now uses 128 dimensions for ColPali embeddings")
        
    except Exception as e:
        print(f"❌ Error fixing database: {e}")
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("🚀 Starting manual generation database fix...")
    fix_manual_db_dimensions()
    print("✅ Database fix completed!")
