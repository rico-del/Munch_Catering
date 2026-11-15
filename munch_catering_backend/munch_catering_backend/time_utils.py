from __future__ import annotations

from datetime import datetime, timezone

try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def daraja_timestamp(value: datetime | None = None) -> str:
    return (value or utc_now()).strftime("%Y%m%d%H%M%S")
