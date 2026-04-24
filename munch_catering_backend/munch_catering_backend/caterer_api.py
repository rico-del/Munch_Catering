from fastapi import APIRouter, Depends

from munch_catering_backend.dependencies import require_role
from munch_catering_backend.lifecycle import booking_lifecycle_stage, normalize_payment_status, quote_lifecycle_stage
from munch_catering_backend.models import CatererProfile, CatererProfileUpdate, Principal, VendorStatsResponse
from munch_catering_backend.user_profile_api import update_caterer_profile
from munch_catering_backend.database import get_db

router = APIRouter(prefix="/caterer", tags=["Caterer Dashboard"])


@router.put("/profile", response_model=CatererProfile)
async def put_profile(
    payload: CatererProfileUpdate,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    return await update_caterer_profile(payload, principal)


@router.post("/update-profile", response_model=CatererProfile)
async def legacy_update_profile(
    payload: CatererProfileUpdate,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    return await update_caterer_profile(payload, principal)


@router.get("/stats", response_model=VendorStatsResponse)
async def get_caterer_stats(
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    booking_query = {} if principal.role == "admin" else {"caterer_owner_id": principal.user_id}
    quote_query = {} if principal.role == "admin" else {"caterer_owner_id": principal.user_id}
    bookings = await db.bookings.find(booking_query).to_list(None)
    quotes = await db.quotes.find(quote_query).to_list(None)

    total_bookings = len(bookings)
    confirmed_bookings = len(
        [
            booking
            for booking in bookings
            if booking_lifecycle_stage(booking) in {"confirmed", "completed"}
        ]
    )
    pending_bookings = len([booking for booking in bookings if booking_lifecycle_stage(booking) == "awaiting_payment"])
    paid_bookings = len([booking for booking in bookings if normalize_payment_status(booking) == "paid"])
    total_revenue = round(
        sum(booking.get("total", 0) for booking in bookings if normalize_payment_status(booking) == "paid"),
        2,
    )
    approved_quotes = len([quote for quote in quotes if quote_lifecycle_stage(quote) == "quote_approved_awaiting_payment"])
    pending_quotes = len([quote for quote in quotes if quote_lifecycle_stage(quote) == "request_pending"])
    average_booking_value = round(sum(booking.get("total", 0) for booking in bookings) / total_bookings, 2) if total_bookings else 0.0
    inquiry_conversion_rate = round((approved_quotes / len(quotes)) * 100, 1) if quotes else 0.0

    return VendorStatsResponse(
        total_bookings=total_bookings,
        confirmed_bookings=confirmed_bookings,
        pending_bookings=pending_bookings,
        total_revenue=total_revenue,
        paid_bookings=paid_bookings,
        approved_quotes=approved_quotes,
        pending_quotes=pending_quotes,
        average_booking_value=average_booking_value,
        inquiry_conversion_rate=inquiry_conversion_rate,
    )
