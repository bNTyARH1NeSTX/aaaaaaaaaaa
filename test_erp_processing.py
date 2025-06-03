#!/usr/bin/env python3
"""
Script de prueba para el procesamiento de imágenes ERP
"""
import asyncio
import sys
import os
import json
from pathlib import Path

# Agregar el directorio del proyecto al path
sys.path.append('.')

from core.config import get_settings
from core.rules.erp_metadata_extraction_rule import ERPMetadataExtractionRule

async def test_erp_processing():
    """Prueba el procesamiento de una imagen ERP individual"""
    
    print("🚀 Iniciando prueba de procesamiento ERP...")
    
    try:
        # Configurar
        print("📖 Cargando configuración...")
        settings = get_settings()
        print(f"📁 Carpeta de imágenes: {getattr(settings, 'MANUAL_GENERATION_IMAGE_FOLDER', 'NO CONFIGURADA')}")
        
        # Imagen de prueba
        test_image = "/root/.ipython/ERP_screenshots/pantalla principal/Pantalla principal.png"
        
        if not os.path.exists(test_image):
            print(f"❌ Imagen de prueba no encontrada: {test_image}")
            return
        
        print(f"🖼️  Procesando imagen: {test_image}")
        
        # Crear regla ERP
        print("🔧 Creando regla ERP...")
        erp_rule = ERPMetadataExtractionRule()
        print(f"✅ Regla ERP creada: {erp_rule.name}")
        
        # Simular metadatos de chunk de imagen
        existing_metadata = {
            "is_image": True,
            "source_path": test_image,
            "file_type": "image",
            "processed_by_erp_rule": False
        }
        
        content = f"ERP Image: {Path(test_image).name}"
        print(f"📄 Contenido: {content}")
        
        # Aplicar regla
        print("🔄 Aplicando regla de extracción de metadatos...")
        extracted_metadata, modified_content = await erp_rule.apply(
            content=content,
            existing_metadata=existing_metadata
        )
        
        print("✅ Metadatos extraídos exitosamente!")
        print(f"📊 Número de claves de metadatos: {len(extracted_metadata)}")
        print(f"📊 Claves de metadatos: {list(extracted_metadata.keys())}")
        
        # Mostrar algunos metadatos importantes
        if extracted_metadata.get("erp_processed"):
            print("\n🎯 Metadatos estructurales:")
            print(f"  - Módulo: {extracted_metadata.get('erp_module')}")
            print(f"  - Sección: {extracted_metadata.get('erp_section')}")
            print(f"  - Función: {extracted_metadata.get('erp_function')}")
            print(f"  - Ruta de navegación: {extracted_metadata.get('erp_navigation_path')}")
            print(f"  - Keywords: {extracted_metadata.get('erp_keywords')}")
            
            print("\n🔍 Metadatos visuales (IA):")
            print(f"  - Tipo de pantalla: {extracted_metadata.get('erp_screen_type')}")
            print(f"  - Funciones detectadas: {extracted_metadata.get('erp_detected_functions')}")
            print(f"  - Botones visibles: {extracted_metadata.get('erp_visible_buttons')}")
            print(f"  - Elementos de navegación: {extracted_metadata.get('erp_navigation_elements')}")
            
            print(f"\n📝 Prompt para manual: {extracted_metadata.get('erp_manual_prompt')}")
            
            # Guardar metadatos completos en archivo JSON
            output_file = "/tmp/erp_metadata_test.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(extracted_metadata, f, indent=2, ensure_ascii=False, default=str)
            print(f"💾 Metadatos guardados en: {output_file}")
            
        else:
            print("❌ El procesamiento ERP falló")
            if extracted_metadata.get("erp_error"):
                print(f"Error: {extracted_metadata['erp_error']}")
                
        print("\n📋 Todos los metadatos extraídos:")
        for key, value in extracted_metadata.items():
            print(f"  - {key}: {value}")
        
    except Exception as e:
        print(f"❌ Error general: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_erp_processing())
