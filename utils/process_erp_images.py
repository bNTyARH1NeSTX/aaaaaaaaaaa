#!/usr/bin/env python3
"""
Utilidad para procesar las imágenes ERP y generar metadatos iniciales
basados en la estructura de carpetas y nombres de archivos.
"""

import os
import json
import csv
from typing import Dict, List, Optional
from pathlib import Path
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ERPImageProcessor:
    def __init__(self, base_folder: str):
        self.base_folder = Path(base_folder)
        self.metadata_list = []
        
    def extract_context_from_path(self, image_path: str) -> Dict:
        """
        Extrae información contextual de la ruta de la imagen.
        """
        context = {
            "module": None,
            "section": None,
            "subsection": None,
            "function_detected": None,
            "hierarchy_level": 0,
            "keywords": []
        }
        
        # Convertir a Path para facilitar el manejo
        path = Path(image_path)
        path_parts = path.parts
        filename = path.stem  # Nombre sin extensión
        
        # Determinar nivel de jerarquía
        context["hierarchy_level"] = len(path_parts) - 1
        
        # Analizar estructura de carpetas
        if "pantalla principal" in path_parts:
            context["module"] = "Pantalla Principal"
            # Buscar información del módulo en el nombre del archivo
            if "modulo" in filename.lower():
                module_name = filename.replace("Modulo", "").replace("modulo", "").replace("_", " ").strip()
                context["section"] = f"Módulo {module_name}"
                context["function_detected"] = "Acceso a módulo"
                context["keywords"] = ["módulo", "acceso", module_name.lower()]
                
        elif "Catalogos" in path_parts:
            context["module"] = "Catálogos"
            cat_index = list(path_parts).index("Catalogos")
            if len(path_parts) > cat_index + 1:
                context["section"] = path_parts[cat_index + 1]
                if len(path_parts) > cat_index + 2:
                    context["subsection"] = path_parts[cat_index + 2]
            context["function_detected"] = "Administración de catálogos"
            context["keywords"] = ["catálogo", "administración"]
            
        # Analizar nombre de archivo para detectar funciones específicas
        filename_lower = filename.lower()
        if "pantalla" in filename_lower:
            context["function_detected"] = "Visualización de pantalla"
            context["keywords"].append("pantalla")
        elif "administrador" in filename_lower:
            context["function_detected"] = "Administración"
            context["keywords"].append("administrador")
        elif "agregar" in filename_lower or "nuevo" in filename_lower:
            context["function_detected"] = "Crear nuevo registro"
            context["keywords"].extend(["agregar", "nuevo", "crear"])
        elif "editar" in filename_lower or "modificar" in filename_lower:
            context["function_detected"] = "Editar registro"
            context["keywords"].extend(["editar", "modificar"])
        elif "consultar" in filename_lower or "buscar" in filename_lower:
            context["function_detected"] = "Consultar información"
            context["keywords"].extend(["consultar", "buscar"])
            
        return context
    
    def generate_description(self, image_path: str, context: Dict) -> str:
        """
        Genera una descripción automática basada en el contexto.
        """
        parts = []
        
        if context.get("module"):
            parts.append(f"Módulo: {context['module']}")
            
        if context.get("section"):
            parts.append(f"Sección: {context['section']}")
            
        if context.get("subsection"):
            parts.append(f"Subsección: {context['subsection']}")
            
        if context.get("function_detected"):
            parts.append(f"Función: {context['function_detected']}")
            
        description = " | ".join(parts) if parts else f"Pantalla del ERP: {Path(image_path).stem}"
        return description
    
    def process_images(self) -> List[Dict]:
        """
        Procesa todas las imágenes en el directorio base.
        """
        logger.info(f"Procesando imágenes en: {self.base_folder}")
        
        # Buscar todas las imágenes
        image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp'}
        
        for image_file in self.base_folder.rglob("*"):
            if image_file.suffix.lower() in image_extensions:
                # Obtener ruta relativa desde la carpeta base
                relative_path = image_file.relative_to(self.base_folder)
                
                # Extraer contexto
                context = self.extract_context_from_path(str(relative_path))
                
                # Generar descripción
                description = self.generate_description(str(relative_path), context)
                
                # Crear entrada de metadatos
                metadata = {
                    "image_path": str(relative_path).replace("\\", "/"),  # Normalizar separadores
                    "absolute_path": str(image_file),
                    "prompt": description,
                    "respuesta": f"Pantalla de {context.get('function_detected', 'interfaz del ERP')}",
                    "module": context.get("module"),
                    "section": context.get("section"),
                    "subsection": context.get("subsection"),
                    "function_detected": context.get("function_detected"),
                    "hierarchy_level": context.get("hierarchy_level", 0),
                    "keywords": context.get("keywords", []),
                    "file_size": image_file.stat().st_size,
                    "filename": image_file.name
                }
                
                self.metadata_list.append(metadata)
                logger.info(f"Procesada: {relative_path}")
        
        logger.info(f"Total de imágenes procesadas: {len(self.metadata_list)}")
        return self.metadata_list
    
    def save_to_csv(self, output_file: str):
        """
        Guarda los metadatos en un archivo CSV.
        """
        if not self.metadata_list:
            logger.warning("No hay metadatos para guardar")
            return
            
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'image_path', 'absolute_path', 'prompt', 'respuesta', 
                'module', 'section', 'subsection', 'function_detected',
                'hierarchy_level', 'keywords', 'file_size', 'filename'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for metadata in self.metadata_list:
                # Convertir lista de keywords a string JSON
                row = metadata.copy()
                row['keywords'] = json.dumps(row['keywords'])
                writer.writerow(row)
                
        logger.info(f"Metadatos guardados en: {output_file}")
    
    def save_to_json(self, output_file: str):
        """
        Guarda los metadatos en un archivo JSON.
        """
        with open(output_file, 'w', encoding='utf-8') as jsonfile:
            json.dump(self.metadata_list, jsonfile, ensure_ascii=False, indent=2)
        logger.info(f"Metadatos guardados en: {output_file}")


def main():
    # Configuración
    ERP_FOLDER = "/root/.ipython/ERP_screenshots"
    OUTPUT_CSV = "/root/.ipython/aaaaaaaaaaa/erp_metadata.csv"
    OUTPUT_JSON = "/root/.ipython/aaaaaaaaaaa/erp_metadata.json"
    
    # Procesar imágenes
    processor = ERPImageProcessor(ERP_FOLDER)
    metadata = processor.process_images()
    
    # Guardar resultados
    processor.save_to_csv(OUTPUT_CSV)
    processor.save_to_json(OUTPUT_JSON)
    
    # Mostrar estadísticas
    print(f"\n📊 Estadísticas de procesamiento:")
    print(f"Total de imágenes: {len(metadata)}")
    
    modules = {}
    for item in metadata:
        module = item.get('module', 'Sin módulo')
        modules[module] = modules.get(module, 0) + 1
    
    print(f"\nImágenes por módulo:")
    for module, count in modules.items():
        print(f"  - {module}: {count} imágenes")


if __name__ == "__main__":
    main()
