"""
Health check and system status endpoints.
"""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/ping")
async def ping_health():
    """Simple health check endpoint that returns 200 OK."""
    return {"status": "ok", "message": "Server is running"}
