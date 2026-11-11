from datetime import datetime
import os
from zoneinfo import ZoneInfo

# Cache the ZoneInfo object at import time so os.getenv + ZoneInfo() are not
# called on every request (BUG-06).
_TZ = ZoneInfo(os.getenv("APP_TZ", "UTC"))


def today_iso() -> str:
    return datetime.now(_TZ).date().isoformat()


def get_app_tz() -> ZoneInfo:
    """Return the application timezone (cached)."""
    return _TZ
