from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Protocol

import httpx
from fastapi import HTTPException, status

from munch_catering_backend.settings import settings
from munch_catering_backend.time_utils import daraja_timestamp

logger = logging.getLogger(__name__)


@dataclass
class PaymentProviderResult:
    provider_reference: str
    status: str
    raw_payload: dict


class BasePaymentProvider:
    provider_name: str
    mode: str

    async def initiate_payment(self, booking: dict, phone_number: str, amount: float, payment_id: str) -> PaymentProviderResult:
        raise NotImplementedError


class MpesaTransport(Protocol):
    async def initiate_stk_push(self, auth_value: str, payload: dict) -> dict:
        ...


class HttpxMpesaTransport:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def initiate_stk_push(self, auth_value: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            token_resp = await client.get(
                f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials",
                headers={"Authorization": f"Basic {auth_value}", "Accept": "application/json"},
            )
            token_resp.raise_for_status()
            access_token = token_resp.json().get("access_token")
            if not access_token:
                logger.error("MPESA token response missing access token: %s", token_resp.text)
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment provider unavailable")

            stk_resp = await client.post(
                f"{self.base_url}/mpesa/stkpush/v1/processrequest",
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            stk_resp.raise_for_status()
            return stk_resp.json()


class TestPaymentProvider(BasePaymentProvider):
    provider_name = "test"
    mode = "test"

    async def initiate_payment(self, booking: dict, phone_number: str, amount: float, payment_id: str) -> PaymentProviderResult:
        reference = f"test_{payment_id}"
        return PaymentProviderResult(
            provider_reference=reference,
            status="pending",
            raw_payload={
                "provider": self.provider_name,
                "mode": self.mode,
                "booking_id": str(booking["_id"]),
                "phone_number": phone_number,
                "amount": amount,
                "simulated": True,
            },
        )


class MpesaPaymentProvider(BasePaymentProvider):
    provider_name = "mpesa"

    def __init__(self, transport: MpesaTransport | None = None) -> None:
        self.mode = settings.MPESA_ENV
        self.transport = transport or HttpxMpesaTransport(settings.MPESA_BASE_URL)

    async def initiate_payment(self, booking: dict, phone_number: str, amount: float, payment_id: str) -> PaymentProviderResult:
        callback_url = settings.MPESA_CALLBACK_URL
        consumer_key = settings.MPESA_CONSUMER_KEY
        consumer_secret = settings.MPESA_CONSUMER_SECRET
        shortcode = settings.MPESA_SHORTCODE
        passkey = settings.MPESA_PASSKEY

        if not (consumer_key and consumer_secret and shortcode and passkey):
            logger.error("Missing MPESA credentials")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Payment service is unavailable")

        auth_value = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()

        timestamp = daraja_timestamp()
        password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()
        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(round(amount)),
            "PartyA": phone_number,
            "PartyB": shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": callback_url,
            "AccountReference": str(booking["_id"]),
            "TransactionDesc": "Munch booking deposit",
        }

        try:
            body = await self.transport.initiate_stk_push(auth_value, payload)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("MPESA initiation failed: %s", exc)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment provider unavailable")

        if body.get("ResponseCode") != "0":
            logger.error("MPESA rejected payment: %s", body)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment initiation failed")

        provider_reference = body.get("CheckoutRequestID") or body.get("MerchantRequestID") or payment_id
        return PaymentProviderResult(
            provider_reference=provider_reference,
            status="pending",
            raw_payload=body,
        )


def get_payment_provider() -> BasePaymentProvider:
    if settings.PAYMENT_PROVIDER == "test":
        return TestPaymentProvider()
    return MpesaPaymentProvider()
