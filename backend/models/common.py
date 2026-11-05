from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator


def _as_utc(value: datetime) -> datetime:
    # motor returns naive datetimes (BSON is UTC) — re-attach the offset on read
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)