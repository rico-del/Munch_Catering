from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import get_current_principal, require_role
from munch_catering_backend.lifecycle import (
    BOOKING_STATUS_AWAITING_PAYMENT,
    PAYMENT_STATUS_UNPAID,
    booking_is_payable,
    booking_lifecycle_stage,
    normalize_booking_status,
    normalize_payment_status,
    normalize_quote_status,
    quote_is_checkout_ready,
    quote_lifecycle_stage,
    resolve_payment_mode,
    resolve_payment_provider,
)
from munch_catering_backend.models import (
    BookingCreateRequest,
    BookingResponse,
    Principal,
    PublicCatererListResponse,
    QuoteCreateRequest,
    QuoteResponse,
    QuoteUpdate,
    VendorStatsResponse,
)
from munch_catering_backend.time_utils import utc_now
from munch_catering_backend.utils import build_paginated_response, clamp_pagination, parse_object_id

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def serialize_booking(document: dict, caterer_name: str | None = None) -> BookingResponse:
    payment_provider = document.get("payment_provider") or resolve_payment_provider()
    payment_mode = document.get("payment_mode") or resolve_payment_mode()
    return BookingResponse(
        id=str(document["_id"]),
        caterer_id=document["caterer_id"],
        caterer_name=caterer_name or document.get("caterer_name", ""),
        customer_phone=document["customer_phone"],
        guest_count=document["guest_count"],
        selected_tier=document["selected_tier"],
        price_per_head=document["price_per_head"],
        total=document["total"],
        deposit=document["deposit"],
        balance=document["balance"],
        status=normalize_booking_status(document),
        payment_status=normalize_payment_status(document),
        lifecycle_stage=booking_lifecycle_stage(document),
        payment_provider=payment_provider,
        payment_mode=payment_mode,
        is_payable=booking_is_payable(document),
        source_quote_id=document.get("source_quote_id"),
        active_payment_id=document.get("active_payment_id"),
        event_date=document.get("event_date"),
        created_at=document.get("created_at"),
    )


def serialize_quote(document: dict, caterer_name: str | None = None) -> QuoteResponse:
    return QuoteResponse(
        id=str(document["_id"]),
        caterer_id=document["caterer_id"],
        caterer_name=caterer_name or document.get("caterer_name", ""),
        customer_email=document.get("customer_email"),
        description=document["description"],
        guest_count=document["guest_count"],
        budget_estimate=document["budget_estimate"],
        status=normalize_quote_status(document),
        lifecycle_stage=quote_lifecycle_stage(document),
        is_checkout_ready=quote_is_checkout_ready(document),
        approved_package_label=document.get("approved_package_label"),
        approved_price_per_head=document.get("approved_price_per_head"),
        approved_total=document.get("approved_total"),
        source_booking_id=document.get("source_booking_id"),
        created_at=document["created_at"],
    )


