from fastapi import APIRouter, Depends, HTTPException, status

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import get_current_principal, require_role
from munch_catering_backend.models import CatererProfile, CatererProfileUpdate, Principal, UserProfile, UserUpdate
from munch_catering_backend.time_utils import utc_now

router = APIRouter(prefix="/user", tags=["User"])


def serialize_user(document: dict) -> UserProfile:
    return UserProfile(
        id=str(document["_id"]),
        full_name=document["full_name"],
        username=document["username"],
        email=document["email"],
        role=document.get("role", "customer"),
        created_at=document.get("created_at"),
    )


def serialize_caterer(document: dict) -> CatererProfile:
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    return CatererProfile(**document)


@router.get("/me", response_model=UserProfile)
async def get_current_user(principal: Principal = Depends(get_current_principal)):
    db = get_db()
    user = await db.users.find_one({"email": principal.email}, {"password": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@router.patch("/me", response_model=UserProfile)
async def update_current_user(
    data: UserUpdate,
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    await db.users.update_one(
        {"email": principal.email},
        {"$set": {"full_name": data.full_name, "username": data.username}},
    )
    user = await db.users.find_one({"email": principal.email}, {"password": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize_user(user)


@router.get("/me/caterer", response_model=CatererProfile)
async def get_caterer_profile(principal: Principal = Depends(require_role(("caterer", "admin")))):
    db = get_db()
    profile = await db.caterers.find_one({"owner_id": principal.user_id})
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caterer profile not found")
    return serialize_caterer(profile)


@router.put("/me/caterer", response_model=CatererProfile)
async def update_caterer_profile(
    payload: CatererProfileUpdate,
    principal: Principal = Depends(require_role(("caterer", "admin"))),
):
    db = get_db()
    profile = await db.caterers.find_one({"owner_id": principal.user_id})
    now = utc_now()

    existing_portfolio = profile.get("portfolio", []) if profile else []
    existing_reviews = profile.get("reviews", []) if profile else []
    existing_created_at = profile.get("created_at", now) if profile else now
    computed_price_from = min((tier.price_per_head for tier in payload.tiers), default=0.0)

    document = {
        "owner_id": principal.user_id,
        "owner_email": principal.email,
        "business_name": payload.business_name,
        "description": payload.description,
        "phone": payload.phone,
        "location": payload.location,
        "rating": profile.get("rating", 0.0) if profile else 0.0,
        "review_count": profile.get("review_count", 0) if profile else 0,
        "portfolio": existing_portfolio,
        "reviews": existing_reviews,
        "tiers": [tier.model_dump() for tier in payload.tiers],
        "price_from": computed_price_from,
        "hero_tagline": payload.hero_tagline,
        "cuisines": payload.cuisines,
        "created_at": existing_created_at,
        "updated_at": now,
    }

    await db.caterers.update_one({"owner_id": principal.user_id}, {"$set": document}, upsert=True)
    saved = await db.caterers.find_one({"owner_id": principal.user_id})
    if not saved:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist caterer profile")
    return serialize_caterer(saved)
