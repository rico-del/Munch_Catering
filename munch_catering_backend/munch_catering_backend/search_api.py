from fastapi import APIRouter, HTTPException, Query, status

from munch_catering_backend.database import get_db
from munch_catering_backend.models import PublicCatererListResponse, PublicCatererProfile, CatererSummary
from munch_catering_backend.utils import clamp_pagination, parse_object_id

router = APIRouter(prefix="/search", tags=["Search & Discovery"])


def serialize_portfolio_preview(document: dict | None) -> dict | None:
    if not document:
        return None
    return {
        "id": document.get("id", document.get("filename", "")),
        "filename": document.get("filename", ""),
        "url": document.get("url", ""),
        "caption": document.get("caption", ""),
        "description": document.get("description", ""),
        "is_primary": bool(document.get("is_primary", False)),
        "uploaded_at": document.get("uploaded_at"),
    }


def resolve_primary_portfolio_image(portfolio: list[dict]) -> dict | None:
    if not portfolio:
        return None
    primary = next((item for item in portfolio if item.get("is_primary")), None)
    return primary or portfolio[0]


def serialize_caterer_summary(document: dict) -> CatererSummary:
    portfolio = document.get("portfolio", [])
    return CatererSummary(
        id=str(document["_id"]),
        business_name=document.get("business_name", ""),
        description=document.get("description", ""),
        phone=document.get("phone"),
        location=document.get("location"),
        rating=document.get("rating", 0.0),
        review_count=document.get("review_count", 0),
        price_from=document.get("price_from", 0.0),
        hero_tagline=document.get("hero_tagline", ""),
        cuisines=document.get("cuisines", []),
        portfolio_preview=serialize_portfolio_preview(resolve_primary_portfolio_image(portfolio)),
    )


def serialize_caterer_profile(document: dict) -> PublicCatererProfile:
    return PublicCatererProfile(
        id=str(document["_id"]),
        business_name=document.get("business_name", ""),
        description=document.get("description", ""),
        phone=document.get("phone"),
        location=document.get("location"),
        rating=document.get("rating", 0.0),
        review_count=document.get("review_count", 0),
        portfolio=document.get("portfolio", []),
        reviews=document.get("reviews", []),
        tiers=document.get("tiers", []),
        price_from=document.get("price_from", 0.0),
        hero_tagline=document.get("hero_tagline", ""),
        cuisines=document.get("cuisines", []),
    )


@router.get("/caterers", response_model=PublicCatererListResponse)
async def get_all_caterers(
    tier: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    query = {"tiers.name": tier} if tier else {}
    total = await db.caterers.count_documents(query)
    documents = await db.caterers.find(query).sort("rating", -1).skip(offset).limit(limit).to_list(limit)
    items = [serialize_caterer_summary(document) for document in documents]
    return PublicCatererListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/caterers/{caterer_id}", response_model=PublicCatererProfile)
async def get_caterer_detail(caterer_id: str):
    db = get_db()
    caterer = await db.caterers.find_one({"_id": parse_object_id(caterer_id, "Invalid caterer id")})
    if not caterer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer not found")
    return serialize_caterer_profile(caterer)
