#!/usr/bin/env python3
"""
Test script to process ERP images and generate embeddings
"""
import requests
import json
import time

# Configuration
BASE_URL = "https://747thwn3jfxuv7-8000.proxy.runpod.net"
ENDPOINT = "/manuals/process_erp_images"

def test_process_erp_images():
    """Test the process_erp_images endpoint"""
    
    print("🚀 Starting ERP image processing test...")
    
    # Request payload
    payload = {
        "folder_path": None,  # Use default from config
        "force_reprocess": True,  # Force reprocessing for testing
        "batch_size": 5  # Process in batches of 5
    }
    
    try:
        print(f"📤 Sending request to {BASE_URL}{ENDPOINT}")
        print(f"📋 Payload: {json.dumps(payload, indent=2)}")
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}{ENDPOINT}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=300  # 5 minutes timeout
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"⏱️ Request took {elapsed_time:.2f} seconds")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success! Processing completed:")
            print(f"  📁 Total images found: {result.get('total_images_found', 0)}")
            print(f"  ✅ Images processed: {result.get('total_images_processed', 0)}")
            print(f"  ⏭️ Images skipped: {result.get('total_images_skipped', 0)}")
            print(f"  ⏱️ Processing time: {result.get('processing_time_seconds', 0):.2f}s")
            print(f"  📊 Status: {result.get('status', 'unknown')}")
            
            if result.get('errors'):
                print(f"  ❌ Errors ({len(result['errors'])}):")
                for error in result['errors'][:5]:  # Show first 5 errors
                    print(f"    - {error}")
                if len(result['errors']) > 5:
                    print(f"    ... and {len(result['errors']) - 5} more errors")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_manual_generation():
    """Test manual generation after processing images"""
    
    print("\n🔍 Testing manual generation...")
    
    payload = {
        "query": "como agregar impresoras",
        "k_images": 3
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/manuals/generate_manual",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120
        )
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Manual generation successful!")
            print(f"  📝 Manual length: {len(result.get('generated_text', ''))}")
            print(f"  🖼️ Images used: {len(result.get('relevant_images_used', []))}")
            print(f"  📋 Query: {result.get('query', '')}")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Manual generation failed: {e}")

if __name__ == "__main__":
    # First process the images
    test_process_erp_images()
    
    # Wait a moment for processing to complete
    print("\n⏳ Waiting 5 seconds before testing manual generation...")
    time.sleep(5)
    
    # Then test manual generation
    test_manual_generation()
    
    print("\n🎉 Test completed!")
