"""Rule template management endpoints."""
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException

from core.models.request import RuleTemplateRequest, RuleTemplateResponse
from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.database.postgres_database import PostgresDatabase
from core.services.telemetry import TelemetryService
from core.services_init import document_service

logger = logging.getLogger(__name__)
telemetry = TelemetryService()

router = APIRouter(prefix="/rule-templates", tags=["rule-templates"])


@router.get("", response_model=List[RuleTemplateResponse])
@telemetry.track(operation_type="get_rule_templates")
async def get_rule_templates(auth: AuthContext = Depends(verify_token)) -> List[RuleTemplateResponse]:
    """Get all rule templates accessible to the authenticated user."""
    try:
        db: PostgresDatabase = document_service.db
        templates = await db.get_rule_templates(auth)
        
        return [
            RuleTemplateResponse(
                id=str(template["id"]),
                name=template["name"],
                description=template["description"],
                rules_json=template["rules_json"],  # Already converted to JSON string
                created_at=template["created_at"],
                updated_at=template["updated_at"]
            )
            for template in templates
        ]
    except Exception as e:
        logger.error(f"Error getting rule templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=RuleTemplateResponse)
@telemetry.track(operation_type="create_rule_template")
async def create_rule_template(
    request: RuleTemplateRequest,
    auth: AuthContext = Depends(verify_token)
) -> RuleTemplateResponse:
    """Create a new rule template."""
    try:
        # Validate that rules_json is valid JSON
        try:
            json.loads(request.rules_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="rules_json must be valid JSON")
        
        db: PostgresDatabase = document_service.db
        template = await db.create_rule_template(
            name=request.name,
            description=request.description,
            rules_json=request.rules_json,
            auth=auth
        )
        
        if not template:
            raise HTTPException(status_code=400, detail="Rule template with this name already exists")
        
        return RuleTemplateResponse(
            id=str(template.id),
            name=template.name,
            description=template.description,
            rules_json=json.dumps(template.rules_json),  # Convert JSONB back to string
            created_at=template.created_at,
            updated_at=template.updated_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rule template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{template_id}")
@telemetry.track(operation_type="delete_rule_template")
async def delete_rule_template(
    template_id: str,
    auth: AuthContext = Depends(verify_token)
) -> Dict[str, str]:
    """Delete a rule template by ID."""
    try:
        db: PostgresDatabase = document_service.db
        success = await db.delete_rule_template(template_id, auth)
        
        if not success:
            raise HTTPException(status_code=404, detail="Rule template not found or insufficient permissions")
        
        return {"status": "success", "message": f"Rule template {template_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule template: {e}")
        raise HTTPException(status_code=500, detail=str(e))
