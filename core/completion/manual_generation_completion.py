import json
import logging
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel

from core.config import get_settings
from core.models.completion import CompletionRequest, CompletionResponse
from core.services.manual_generator_service import ManualGeneratorService

from .base_completion import BaseCompletionModel

logger = logging.getLogger(__name__)


class ManualGenerationCompletionModel(BaseCompletionModel):
    """Completion model that uses the ManualGeneratorService for generation"""

    def __init__(self, manual_generator_service: ManualGeneratorService):
        self.manual_generator_service = manual_generator_service
        logger.info("Initialized ManualGenerationCompletionModel")

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """Generate completion using the manual generation model"""
        try:
            # Format the content for the manual generation model
            context_text = "\n".join(request.context_chunks)
            
            # Create the prompt for entity extraction
            full_prompt = f"{request.query}\n\nTexto a analizar:\n{context_text}"
            
            # Check if we need structured output
            if request.schema:
                # For structured output, add JSON formatting instructions
                full_prompt += "\n\nResponde únicamente en formato JSON válido."
            
            # Use the manual generator service to generate response
            response_text = await self.manual_generator_service.generate_manual_content(
                prompt=full_prompt,
                max_new_tokens=request.max_tokens or 1000,
                temperature=request.temperature or 0.7
            )
            
            # If structured output is requested, try to parse as JSON
            if request.schema:
                try:
                    # Try to extract JSON from the response
                    json_response = self._extract_json_from_response(response_text)
                    
                    # If we have a Pydantic model as schema, validate with it
                    if isinstance(request.schema, type) and issubclass(request.schema, BaseModel):
                        validated_response = request.schema.model_validate(json_response)
                        response_text = validated_response
                    else:
                        response_text = json_response
                        
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse JSON response, returning raw text: {e}")
                    # Fall back to raw text if JSON parsing fails
            
            return CompletionResponse(
                completion=response_text,
                usage={
                    "prompt_tokens": len(full_prompt.split()) * 1.3,  # Rough estimation
                    "completion_tokens": len(str(response_text).split()) * 1.3,
                    "total_tokens": len(full_prompt.split()) * 1.3 + len(str(response_text).split()) * 1.3,
                },
                finish_reason="stop",
            )
            
        except Exception as e:
            logger.error(f"Error in ManualGenerationCompletionModel.complete: {e}")
            raise
    
    def _extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """
        Extract JSON from the model response, handling additional text.
        
        Args:
            response_text: Raw response from the model
            
        Returns:
            Dict with the extracted JSON data
        """
        try:
            # Try to parse directly first
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            pass
        
        # Search for JSON in the text using regex patterns
        import re
        json_patterns = [
            r'```json\s*(\{.*?\})\s*```',  # JSON in code block
            r'```\s*(\{.*?\})\s*```',     # JSON in code block without language
            r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})',  # Standalone JSON object
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response_text, re.DOTALL)
            for match in matches:
                try:
                    return json.loads(match.strip())
                except json.JSONDecodeError:
                    continue
        
        # If no valid JSON found, try to create a basic structure
        logger.warning("Could not extract valid JSON from response, creating basic structure")
        return {"entities": [], "relationships": []}