def get_booking_query_for_principal(principal: Principal) -> dict:
    if principal.role == "admin":
        return {}
    if principal.role == "caterer":
        return {"caterer_owner_id": principal.user_id}
    return {"customer_user_id": principal.user_id}


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    req: BookingCreateRequest,
    principal: Principal = Depends(require_role(("customer", "admin"))),
):
    db = get_db()
    caterer = await db.caterers.find_one({"_id": parse_object_id(req.caterer_id, "Invalid caterer id")})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")

    guest_count = req.guest_count
    selected_tier = req.selected_tier
    price_per_head = 0.0
    total = 0.0
    source_quote_id = None
    reserved_quote_token = None
    now = utc_now()

    if req.quote_id:
        quote_query = {"_id": parse_object_id(req.quote_id, "Invalid quote id")}
        if principal.role != "admin":
            quote_query["customer_user_id"] = principal.user_id

        quote = await db.quotes.find_one(quote_query)
        if not quote:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved quote not found")
        if normalize_quote_status(quote) == "converted_to_booking":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This approved quote has already been converted into a booking")
        if normalize_quote_status(quote) != "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved quotes can be checked out")
        if quote.get("caterer_id") != req.caterer_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quote does not belong to this caterer")

        existing_booking = await db.bookings.find_one({"source_quote_id": str(quote["_id"])})
        if existing_booking:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This approved quote has already been converted into a booking")

        reserved_quote_token = f"pending-booking:{uuid4().hex}"
        reservation = await db.quotes.update_one(
            {
                "_id": quote["_id"],
                "status": quote.get("status"),
                "source_booking_id": quote.get("source_booking_id"),
            },
            {
                "$set": {
                    "source_booking_id": reserved_quote_token,
                    "updated_at": now,
                }
            },
        )
        if reservation.matched_count != 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This approved quote is already being converted into a booking")

        guest_count = quote.get("guest_count", guest_count)
        source_quote_id = str(quote["_id"])
        approved_total = float(quote.get("approved_total") or quote.get("budget_estimate") or 0)
        approved_price = quote.get("approved_price_per_head")
        if approved_price is None:
            approved_price = round(approved_total / guest_count, 2) if guest_count else 0
        price_per_head = float(approved_price)
        total = round(approved_total, 2)
        selected_tier = quote.get("approved_package_label") or "Custom quote"
    else:
        available_tiers = caterer.get("tiers", [])
        selected_tier = selected_tier or (available_tiers[0]["name"] if available_tiers else None)
        if not selected_tier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tier selected")

        tier = next((item for item in available_tiers if item.get("name") == selected_tier), None)
        if not tier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tier selected")

        price_per_head = float(tier.get("price_per_head", 0))
        total = round(guest_count * price_per_head, 2)

    deposit = round(total * 0.20, 2)
    balance = round(total - deposit, 2)

    booking = {
        "caterer_id": req.caterer_id,
        "caterer_name": caterer.get("business_name", ""),
        "caterer_owner_id": caterer.get("owner_id"),
        "caterer_owner_email": caterer.get("owner_email"),
        "customer_user_id": principal.user_id,
        "customer_email": principal.email,
        "customer_phone": req.customer_phone,
        "guest_count": guest_count,
        "selected_tier": selected_tier,
        "price_per_head": price_per_head,
        "total": total,
        "deposit": deposit,
        "balance": balance,
        "source_quote_id": source_quote_id,
        "status": BOOKING_STATUS_AWAITING_PAYMENT,
        "payment_status": PAYMENT_STATUS_UNPAID,
        "payment_provider": resolve_payment_provider(),
        "payment_mode": resolve_payment_mode(),
        "event_date": req.event_date,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.bookings.insert_one(booking)
        booking["_id"] = result.inserted_id
        if source_quote_id:
            await db.quotes.update_one(
                {
                    "_id": parse_object_id(source_quote_id, "Invalid quote id"),
                    "source_booking_id": reserved_quote_token,
                },
                {
                    "$set": {
                        "status": "converted_to_booking",
                        "source_booking_id": str(result.inserted_id),
                        "updated_at": now,
                    }
                },
            )
        return serialize_booking(booking, caterer.get("business_name"))
    except Exception:
        if source_quote_id and reserved_quote_token:
            await db.quotes.update_one(
                {
                    "_id": parse_object_id(source_quote_id, "Invalid quote id"),
                    "source_booking_id": reserved_quote_token,
                },
                {
                    "$set": {
                        "source_booking_id": None,
                        "updated_at": utc_now(),
                    }
                },
            )
        raise


@router.get("", response_model=dict)
async def list_bookings(
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    query = get_booking_query_for_principal(principal)
    total = await db.bookings.count_documents(query)
    documents = await db.bookings.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    items = [serialize_booking(document).model_dump() for document in documents]
    return build_paginated_response(items, total, limit, offset)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_detail(
    booking_id: str,
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    query = {"_id": parse_object_id(booking_id, "Invalid booking id")}
    query.update(get_booking_query_for_principal(principal))
    booking = await db.bookings.find_one(query)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return serialize_booking(booking)


@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def request_quote(
    quote: QuoteCreateRequest,
    principal: Principal = Depends(require_role(("customer", "admin"))),
):
    db = get_db()
    caterer = await db.caterers.find_one({"_id": parse_object_id(quote.caterer_id, "Invalid caterer id")})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")

    document = {
        "caterer_id": quote.caterer_id,
        "caterer_name": caterer.get("business_name", ""),
        "caterer_owner_id": caterer.get("owner_id"),
        "customer_user_id": principal.user_id,
        "customer_email": principal.email,
        "description": quote.description,
        "guest_count": quote.guest_count,
        "budget_estimate": quote.budget_estimate,
        "status": "pending_review",
        "created_at": utc_now(),
    }
    result = await db.quotes.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_quote(document, caterer.get("business_name"))


@router.get("/quotes/history", response_model=dict)
async def get_quote_history(
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    if principal.role == "caterer":
        query = {"caterer_owner_id": principal.user_id}
    elif principal.role == "admin":
        query = {}
    else:
        query = {"customer_user_id": principal.user_id}

    total = await db.quotes.count_documents(query)
    quotes = await db.quotes.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    items = [serialize_quote(item).model_dump() for item in quotes]
    return build_paginated_response(items, total, limit, offset)


@router.patch("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote_status(
    quote_id: str,
    payload: QuoteUpdate,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    query = {"_id": parse_object_id(quote_id, "Invalid quote id")}
    if principal.role != "admin":
        query["caterer_owner_id"] = principal.user_id

    quote = await db.quotes.find_one(query)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")

    if normalize_quote_status(quote) == "converted_to_booking":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Converted quotes can no longer be updated")

    update_fields = {"status": payload.status, "updated_at": utc_now()}
    if payload.status == "approved":
        approved_total = payload.approved_total
        approved_price_per_head = payload.approved_price_per_head
        guest_count = quote.get("guest_count", 0) or 0

        if approved_total is None and approved_price_per_head is not None:
            approved_total = round(float(approved_price_per_head) * guest_count, 2)
        if approved_price_per_head is None and approved_total is not None and guest_count:
            approved_price_per_head = round(float(approved_total) / guest_count, 2)
        if approved_total is None and approved_price_per_head is None:
            approved_total = round(float(quote.get("budget_estimate", 0)), 2)
            approved_price_per_head = round(approved_total / guest_count, 2) if guest_count else 0.0

        update_fields["approved_package_label"] = payload.approved_package_label or "Custom quote"
        update_fields["approved_total"] = round(float(approved_total), 2)
        update_fields["approved_price_per_head"] = round(float(approved_price_per_head), 2)
    elif payload.status == "rejected":
        update_fields["approved_package_label"] = None
        update_fields["approved_total"] = None
        update_fields["approved_price_per_head"] = None

    await db.quotes.update_one(query, {"$set": update_fields})
    quote = await db.quotes.find_one(query)
    return serialize_quote(quote)
