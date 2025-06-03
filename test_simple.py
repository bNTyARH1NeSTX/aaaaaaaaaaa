#!/usr/bin/env python3
import sys
import os
sys.path.append('.')

print("Testing basic imports...")

try:
    from core.config import get_settings
    print("✅ Config imported")
    
    settings = get_settings()
    print("✅ Settings loaded")
    
    # Test ERP rule structural metadata only (no AI)
    from core.rules.erp_metadata_extraction_rule import ERPMetadataExtractionRule
    print("✅ ERP rule imported")
    
    # Create rule instance
    rule = ERPMetadataExtractionRule()
    print(f"✅ Rule created: {rule.name}")
    
    # Test structural metadata extraction
    test_path = "/root/.ipython/ERP_screenshots/pantalla principal/Pantalla principal.png"
    structural_metadata = rule._extract_structural_metadata(test_path)
    
    print("\n📊 Structural metadata:")
    for key, value in structural_metadata.items():
        print(f"  {key}: {value}")
    
    print("\n✅ Test completed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
