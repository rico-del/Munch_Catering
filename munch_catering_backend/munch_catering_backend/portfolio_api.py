import logging
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import get_current_principal, require_role
from munch_catering_backend.models import Principal, PortfolioImageUpdate, Review, ReviewCreate, ReviewListResponse
from munch_catering_backend.time_utils import utc_now
from munch_catering_backend.utils import clamp_pagination, parse_object_id, read_validated_upload, sanitize_filename

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["Portfolio & Reviews"])

PORTFOLIO_DIR = "portfolio_images"
os.makedirs(PORTFOLIO_DIR, exist_ok=True)


def normalize_portfolio_items(items: list[dict]) -> list[dict]:
    normalized = []
    primary_seen = False
    for item in items:
        current = dict(item)
        current["caption"] = (current.get("caption") or "")[:240]
        current["description"] = (current.get("description") or "")[:1200]
        is_primary = bool(current.get("is_primary"))
        if is_primary and not primary_seen:
            primary_seen = True
            current["is_primary"] = True
        else:
            current["is_primary"] = False
        normalized.append(current)

    if normalized and not primary_seen:
        normalized[0]["is_primary"] = True
    return normalized


def resolve_primary_portfolio_image(items: list[dict]) -> dict | None:
    if not items:
        return None
    return next((item for item in items if item.get("is_primary")), items[0])


