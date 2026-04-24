from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from munch_catering_backend.settings import settings

BOOKING_STATUS_AWAITING_PAYMENT = "awaiting_payment"
BOOKING_STATUS_CONFIRMED = "confirmed"
BOOKING_STATUS_COMPLETED = "completed"
BOOKING_STATUS_CANCELLED = "cancelled"

PAYMENT_STATUS_UNPAID = "unpaid"
PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_PAID = "paid"
PAYMENT_STATUS_FAILED = "failed"

QUOTE_STATUS_PENDING_REVIEW = "pending_review"
QUOTE_STATUS_CONTACTED = "contacted"
QUOTE_STATUS_APPROVED = "approved"
QUOTE_STATUS_CONVERTED_TO_BOOKING = "converted_to_booking"
QUOTE_STATUS_REJECTED = "rejected"

QUOTE_STAGE_REQUEST_PENDING = "request_pending"
QUOTE_STAGE_APPROVED_AWAITING_PAYMENT = "quote_approved_awaiting_payment"
QUOTE_STAGE_BOOKING_CONVERTED = "booking_converted"
QUOTE_STAGE_REQUEST_REJECTED = "request_rejected"

PAYMENT_RETRYABLE_STATUSES = frozenset({PAYMENT_STATUS_UNPAID, PAYMENT_STATUS_FAILED})


LEGACY_BOOKING_STATUS_MAP = {
    "awaiting deposit": BOOKING_STATUS_AWAITING_PAYMENT,
    "awaiting_payment": BOOKING_STATUS_AWAITING_PAYMENT,
    "confirmed": BOOKING_STATUS_CONFIRMED,
    "completed": BOOKING_STATUS_COMPLETED,
    "cancelled": BOOKING_STATUS_CANCELLED,
    "canceled": BOOKING_STATUS_CANCELLED,
}

LEGACY_PAYMENT_STATUS_MAP = {
    "pending": PAYMENT_STATUS_PENDING,
    "processing": PAYMENT_STATUS_PENDING,
    "in_progress": PAYMENT_STATUS_PENDING,
    "unpaid": PAYMENT_STATUS_UNPAID,
    "paid": PAYMENT_STATUS_PAID,
    "success": PAYMENT_STATUS_PAID,
    "succeeded": PAYMENT_STATUS_PAID,
    "failed": PAYMENT_STATUS_FAILED,
    "cancelled": PAYMENT_STATUS_FAILED,
    "canceled": PAYMENT_STATUS_FAILED,
}

LEGACY_QUOTE_STATUS_MAP = {
    "pending_review": QUOTE_STATUS_PENDING_REVIEW,
    "contacted": QUOTE_STATUS_CONTACTED,
    "approved": QUOTE_STATUS_APPROVED,
    "booked": QUOTE_STATUS_CONVERTED_TO_BOOKING,
    "converted_to_booking": QUOTE_STATUS_CONVERTED_TO_BOOKING,
    "rejected": QUOTE_STATUS_REJECTED,
}


@dataclass(frozen=True)
class BookingLifecycleSnapshot:
    booking_status: str
    payment_status: str
    payment_in_progress: bool
    is_payable: bool


def normalize_booking_status(document: dict[str, Any]) -> str:
    payment_status = normalize_payment_status(document)
    raw = str(document.get("status") or "").strip().lower()
    normalized = LEGACY_BOOKING_STATUS_MAP.get(raw)
    if normalized:
        if normalized == BOOKING_STATUS_AWAITING_PAYMENT and payment_status == PAYMENT_STATUS_PAID:
            return BOOKING_STATUS_CONFIRMED
        return normalized
    if payment_status == PAYMENT_STATUS_PAID:
        return BOOKING_STATUS_CONFIRMED
    return BOOKING_STATUS_AWAITING_PAYMENT


def normalize_payment_status(document: dict[str, Any]) -> str:
    raw = str(document.get("payment_status") or "").strip().lower()
    normalized = LEGACY_PAYMENT_STATUS_MAP.get(raw)
    if normalized:
        return normalized
    return PAYMENT_STATUS_UNPAID


def get_booking_lifecycle(document: dict[str, Any]) -> BookingLifecycleSnapshot:
    booking_status = normalize_booking_status(document)
    payment_status = normalize_payment_status(document)
    payment_in_progress = payment_status == PAYMENT_STATUS_PENDING
    is_payable = booking_status == BOOKING_STATUS_AWAITING_PAYMENT and payment_status in PAYMENT_RETRYABLE_STATUSES
    return BookingLifecycleSnapshot(
        booking_status=booking_status,
        payment_status=payment_status,
        payment_in_progress=payment_in_progress,
        is_payable=is_payable,
    )


def booking_has_pending_payment(document: dict[str, Any]) -> bool:
    return get_booking_lifecycle(document).payment_in_progress


def booking_lifecycle_stage(document: dict[str, Any]) -> str:
    return get_booking_lifecycle(document).booking_status


def booking_is_payable(document: dict[str, Any]) -> bool:
    return get_booking_lifecycle(document).is_payable


def normalize_quote_status(document: dict[str, Any]) -> str:
    if document.get("source_booking_id"):
        return QUOTE_STATUS_CONVERTED_TO_BOOKING
    raw = str(document.get("status") or "").strip().lower()
    return LEGACY_QUOTE_STATUS_MAP.get(raw, QUOTE_STATUS_PENDING_REVIEW)


def quote_lifecycle_stage(document: dict[str, Any]) -> str:
    status = normalize_quote_status(document)
    if status in {QUOTE_STATUS_PENDING_REVIEW, QUOTE_STATUS_CONTACTED}:
        return QUOTE_STAGE_REQUEST_PENDING
    if status == QUOTE_STATUS_APPROVED:
        return QUOTE_STAGE_APPROVED_AWAITING_PAYMENT
    if status == QUOTE_STATUS_REJECTED:
        return QUOTE_STAGE_REQUEST_REJECTED
    return QUOTE_STAGE_BOOKING_CONVERTED


def quote_is_checkout_ready(document: dict[str, Any]) -> bool:
    return quote_lifecycle_stage(document) == QUOTE_STAGE_APPROVED_AWAITING_PAYMENT


def resolve_payment_provider() -> str:
    return settings.PAYMENT_PROVIDER


def resolve_payment_mode() -> str:
    if settings.PAYMENT_PROVIDER == "test":
        return "test"
    return settings.MPESA_ENV
