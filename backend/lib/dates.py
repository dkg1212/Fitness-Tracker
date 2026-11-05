from datetime import datetime
import os
from zoneinfo import ZoneInfo


def today_iso() -> str:
    timezone = ZoneInfo(os.getenv("APP_TZ", "UTC"))
    return datetime.now(timezone).date().isoformat()