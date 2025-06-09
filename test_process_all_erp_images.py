#!/usr/bin/env python3
"""
Test script to process ALL ERP images without max_images limitation
"""

import asyncio
import sys
import os
import time
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, '/root/.ipython/aaaaaaaaaaa')

async def test_process_all_erp_images():
    """Test processing all ERP images without max_images limitation"""
    
    try:
        # Import required modules
        from core.embedding.manual_generation_embedding_model import ManualGenerationEmbeddingModel
        from core.config import get_settings
        
        settings = get_settings()
        print(f"Testing manual generation image processing...")
        print(f"Image folder: {settings.MANUAL_GENERATION_IMAGE_FOLDER}")
        
        # Check if folder exists and count images
        image_folder = Path(settings.MANUAL_GENERATION_IMAGE_FOLDER)
        if not image_folder.exists():
            print(f"❌ Image folder does not exist: {image_folder}")
            return False
            
        # Count all image files
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff')
        image_files = []
        
        for root, dirs, files in os.walk(image_folder):
            for file in files:
                if file.lower().endswith(image_extensions):
                    full_path = os.path.join(root, file)
                    relative_path = os.path.relpath(full_path, image_folder)
                    image_files.append((full_path, relative_path))
        
        total_images = len(image_files)
        print(f"📸 Found {total_images} total images in folder")
        
        if total_images == 0:
            print("❌ No images found in folder")
            return False
        
        # Initialize embedding model
        print("🔧 Initializing embedding model...")
        embedding_model = ManualGenerationEmbeddingModel()
        
        # Test database connection
        print("🔗 Testing database connection...")
        db_session = embedding_model.get_manual_gen_db_session()
        if not db_session:
            print("❌ Failed to connect to manual_db database")
            return False
        
        # Check how many images are already processed
        from core.models.manual_generation_document import ManualGenDocument
        existing_count = db_session.query(ManualGenDocument).count()
        db_session.close()
        
        print(f"📊 Currently {existing_count} images already processed in database")
        
        # Process images with force_reprocess=False (only new ones)
        print(f"🚀 Starting to process {total_images - existing_count} new images...")
        start_time = time.time()
        
        processed_count = 0
        skipped_count = 0
        error_count = 0
        
        # Process in smaller batches to avoid memory issues
        batch_size = 5
        
        for i in range(0, len(image_files), batch_size):
            batch = image_files[i:i + batch_size]
            batch_num = i//batch_size + 1
            total_batches = (len(image_files) + batch_size - 1)//batch_size
            
            print(f"📦 Processing batch {batch_num}/{total_batches} ({len(batch)} images)")
            
            for full_path, relative_path in batch:
                try:
                    # Check if already processed
                    db_session = embedding_model.get_manual_gen_db_session()
                    if db_session:
                        existing = db_session.query(ManualGenDocument).filter_by(image_path=relative_path).first()
                        db_session.close()
                        if existing:
                            skipped_count += 1
                            print(f"  ⏭️  Skipping already processed: {relative_path}")
                            continue
                    
                    print(f"  🔄 Processing: {relative_path}")
                    
                    # Extract metadata from image path using rules-like logic
                    from core.routers.manual_generation_router import _extract_metadata_from_path, _generate_embedding_text
                    metadata = await _extract_metadata_from_path(relative_path, full_path)
                    
                    # Generate embedding text for ColPali
                    embedding_text = _generate_embedding_text(metadata, relative_path)
                    
                    # Store the image metadata and embedding
                    success = await embedding_model.store_image_metadata(
                        image_path=relative_path,
                        prompt=metadata.get('prompt'),
                        respuesta=metadata.get('respuesta'),
                        embedding_text=embedding_text,
                        module=metadata.get('module'),
                        section=metadata.get('section'),
                        subsection=metadata.get('subsection'),
                        function_detected=metadata.get('function_detected'),
                        hierarchy_level=metadata.get('hierarchy_level'),
                        keywords=metadata.get('keywords'),
                        additional_metadata=metadata.get('additional_metadata'),
                        force_reprocess=False
                    )
                    
                    if success:
                        processed_count += 1
                        print(f"  ✅ Successfully processed: {relative_path}")
                    else:
                        error_count += 1
                        print(f"  ❌ Failed to process: {relative_path}")
                        
                except Exception as e:
                    error_count += 1
                    print(f"  ❌ Error processing {relative_path}: {str(e)}")
            
            # Progress update
            total_handled = processed_count + skipped_count + error_count
            progress = (total_handled / total_images) * 100
            print(f"📈 Progress: {progress:.1f}% ({total_handled}/{total_images})")
        
        processing_time = time.time() - start_time
        
        print(f"\n🎯 Processing Complete!")
        print(f"📊 Results:")
        print(f"  • Total images found: {total_images}")
        print(f"  • Images processed: {processed_count}")
        print(f"  • Images skipped: {skipped_count}")
        print(f"  • Errors: {error_count}")
        print(f"  • Processing time: {processing_time:.2f} seconds")
        
        # Final database count
        db_session = embedding_model.get_manual_gen_db_session()
        if db_session:
            final_count = db_session.query(ManualGenDocument).count()
            db_session.close()
            print(f"  • Total images in database: {final_count}")
        
        return processed_count > 0 or skipped_count > 0
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 Testing ERP Image Processing - ALL IMAGES")
    print("=" * 50)
    
    result = asyncio.run(test_process_all_erp_images())
    
    if result:
        print("\n✅ Test completed successfully!")
    else:
        print("\n❌ Test failed!")
    
    print("=" * 50)