async def save_portfolio(db, owner_id: str, portfolio: list[dict]):
    await db.caterers.update_one(
        {"owner_id": owner_id},
        {
            "$set": {
                "portfolio": normalize_portfolio_items(portfolio),
                "updated_at": utc_now(),
            }
        },
    )


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_portfolio_image(
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    description: str = Form(default=""),
    is_primary: str = Form(default="false"),
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    caterer = await db.caterers.find_one({"owner_id": principal.user_id})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer profile not found")

    content = await read_validated_upload(file)
    filename = sanitize_filename(file.filename)
    image_id = uuid4().hex
    filepath = os.path.join(PORTFOLIO_DIR, filename)

    with open(filepath, "wb") as handle:
        handle.write(content)

    portfolio = normalize_portfolio_items(caterer.get("portfolio", []))

    wants_primary = str(is_primary).strip().lower() in {"1", "true", "yes", "on"}

    image_record = {
        "id": image_id,
        "filename": filename,
        "url": f"/portfolio/images/{filename}",
        "caption": caption[:240],
        "description": description[:1200],
        "is_primary": wants_primary or not portfolio,
        "uploaded_at": utc_now(),
    }
    if image_record["is_primary"]:
        portfolio = [{**item, "is_primary": False} for item in portfolio]
    portfolio.append(image_record)
    await save_portfolio(db, principal.user_id, portfolio)
    return image_record


@router.get("/me")
async def get_my_portfolio(principal: Principal = Depends(require_role(("caterer", "admin")))):
    db = get_db()
    caterer = await db.caterers.find_one({"owner_id": principal.user_id}, {"portfolio": 1})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer profile not found")
    return {"items": caterer.get("portfolio", [])}


@router.delete("/images/{image_id}")
async def delete_portfolio_image(
    image_id: str,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    caterer = await db.caterers.find_one({"owner_id": principal.user_id}, {"portfolio": 1})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer profile not found")

    image = next((item for item in caterer.get("portfolio", []) if item.get("id") == image_id), None)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio image not found")

    remaining = [item for item in caterer.get("portfolio", []) if item.get("id") != image_id]
    await save_portfolio(db, principal.user_id, remaining)

    filepath = os.path.join(PORTFOLIO_DIR, image["filename"])
    if os.path.exists(filepath):
        os.remove(filepath)

    return {"message": "Image deleted successfully", "deleted_image_id": image_id}


@router.patch("/images/{image_id}")
async def update_portfolio_image(
    image_id: str,
    payload: PortfolioImageUpdate,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    caterer = await db.caterers.find_one({"owner_id": principal.user_id}, {"portfolio": 1})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer profile not found")

    portfolio = []
    found = False
    for item in caterer.get("portfolio", []):
        current = dict(item)
        if current.get("id") == image_id:
            found = True
            if payload.caption is not None:
                current["caption"] = payload.caption[:240]
            if payload.description is not None:
                current["description"] = payload.description[:1200]
            if payload.is_primary is not None:
                current["is_primary"] = payload.is_primary
        elif payload.is_primary:
            current["is_primary"] = False
        portfolio.append(current)

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio image not found")

    await save_portfolio(db, principal.user_id, portfolio)
    updated = next(item for item in normalize_portfolio_items(portfolio) if item.get("id") == image_id)
    return updated


@router.get("/caterers/{caterer_id}")
async def get_caterer_portfolio(
    caterer_id: str,
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    caterer = await db.caterers.find_one({"_id": parse_object_id(caterer_id, "Invalid caterer id")}, {"portfolio": 1})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")
    portfolio = caterer.get("portfolio", [])
    items = portfolio[offset : offset + limit]
    return {"items": items, "total": len(portfolio), "limit": limit, "offset": offset}


@router.post("/reviews", response_model=ReviewListResponse)
async def add_review(
    payload: ReviewCreate,
    principal: Principal = Depends(require_role(("customer", "admin"))),
):
    db = get_db()
    caterer_oid = parse_object_id(payload.caterer_id, "Invalid caterer id")
    caterer = await db.caterers.find_one({"_id": caterer_oid})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")

    prior_booking = await db.bookings.find_one(
        {"caterer_id": payload.caterer_id, "customer_user_id": principal.user_id}
    )
    if not prior_booking and principal.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only customers with bookings can review this caterer")

    existing_review = next(
        (item for item in caterer.get("reviews", []) if item.get("reviewer_id") == principal.user_id),
        None,
    )
    if existing_review:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already reviewed this caterer")

    review = Review(
        id=uuid4().hex,
        reviewer_id=principal.user_id,
        reviewer_email=principal.email,
        reviewer_name=principal.full_name or principal.username or principal.email,
        rating=payload.rating,
        comment=payload.comment,
    )
    reviews = caterer.get("reviews", []) + [review.model_dump()]
    avg_rating = round(sum(item["rating"] for item in reviews) / len(reviews), 2)

    await db.caterers.update_one(
        {"_id": caterer_oid},
        {
            "$push": {"reviews": review.model_dump()},
            "$set": {
                "rating": avg_rating,
                "review_count": len(reviews),
                "updated_at": utc_now(),
            },
        },
    )
    return ReviewListResponse(reviews=[Review(**item) for item in reviews], rating=avg_rating, review_count=len(reviews))


@router.get("/reviews/{caterer_id}", response_model=ReviewListResponse)
async def get_caterer_reviews(caterer_id: str):
    db = get_db()
    caterer = await db.caterers.find_one(
        {"_id": parse_object_id(caterer_id, "Invalid caterer id")},
        {"reviews": 1, "rating": 1, "review_count": 1},
    )
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")
    reviews = [Review(**item) for item in caterer.get("reviews", [])]
    return ReviewListResponse(
        reviews=reviews,
        rating=caterer.get("rating", 0.0),
        review_count=caterer.get("review_count", 0),
    )


@router.get("/top-rated")
async def get_top_rated_caterers(limit: int = Query(default=10, ge=1, le=25)):
    db = get_db()
    caterers = await db.caterers.find(
        {"review_count": {"$gt": 0}},
        {"business_name": 1, "rating": 1, "review_count": 1, "portfolio": 1, "description": 1, "price_from": 1},
    ).sort("rating", -1).limit(limit).to_list(limit)

    items = []
    for caterer in caterers:
        portfolio = caterer.get("portfolio", [])
        items.append(
            {
                "id": str(caterer["_id"]),
                "business_name": caterer.get("business_name", ""),
                "rating": caterer.get("rating", 0.0),
                "review_count": caterer.get("review_count", 0),
                "portfolio_preview": resolve_primary_portfolio_image(portfolio),
                "description": caterer.get("description", ""),
                "price_from": caterer.get("price_from", 0.0),
            }
        )
    return {"items": items, "total": len(items), "limit": limit, "offset": 0}
