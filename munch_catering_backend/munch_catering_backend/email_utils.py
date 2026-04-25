import logging
from urllib.parse import quote

import httpx

from munch_catering_backend.settings import settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, token: str) -> None:
    if not settings.RESEND_API_KEY:
        if settings.is_development:
            logger.warning("Password reset token for %s: %s", email, token)
            return
        raise RuntimeError("Password reset email is not configured.")

    reset_url = f"{settings.PASSWORD_RESET_BASE_URL}/?resetToken={quote(token)}&email={quote(email)}"
    payload = {
        "from": settings.EMAIL_FROM,
        "to": [email],
        "subject": "Reset your Munch password",
        "html": (
            "<p>Use this secure link to reset your Munch password:</p>"
            f'<p><a href="{reset_url}">Reset password</a></p>'
            f"<p>Reset token: <code>{token}</code></p>"
            "<p>This link expires soon. If you did not request it, you can ignore this email.</p>"
        ),
        "text": (
            "Use this secure link to reset your Munch password:\n"
            f"{reset_url}\n\n"
            f"Reset token: {token}\n\n"
            "This link expires soon. If you did not request it, you can ignore this email."
        ),
    }
    headers = {"Authorization": f"Bearer {settings.RESEND_API_KEY}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        response.raise_for_status()
