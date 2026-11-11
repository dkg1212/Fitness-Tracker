"""Clerk session-token verification and per-user Mongo profile provisioning."""

import os

from clerk_backend_api.security import AuthenticateRequestOptions, authenticate_request_async
from fastapi import HTTPException, Request

from lib.db import db


def validate_auth_config() -> None:
    if not os.getenv("CLERK_SECRET_KEY", "").startswith("sk_"):
        raise RuntimeError("CLERK_SECRET_KEY must be set in backend/.env")


def _authorized_parties() -> list[str]:
    """
    Trusted Clerk party origins — the list of frontend origins whose JWTs we accept.

    Priority:
    1. CLERK_AUTHORIZED_PARTIES (comma-separated, explicit, recommended for production)
    2. Falls back to CORS_ORIGINS for local development convenience.

    Why separate from CORS_ORIGINS (RISK-02): CORS_ORIGINS may include wildcard or
    test origins that should not be trusted as JWT parties.  In production, set
    CLERK_AUTHORIZED_PARTIES to exactly your frontend domain(s).
    """
    raw = os.getenv("CLERK_AUTHORIZED_PARTIES") or os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


async def current_user(request: Request) -> dict:
    """FastAPI dependency: verified Clerk user plus a local Mongo profile."""
    state = await authenticate_request_async(
        request,
        AuthenticateRequestOptions(
            secret_key=os.environ["CLERK_SECRET_KEY"],
            authorized_parties=_authorized_parties(),
        ),
    )
    if not state.is_authenticated or not state.payload or not state.payload.get("sub"):
        raise HTTPException(status_code=401, detail="Not authenticated")

    clerk_id = state.payload["sub"]

    # Normalise email to lowercase to prevent duplicate user documents when
    # Clerk supplies the same address with different casing (RISK-03).
    raw_email = state.payload.get("email") or f"{clerk_id}@clerk.local"
    email = raw_email.lower()

    await db.users.update_one(
        {"id": clerk_id},
        {"$setOnInsert": {
            "id": clerk_id,
            "email": email,
            "name": state.payload.get("username") or "Athlete",
        }},
        upsert=True,
    )
    user = await db.users.find_one({"id": clerk_id}, {"_id": 0})
    return user
