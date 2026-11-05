"""Clerk session-token verification and per-user Mongo profile provisioning."""

import os

from clerk_backend_api.security import AuthenticateRequestOptions, authenticate_request_async
from fastapi import HTTPException, Request

from lib.db import db

def validate_auth_config() -> None:
    if not os.getenv("CLERK_SECRET_KEY", "").startswith("sk_"):
        raise RuntimeError("CLERK_SECRET_KEY must be set in backend/.env")


async def current_user(request: Request) -> dict:
    """FastAPI dependency: verified Clerk user plus a local Mongo profile."""
    allowed = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
    state = await authenticate_request_async(
        request,
        AuthenticateRequestOptions(secret_key=os.environ["CLERK_SECRET_KEY"], authorized_parties=allowed),
    )
    if not state.is_authenticated or not state.payload or not state.payload.get("sub"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    clerk_id = state.payload["sub"]
    email = state.payload.get("email") or f"{clerk_id}@clerk.local"
    await db.users.update_one(
        {"id": clerk_id},
        {"$setOnInsert": {"id": clerk_id, "email": email, "name": state.payload.get("username") or "Athlete"}},
        upsert=True,
    )
    user = await db.users.find_one({"id": clerk_id}, {"_id": 0})
    return user
