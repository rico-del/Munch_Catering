import io
import os
import unittest
from contextlib import ExitStack
from copy import deepcopy
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient

from munch_catering_backend.auth_utils import create_token
from munch_catering_backend.main import app
from munch_catering_backend.settings import settings
from munch_catering_backend.time_utils import utc_now


class FakeHttpxResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return deepcopy(self._payload)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, headers=None):
        if "oauth/v1/generate" in url:
            return FakeHttpxResponse({"access_token": "sandbox-token"})
        return FakeHttpxResponse({}, status_code=404)

    async def post(self, url, json=None, headers=None):
        if "stkpush/v1/processrequest" in url:
            return FakeHttpxResponse({"ResponseCode": "0", "CheckoutRequestID": "ws_CO_123"})
        return FakeHttpxResponse({}, status_code=404)


def get_nested(document, key):
    parts = key.split(".")
    value = document
    for part in parts:
        if isinstance(value, list):
            return [item.get(part) for item in value if isinstance(item, dict)]
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def match_query(document, query):
    if not query:
        return True

    for key, expected in query.items():
        if key == "$or":
            return any(match_query(document, item) for item in expected)

        actual = get_nested(document, key)
        if isinstance(actual, list):
            if isinstance(expected, dict) and "$gt" in expected:
                return any(item > expected["$gt"] for item in actual if item is not None)
            return expected in actual

        if isinstance(expected, dict):
            if "$gt" in expected and not (actual is not None and actual > expected["$gt"]):
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$exists" in expected:
                exists = actual is not None
                if bool(expected["$exists"]) != exists:
                    return False
        elif actual != expected:
            return False

    return True


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count=0, modified_count=0):
        self.matched_count = matched_count
        self.modified_count = modified_count


class DeleteResult:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)
        self._skip = 0
        self._limit = None

    def sort(self, key, direction):
        reverse = direction < 0
        self.documents.sort(key=lambda item: get_nested(item, key) or "", reverse=reverse)
        return self

    def skip(self, amount):
        self._skip = amount
        return self

    def limit(self, amount):
        self._limit = amount
        return self

    async def to_list(self, amount):
        documents = self.documents[self._skip :]
        limit = self._limit if self._limit is not None else amount
        if limit is None:
            return deepcopy(documents)
        return deepcopy(documents[:limit])


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def create_index(self, *args, **kwargs):
        return None

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if match_query(document, query):
                item = deepcopy(document)
                if projection:
                    if projection.get("password") == 0:
                        item.pop("password", None)
                return item
        return None

    async def insert_one(self, document):
        item = deepcopy(document)
        if "_id" not in item:
            item["_id"] = ObjectId()
        self.documents.append(item)
        return InsertResult(item["_id"])

    async def update_one(self, query, update, upsert=False):
        for document in self.documents:
            if match_query(document, query):
                self._apply_update(document, update)
                return UpdateResult(matched_count=1, modified_count=1)

        if upsert:
            base = deepcopy(query)
            self._apply_update(base, update)
            if "_id" not in base:
                base["_id"] = ObjectId()
            self.documents.append(base)
            return UpdateResult(matched_count=0, modified_count=1)

        return UpdateResult()

    async def update_many(self, query, update):
        modified = 0
        for document in self.documents:
            if match_query(document, query):
                self._apply_update(document, update)
                modified += 1
        return UpdateResult(matched_count=modified, modified_count=modified)

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                self.documents.pop(index)
                return DeleteResult(deleted_count=1)
        return DeleteResult()

    async def delete_many(self, query):
        kept = []
        deleted = 0
        for document in self.documents:
            if match_query(document, query):
                deleted += 1
            else:
                kept.append(document)
        self.documents = kept
        return DeleteResult(deleted_count=deleted)

    async def find_one_and_update(self, query, update, return_document=None):
        for document in self.documents:
            if match_query(document, query):
                self._apply_update(document, update)
                return deepcopy(document)
        return None

    async def count_documents(self, query):
        return len([document for document in self.documents if match_query(document, query)])

    def find(self, query, projection=None):
        documents = []
        for document in self.documents:
            if match_query(document, query):
                item = deepcopy(document)
                documents.append(item)
        return FakeCursor(documents)

    def _apply_update(self, document, update):
        for operator, payload in update.items():
            if operator == "$set":
                for key, value in payload.items():
                    document[key] = value
            elif operator == "$push":
                for key, value in payload.items():
                    document.setdefault(key, []).append(deepcopy(value))
            elif operator == "$pull":
                for key, matcher in payload.items():
                    document[key] = [item for item in document.get(key, []) if not match_query(item, matcher)]
            elif operator == "$unset":
                for key in payload:
                    document.pop(key, None)


