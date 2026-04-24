from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import require_role
from munch_catering_backend.lifecycle import (
    BOOKING_STATUS_AWAITING_PAYMENT,
    BOOKING_STATUS_CONFIRMED,
    PAYMENT_STATUS_FAILED,
    PAYMENT_STATUS_PAID,
    PAYMENT_STATUS_PENDING,
    booking_has_pending_payment,
    get_booking_lifecycle,
)
from munch_catering_backend.models import (
    PaymentInitiationRequest,
    PaymentInitiationResponse,
    Principal,
    TestPaymentSimulationRequest,
)
from munch_catering_backend.payment_providers import get_payment_provider
from munch_catering_backend.settings import settings
from munch_catering_backend.time_utils import utc_now
from munch_catering_backend.utils import parse_object_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Payments"])


def normalize_phone(phone: str) -> str:
    value = (phone or "").strip()
    if value.startswith("+"):
        value = value[1:]
    if value.startswith("0") and len(value) == 10:
        value = "254" + value[1:]
    if not value.isdigit() or len(value) != 12 or not value.startswith("254"):
        raise ValueError("Phone number must be a valid Kenyan mobile number")
    return value


async def _get_scoped_booking(booking_id: str, principal: Principal) -> dict:
    db = get_db()
    booking = await db.bookings.find_one({"_id": parse_object_id(booking_id, "Invalid booking id")})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if principal.role != "admin" and booking.get("customer_user_id") != principal.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this booking")
    return booking


