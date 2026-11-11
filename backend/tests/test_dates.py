"""
Unit tests for lib/dates.py
Covers: today_iso returns a valid ISO date string; get_app_tz returns a ZoneInfo.
"""
import re
from zoneinfo import ZoneInfo

from lib.dates import get_app_tz, today_iso


def test_today_iso_format():
    result = today_iso()
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", result), f"Unexpected date format: {result}"


def test_today_iso_valid_date():
    from datetime import date
    result = today_iso()
    parsed = date.fromisoformat(result)   # raises if invalid
    assert parsed.year >= 2024


def test_get_app_tz_returns_zoneinfo():
    tz = get_app_tz()
    assert isinstance(tz, ZoneInfo)


def test_today_iso_consistent_with_get_app_tz():
    """today_iso and get_app_tz must use the same timezone."""
    from datetime import datetime
    tz = get_app_tz()
    expected = datetime.now(tz).date().isoformat()
    assert today_iso() == expected
