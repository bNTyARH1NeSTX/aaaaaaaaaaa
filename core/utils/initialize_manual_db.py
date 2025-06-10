#!/usr/bin/env python3
"""
Initialize Manual Generation Vector Database

This script ensures the manual generation vector database is populated with ERP images.
It can be run manually or is automatically called when the database is found to be empty.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from core.config import get_settings
from core.embedding.manual_generation_embedding_model import ManualGenerationEmbeddingModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def initialize_manual_db(force_reprocess: bool = False):
    """
    Initialize the manual generation database with ERP images.
    
    Args:
        force_reprocess: If True, reprocess all images even if they already exist
    """
    try:
        settings = get_settings()
        logger.info("🚀 Initializing Manual Generation Vector Database")
        logger.info(f"📁 ERP Images Folder: {settings.COLPALI_MODEL_NAME}")
        logger.info(f"🗄️ Database: {settings.MANUAL_GEN_DB_URI.split('@')[-1] if settings.MANUAL_GEN_DB_URI else 'Not configured'}")
        
        # Check if ERP images folder exists
        if not settings.MANUAL_GENERATION_IMAGE_FOLDER or not os.path.isdir(settings.MANUAL_GENERATION_IMAGE_FOLDER):
            logger.error(f"❌ ERP images folder not found: {settings.MANUAL_GENERATION_IMAGE_FOLDER}")
            return False
        
        # Count available images
        image_folder = Path(settings.MANUAL_GENERATION_IMAGE_FOLDER)
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff')
        image_files = []
        
        for root, dirs, files in os.walk(image_folder):
            for file in files:
                if file.lower().endswith(image_extensions):
                    image_files.append(os.path.join(root, file))
        
        total_images = len(image_files)
        logger.info(f"📸 Found {total_images} ERP images to process")
        
        if total_images == 0:
            logger.warning("❌ No images found in ERP folder")
            return False
        
        # Initialize embedding model
        logger.info("🔧 Initializing ManualGenerationEmbeddingModel...")
        embedding_model = ManualGenerationEmbeddingModel(settings)
        
        # Check current database state
        db_session = embedding_model.get_manual_gen_db_session()
        if not db_session:
            logger.error("❌ Failed to connect to manual_db database")
            return False
        
        from core.models.manual_generation_document import ManualGenDocument
        existing_count = db_session.query(ManualGenDocument).count()
        db_session.close()
        
        logger.info(f"📊 Current database state: {existing_count} images already processed")
        
        if existing_count > 0 and not force_reprocess:
            logger.info("✅ Database already initialized. Use force_reprocess=True to reprocess all images.")
            return True
        
        # Process all images
        if force_reprocess and existing_count > 0:
            logger.info("🔄 Force reprocessing enabled - will update existing entries")
        
        logger.info("🚀 Starting image processing...")
        success = await embedding_model._auto_process_erp_images()
        
        if success:
            # Check final count
            db_session = embedding_model.get_manual_gen_db_session()
            if db_session:
                final_count = db_session.query(ManualGenDocument).count()
                db_session.close()
                
                logger.info(f"🎯 Initialization completed successfully!")
                logger.info(f"📊 Final database state: {final_count} images in database")
                logger.info("✅ Manual generation is now ready to use")
                return True
        
        logger.error("❌ Initialization failed")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error during initialization: {e}")
        import traceback
        traceback.print_exc()
        return False

async def check_database_status():
    """Check the current status of the manual generation database"""
    try:
        settings = get_settings()
        embedding_model = ManualGenerationEmbeddingModel(settings)
        
        db_session = embedding_model.get_manual_gen_db_session()
        if not db_session:
            print("❌ Cannot connect to manual_db database")
            return
        
        from core.models.manual_generation_document import ManualGenDocument
        total_count = db_session.query(ManualGenDocument).count()
        
        if total_count == 0:
            print("📊 Database Status: Empty (no images processed)")
            print("💡 Run with --initialize to populate the database")
        else:
            print(f"📊 Database Status: {total_count} images processed")
            print("✅ Database ready for manual generation")
        
        db_session.close()
        
    except Exception as e:
        print(f"❌ Error checking database status: {e}")

def main():
    """Main function for command line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize Manual Generation Vector Database")
    parser.add_argument("--initialize", action="store_true", help="Initialize the database with ERP images")
    parser.add_argument("--force", action="store_true", help="Force reprocessing of all images")
    parser.add_argument("--status", action="store_true", help="Check database status")
    
    args = parser.parse_args()
    
    if args.status:
        asyncio.run(check_database_status())
    elif args.initialize:
        success = asyncio.run(initialize_manual_db(force_reprocess=args.force))
        if success:
            print("\n🎉 Manual generation database initialized successfully!")
            print("You can now use the manual generation endpoints.")
        else:
            print("\n❌ Failed to initialize database. Check the logs for details.")
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