async def _initiate_payment(payment: PaymentInitiationRequest, principal: Principal) -> PaymentInitiationResponse:
    db = get_db()
    booking = await _get_scoped_booking(payment.booking_id, principal)
    lifecycle = get_booking_lifecycle(booking)

    try:
        phone_number = normalize_phone(booking["customer_phone"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    amount = float(booking.get("deposit", 0))
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking deposit is not payable")
    if lifecycle.payment_status == PAYMENT_STATUS_PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking has already been paid")
    if booking_has_pending_payment(booking):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A payment request is already in progress for this booking")
    if not lifecycle.is_payable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking is not eligible for payment")

    existing_payment = await db.payments.find_one(
        {
            "booking_id": str(booking["_id"]),
            "status": PAYMENT_STATUS_PENDING,
        }
    )
    if existing_payment:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A payment request is already in progress for this booking")

    payment_id = uuid4().hex
    now = utc_now()
    payment_provider = get_payment_provider()

    lock_result = await db.bookings.update_one(
        {
            "_id": booking["_id"],
            "active_payment_id": booking.get("active_payment_id"),
            "payment_status": booking.get("payment_status"),
        },
        {
            "$set": {
                "active_payment_id": payment_id,
                "payment_status": PAYMENT_STATUS_PENDING,
                "payment_provider": payment_provider.provider_name,
                "payment_mode": payment_provider.mode,
                "updated_at": now,
            }
        },
    )
    if lock_result.matched_count != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking is already processing a payment")

    payment_document = {
        "_id": payment_id,
        "booking_id": str(booking["_id"]),
        "customer_user_id": booking.get("customer_user_id"),
        "phone": phone_number,
        "amount": amount,
        "status": PAYMENT_STATUS_PENDING,
        "provider": payment_provider.provider_name,
        "mode": payment_provider.mode,
        "provider_reference": None,
        "created_at": now,
        "updated_at": now,
        "callback_payload": None,
        "request_payload": None,
    }

    try:
        provider_result = await payment_provider.initiate_payment(booking, phone_number, amount, payment_id)
        payment_document["provider_reference"] = provider_result.provider_reference
        payment_document["request_payload"] = provider_result.raw_payload
        await db.payments.insert_one(payment_document)
        return PaymentInitiationResponse(
            payment_id=payment_id,
            booking_id=str(booking["_id"]),
            amount=amount,
            phone=phone_number,
            status=PAYMENT_STATUS_PENDING,
            provider_reference=provider_result.provider_reference,
            provider=payment_provider.provider_name,
            mode=payment_provider.mode,
        )
    except HTTPException:
        await db.bookings.update_one(
            {"_id": booking["_id"], "active_payment_id": payment_id},
            {
                "$set": {
                    "active_payment_id": None,
                    "payment_status": lifecycle.payment_status,
                    "updated_at": utc_now(),
                }
            },
        )
        raise


async def _finalize_payment(provider_reference: str, outcome: str, payload: dict) -> dict:
    db = get_db()
    payment = await db.payments.find_one(
        {
            "$or": [
                {"provider_reference": provider_reference},
                {"request_payload.MerchantRequestID": provider_reference},
            ]
        }
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown payment reference")

    current_status = str(payment.get("status") or "").lower()
    if current_status == PAYMENT_STATUS_PAID and outcome == PAYMENT_STATUS_PAID:
        return {"status": "callback received", "duplicate": True}
    if current_status == PAYMENT_STATUS_FAILED and outcome == PAYMENT_STATUS_FAILED:
        return {"status": "callback received", "duplicate": True}

    booking = await db.bookings.find_one({"_id": parse_object_id(payment["booking_id"], "Invalid booking id")})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    lifecycle = get_booking_lifecycle(booking)
    if lifecycle.payment_status == PAYMENT_STATUS_PAID and payment.get("_id") != booking.get("active_payment_id"):
        await db.payments.update_one(
            {"_id": payment["_id"]},
            {
                "$set": {
                    "status": PAYMENT_STATUS_FAILED,
                    "callback_payload": payload,
                    "updated_at": utc_now(),
                }
            },
        )
        return {"status": "callback received", "duplicate": True}

    payment_update = {
        "status": outcome,
        "callback_payload": payload,
        "updated_at": utc_now(),
    }
    booking_update = {
        "updated_at": utc_now(),
        "active_payment_id": None,
    }
    if outcome == PAYMENT_STATUS_PAID:
        booking_update["payment_status"] = PAYMENT_STATUS_PAID
        booking_update["status"] = BOOKING_STATUS_CONFIRMED
        booking_update["confirmed_at"] = utc_now()
    else:
        booking_update["payment_status"] = PAYMENT_STATUS_FAILED
        booking_update["status"] = lifecycle.booking_status if lifecycle.booking_status != BOOKING_STATUS_CONFIRMED else BOOKING_STATUS_AWAITING_PAYMENT

    await db.payments.update_one({"_id": payment["_id"]}, {"$set": payment_update})
    await db.bookings.update_one({"_id": booking["_id"]}, {"$set": booking_update})
    return {"status": "callback received"}


@router.post("/payments/initiate", response_model=PaymentInitiationResponse)
@router.post("/mpesa/stk-push", response_model=PaymentInitiationResponse)
async def initiate_payment(
    payment: PaymentInitiationRequest,
    principal: Principal = Depends(require_role(("customer", "admin"))),
):
    return await _initiate_payment(payment, principal)


@router.post("/payments/callback/mpesa")
@router.post("/mpesa/callback")
async def mpesa_callback(data: dict):
    callback = (((data or {}).get("Body") or {}).get("stkCallback") or {})
    provider_reference = callback.get("CheckoutRequestID") or callback.get("MerchantRequestID")
    if not provider_reference:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing payment reference")

    result_code = str(callback.get("ResultCode", ""))
    outcome = PAYMENT_STATUS_PAID if result_code == "0" else PAYMENT_STATUS_FAILED
    return await _finalize_payment(provider_reference, outcome, data)


@router.post("/payments/test/complete")
async def complete_test_payment(
    payload: TestPaymentSimulationRequest,
    principal: Principal = Depends(require_role(("customer", "admin"))),
):
    if settings.PAYMENT_PROVIDER != "test":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test payment simulation is disabled")

    db = get_db()
    payment = await db.payments.find_one({"_id": payload.payment_id})
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if principal.role != "admin" and payment.get("customer_user_id") != principal.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this payment")
    if payment.get("provider") != "test":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only test payments can be simulated")

    simulation_payload = {
        "provider": "test",
        "payment_id": payload.payment_id,
        "provider_reference": payment.get("provider_reference"),
        "outcome": payload.outcome,
        "simulated_at": utc_now().isoformat(),
    }
    return await _finalize_payment(payment["provider_reference"], payload.outcome, simulation_payload)
