#!/usr/bin/env python3
"""
Test script for AI Adaptive Entity Extraction functionality
Tests the new adaptive entity type determination in graph_service.py
"""
import asyncio
import json
import logging
import sys
import os
from typing import Dict, Any

# Add the current directory to Python path
sys.path.append('/root/.ipython/aaaaaaaaaaa')

from core.services_init import document_service
from core.models.auth import AuthContext
from core.models.prompts import GraphPromptOverrides

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test documents with different domains
test_documents = {
    "technology": """
    Apple Inc. announced the release of the new iPhone 15 Pro Max, featuring advanced AI capabilities 
    powered by the A17 Pro chip. The device includes enhanced camera technology with computational 
    photography algorithms. Tim Cook, CEO of Apple, stated that this represents a significant leap 
    in smartphone innovation. The phone will be manufactured in China and distributed globally 
    through Apple Stores and authorized retailers.
    """,
    
    "medical": """
    Dr. Sarah Johnson published groundbreaking research on CRISPR gene therapy at Stanford University. 
    The study focuses on treating hereditary diseases using targeted genetic modifications. 
    The research team successfully tested the therapy on patients with sickle cell anemia. 
    The FDA has approved clinical trials for this innovative treatment approach. 
    The therapy could revolutionize treatment for genetic disorders affecting millions worldwide.
    """,
    
    "finance": """
    Goldman Sachs reported strong quarterly earnings driven by investment banking activities. 
    The bank's trading revenue increased by 15% compared to the previous quarter. 
    CEO David Solomon announced plans to expand digital banking services and cryptocurrency 
    trading platforms. The Federal Reserve's interest rate decisions continue to impact 
    mortgage lending and consumer credit markets across major financial institutions.
    """,
    
    "scientific": """
    Researchers at MIT developed a new quantum computing algorithm that demonstrates quantum supremacy 
    in solving optimization problems. The algorithm utilizes superconducting qubits operating at 
    near absolute zero temperatures. The breakthrough could accelerate drug discovery processes 
    and improve artificial intelligence model training. The research was published in Nature Physics 
    and funded by the National Science Foundation.
    """
}

async def test_adaptive_entity_extraction():
    """Test the adaptive entity extraction functionality"""
    print("🧪 Testing AI Adaptive Entity Extraction")
    print("=" * 50)
    
    # Get the graph service from document service
    graph_service = document_service.graph_service
    
    # Create a mock auth context
    from core.models.auth import EntityType
    auth = AuthContext(
        user_id="test_user",
        email="test@example.com",
        entity_type=EntityType.USER,
        entity_id="test_user",
        permissions=["read", "write"]
    )
    
    for domain, content in test_documents.items():
        print(f"\n📄 Testing {domain.upper()} domain:")
        print("-" * 30)
        print(f"Content preview: {content[:100]}...")
        
        try:
            # Test adaptive entity type determination
            print(f"🔍 Determining adaptive entity types for {domain} content...")
            
            adaptive_types = await graph_service._determine_adaptive_entity_types(
                content=content,
                num_types=5
            )
            
            print(f"✅ Adaptive entity types: {adaptive_types}")
            
            # Test full entity extraction with adaptive types
            print(f"🔍 Extracting entities using adaptive types...")
            
            entities, relationships = await graph_service.extract_entities_from_text(
                content=content,
                doc_id="test_doc",
                chunk_number=0
            )
            
            print(f"✅ Extracted {len(entities)} entities:")
            for entity in entities[:3]:  # Show first 3 entities
                print(f"   - {entity.label} ({entity.type})")
            
            if len(entities) > 3:
                print(f"   ... and {len(entities) - 3} more entities")
                
        except Exception as e:
            print(f"❌ Error testing {domain}: {str(e)}")
            logger.error(f"Error in {domain} test", exc_info=True)
    
    print(f"\n🎯 Testing custom prompt overrides (should use hardcoded types)...")
    try:
        # Test with custom prompt overrides (should NOT use adaptive types)
        from core.models.prompts import EntityExtractionExample, EntityExtractionPromptOverride
        
        custom_entity_override = EntityExtractionPromptOverride(
            prompt_template="Extract only PERSON and LOCATION entities from this text: {content}\n\nExamples: {examples}\n\nReturn JSON:",
            examples=[
                EntityExtractionExample(label="John", type="PERSON"),
                EntityExtractionExample(label="New York", type="LOCATION")
            ]
        )
        
        custom_overrides = GraphPromptOverrides(
            entity_extraction=custom_entity_override
        )
        
        entities_custom, relationships_custom = await graph_service.extract_entities_from_text(
            content=test_documents["technology"],
            doc_id="test_doc",
            chunk_number=0,
            prompt_overrides=custom_entity_override
        )
        
        print(f"✅ Custom prompt extraction: {len(entities_custom)} entities")
        for entity in entities_custom[:3]:
            print(f"   - {entity.label} ({entity.type})")
            
    except Exception as e:
        print(f"❌ Error testing custom prompts: {str(e)}")
        logger.error("Error in custom prompt test", exc_info=True)

if __name__ == "__main__":
    asyncio.run(test_adaptive_entity_extraction())
