"""Usage tracking and statistics endpoints."""
import logging
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends

from core.auth_utils import verify_token
from core.models.auth import AuthContext
from core.services.telemetry import TelemetryService

logger = logging.getLogger(__name__)
telemetry = TelemetryService()

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/stats")
@telemetry.track(operation_type="get_usage_stats", metadata_resolver=telemetry.usage_stats_metadata)
async def get_usage_stats(auth: AuthContext = Depends(verify_token)) -> Dict[str, int]:
    """Get usage statistics for the authenticated user."""
    if not auth.permissions or "admin" not in auth.permissions:
        return telemetry.get_user_usage(auth.entity_id)
    return telemetry.get_user_usage(auth.entity_id)


@router.get("/recent")
@telemetry.track(operation_type="get_recent_usage", metadata_resolver=telemetry.recent_usage_metadata)
async def get_recent_usage(
    auth: AuthContext = Depends(verify_token),
    operation_type: Optional[str] = None,
    since: Optional[datetime] = None,
    status: Optional[str] = None,
) -> List[Dict]:
    """Get recent usage records."""
    if not auth.permissions or "admin" not in auth.permissions:
        records = telemetry.get_recent_usage(
            user_id=auth.entity_id, operation_type=operation_type, since=since, status=status
        )
    else:
        records = telemetry.get_recent_usage(operation_type=operation_type, since=since, status=status)
    
    return records
