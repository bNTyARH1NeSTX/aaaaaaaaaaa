#!/usr/bin/env python3
"""
Test script to check AI generation of questions and answers for ERP images
"""

import sys
import json
import asyncio
from pathlib import Path

# Add the root directory to the path
sys.path.append(str(Path(__file__).parent))

from utils.process_erp_images import ERPImageProcessor

async def test_single_image():
    """Test processing a single image with AI questions generation"""
    
    # Pick a simple image to test
    test_image = "/root/.ipython/aaaaaaaaaaa/ERP_screenshots/pantalla principal/Pantalla principal.png"
    
    if not Path(test_image).exists():
        print("Test image not found!")
        return
    
    # Create processor
    processor = ERPImageProcessor("/root/.ipython/aaaaaaaaaaa/ERP_screenshots")
    
    # Test AI analysis on single image
    print("Testing AI analysis on single image...")
    ai_metadata = await processor._analyze_image_with_ai(Path(test_image))
    
    print("AI Metadata result:")
    print(json.dumps(ai_metadata, indent=2, ensure_ascii=False))
    
    # Test structural analysis
    relative_path = Path(test_image).relative_to(Path("/root/.ipython/aaaaaaaaaaa/ERP_screenshots"))
    structural_context = processor.extract_context_from_path(str(relative_path))
    
    print("\nStructural context:")
    print(json.dumps(structural_context, indent=2, ensure_ascii=False))
    
    # Test merged metadata
    merged = processor._merge_metadata(structural_context, ai_metadata)
    
    print("\nMerged metadata with questions:")
    print(json.dumps(merged, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(test_single_image())
