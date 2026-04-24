import logging
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from bson import ObjectId

from munch_catering_backend.database import get_db
from munch_catering_backend.models import Principal
from munch_catering_backend.settings import settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        logger.warning("Invalid JWT: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    subject = payload.get("sub")
    user_id = payload.get("uid")
    if not subject and not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    db = get_db()
    lookup = {"email": subject} if subject else {"_id": ObjectId(user_id)}
    user = await db.users.find_one(lookup)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user not found")

    return Principal(
        user_id=str(user.get("_id")),
        email=user["email"],
        role=user.get("role", "customer"),
        username=user.get("username"),
        full_name=user.get("full_name"),
    )


def require_role(role: str | tuple[str, ...]) -> Callable[[Principal], Principal]:
    allowed_roles = {role} if isinstance(role, str) else set(role)

    async def dependency(principal: Principal = Depends(get_current_principal)) -> Principal:
        if principal.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this resource")
        return principal

    return dependency


def ensure_admin_routes_enabled() -> None:
    if not settings.ENABLE_ADMIN_ROUTES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
