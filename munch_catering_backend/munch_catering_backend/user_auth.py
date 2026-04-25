import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from munch_catering_backend.auth_utils import create_token, hash_password, verify_password
from munch_catering_backend.database import get_db
from munch_catering_backend.email_utils import send_password_reset_email
from munch_catering_backend.models import (
    AuthResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserLogin,
    UserProfile,
    UserReactivate,
    UserRegister,
)
from munch_catering_backend.settings import settings
from munch_catering_backend.time_utils import utc_now

router = APIRouter(prefix="/auth", tags=["Auth"])


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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


@router.post("/password-reset/request")
async def request_password_reset(payload: PasswordResetRequest):
    db = get_db()
    normalized_email = payload.email.lower()
    db_user = await db.users.find_one({"email": normalized_email})
    if not db_user:
        return {"message": "If an account exists, a password reset email has been sent."}

    reset_token = secrets.token_urlsafe(32)
    now = utc_now()
    await db.users.update_one(
        {"email": normalized_email},
        {
            "$set": {
                "password_reset_token_hash": hash_reset_token(reset_token),
                "password_reset_expires_at": now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_MINUTES),
                "password_reset_requested_at": now,
                "updated_at": now,
            }
        },
    )

    try:
        await send_password_reset_email(normalized_email, reset_token)
    except Exception as exc:
        await db.users.update_one(
            {"email": normalized_email},
            {"$unset": {"password_reset_token_hash": "", "password_reset_expires_at": "", "password_reset_requested_at": ""}},
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Password reset email is not available") from exc

    return {"message": "If an account exists, a password reset email has been sent."}


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm):
    db = get_db()
    normalized_email = payload.email.lower()
    db_user = await db.users.find_one({"email": normalized_email})
    if not db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    token_hash = db_user.get("password_reset_token_hash")
    expires_at = db_user.get("password_reset_expires_at")
    if not token_hash or not secrets.compare_digest(token_hash, hash_reset_token(payload.token)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    if not expires_at or expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    now = utc_now()
    await db.users.update_one(
        {"email": normalized_email},
        {
            "$set": {"password": hash_password(payload.new_password), "password_reset_at": now, "updated_at": now},
            "$unset": {
                "password_reset_token_hash": "",
                "password_reset_expires_at": "",
                "password_reset_requested_at": "",
            },
        },
    )
    return {"message": "Password has been reset"}


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
