#!/usr/bin/env python3
"""
Test para verificar que el prompt mejorado incluye referencias IMAGE_PATH:
"""

import asyncio
import sys
sys.path.append('/root/.ipython/aaaaaaaaaaa')

from core.routers.manual_generation_router import manual_generation_router
from core.models.request import ManualGenerationRequest
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_improved_prompt():
    print("🧪 Probando el prompt mejorado para incluir referencias IMAGE_PATH:")
    print("=" * 60)
    
    # Test con una consulta específica
    test_query = "como agregar impresoras en el sistema ERP"
    
    request = ManualGenerationRequest(query=test_query)
    
    try:
        # Call the manual generation endpoint
        from fastapi import Request
        from unittest.mock import Mock
        mock_request = Mock(spec=Request)
        
        response = await manual_generation_router.generate_manual(request, mock_request)
        
        print(f"✅ Manual generado exitosamente")
        print(f"📊 Query: {test_query}")
        
        manual_text = response.manual_text if hasattr(response, 'manual_text') else response.get('manual_text', '')
        
        print(f"📄 Longitud del manual: {len(manual_text)} caracteres")
        
        # Check for IMAGE_PATH references
        image_refs = manual_text.count('IMAGE_PATH:')
        print(f"🖼️  Referencias IMAGE_PATH encontradas: {image_refs}")
        
        if image_refs > 0:
            print("✅ ÉXITO: El manual incluye referencias de imagen")
            
            # Show the first few IMAGE_PATH references
            import re
            refs = re.findall(r'!\[[^\]]*\]\(IMAGE_PATH:[^)]+\)', manual_text)
            print(f"📝 Referencias encontradas:")
            for i, ref in enumerate(refs[:3], 1):
                print(f"   {i}. {ref}")
            if len(refs) > 3:
                print(f"   ... y {len(refs) - 3} más")
        else:
            print("❌ PROBLEMA: El manual NO incluye referencias IMAGE_PATH:")
            print("\n📄 Texto del manual:")
            print("-" * 40)
            print(manual_text[:500] + "..." if len(manual_text) > 500 else manual_text)
            print("-" * 40)
        
        print(f"\n🔍 Análisis completo:")
        if hasattr(response, 'analysis'):
            print(f"📊 {response.analysis}")
        
        # Check images_base64
        if hasattr(response, 'images_base64') and response.images_base64:
            print(f"🖼️  Imágenes base64 incluidas: {len(response.images_base64)}")
            for path in list(response.images_base64.keys())[:3]:
                print(f"   - {path}")
        else:
            print("⚠️  No se incluyeron imágenes base64")
        
        return response
    
    except Exception as e:
        print(f"❌ Error durante la prueba: {e}")
        import traceback
        traceback.print_exc()
        return None

async def main():
    print("🚀 Iniciando test del prompt mejorado...")
    result = await test_improved_prompt()
    
    if result:
        print("\n🎉 Test completado exitosamente")
    else:
        print("\n💥 Test falló")

if __name__ == "__main__":
    asyncio.run(main())
