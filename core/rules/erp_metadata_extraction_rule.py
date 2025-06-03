import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.models.rules import MetadataExtractionRule
from core.completion.litellm_completion import LiteLLMCompletionModel
from core.models.completion import CompletionRequest

logger = logging.getLogger(__name__)


class ERPMetadataExtractionRule(MetadataExtractionRule):
    """
    Regla especializada para extraer metadatos de imágenes ERP.
    Combina análisis estructural (rutas de carpetas) con análisis visual usando IA.
    """
    
    def __init__(self, **kwargs):
        # Configuración por defecto para ERP
        defaults = {
            "name": "ERP Metadata Extraction",
            "description": "Extrae metadatos estructurales y visuales de imágenes ERP",
            "type": "metadata_extraction",
            "stage": "post_chunking",
            "use_images": True,
            "model": "qwen_manual_generator",  # Usar el modelo Qwen fine-tuneado
            "prompt": self._get_erp_analysis_prompt(),
            "schema": {
                "type": "object",
                "properties": {
                    "erp_module": {"type": "string"},
                    "erp_section": {"type": "string"},
                    "erp_function": {"type": "string"},
                    "erp_processed": {"type": "boolean"}
                }
            }
        }
        
        # Combinar defaults con kwargs proporcionados
        config = {**defaults, **kwargs}
        super().__init__(**config)
        
        # Inicializar el modelo de completion internamente después de la inicialización
        self._completion_model = None
        self._model_key = "qwen_manual_generator"

    def _get_completion_model(self):
        """Inicializa y retorna el modelo de completion de forma lazy"""
        if self._completion_model is None:
            try:
                self._completion_model = LiteLLMCompletionModel(self._model_key)
            except Exception as e:
                logger.warning(f"Could not initialize completion model {self._model_key}: {e}")
                self._completion_model = None
        return self._completion_model

    def _get_erp_analysis_prompt(self) -> str:
        """Prompt especializado para análisis de pantallas ERP"""
        return """Analiza esta imagen de pantalla del ERP Bnext y extrae la siguiente información en formato JSON:

{
    "funciones_detectadas": ["lista", "de", "funciones"],
    "botones_visibles": ["lista", "de", "botones"],
    "tipo_pantalla": "descripción del tipo de pantalla",
    "elementos_navegacion": ["lista", "de", "elementos", "de", "navegación"],
    "campos_formulario": ["lista", "de", "campos", "si", "aplica"],
    "acciones_principales": ["lista", "de", "acciones", "principales"]
}

Instrucciones específicas:
- Identifica todas las funciones disponibles en la pantalla
- Lista todos los botones visibles (texto exacto)
- Determina si es pantalla de listado, formulario, dashboard, etc.
- Identifica elementos de navegación como menús, breadcrumbs
- Si hay formularios, lista los campos principales
- Identifica las acciones principales que puede realizar el usuario

Responde SOLO con el JSON válido, sin explicaciones adicionales."""

    def _extract_structural_metadata(self, image_path: str) -> Dict[str, Any]:
        """
        Extrae metadatos basados en la estructura de carpetas del path de la imagen.
        
        Args:
            image_path: Ruta completa de la imagen
            
        Returns:
            Dict con metadatos estructurales extraídos
        """
        logger.debug(f"Extracting structural metadata from path: {image_path}")
        
        metadata = {
            "module": None,
            "section": None,
            "subsection": None,
            "function_detected": None,
            "hierarchy_level": 0,
            "keywords": [],
            "navigation_path": []
        }
        
        # Normalizar el path para trabajar consistentemente
        normalized_path = image_path.replace("\\", "/")
        path_parts = [part for part in normalized_path.split("/") if part]
        filename = Path(image_path).stem  # Nombre sin extensión
        
        # Determinar nivel de jerarquía
        metadata["hierarchy_level"] = len(path_parts) - 1
        
        # Extraer información de la estructura de carpetas
        if "pantalla principal" in normalized_path.lower():
            metadata["module"] = "Pantalla Principal"
            metadata["navigation_path"].append("Pantalla Principal")
            
            # Buscar información del módulo en el nombre del archivo
            if "modulo" in filename.lower():
                module_match = re.search(r"modulo[_\s]+(.+)", filename, re.IGNORECASE)
                if module_match:
                    module_name = module_match.group(1).replace("_", " ").title()
                    metadata["section"] = f"Módulo {module_name}"
                    metadata["function_detected"] = "Acceso a módulo"
                    metadata["keywords"].extend(["módulo", module_name.lower()])
        
        elif "catalogos" in normalized_path.lower():
            metadata["module"] = "Catálogos"
            metadata["navigation_path"].append("Catálogos")
            
            # Buscar la sección específica del catálogo
            cat_index = next((i for i, part in enumerate(path_parts) 
                            if "catalogos" in part.lower()), -1)
            
            if cat_index >= 0 and len(path_parts) > cat_index + 1:
                section = path_parts[cat_index + 1].replace("_", " ").title()
                metadata["section"] = section
                metadata["navigation_path"].append(section)
                metadata["keywords"].append(section.lower())
                
                # Si hay subsección
                if len(path_parts) > cat_index + 2:
                    subsection = path_parts[cat_index + 2].replace("_", " ").title()
                    metadata["subsection"] = subsection
                    metadata["navigation_path"].append(subsection)
                    metadata["keywords"].append(subsection.lower())
            
            metadata["function_detected"] = "Administración de catálogos"
            metadata["keywords"].extend(["catálogo", "administración"])
        
        # Analizar el nombre del archivo para información adicional
        filename_lower = filename.lower()
        if "pantalla" in filename_lower:
            metadata["function_detected"] = "Visualización"
            metadata["keywords"].append("pantalla")
        elif "formulario" in filename_lower:
            metadata["function_detected"] = "Formulario"
            metadata["keywords"].append("formulario")
        elif "listado" in filename_lower:
            metadata["function_detected"] = "Listado"
            metadata["keywords"].append("listado")
        elif "administrador" in filename_lower:
            if not metadata["function_detected"]:
                metadata["function_detected"] = "Administración"
            metadata["keywords"].append("administrador")
        
        # Generar keywords adicionales de todos los componentes del path
        for part in path_parts:
            if part and len(part) > 2:  # Evitar partes muy cortas
                clean_part = re.sub(r'[^\w\s]', ' ', part).strip().lower()
                if clean_part and clean_part not in metadata["keywords"]:
                    metadata["keywords"].append(clean_part)
        
        logger.debug(f"Extracted structural metadata: {metadata}")
        return metadata

    def _extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """
        Extrae JSON válido de la respuesta del modelo, manejando texto adicional.
        
        Args:
            response_text: Texto de respuesta del modelo
            
        Returns:
            Dict con los datos JSON extraídos
        """
        try:
            # Intentar parsear directamente
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            pass
        
        # Buscar JSON en el texto usando regex
        json_patterns = [
            r'```json\s*(\{.*?\})\s*```',  # JSON en bloque de código
            r'```\s*(\{.*?\})\s*```',     # JSON en bloque de código sin especificar lenguaje
            r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})',  # JSON standalone
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response_text, re.DOTALL | re.MULTILINE)
            for match in matches:
                try:
                    return json.loads(match.strip())
                except json.JSONDecodeError:
                    continue
        
        # Si no se puede extraer JSON válido, retornar estructura por defecto
        logger.warning(f"Could not extract valid JSON from response: {response_text[:200]}...")
        return {
            "funciones_detectadas": ["Error al procesar"],
            "botones_visibles": ["Error al procesar"],
            "tipo_pantalla": "error",
            "elementos_navegacion": [],
            "campos_formulario": [],
            "acciones_principales": []
        }

    async def apply(self, content: str, existing_metadata: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
        """
        Aplica la regla de extracción de metadatos ERP.
        
        Args:
            content: Contenido del chunk (para imágenes, puede ser path o descripción)
            existing_metadata: Metadatos existentes del chunk
            
        Returns:
            Tuple[Dict[str, Any], str]: (metadatos_extraídos, contenido_modificado)
        """
        logger.debug(f"Applying ERP metadata extraction rule")
        
        extracted_metadata = {}
        
        # Verificar si es un chunk de imagen
        is_image = existing_metadata.get("is_image", False)
        if not is_image:
            logger.debug("Chunk is not an image, skipping ERP metadata extraction")
            return extracted_metadata, content
        
        # Obtener la ruta de la imagen
        image_path = existing_metadata.get("source_path", "")
        if not image_path:
            logger.warning("No image path found in metadata")
            return extracted_metadata, content
        
        # Verificar si es una imagen ERP (basado en la ruta)
        if "/ERP_screenshots/" not in image_path:
            logger.debug("Not an ERP screenshot, skipping ERP metadata extraction")
            return extracted_metadata, content
        
        logger.info(f"Processing ERP image: {image_path}")
        
        try:
            # 1. Extraer metadatos estructurales de la ruta
            structural_metadata = self._extract_structural_metadata(image_path)
            extracted_metadata.update(structural_metadata)
            
            # 2. Realizar análisis visual con IA (solo si el modelo está disponible)
            completion_model = self._get_completion_model()
            visual_metadata = {}
            
            if completion_model is not None:
                try:
                    # Preparar el contexto con la imagen
                    context_chunks = [f"image:{image_path}"]
                    
                    # Crear request para el modelo de completación
                    completion_request = CompletionRequest(
                        query=self._get_erp_analysis_prompt(),
                        context_chunks=context_chunks
                    )
                    
                    # Llamar al modelo Qwen fine-tuneado
                    response = await completion_model.complete(completion_request)
                    
                    # Extraer JSON de la respuesta
                    visual_metadata = self._extract_json_from_response(response.completion)
                    
                except Exception as ai_error:
                    logger.warning(f"AI analysis failed for {image_path}: {ai_error}")
                    visual_metadata = {
                        "funciones_detectadas": ["Error en análisis IA"],
                        "botones_visibles": ["Error en análisis IA"],
                        "tipo_pantalla": "error_ia",
                        "elementos_navegacion": [],
                        "campos_formulario": [],
                        "acciones_principales": []
                    }
            else:
                logger.info("AI model not available, using structural metadata only")
                visual_metadata = {
                    "funciones_detectadas": ["Modelo IA no disponible"],
                    "botones_visibles": ["Modelo IA no disponible"],
                    "tipo_pantalla": "sin_analisis_visual",
                    "elementos_navegacion": [],
                    "campos_formulario": [],
                    "acciones_principales": []
                }
            
            # 3. Combinar metadatos estructurales y visuales
            combined_metadata = {
                # Metadatos estructurales
                "erp_module": structural_metadata.get("module"),
                "erp_section": structural_metadata.get("section"), 
                "erp_subsection": structural_metadata.get("subsection"),
                "erp_function": structural_metadata.get("function_detected"),
                "erp_hierarchy_level": structural_metadata.get("hierarchy_level"),
                "erp_navigation_path": structural_metadata.get("navigation_path"),
                "erp_keywords": structural_metadata.get("keywords"),
                
                # Metadatos visuales del modelo IA
                "erp_detected_functions": visual_metadata.get("funciones_detectadas", []),
                "erp_visible_buttons": visual_metadata.get("botones_visibles", []),
                "erp_screen_type": visual_metadata.get("tipo_pantalla", ""),
                "erp_navigation_elements": visual_metadata.get("elementos_navegacion", []),
                "erp_form_fields": visual_metadata.get("campos_formulario", []),
                "erp_main_actions": visual_metadata.get("acciones_principales", []),
                
                # Metadatos combinados para búsqueda
                "erp_all_keywords": list(set(
                    structural_metadata.get("keywords", []) +
                    visual_metadata.get("funciones_detectadas", []) +
                    visual_metadata.get("botones_visibles", [])
                )),
                
                # Prompt para generación de manuales
                "erp_manual_prompt": self._generate_manual_prompt(structural_metadata, visual_metadata),
                
                # Metadatos técnicos
                "erp_processed": True,
                "erp_analysis_model": self._model_key
            }
            
            extracted_metadata.update(combined_metadata)
            
            logger.info(f"Successfully extracted ERP metadata for {Path(image_path).name}")
            logger.debug(f"Extracted metadata keys: {list(extracted_metadata.keys())}")
            
        except Exception as e:
            logger.error(f"Error processing ERP image {image_path}: {str(e)}")
            extracted_metadata.update({
                "erp_processed": False,
                "erp_error": str(e),
                "erp_analysis_model": self._model_key
            })
        
        return extracted_metadata, content

    def _generate_manual_prompt(self, structural: Dict[str, Any], visual: Dict[str, Any]) -> str:
        """
        Genera un prompt descriptivo para usar en la generación de manuales.
        
        Args:
            structural: Metadatos estructurales
            visual: Metadatos visuales
            
        Returns:
            String con prompt descriptivo
        """
        parts = []
        
        # Información de navegación
        if structural.get("navigation_path"):
            nav_path = " > ".join(structural["navigation_path"])
            parts.append(f"Ubicación: {nav_path}")
        
        # Función principal
        if structural.get("function_detected"):
            parts.append(f"Función: {structural['function_detected']}")
        
        # Tipo de pantalla
        if visual.get("tipo_pantalla"):
            parts.append(f"Tipo: {visual['tipo_pantalla']}")
        
        # Funciones detectadas
        if visual.get("funciones_detectadas"):
            funcs = ", ".join(visual["funciones_detectadas"][:3])  # Primeras 3
            parts.append(f"Funciones: {funcs}")
        
        # Botones principales
        if visual.get("botones_visibles"):
            buttons = ", ".join(visual["botones_visibles"][:5])  # Primeros 5
            parts.append(f"Botones: {buttons}")
        
        return " | ".join(parts) if parts else "Pantalla ERP"
