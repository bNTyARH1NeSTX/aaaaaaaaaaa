import logging
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict

from core.config import get_settings
from core.models.graph import Entity
from core.models.prompts import EntityResolutionPromptOverride

logger = logging.getLogger(__name__)


# Define Pydantic models for structured output
class EntityGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    canonical: str
    variants: List[str]


class EntityResolutionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_groups: List[EntityGroup]


class EntityResolver:
    """
    Resolves and normalizes entities by identifying different variants of the same entity.
    Handles cases like "Trump" vs "Donald J Trump" or "JFK" vs "Kennedy".
    """

    def __init__(self):
        """Initialize the entity resolver"""
        self.settings = get_settings()

    async def resolve_entities(
        self,
        entities: List[Entity],
        prompt_overrides: Optional[EntityResolutionPromptOverride] = None,
    ) -> Tuple[List[Entity], Dict[str, str]]:
        """
        Resolves entities by identifying and grouping entities that refer to the same real-world entity.

        Args:
            entities: List of extracted entities
            prompt_overrides: Optional EntityResolutionPromptOverride with customizations for entity resolution

        Returns:
            Tuple containing:
            - List of normalized entities
            - Dictionary mapping original entity text to canonical entity text
        """
        if not entities:
            return [], {}

        # Extract entity labels to deduplicate
        entity_labels = [e.label for e in entities]

        # If there's only one entity, no need to resolve
        if len(entity_labels) <= 1:
            return entities, {entity_labels[0]: entity_labels[0]} if entity_labels else {}

        # Extract relevant overrides for entity resolution if they exist
        er_overrides = {}

        # Convert prompt_overrides to dict for LLM request
        if prompt_overrides:
            # Convert EntityResolutionPromptOverride to dict
            er_overrides = prompt_overrides.model_dump(exclude_none=True)

        # Use LLM to identify and group similar entities
        resolved_entities = await self._resolve_with_llm(entity_labels, **er_overrides)

        # Create mapping from original to canonical forms
        entity_mapping = {}
        for group in resolved_entities:
            canonical = group["canonical"]
            for variant in group["variants"]:
                entity_mapping[variant] = canonical

        # Deduplicate entities based on mapping
        unique_entities = []
        label_to_entity_map = {}

        # First, create a map from labels to entities
        for entity in entities:
            canonical_label = entity_mapping.get(entity.label, entity.label)

            # If we haven't seen this canonical label yet, add the entity to our map
            if canonical_label not in label_to_entity_map:
                label_to_entity_map[canonical_label] = entity
            else:
                # If we have seen it, merge chunk sources
                existing_entity = label_to_entity_map[canonical_label]

                # Merge document IDs
                for doc_id in entity.document_ids:
                    if doc_id not in existing_entity.document_ids:
                        existing_entity.document_ids.append(doc_id)

                # Merge chunk sources
                for doc_id, chunk_numbers in entity.chunk_sources.items():
                    if doc_id not in existing_entity.chunk_sources:
                        existing_entity.chunk_sources[doc_id] = list(chunk_numbers)
                    else:
                        for chunk_num in chunk_numbers:
                            if chunk_num not in existing_entity.chunk_sources[doc_id]:
                                existing_entity.chunk_sources[doc_id].append(chunk_num)

                # Merge properties (optional)
                for key, value in entity.properties.items():
                    if key not in existing_entity.properties:
                        existing_entity.properties[key] = value

        # Now, update the labels and create unique entities list
        for canonical_label, entity in label_to_entity_map.items():
            # Update the entity label to the canonical form
            entity.label = canonical_label

            # Add aliases property if there are variants
            variants = [
                variant
                for variant, canon in entity_mapping.items()
                if canon == canonical_label and variant != canonical_label
            ]
            if variants:
                if "aliases" not in entity.properties:
                    entity.properties["aliases"] = []
                entity.properties["aliases"].extend(variants)
                # Deduplicate aliases
                entity.properties["aliases"] = list(set(entity.properties["aliases"]))

            unique_entities.append(entity)

        return unique_entities, entity_mapping

    async def _resolve_with_llm(
        self, entity_labels: List[str], prompt_template=None, examples=None, **options
    ) -> List[Dict[str, Any]]:
        """
        Uses LLM to identify and group similar entities using litellm.

        Args:
            entity_labels: List of entity labels to resolve
            prompt_template: Optional custom prompt template
            examples: Optional custom examples for entity resolution
            **options: Additional options for entity resolution

        Returns:
            List of entity groups, where each group is a dict with:
            - "canonical": The canonical form of the entity
            - "variants": List of variant forms of the entity
        """
        # Import these here to avoid circular imports
        import instructor
        import litellm

        # Create the prompt for entity resolution
        prompt = self._create_entity_resolution_prompt(
            entity_labels, prompt_template=prompt_template, examples=examples
        )

        # Get the model configuration from registered_models
        model_config = self.settings.REGISTERED_MODELS.get(self.settings.GRAPH_MODEL, {})
        if not model_config:
            logger.error(f"Model '{self.settings.GRAPH_MODEL}' not found in registered_models configuration")
            return [{"canonical": label, "variants": [label]} for label in entity_labels]

        system_message = {
            "role": "system",
            "content": "Eres un experto en resolución de entidades. Tu tarea es identificar y agrupar diferentes representaciones de la misma entidad del mundo real.",
        }

        user_message = {"role": "user", "content": prompt}

        try:
            # Use instructor with litellm for structured output
            client = instructor.from_litellm(litellm.acompletion, mode=instructor.Mode.JSON)

            # Extract model name and prepare parameters
            model = model_config.get("model_name")
            model_kwargs = {k: v for k, v in model_config.items() if k != "model_name"}

            # Get structured response using instructor
            response = await client.chat.completions.create(
                model=model,
                messages=[system_message, user_message],
                response_model=EntityResolutionResult,
                **model_kwargs,
            )

            # Extract entity groups from the Pydantic model
            return [group.model_dump() for group in response.entity_groups]

        except Exception as e:
            logger.error(f"Error during entity resolution with litellm: {str(e)}")
            # Fallback: treat each entity as unique
            return [{"canonical": label, "variants": [label]} for label in entity_labels]

    def _create_entity_resolution_prompt(self, entity_labels: List[str], prompt_template=None, examples=None) -> str:
        """
        Creates a prompt for the LLM to resolve entities.

        Args:
            entity_labels: List of entity labels to resolve
            prompt_template: Optional custom prompt template
            examples: Optional custom examples for entity resolution

        Returns:
            Prompt string for the LLM
        """
        entities_str = "\n".join([f"- {label}" for label in entity_labels])

        # Use custom examples if provided, otherwise use defaults
        if examples is not None:
            # Ensure proper serialization for both dict and Pydantic model examples
            if isinstance(examples, list) and examples and hasattr(examples[0], "model_dump"):
                # List of Pydantic model objects
                serialized_examples = [example.model_dump() for example in examples]
            else:
                # List of dictionaries
                serialized_examples = examples

            entities_example_dict = {"entity_groups": serialized_examples}
        else:
            entities_example_dict = {
                "entity_groups": [
                    {
                        "canonical": "John F. Kennedy",
                        "variants": ["John F. Kennedy", "JFK", "Kennedy"],
                    },
                    {
                        "canonical": "United States of America",
                        "variants": ["United States of America", "USA", "United States"],
                    },
                ]
            }

        # If a custom template is provided, use it
        if prompt_template:
            # Format the custom template with our variables
            return prompt_template.format(entities_str=entities_str, examples_json=str(entities_example_dict))

        # Otherwise use the default prompt
        prompt = f"""
A continuación hay una lista de entidades extraídas de un documento:

{entities_str}

Tu tarea es identificar entidades en esta lista que se refieren al MISMO concepto u objeto del mundo real, diferenciándose SOLO por el nombre, abreviación o variaciones menores de ortografía. Agrupa estas entidades sinónimas juntas.

**REGLAS CRÍTICAS:**
1.  **SOLO Sinonimia:** Solo agrupa entidades si son verdaderamente sinónimas (ej., "JFK", "John F. Kennedy", "Kennedy").
2.  **NO Agrupes Conceptos Relacionados:** NO agrupes entidades distintas aunque estén relacionadas. Por ejemplo:
    * Una empresa y sus productos (ej., "Apple" e "iPhone" deben permanecer separados).
    * Una organización y sus proyectos o vehículos específicos (ej., "SpaceX", "Falcon 9" y "Starship" deben permanecer separados).
    * Una persona y su título (ej. "Elon Musk" y "CEO" deben permanecer separados a menos que la lista solo contenga variaciones como "CEO Musk").
3.  **Forma Canónica:** Para cada grupo de sinónimos, elige el nombre más completo y formal como la forma "canónica".
4.  **Omite Entidades Únicas:** Si una entidad no tiene sinónimos en la lista proporcionada, NO la incluyas en el JSON de salida. La salida debe contener solo grupos de dos o más entidades sinónimas.

**Formato de Salida:**
Formatea tu respuesta como un objeto JSON que contenga una sola clave "entity_groups", que es un array. Cada elemento en el array representa un grupo de sinónimos y debe tener:
- "canonical": La forma estándar elegida.
- "variants": Un array de todas las variantes sinónimas encontradas en la lista de entrada (incluyendo la forma canónica).

```json
{str(entities_example_dict)}
```
"""
        return prompt
