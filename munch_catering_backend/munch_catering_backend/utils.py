import logging
import os
import re
from math import ceil
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, UploadFile, status

from munch_catering_backend.settings import settings

logger = logging.getLogger(__name__)

IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def parse_object_id(value: str, detail: str = "Invalid resource id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def serialize_id(value: Any) -> str:
    return str(value)


def sanitize_document(document: dict | None) -> dict | None:
    if document is None:
        return None
    copy = dict(document)
    if "_id" in copy:
        copy["id"] = serialize_id(copy.pop("_id"))
    return copy


def clamp_pagination(limit: int | None, offset: int | None) -> tuple[int, int]:
    safe_limit = limit or settings.DEFAULT_PAGE_SIZE
    safe_offset = offset or 0
    safe_limit = max(1, min(safe_limit, settings.MAX_PAGE_SIZE))
    safe_offset = max(0, safe_offset)
    return safe_limit, safe_offset


def build_paginated_response(items: list[dict], total: int, limit: int, offset: int) -> dict:
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def sanitize_filename(filename: str | None) -> str:
    base_name = filename or "upload.bin"
    clean_name = re.sub(r"[^A-Za-z0-9._-]", "-", os.path.basename(base_name))
    root, ext = os.path.splitext(clean_name)
    ext = ext.lower() or ".bin"
    return f"{root[:40] or 'file'}-{uuid4().hex[:12]}{ext}"


async def read_validated_upload(file: UploadFile) -> bytes:
    if file.content_type not in IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image exceeds size limit")

    return content
