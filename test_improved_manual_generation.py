#!/usr/bin/env python3
"""
Test script for improved manual generation with images
"""
import requests
import json
import time

# Configuration
BASE_URL = "https://747thwn3jfxuv7-8000.proxy.runpod.net"

def test_improved_manual_generation():
    """Test the improved manual generation with base64 images"""
    
    print("🚀 Testing improved manual generation with images...")
    
    payload = {
        "query": "como agregar impresoras en el sistema ERP",
        "k_images": 3
    }
    
    try:
        print(f"📤 Sending request to {BASE_URL}/manuals/generate_manual")
        print(f"📋 Payload: {json.dumps(payload, indent=2)}")
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/manuals/generate_manual",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"⏱️ Request took {elapsed_time:.2f} seconds")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Manual generation successful!")
            print(f"  📝 Manual length: {len(result.get('generated_text', ''))}")
            print(f"  🖼️ Images used: {len(result.get('relevant_images_used', []))}")
            print(f"  📋 Query: {result.get('query', '')}")
            print(f"  🔢 Base64 images: {len(result.get('images_base64', {}))}")
            
            # Check if manual contains IMAGE_PATH references
            manual_text = result.get('generated_text', '')
            image_refs = manual_text.count('IMAGE_PATH:')
            print(f"  🔗 Image references in manual: {image_refs}")
            
            # Show first few lines of manual
            manual_lines = manual_text.split('\n')[:5]
            print(f"  📄 Manual preview:")
            for i, line in enumerate(manual_lines, 1):
                print(f"     {i}: {line[:80]}{'...' if len(line) > 80 else ''}")
            
            # Show image paths
            if result.get('images_base64'):
                print(f"  🖼️ Base64 images available:")
                for img_path in result.get('images_base64', {}):
                    print(f"     - {img_path}")
                    
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ Request timed out")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_powerpoint_generation():
    """Test PowerPoint generation with base64 images"""
    
    print("\n🎯 Testing PowerPoint generation with images...")
    
    payload = {
        "query": "como agregar impresoras en el sistema ERP",
        "k_images": 3
    }
    
    try:
        print(f"📤 Sending request to {BASE_URL}/manuals/generate_powerpoint")
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/manuals/generate_powerpoint",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=180  # 3 minutes for PowerPoint generation
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"⏱️ Request took {elapsed_time:.2f} seconds")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # Save the PowerPoint file
            filename = f"test_manual_{int(time.time())}.pptx"
            with open(filename, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ PowerPoint generated successfully!")
            print(f"  📁 Saved as: {filename}")
            print(f"  📏 File size: {len(response.content)} bytes")
            
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ PowerPoint generation timed out")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    # Test improved manual generation
    test_improved_manual_generation()
    
    # Wait a moment
    print("\n⏳ Waiting 3 seconds before testing PowerPoint...")
    time.sleep(3)
    
    # Test PowerPoint generation
    test_powerpoint_generation()
    
    print("\n🎉 Test completed!")
