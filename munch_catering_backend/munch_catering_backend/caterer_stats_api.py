from fastapi import APIRouter, Depends, Query

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import ensure_admin_routes_enabled, require_role
from munch_catering_backend.lifecycle import normalize_booking_status, normalize_payment_status
from munch_catering_backend.models import AdminStatsResponse, Principal
from munch_catering_backend.utils import build_paginated_response, clamp_pagination

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(principal: Principal = Depends(require_role("admin"))):
    ensure_admin_routes_enabled()
    db = get_db()
    total_users = await db.users.count_documents({})
    bookings = await db.bookings.find({}).to_list(None)
    total_revenue = round(sum(booking.get("total", 0) for booking in bookings), 2)
    return AdminStatsResponse(
        total_users=total_users,
        total_bookings=len(bookings),
        total_revenue=total_revenue,
    )


@router.get("/bookings", response_model=dict)
async def admin_bookings(
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_role("admin")),
):
    ensure_admin_routes_enabled()
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    total = await db.bookings.count_documents({})
    bookings = await db.bookings.find({}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    items = []
    for booking in bookings:
        items.append(
            {
                "id": str(booking["_id"]),
                "caterer_id": booking["caterer_id"],
                "caterer_name": booking.get("caterer_name", ""),
                "customer_email": booking.get("customer_email"),
                "guest_count": booking["guest_count"],
                "selected_tier": booking["selected_tier"],
                "total": booking["total"],
                "deposit": booking["deposit"],
                "balance": booking["balance"],
                "status": normalize_booking_status(booking),
                "payment_status": normalize_payment_status(booking),
                "created_at": booking.get("created_at"),
            }
        )
    return build_paginated_response(items, total, limit, offset)
