"""
Chat service for handling conversational interactions with ERP manual generation.
"""

import os
import logging
from typing import List, Dict, Any, Optional
import torch
from PIL import Image
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor

logger = logging.getLogger(__name__)


class ChatService:
    """Service for handling chat responses using the manual generation model."""
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.image_folder = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    def initialize(self, model: Qwen2VLForConditionalGeneration, processor: AutoProcessor, image_folder: str):
        """Initialize the chat service with the manual generation model."""
        self.model = model
        self.processor = processor
        self.image_folder = image_folder
        logger.info("Chat service initialized successfully.")
    
    async def generate_chat_response(
        self,
        query: str,
        images_metadata: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Generate a conversational chat response using RAG with ColPali images.
        This uses the manual generation model but for conversational purposes.
        """
        if not self.model or not self.processor:
            logger.error("Chat generation model not loaded properly.")
            return "Lo siento, el modelo no está disponible en este momento."
        
        if not self.image_folder:
            logger.warning("Image folder not configured. Continuing without images.")
            images_metadata = []

        # Load images if available
        pil_images = []
        
        if images_metadata:
            for metadata in images_metadata:
                image_path_relative = metadata.get("image_path")
                if not image_path_relative:
                    continue
                    
                full_image_path = os.path.join(self.image_folder, image_path_relative)
                if not os.path.exists(full_image_path):
                    logger.warning(f"Image not found at {full_image_path}. Skipping.")
                    continue
                
                try:
                    image = Image.open(full_image_path).convert("RGB")
                    pil_images.append(image)
                except Exception as e:
                    logger.warning(f"Error loading image {full_image_path}: {e}")
                    continue

        # Build conversation context
        conversation_context = ""
        if conversation_history:
            conversation_context = "\n\nContexto de la conversación:\n"
            for msg in conversation_history[-5:]:  # Last 5 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")
                conversation_context += f"{role.title()}: {content}\n"

        # Create chat prompt
        user_text_prompt = f"""Eres un experto en sistemas ERP especializado en ayudar a los usuarios con preguntas sobre el sistema.

Pregunta del usuario: {query}

INSTRUCCIONES IMPORTANTES:
1. Responde de manera conversacional y útil basándote en las imágenes proporcionadas
2. Describe específicamente lo que ves en las imágenes del ERP que sea relevante para la pregunta
3. Si las imágenes no son directamente relevantes para la pregunta, menciona qué muestran y explica cómo se relacionan o no con lo que busca el usuario
4. Mantén tus respuestas claras y concisas
5. Si no tienes información suficiente, dilo honestamente

Información de las imágenes disponibles:"""

        # Add detailed image information
        if images_metadata:
            for i, metadata in enumerate(images_metadata):
                image_path_relative = metadata.get("image_path", "")
                folder_path = os.path.dirname(image_path_relative)
                hierarchy_parts = [part for part in folder_path.split('/') if part]
                hierarchy_str = ' > '.join(hierarchy_parts) if hierarchy_parts else 'Raíz'
                
                user_text_prompt += f"""

Imagen {i+1}:
- Ruta: {image_path_relative}
- Jerarquía de navegación: {hierarchy_str}
- Prompt: {metadata.get("prompt", "Sin descripción")}
- Respuesta: {metadata.get("respuesta", "Sin respuesta")}"""

        if conversation_context:
            user_text_prompt += conversation_context

        user_text_prompt += f"""

Ahora responde a la pregunta basándote en las imágenes proporcionadas y describe específicamente lo que ves que sea relevante para: {query}"""

        try:
            # Create messages for the model
            messages_for_template = [{"role": "user", "content": []}]
            
            # Add images to user message
            for img in pil_images:
                messages_for_template[0]["content"].append({"type": "image", "image": img})
            
            # Add text to user message
            messages_for_template[0]["content"].append({"type": "text", "text": user_text_prompt})

            # Apply chat template
            chat_text_for_model = self.processor.apply_chat_template(
                messages_for_template, tokenize=False, add_generation_prompt=True
            )
            
            # Generate response using direct method
            try:
                inputs = self.processor(
                    text=[chat_text_for_model], 
                    images=pil_images, 
                    return_tensors="pt", 
                    padding=True
                ).to(self.model.device)

                with torch.no_grad():
                    output_ids = self.model.generate(
                        **inputs,
                        max_new_tokens=500,  # Shorter for chat
                        do_sample=True,
                        temperature=0.7,
                        top_p=0.9,
                        pad_token_id=self.processor.tokenizer.eos_token_id
                    )
                
                input_token_len = inputs.input_ids.shape[1]
                generated_ids_only = output_ids[:, input_token_len:]
                generated_text = self.processor.batch_decode(generated_ids_only, skip_special_tokens=True)[0]
                logger.info("Chat generation successful.")

            except Exception as e_direct:
                logger.error(f"Chat generation failed: {e_direct}")
                return "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo."

        except Exception as e:
            logger.error(f"Error in chat service: {e}", exc_info=True)
            return "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo."
        
        # Clean up the response
        if "Assistant:" in generated_text:
            generated_text = generated_text.split("Assistant:", 1)[1].strip()
        if "<|im_end|>" in generated_text:
            generated_text = generated_text.split("<|im_end|>")[0].strip()
        if generated_text.startswith(user_text_prompt):
            generated_text = generated_text[len(user_text_prompt):].strip()
            
        # Remove any manual-specific formatting that might leak through
        if generated_text.startswith("##") or generated_text.startswith("# "):
            lines = generated_text.split('\n')
            cleaned_lines = []
            for line in lines:
                if line.startswith('#'):
                    cleaned_lines.append(line.lstrip('#').strip())
                else:
                    cleaned_lines.append(line)
            generated_text = '\n'.join(cleaned_lines)
        
        if not generated_text.strip():
            return "Lo siento, no pude generar una respuesta para tu pregunta. ¿Podrías reformularla?"
            
        return generated_text.strip()
