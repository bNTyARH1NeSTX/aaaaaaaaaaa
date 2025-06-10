#!/usr/bin/env python3
"""
Utilidad para procesar las imágenes ERP y generar metadatos usando AI
para análisis visual y estructural de las pantallas.
"""

import os
import json
import csv
import base64
import asyncio
from typing import Dict, List, Optional
from pathlib import Path
import logging
import sys

# Agregar el directorio raíz al path para importar módulos del core
sys.path.append(str(Path(__file__).parent.parent))

from core.completion.litellm_completion import LiteLLMCompletionModel
from core.models.completion import CompletionRequest
from core.config import get_settings

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ERPImageProcessor:
    def __init__(self, base_folder: str):
        self.base_folder = Path(base_folder)
        self.metadata_list = []
        self.settings = get_settings()
        
        # Inicializar modelo de AI para análisis visual
        try:
            self.completion_model = LiteLLMCompletionModel("qwen_manual_generator")
            logger.info("AI completion model initialized successfully")
        except Exception as e:
            logger.warning(f"Could not initialize AI model: {e}. Using structural analysis only.")
            self.completion_model = None
        
    def _get_erp_analysis_prompt(self) -> str:
        """Prompt especializado para análisis de pantallas ERP basado en el modelo manual generator"""
        return """
Eres un analizador visual experto en interfaces de sistemas ERP. Estás colaborando con la empresa BNEXT para construir un sistema de recuperación visual de pantallas usando un modelo RAG de imágenes (como ColPali).

Tu tarea es generar metadatos estructurados que describan las funcionalidades clave de cada pantalla del ERP. Estos metadatos serán usados para indexar imágenes y facilitar que usuarios encuentren pantallas según lo que necesitan hacer (aunque no conozcan la ruta exacta del sistema).

Analiza la imagen de pantalla del ERP Bnext y extrae la siguiente información:

### 🎯 Funciones principales de la pantalla
Describe brevemente las acciones que un usuario puede realizar desde esta pantalla. Por ejemplo: "buscar productos", "consultar ubicaciones", "editar configuraciones".

### 🧩 Botones visibles
Enumera los botones que aparecen en la interfaz y qué función realiza cada uno. Por ejemplo: "Nuevo: abre un formulario para crear un nuevo producto", "Buscar: ejecuta la búsqueda con los filtros".

### 📘 Tipo de pantalla
Indica el tipo de pantalla. Por ejemplo:
- `"panel"`: si es un panel de búsqueda o navegación.
- `"formulario"`: si es una pantalla para alta o edición de datos.
- `"detalle"`: si muestra información en modo solo lectura.
- `"reporte"`: si muestra datos resumidos, listados o reportes descargables.

### 🔍 Campos de formulario
Si hay campos de entrada, lista los más importantes.

### 🗂️ Módulo ERP
Identifica a qué módulo pertenece (Ventas, Compras, Inventario, Catálogos, etc.)

### ❓ Preguntas y respuestas frecuentes
Genera 3-5 preguntas que un usuario haría sobre esta pantalla y sus respuestas.

🧠 Estructura de salida esperada (formato JSON):
```json
{
  "module": "Nombre del módulo (ej: Catálogos, Ventas, Inventario)",
  "section": "Sección específica dentro del módulo",
  "funciones_detectadas": ["buscar productos", "filtrar por categoría", "ver productos activos"],
  "botones_visibles": [
    "Buscar: ejecuta la búsqueda con los filtros establecidos",
    "Limpiar: borra los campos del formulario",
    "Eliminar: elimina un registro seleccionado",
    "Modificar: abre el formulario de edición del producto",
    "Nuevo: abre un formulario para dar de alta un producto"
  ],
  "tipo_pantalla": "panel",
  "form_fields": ["Código Interno", "Nombre", "Descripción", "Tipo"],
  "navigation_elements": ["Menú principal", "Breadcrumbs", "Pestañas"],
  "keywords": ["producto", "búsqueda", "filtro", "catálogo"],
  "user_workflow": "El usuario puede filtrar productos usando varios criterios y luego seleccionar acciones como crear, modificar o ver detalles",
  "user_questions_and_answers": [
    {
      "question": "¿Qué puedo hacer aquí?",
      "answer": "Puedes buscar y gestionar productos en el catálogo del ERP"
    },
    {
      "question": "¿Cómo busco un producto específico?",
      "answer": "Usa los filtros de búsqueda como código interno, nombre o descripción y luego presiona Buscar"
    },
    {
      "question": "¿Cómo agrego un nuevo producto?",
      "answer": "Haz clic en el botón Nuevo para abrir el formulario de alta de productos"
    }
  ]
}
```

Responde SOLO con el JSON válido, sin explicaciones adicionales."""

    def _convert_image_to_base64(self, image_path: Path) -> Optional[str]:
        """Convierte una imagen a base64 para enviar al modelo de AI"""
        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return encoded_string
        except Exception as e:
            logger.error(f"Error converting image to base64 {image_path}: {e}")
            return None

    def _generate_fallback_questions_answers(self, metadata: Dict) -> List[Dict]:
        """Genera preguntas y respuestas de fallback basadas en el contexto estructural"""
        questions_answers = []
        
        module = metadata.get("module", "ERP")
        function = metadata.get("function_detected", "navegar por el sistema")
        section = metadata.get("section", "")
        
        # Pregunta básica sobre funcionalidad
        questions_answers.append({
            "question": "¿Qué puedo hacer aquí?",
            "answer": f"En esta pantalla de {module} puedes {function.lower()}. {section}"
        })
        
        # Pregunta sobre navegación
        if "Pantalla Principal" in str(module):
            questions_answers.append({
                "question": "¿Cómo accedo a esta función?",
                "answer": f"Desde la pantalla principal del ERP, navega hacia {section or 'la sección correspondiente'}"
            })
        else:
            questions_answers.append({
                "question": "¿Cómo navego en esta pantalla?",
                "answer": "Utiliza los menús y botones disponibles para navegar entre las diferentes opciones"
            })
        
        # Pregunta sobre información requerida
        if "agregar" in function.lower() or "nuevo" in function.lower():
            questions_answers.append({
                "question": "¿Qué información necesito ingresar?",
                "answer": "Completa todos los campos requeridos en el formulario antes de guardar"
            })
        elif "consultar" in function.lower() or "buscar" in function.lower():
            questions_answers.append({
                "question": "¿Cómo busco información específica?",
                "answer": "Utiliza los filtros y campos de búsqueda para encontrar los registros que necesitas"
            })
        else:
            questions_answers.append({
                "question": "¿Qué pasos debo seguir?",
                "answer": f"Sigue el flujo de trabajo estándar para {function.lower()} en el sistema ERP"
            })
        
        return questions_answers
    
    async def _analyze_image_with_ai(self, image_path: Path) -> Dict:
        """Analiza la imagen usando AI para extraer metadatos visuales"""
        if not self.completion_model:
            logger.debug(f"AI model not available, skipping visual analysis for {image_path}")
            return {}
            
        try:
            # Convertir imagen a base64
            base64_image = self._convert_image_to_base64(image_path)
            if not base64_image:
                return {}
            
            # Get the prompt
            prompt = self._get_erp_analysis_prompt()
            
            # Crear request para el modelo usando los campos correctos
            completion_request = CompletionRequest(
                query=prompt,
                context_chunks=[f"data:image/png;base64,{base64_image}"],
                max_tokens=1500,  # Increased for more detailed responses
                temperature=0.1  # Baja temperatura para respuestas consistentes
            )
            
            logger.debug(f"Sending request to AI model for {image_path}")
            
            # Obtener respuesta del modelo (async)
            response = await self.completion_model.complete(completion_request)
            
            if response and hasattr(response, 'choices') and response.choices:
                response_text = response.choices[0].message.content.strip()
                
                logger.debug(f"AI model response for {image_path}: {response_text[:200]}...")
                
                # Intentar parsear JSON usando la función similar a n.py
                try:
                    ai_metadata = self._extract_json_from_text(response_text)
                    logger.info(f"AI analysis successful for {image_path}")
                    return ai_metadata
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse AI response as JSON for {image_path}: {e}")
                    logger.debug(f"AI response was: {response_text}")
                    
            else:
                logger.warning(f"No valid response from AI model for {image_path}")
                    
        except Exception as e:
            logger.error(f"Error during AI analysis of {image_path}: {e}")
            
        return {}
    
    def _extract_json_from_text(self, text: str) -> Dict:
        """Extract JSON from text that might contain other content, similar to n.py"""
        try:
            # First try to parse the entire text as JSON
            return json.loads(text)
        except json.JSONDecodeError:
            # If that fails, try to find JSON-like structure
            try:
                # Look for the last occurrence of a JSON-like structure
                start_idx = text.rfind("{")
                end_idx = text.rfind("}") + 1
                if start_idx != -1 and end_idx > start_idx:
                    json_str = text[start_idx:end_idx]
                    return json.loads(json_str)
            except (json.JSONDecodeError, ValueError):
                pass
            
            # If still no valid JSON, create a default structure
            logger.warning(f"Could not extract valid JSON from AI response: {text[:200]}...")
            return {
                "funciones_detectadas": ["No se pudo detectar funciones"],
                "botones_visibles": ["No se pudieron detectar botones"],
                "tipo_pantalla": "desconocido",
                "user_questions_and_answers": [
                    {
                        "question": "¿Qué puedo hacer aquí?",
                        "answer": "No se pudo analizar automáticamente. Consulta la documentación del ERP."
                    }
                ]
            }
        
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
        if "pantalla principal" in [p.lower() for p in path_parts]:
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
    
    async def process_images(self) -> List[Dict]:
        """
        Procesa todas las imágenes en el directorio base usando AI para generar metadatos.
        """
        logger.info(f"Procesando imágenes en: {self.base_folder}")
        logger.info(f"Verificando que el directorio existe: {self.base_folder.exists()}")
        
        if not self.base_folder.exists():
            logger.error(f"El directorio {self.base_folder} no existe")
            return []
        
        # Buscar todas las imágenes
        image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp'}
        
        # Verificar contenido del directorio
        all_files = list(self.base_folder.rglob("*"))
        logger.info(f"Total de archivos encontrados: {len(all_files)}")
        
        image_files = [f for f in all_files if f.suffix.lower() in image_extensions]
        logger.info(f"Archivos de imagen encontrados: {len(image_files)}")
        
        for image_file in image_files:
            try:
                logger.info(f"Procesando imagen: {image_file}")
                
                # Obtener ruta relativa desde la carpeta base
                relative_path = image_file.relative_to(self.base_folder)
                
                # Combinar análisis estructural y AI
                structural_context = self.extract_context_from_path(str(relative_path))
                ai_metadata = await self._analyze_image_with_ai(image_file)  # await here
                
                # Combinar metadatos de ambas fuentes
                combined_metadata = self._merge_metadata(structural_context, ai_metadata)
                
                # Generar descripción mejorada
                description = self._generate_enhanced_description(str(relative_path), combined_metadata)
                
                # Crear entrada de metadatos completa
                metadata = {
                    "image_path": str(relative_path).replace("\\", "/"),
                    "absolute_path": str(image_file),
                    "prompt": description,
                    "respuesta": self._generate_response(combined_metadata),
                    
                    # Metadatos estructurales (del path)
                    "module": combined_metadata.get("module"),
                    "section": combined_metadata.get("section"),
                    "subsection": combined_metadata.get("subsection"),
                    "function_detected": combined_metadata.get("function_detected"),
                    "hierarchy_level": combined_metadata.get("hierarchy_level", 0),
                    
                    # Metadatos de AI (análisis visual)
                    "screen_type": combined_metadata.get("screen_type"),
                    "buttons_visible": combined_metadata.get("buttons_visible", []),
                    "form_fields": combined_metadata.get("form_fields", []),
                    "navigation_elements": combined_metadata.get("navigation_elements", []),
                    "main_actions": combined_metadata.get("main_actions", []),
                    "user_workflow": combined_metadata.get("user_workflow"),
                    
                    # Preguntas y respuestas generadas por AI
                    "user_questions_and_answers": combined_metadata.get("user_questions_and_answers", []),
                    
                    # Metadatos combinados
                    "keywords": combined_metadata.get("keywords", []),
                    "additional_metadata": {
                        "ai_analysis_successful": bool(ai_metadata),
                        "structural_analysis": structural_context,
                        "ai_raw_response": ai_metadata
                    },
                    
                    # Metadatos de archivo
                    "file_size": image_file.stat().st_size,
                    "filename": image_file.name
                }
                
                self.metadata_list.append(metadata)
                logger.info(f"✅ Procesada exitosamente: {relative_path}")
                
            except Exception as e:
                logger.error(f"❌ Error procesando {image_file}: {e}")
                continue
        
        logger.info(f"🎉 Total de imágenes procesadas: {len(self.metadata_list)}")
        return self.metadata_list
    
    def _merge_metadata(self, structural: Dict, ai_metadata: Dict) -> Dict:
        """Combina metadatos estructurales y de AI, priorizando AI cuando esté disponible"""
        merged = structural.copy()
        
        # AI metadata toma prioridad para campos específicos
        if ai_metadata:
            # Map AI fields to our structure
            merged.update({
                # Use AI detected module if available, fallback to structural
                "module": ai_metadata.get("module") or structural.get("module"),
                "section": ai_metadata.get("section") or structural.get("section"),
                "subsection": ai_metadata.get("subsection") or structural.get("subsection"),
                
                # AI specific fields
                "screen_type": ai_metadata.get("tipo_pantalla"),
                "buttons_visible": ai_metadata.get("botones_visibles", []),
                "form_fields": ai_metadata.get("form_fields", []),
                "navigation_elements": ai_metadata.get("navigation_elements", []),
                "main_actions": ai_metadata.get("funciones_detectadas", []),
                "user_workflow": ai_metadata.get("user_workflow"),
                
                # Combine keywords from both sources
                "keywords": list(set(
                    structural.get("keywords", []) + 
                    ai_metadata.get("keywords", []) +
                    [kw.lower() for kw in ai_metadata.get("funciones_detectadas", [])] +
                    [btn.split(":")[0].lower() for btn in ai_metadata.get("botones_visibles", [])]
                )),
                
                # AI generated questions and answers
                "user_questions_and_answers": ai_metadata.get("user_questions_and_answers", [])
            })
        
        # If no AI metadata, generate fallback questions
        if not merged.get("user_questions_and_answers"):
            merged["user_questions_and_answers"] = self._generate_fallback_questions_answers(merged)
        
        return merged
            # Mantener campos estructurales pero enriquecer con AI
            if "module" in ai_metadata and ai_metadata["module"]:
                merged["module"] = ai_metadata["module"]
            if "section" in ai_metadata and ai_metadata["section"]:
                merged["section"] = ai_metadata["section"]
            if "function_detected" in ai_metadata and ai_metadata["function_detected"]:
                merged["function_detected"] = ai_metadata["function_detected"]
                
            # Agregar campos únicos de AI
            for key in ["screen_type", "buttons_visible", "form_fields", 
                       "navigation_elements", "main_actions", "user_workflow", 
                       "user_questions_and_answers"]:
                if key in ai_metadata:
                    merged[key] = ai_metadata[key]
            
            # Combinar keywords
            ai_keywords = ai_metadata.get("keywords", [])
            structural_keywords = merged.get("keywords", [])
            merged["keywords"] = list(set(structural_keywords + ai_keywords))
        
        # If AI questions are not available or incomplete, generate fallback questions
        if not merged.get("user_questions_and_answers"):
            merged["user_questions_and_answers"] = self._generate_fallback_questions_answers(merged)
        
        return merged
    
    def _generate_enhanced_description(self, image_path: str, metadata: Dict) -> str:
        """Genera una descripción enriquecida usando tanto análisis estructural como AI"""
        parts = []
        
        if metadata.get("module"):
            parts.append(f"Módulo: {metadata['module']}")
            
        if metadata.get("section"):
            parts.append(f"Sección: {metadata['section']}")
            
        if metadata.get("subsection"):
            parts.append(f"Subsección: {metadata['subsection']}")
            
        if metadata.get("function_detected"):
            parts.append(f"Función: {metadata['function_detected']}")
            
        if metadata.get("screen_type"):
            parts.append(f"Tipo: {metadata['screen_type']}")
        
        description = " | ".join(parts) if parts else f"Pantalla del ERP: {Path(image_path).stem}"
        
        # Agregar información de workflow si está disponible
        if metadata.get("user_workflow"):
            description += f" | Flujo: {metadata['user_workflow']}"
            
        return description
    
    def _generate_response(self, metadata: Dict) -> str:
        """Genera una respuesta descriptiva basada en los metadatos"""
        function = metadata.get("function_detected", "interfaz del ERP")
        screen_type = metadata.get("screen_type", "pantalla")
        
        response = f"Pantalla de {function}"
        if screen_type and screen_type != "pantalla":
            response += f" - {screen_type}"
            
        # Agregar información de acciones principales si está disponible
        main_actions = metadata.get("main_actions", [])
        if main_actions:
            actions_text = ", ".join(main_actions[:3])  # Máximo 3 acciones
            response += f". Acciones disponibles: {actions_text}"
            
        return response
    
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
                'hierarchy_level', 'screen_type', 'buttons_visible', 'form_fields',
                'navigation_elements', 'main_actions', 'user_workflow', 
                'user_questions_and_answers', 'keywords', 
                'additional_metadata', 'file_size', 'filename'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for metadata in self.metadata_list:
                # Convertir campos complejos a string JSON para CSV
                row = metadata.copy()
                row['keywords'] = json.dumps(row.get('keywords', []))
                row['buttons_visible'] = json.dumps(row.get('buttons_visible', []))
                row['form_fields'] = json.dumps(row.get('form_fields', []))
                row['navigation_elements'] = json.dumps(row.get('navigation_elements', []))
                row['main_actions'] = json.dumps(row.get('main_actions', []))
                row['user_questions_and_answers'] = json.dumps(row.get('user_questions_and_answers', []))
                row['additional_metadata'] = json.dumps(row.get('additional_metadata', {}))
                writer.writerow(row)
                
        logger.info(f"Metadatos guardados en: {output_file}")
    
    def save_to_json(self, output_file: str):
        """
        Guarda los metadatos en un archivo JSON.
        """
        with open(output_file, 'w', encoding='utf-8') as jsonfile:
            json.dump(self.metadata_list, jsonfile, ensure_ascii=False, indent=2)
        logger.info(f"Metadatos guardados en: {output_file}")


async def main():
    # Configuración
    ERP_FOLDER = "/root/.ipython/aaaaaaaaaaa/ERP_screenshots"
    OUTPUT_CSV = "/root/.ipython/aaaaaaaaaaa/erp_metadata.csv"
    OUTPUT_JSON = "/root/.ipython/aaaaaaaaaaa/erp_metadata.json"
    
    # Procesar imágenes
    processor = ERPImageProcessor(ERP_FOLDER)
    metadata = await processor.process_images()  # await here
    
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
    asyncio.run(main())
