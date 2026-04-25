from fastapi import APIRouter, HTTPException, status

from munch_catering_backend.auth_utils import create_token, hash_password, verify_password
from munch_catering_backend.database import get_db
from munch_catering_backend.models import AuthResponse, UserLogin, UserProfile, UserReactivate, UserRegister
from munch_catering_backend.time_utils import utc_now

router = APIRouter(prefix="/auth", tags=["Auth"])


def build_user_profile(document: dict) -> UserProfile:
    return UserProfile(
        id=str(document["_id"]),
        full_name=document["full_name"],
        username=document["username"],
        email=document["email"],
        role=document.get("role", "customer"),
        created_at=document.get("created_at"),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister):
    db = get_db()
    normalized_email = user.email.lower()
    existing_user = await db.users.find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    document = user.model_dump()
    document["email"] = normalized_email
    document["password"] = hash_password(user.password)
    document["created_at"] = utc_now()
    result = await db.users.insert_one(document)

    persisted = {**document, "_id": result.inserted_id}
    token = create_token({"sub": normalized_email, "uid": str(result.inserted_id), "role": document["role"]})
    return AuthResponse(token=token, user=build_user_profile(persisted))


@router.post("/login", response_model=AuthResponse)
async def login(user: UserLogin):
    db = get_db()
    normalized_email = user.email.lower()
    db_user = await db.users.find_one({"email": normalized_email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if db_user.get("is_disabled"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been disabled")

    token = create_token({"sub": normalized_email, "uid": str(db_user["_id"]), "role": db_user.get("role", "customer")})
    return AuthResponse(token=token, user=build_user_profile(db_user))


@router.post("/reactivate", response_model=AuthResponse)
async def reactivate(user: UserReactivate):
    db = get_db()
    normalized_email = user.email.lower()
    db_user = await db.users.find_one({"email": normalized_email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not db_user.get("is_disabled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is already active")

    now = utc_now()
    await db.users.update_one(
        {"email": normalized_email},
        {"$set": {"is_disabled": False, "reactivated_at": now, "updated_at": now}, "$unset": {"disabled_at": ""}},
    )
    if db_user.get("role") == "caterer":
        await db.caterers.update_one(
            {"owner_id": str(db_user["_id"])},
            {"$set": {"is_active": True, "reactivated_at": now, "updated_at": now}, "$unset": {"disabled_at": ""}},
        )

    db_user["is_disabled"] = False
    token = create_token({"sub": normalized_email, "uid": str(db_user["_id"]), "role": db_user.get("role", "customer")})
    return AuthResponse(token=token, user=build_user_profile(db_user))