class FakeDB:
    def __init__(self):
        customer_id = ObjectId()
        other_customer_id = ObjectId()
        caterer_user_id = ObjectId()
        admin_id = ObjectId()
        caterer_id = ObjectId()
        second_caterer_id = ObjectId()
        booking_id = ObjectId()
        other_booking_id = ObjectId()
        message_id = ObjectId()

        self.user_ids = {
            "customer": customer_id,
            "other_customer": other_customer_id,
            "caterer": caterer_user_id,
            "admin": admin_id,
        }
        self.caterer_ids = {"primary": caterer_id, "secondary": second_caterer_id}
        self.booking_ids = {"primary": booking_id, "secondary": other_booking_id}
        self.message_ids = {"primary": message_id}

        self.users = FakeCollection(
            [
                {
                    "_id": customer_id,
                    "full_name": "Deri Client",
                    "username": "deri",
                    "email": "guest@munch.app",
                    "password": "hashed",
                    "role": "customer",
                },
                {
                    "_id": other_customer_id,
                    "full_name": "Other Client",
                    "username": "other",
                    "email": "other@munch.app",
                    "password": "hashed",
                    "role": "customer",
                },
                {
                    "_id": caterer_user_id,
                    "full_name": "Amani Njoroge",
                    "username": "harvest",
                    "email": "chef@harvesttable.co.ke",
                    "password": "hashed",
                    "role": "caterer",
                },
                {
                    "_id": admin_id,
                    "full_name": "Admin User",
                    "username": "admin",
                    "email": "admin@munch.app",
                    "password": "hashed",
                    "role": "admin",
                },
            ]
        )
        self.caterers = FakeCollection(
            [
                {
                    "_id": caterer_id,
                    "business_name": "Harvest Table Studio",
                    "owner_id": str(caterer_user_id),
                    "owner_email": "chef@harvesttable.co.ke",
                    "description": "Contemporary catering for editorial events.",
                    "phone": "+254722112233",
                    "location": "Westlands, Nairobi",
                    "rating": 4.8,
                    "review_count": 2,
                    "portfolio": [
                        {
                            "id": "p1",
                            "filename": "harvest.jpg",
                            "url": "/portfolio/images/harvest.jpg",
                            "caption": "Garden reception",
                            "description": "Long-table garden wedding service.",
                            "is_primary": True,
                        }
                    ],
                    "reviews": [
                        {
                            "id": "r1",
                            "reviewer_id": str(customer_id),
                            "reviewer_email": "guest@munch.app",
                            "reviewer_name": "Deri Client",
                            "rating": 4.8,
                            "comment": "Excellent",
                            "created_at": "2026-04-11T08:00:00Z",
                        },
                        {
                            "id": "r2",
                            "reviewer_id": str(other_customer_id),
                            "reviewer_email": "other@munch.app",
                            "reviewer_name": "Other Client",
                            "rating": 4.6,
                            "comment": "Great",
                            "created_at": "2026-04-12T08:00:00Z",
                        },
                    ],
                    "tiers": [
                        {"name": "Standard", "price_per_head": 2200, "items": ["Buffet service"]},
                        {"name": "Premium", "price_per_head": 3600, "items": ["Live stations"]},
                    ],
                    "price_from": 2200,
                    "hero_tagline": "Editorial plating with reliable execution.",
                    "cuisines": ["Modern African"],
                },
                {
                    "_id": second_caterer_id,
                    "business_name": "Savory Social",
                    "owner_id": "someone-else",
                    "owner_email": "events@savorysocial.co.ke",
                    "description": "Corporate launch specialists.",
                    "rating": 4.5,
                    "review_count": 1,
                    "portfolio": [],
                    "reviews": [],
                    "tiers": [{"name": "Standard", "price_per_head": 1800, "items": ["Buffet service"]}],
                    "price_from": 1800,
                    "hero_tagline": "Built for social events.",
                    "cuisines": ["Fusion"],
                },
            ]
        )
        self.bookings = FakeCollection(
            [
                {
                    "_id": booking_id,
                    "caterer_id": str(caterer_id),
                    "caterer_name": "Harvest Table Studio",
                    "caterer_owner_id": str(caterer_user_id),
                    "customer_user_id": str(customer_id),
                    "customer_email": "guest@munch.app",
                    "customer_phone": "0712345678",
                    "guest_count": 120,
                    "selected_tier": "Premium",
                    "price_per_head": 3600,
                    "total": 432000,
                    "deposit": 86400,
                    "balance": 345600,
                    "status": "Awaiting Deposit",
                    "payment_status": "unpaid",
                },
                {
                    "_id": other_booking_id,
                    "caterer_id": str(caterer_id),
                    "caterer_name": "Harvest Table Studio",
                    "caterer_owner_id": str(caterer_user_id),
                    "customer_user_id": str(other_customer_id),
                    "customer_email": "other@munch.app",
                    "customer_phone": "0799999999",
                    "guest_count": 60,
                    "selected_tier": "Standard",
                    "price_per_head": 2200,
                    "total": 132000,
                    "deposit": 26400,
                    "balance": 105600,
                    "status": "Confirmed",
                    "payment_status": "paid",
                },
            ]
        )
        self.quotes = FakeCollection([])
        self.messages = FakeCollection(
            [
                {
                    "_id": message_id,
                    "sender": "chef@harvesttable.co.ke",
                    "recipient": "guest@munch.app",
                    "content": "Your menu is ready.",
                    "timestamp": "2026-04-21T12:00:00Z",
                    "is_read": False,
                }
            ]
        )
        self.payments = FakeCollection([])


class ApiSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SECRET_KEY = "test-secret"
        settings.ENABLE_ADMIN_ROUTES = True

    def setUp(self):
        self.fake_db = FakeDB()
        settings.PAYMENT_PROVIDER = "mpesa"
        settings.MPESA_ENV = "sandbox"
        settings.MPESA_BASE_URL = "https://sandbox.safaricom.co.ke"
        settings.MPESA_CONSUMER_KEY = "test-key"
        settings.MPESA_CONSUMER_SECRET = "test-secret"
        settings.MPESA_SHORTCODE = "174379"
        settings.MPESA_PASSKEY = "test-passkey"
        settings.MPESA_CALLBACK_URL = "https://example.test/mpesa/callback"
        self.exit_stack = ExitStack()
        targets = [
            "munch_catering_backend.dependencies.get_db",
            "munch_catering_backend.user_auth.get_db",
            "munch_catering_backend.user_profile_api.get_db",
            "munch_catering_backend.booking_api.get_db",
            "munch_catering_backend.messages_api.get_db",
            "munch_catering_backend.caterer_api.get_db",
            "munch_catering_backend.caterer_stats_api.get_db",
            "munch_catering_backend.portfolio_api.get_db",
            "munch_catering_backend.search_api.get_db",
            "munch_catering_backend.payment_api.get_db",
        ]
        for target in targets:
            self.exit_stack.enter_context(patch(target, return_value=self.fake_db))
        self.exit_stack.enter_context(patch("munch_catering_backend.payment_providers.httpx.AsyncClient", FakeAsyncClient))
        self.client = TestClient(app)

    def tearDown(self):
        self.exit_stack.close()

    def auth_header(self, user_key):
        roles = {
            "customer": "customer",
            "other_customer": "customer",
            "caterer": "caterer",
            "admin": "admin",
        }
        emails = {
            "customer": "guest@munch.app",
            "other_customer": "other@munch.app",
            "caterer": "chef@harvesttable.co.ke",
            "admin": "admin@munch.app",
        }
        token = create_token(
            {
                "sub": emails[user_key],
                "uid": str(self.fake_db.user_ids[user_key]),
                "role": roles[user_key],
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def test_unauthorized_access_blocked(self):
        response = self.client.get("/user/me")
        self.assertEqual(response.status_code, 401)

    def test_admin_routes_require_admin_role(self):
        customer = self.client.get("/admin/stats", headers=self.auth_header("customer"))
        admin = self.client.get("/admin/stats", headers=self.auth_header("admin"))

        self.assertEqual(customer.status_code, 403)
        self.assertEqual(admin.status_code, 200)
        self.assertEqual(admin.json()["total_users"], 4)

    def test_self_service_endpoint_ignores_forged_identity_fields(self):
        response = self.client.get("/user/me?email=other@munch.app", headers=self.auth_header("customer"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "guest@munch.app")

    def test_disabled_account_cannot_continue_or_login(self):
        disabled = self.client.patch("/user/me/disable", headers=self.auth_header("customer"))
        self.assertEqual(disabled.status_code, 200)

        profile = self.client.get("/user/me", headers=self.auth_header("customer"))
        self.assertEqual(profile.status_code, 403)

        with patch("munch_catering_backend.user_auth.verify_password", return_value=True):
            login = self.client.post(
                "/auth/login",
                json={"email": "guest@munch.app", "password": "password123"},
            )
        self.assertEqual(login.status_code, 403)

    def test_reactivate_requires_password_and_restores_account(self):
        disabled = self.client.patch("/user/me/disable", headers=self.auth_header("customer"))
        self.assertEqual(disabled.status_code, 200)

        with patch("munch_catering_backend.user_auth.verify_password", return_value=False):
            rejected = self.client.post(
                "/auth/reactivate",
                json={"email": "guest@munch.app", "password": "wrongpass123"},
            )
        self.assertEqual(rejected.status_code, 401)

        with patch("munch_catering_backend.user_auth.verify_password", return_value=True):
            restored = self.client.post(
                "/auth/reactivate",
                json={"email": "guest@munch.app", "password": "password123"},
            )
        self.assertEqual(restored.status_code, 200)
        self.assertIn("token", restored.json())

        profile = self.client.get("/user/me", headers=self.auth_header("customer"))
        self.assertEqual(profile.status_code, 200)

    def test_delete_account_removes_customer_owned_records(self):
        response = self.client.delete("/user/me", headers=self.auth_header("customer"))
        self.assertEqual(response.status_code, 200)

        self.assertFalse(any(item["email"] == "guest@munch.app" for item in self.fake_db.users.documents))
        self.assertFalse(any(item.get("customer_user_id") == str(self.fake_db.user_ids["customer"]) for item in self.fake_db.bookings.documents))
        self.assertFalse(any(item.get("sender") == "guest@munch.app" or item.get("recipient") == "guest@munch.app" for item in self.fake_db.messages.documents))

    def test_booking_list_and_detail_are_user_scoped(self):
        listing = self.client.get("/bookings", headers=self.auth_header("customer"))
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()["items"]), 1)

        forbidden = self.client.get(
            f"/bookings/{self.fake_db.booking_ids['secondary']}",
            headers=self.auth_header("customer"),
        )
        self.assertEqual(forbidden.status_code, 404)

    def test_sender_spoofing_is_blocked(self):
        response = self.client.post(
            "/messages",
            headers=self.auth_header("customer"),
            json={
                "recipient": "chef@harvesttable.co.ke",
                "content": "Need a quote.",
                "sender": "admin@munch.app",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["sender"], "guest@munch.app")

    def test_mark_read_requires_real_recipient_membership(self):
        response = self.client.put(
            f"/messages/{self.fake_db.message_ids['primary']}/read",
            headers=self.auth_header("other_customer"),
        )
        self.assertEqual(response.status_code, 404)

    def test_caterer_stats_align_with_booking_schema(self):
        create = self.client.post(
            "/bookings",
            headers=self.auth_header("customer"),
            json={
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "customer_phone": "0712345678",
                "guest_count": 50,
                "selected_tier": "Standard",
            },
        )
        self.assertEqual(create.status_code, 201)

        stats = self.client.get("/caterer/stats", headers=self.auth_header("caterer"))
        self.assertEqual(stats.status_code, 200)
        payload = stats.json()
        self.assertGreaterEqual(payload["total_bookings"], 3)
        self.assertIn("pending_bookings", payload)

    def test_approved_custom_quote_creates_booking_without_tier_fallback(self):
        quote_id = ObjectId()
        self.fake_db.quotes.documents.append(
            {
                "_id": quote_id,
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "caterer_name": "Harvest Table Studio",
                "caterer_owner_id": str(self.fake_db.user_ids["caterer"]),
                "customer_user_id": str(self.fake_db.user_ids["customer"]),
                "customer_email": "guest@munch.app",
                "description": "Curated plated dinner with late-night service.",
                "guest_count": 90,
                "budget_estimate": 315000,
                "status": "approved",
                "approved_package_label": "Custom plated experience",
                "approved_price_per_head": 3500,
                "approved_total": 315000,
                "created_at": utc_now(),
            }
        )

        response = self.client.post(
            "/bookings",
            headers=self.auth_header("customer"),
            json={
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "quote_id": str(quote_id),
                "customer_phone": "0712345678",
                "guest_count": 10,
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["selected_tier"], "Custom plated experience")
        self.assertEqual(payload["guest_count"], 90)
        self.assertEqual(payload["total"], 315000)
        self.assertEqual(payload["price_per_head"], 3500)
        booked_quote = next(item for item in self.fake_db.quotes.documents if item["_id"] == quote_id)
        self.assertEqual(booked_quote["status"], "converted_to_booking")
        self.assertTrue(booked_quote["source_booking_id"])

        second_attempt = self.client.post(
            "/bookings",
            headers=self.auth_header("customer"),
            json={
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "quote_id": str(quote_id),
                "customer_phone": "0712345678",
                "guest_count": 10,
            },
        )
        self.assertEqual(second_attempt.status_code, 409)

    def test_portfolio_upload_constraints_are_enforced(self):
        response = self.client.post(
            "/portfolio/images",
            headers=self.auth_header("caterer"),
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
            data={"caption": "Bad upload"},
        )
        self.assertEqual(response.status_code, 400)

    def test_search_contract_exposes_rating_and_review_count(self):
        response = self.client.get("/search/caterers?limit=1")
        self.assertEqual(response.status_code, 200)
        item = response.json()["items"][0]
        self.assertIn("rating", item)
        self.assertIn("review_count", item)
        self.assertIn("is_primary", item["portfolio_preview"])

    def test_portfolio_image_can_be_updated_as_primary_with_description(self):
        response = self.client.patch(
            "/portfolio/images/p1",
            headers=self.auth_header("caterer"),
            json={"description": "Updated studio showcase image.", "is_primary": True},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["is_primary"])
        self.assertEqual(payload["description"], "Updated studio showcase image.")

    def test_payment_initiation_and_callback_integrity(self):
        forbidden = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("other_customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(forbidden.status_code, 403)

        allowed = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(allowed.status_code, 200)
        provider_reference = allowed.json()["provider_reference"]
        self.assertEqual(allowed.json()["provider"], "mpesa")

        duplicate = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(duplicate.status_code, 409)

        missing = self.client.post("/mpesa/callback", json={"Body": {"stkCallback": {"CheckoutRequestID": "missing"}}})
        self.assertEqual(missing.status_code, 404)

        callback = self.client.post(
            "/payments/callback/mpesa",
            json={"Body": {"stkCallback": {"CheckoutRequestID": provider_reference, "ResultCode": 0}}},
        )
        self.assertEqual(callback.status_code, 200)

        paid_again = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(paid_again.status_code, 409)

    def test_mpesa_callback_can_match_merchant_request_id(self):
        allowed = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(allowed.status_code, 200)

        payment = self.fake_db.payments.documents[0]
        payment["request_payload"]["MerchantRequestID"] = "merchant-123"

        callback = self.client.post(
            "/payments/callback/mpesa",
            json={"Body": {"stkCallback": {"MerchantRequestID": "merchant-123", "ResultCode": 0}}},
        )
        self.assertEqual(callback.status_code, 200)

        booking = self.client.get(
            f"/bookings/{self.fake_db.booking_ids['primary']}",
            headers=self.auth_header("customer"),
        )
        self.assertEqual(booking.status_code, 200)
        self.assertEqual(booking.json()["payment_status"], "paid")

    def test_approved_request_moves_out_of_pending_after_conversion(self):
        quote_id = ObjectId()
        self.fake_db.quotes.documents.append(
            {
                "_id": quote_id,
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "caterer_name": "Harvest Table Studio",
                "caterer_owner_id": str(self.fake_db.user_ids["caterer"]),
                "customer_user_id": str(self.fake_db.user_ids["customer"]),
                "customer_email": "guest@munch.app",
                "description": "Sunset reception dinner",
                "guest_count": 80,
                "budget_estimate": 240000,
                "status": "pending_review",
                "created_at": utc_now(),
            }
        )

        approved = self.client.patch(
            f"/bookings/quotes/{quote_id}",
            headers=self.auth_header("caterer"),
            json={"status": "approved"},
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["lifecycle_stage"], "quote_approved_awaiting_payment")
        self.assertTrue(approved.json()["is_checkout_ready"])

        create_booking = self.client.post(
            "/bookings",
            headers=self.auth_header("customer"),
            json={
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "quote_id": str(quote_id),
                "customer_phone": "0712345678",
                "guest_count": 80,
            },
        )
        self.assertEqual(create_booking.status_code, 201)
        self.assertEqual(create_booking.json()["lifecycle_stage"], "awaiting_payment")

        quote_history = self.client.get("/bookings/quotes/history", headers=self.auth_header("customer"))
        self.assertEqual(quote_history.status_code, 200)
        converted_quote = next(item for item in quote_history.json()["items"] if item["id"] == str(quote_id))
        self.assertEqual(converted_quote["lifecycle_stage"], "booking_converted")
        self.assertFalse(converted_quote["is_checkout_ready"])

    def test_completed_bookings_are_not_payable(self):
        self.fake_db.bookings.documents.append(
            {
                "_id": ObjectId(),
                "caterer_id": str(self.fake_db.caterer_ids["primary"]),
                "caterer_name": "Harvest Table Studio",
                "caterer_owner_id": str(self.fake_db.user_ids["caterer"]),
                "customer_user_id": str(self.fake_db.user_ids["customer"]),
                "customer_email": "guest@munch.app",
                "customer_phone": "0712345678",
                "guest_count": 45,
                "selected_tier": "Premium",
                "price_per_head": 3600,
                "total": 162000,
                "deposit": 32400,
                "balance": 129600,
                "status": "completed",
                "payment_status": "paid",
            }
        )

        listing = self.client.get("/bookings", headers=self.auth_header("customer"))
        self.assertEqual(listing.status_code, 200)
        completed = next(item for item in listing.json()["items"] if item["status"] == "completed")
        self.assertFalse(completed["is_payable"])
        self.assertEqual(completed["lifecycle_stage"], "completed")

    def test_test_payment_provider_simulates_without_real_callback(self):
        settings.PAYMENT_PROVIDER = "test"
        booking_id = str(self.fake_db.booking_ids["primary"])

        initiated = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": booking_id},
        )
        self.assertEqual(initiated.status_code, 200)
        payload = initiated.json()
        self.assertEqual(payload["provider"], "test")
        self.assertEqual(payload["mode"], "test")

        confirmed = self.client.post(
            "/payments/test/complete",
            headers=self.auth_header("customer"),
            json={"payment_id": payload["payment_id"], "outcome": "paid"},
        )
        self.assertEqual(confirmed.status_code, 200)

        booking = self.client.get(f"/bookings/{booking_id}", headers=self.auth_header("customer"))
        self.assertEqual(booking.status_code, 200)
        self.assertEqual(booking.json()["status"], "confirmed")
        self.assertEqual(booking.json()["payment_status"], "paid")

    def test_failed_mpesa_payment_can_be_retried(self):
        booking_id = str(self.fake_db.booking_ids["primary"])

        initiated = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": booking_id},
        )
        self.assertEqual(initiated.status_code, 200)

        failed = self.client.post(
            "/payments/callback/mpesa",
            json={"Body": {"stkCallback": {"CheckoutRequestID": initiated.json()["provider_reference"], "ResultCode": 1032}}},
        )
        self.assertEqual(failed.status_code, 200)

        booking = self.client.get(f"/bookings/{booking_id}", headers=self.auth_header("customer"))
        self.assertEqual(booking.status_code, 200)
        self.assertEqual(booking.json()["status"], "awaiting_payment")
        self.assertEqual(booking.json()["payment_status"], "failed")
        self.assertTrue(booking.json()["is_payable"])

        retried = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": booking_id},
        )
        self.assertEqual(retried.status_code, 200)

    def test_pending_payment_state_is_rejected_until_callback_resolves(self):
        self.fake_db.bookings.documents[0]["payment_status"] = "pending"
        self.fake_db.bookings.documents[0]["active_payment_id"] = "existing-payment"
        self.fake_db.payments.documents.append(
            {
                "_id": "existing-payment",
                "booking_id": str(self.fake_db.booking_ids["primary"]),
                "customer_user_id": str(self.fake_db.user_ids["customer"]),
                "phone": "254712345678",
                "amount": 86400,
                "status": "pending",
                "provider": "mpesa",
                "mode": "sandbox",
                "provider_reference": "ws_CO_existing",
            }
        )

        response = self.client.post(
            "/payments/initiate",
            headers=self.auth_header("customer"),
            json={"booking_id": str(self.fake_db.booking_ids["primary"])},
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("already in progress", response.json()["detail"])

    def test_mpesa_validation_rejects_localhost_callback_url(self):
        settings.MPESA_CALLBACK_URL = "http://localhost:8000/mpesa/callback"

        with self.assertRaises(RuntimeError):
            settings.validate()

    def test_pagination_limits_are_clamped(self):
        response = self.client.get("/bookings?limit=999", headers=self.auth_header("customer"))
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(response.json()["limit"], settings.MAX_PAGE_SIZE)


if __name__ == "__main__":
    unittest.main()
