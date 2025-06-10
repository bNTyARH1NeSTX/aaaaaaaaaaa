#!/usr/bin/env python3
"""
Script to process ERP images and create vector embeddings for manual generation.
This script will populate the vector database with image embeddings so that 
manual generation can find relevant images.
"""

import os
import asyncio
import requests
import json
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"  # Change this to your server URL
PROCESS_ENDPOINT = "/manuals/process_all_erp_images"

def check_server_status():
    """Check if the server is running"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def process_erp_images():
    """Process all ERP images to create vector embeddings"""
    print("🚀 Starting ERP image processing for vector database...")
    
    # Check if server is running
    if not check_server_status():
        print(f"❌ Server is not running at {BASE_URL}")
        print("Please start the server first with: python start_server.py")
        return False
    
    try:
        print(f"📤 Sending request to process all ERP images...")
        
        # Make request to process all images
        response = requests.post(
            f"{BASE_URL}{PROCESS_ENDPOINT}",
            params={"force_reprocess": True},  # Force reprocessing to ensure all images are processed
            headers={"Content-Type": "application/json"},
            timeout=600  # 10 minutes timeout for large image processing
        )
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Image processing completed successfully!")
            
            # Print summary
            summary = result.get("summary", {})
            print(f"📈 Processing Summary:")
            print(f"  • Total images: {summary.get('total_images', 0)}")
            print(f"  • Successfully processed: {summary.get('processed_successfully', 0)}")
            print(f"  • Failed: {summary.get('failed', 0)}")
            print(f"  • Skipped: {summary.get('skipped', 0)}")
            
            # Show some results
            results = result.get("results", [])
            if results:
                print(f"\n📋 Sample Results:")
                for i, res in enumerate(results[:5]):  # Show first 5
                    status = res.get("status", "unknown")
                    image_path = res.get("image_path", "unknown")
                    print(f"  {i+1}. {status}: {Path(image_path).name}")
                
                if len(results) > 5:
                    print(f"  ... and {len(results) - 5} more images")
            
            if summary.get('processed_successfully', 0) > 0:
                print(f"\n🎯 Success! {summary.get('processed_successfully')} images have been processed.")
                print("Now you can use manual generation queries like:")
                print("  • 'como añadir impresoras'")
                print("  • 'acceso a módulos'") 
                print("  • 'pantalla principal'")
                return True
            else:
                print("\n⚠️  No images were successfully processed. Check the logs for errors.")
                return False
                
        elif response.status_code == 422:
            print("❌ Authentication required. Please check your API keys.")
            return False
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out. Image processing might take longer than expected.")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_manual_generation():
    """Test manual generation after processing images"""
    print("\n🧪 Testing manual generation...")
    
    test_query = "como añadir impresoras"
    
    try:
        response = requests.post(
            f"{BASE_URL}/manuals/generate_manual",
            json={
                "query": test_query,
                "k": 3,
                "include_parent_images": True
            },
            timeout=60
        )
        
        if response.status_code == 200:
            print(f"✅ Manual generation test successful for query: '{test_query}'")
            result = response.json()
            print(f"📄 Generated manual preview: {result.get('manual', '')[:200]}...")
            return True
        elif response.status_code == 404:
            print(f"⚠️  No relevant images found for query: '{test_query}'")
            print("This might mean the images weren't processed correctly or the query doesn't match any content.")
            return False
        else:
            print(f"❌ Manual generation test failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Manual generation test error: {e}")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("🔧 ERP Image Vector Database Setup")
    print("=" * 60)
    
    # Check if ERP screenshots directory exists
    erp_dir = Path("/root/.ipython/aaaaaaaaaaa/ERP_screenshots")
    if not erp_dir.exists():
        print(f"❌ ERP screenshots directory not found: {erp_dir}")
        print("Please ensure the ERP_screenshots directory exists and contains images.")
        return
    
    # Count images
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')
    image_files = []
    for ext in image_extensions:
        image_files.extend(erp_dir.rglob(f"*{ext}"))
    
    print(f"📸 Found {len(image_files)} images in ERP_screenshots directory")
    
    if len(image_files) == 0:
        print("❌ No images found in ERP_screenshots directory.")
        return
    
    # Process images
    success = process_erp_images()
    
    if success:
        print("\n⏳ Waiting 3 seconds before testing...")
        import time
        time.sleep(3)
        
        # Test manual generation
        test_manual_generation()
        
        print("\n🎉 Setup completed!")
        print("\nYou can now use manual generation in your application.")
        print("The vector database has been populated with image embeddings.")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
