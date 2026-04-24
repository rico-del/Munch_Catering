from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from munch_catering_backend.time_utils import utc_now


UserRole = Literal["customer", "caterer", "admin"]
QuoteStatus = Literal["pending_review", "contacted", "approved", "converted_to_booking", "rejected"]
BookingStatus = Literal["awaiting_payment", "confirmed", "completed", "cancelled"]
PaymentStatus = Literal["unpaid", "pending", "paid", "failed"]
PaymentProvider = Literal["test", "mpesa"]


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "customer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserProfile(BaseModel):
    id: str
    full_name: str
    username: str
    email: EmailStr
    role: UserRole
    created_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=2, max_length=60)


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


class MenuTier(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price_per_head: float = Field(ge=0)
    items: list[str] = Field(default_factory=list)


class PortfolioImage(BaseModel):
    id: str
    filename: str
    url: str
    caption: str = Field(default="", max_length=240)
    description: str = Field(default="", max_length=1200)
    is_primary: bool = False
    uploaded_at: Optional[datetime] = None


class PortfolioImageUpdate(BaseModel):
    caption: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = Field(default=None, max_length=1200)
    is_primary: Optional[bool] = None


class Review(BaseModel):
    id: str
    reviewer_id: str
    reviewer_email: EmailStr
    reviewer_name: str
    rating: float = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)
    created_at: datetime = Field(default_factory=utc_now)


class CatererSummary(BaseModel):
    id: str
    business_name: str
    description: str
    phone: Optional[str] = None
    location: Optional[str] = None
    rating: float = 0.0
    review_count: int = 0
    price_from: float = 0.0
    hero_tagline: str = ""
    cuisines: list[str] = Field(default_factory=list)
    portfolio_preview: Optional[PortfolioImage] = None


class CatererProfile(BaseModel):
    id: str
    business_name: str
    owner_id: str
    owner_email: EmailStr
    description: str
    phone: Optional[str] = None
    location: Optional[str] = None
    rating: float = 0.0
    review_count: int = 0
    portfolio: list[PortfolioImage] = Field(default_factory=list)
    reviews: list[Review] = Field(default_factory=list)
    tiers: list[MenuTier] = Field(default_factory=list)
    price_from: float = 0.0
    hero_tagline: str = ""
    cuisines: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class PublicCatererProfile(BaseModel):
    id: str
    business_name: str
    description: str
    phone: Optional[str] = None
    location: Optional[str] = None
    rating: float = 0.0
    review_count: int = 0
    portfolio: list[PortfolioImage] = Field(default_factory=list)
    reviews: list[Review] = Field(default_factory=list)
    tiers: list[MenuTier] = Field(default_factory=list)
    price_from: float = 0.0
    hero_tagline: str = ""
    cuisines: list[str] = Field(default_factory=list)


class CatererProfileUpdate(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=8, max_length=1500)
    phone: Optional[str] = Field(default=None, max_length=40)
    location: Optional[str] = Field(default=None, max_length=160)
    tiers: list[MenuTier] = Field(default_factory=list)
    hero_tagline: str = Field(default="", max_length=160)
    cuisines: list[str] = Field(default_factory=list)


class BookingCreateRequest(BaseModel):
    caterer_id: str
    customer_phone: str = Field(min_length=9, max_length=20)
    guest_count: int = Field(ge=1, le=10000)
    selected_tier: Optional[str] = Field(default=None, max_length=80)
    quote_id: Optional[str] = None
    event_date: Optional[datetime] = None


class BookingResponse(BaseModel):
    id: str
    caterer_id: str
    caterer_name: str
    customer_phone: str
    guest_count: int
    selected_tier: str
    price_per_head: float
    total: float
    deposit: float
    balance: float
    status: BookingStatus
    payment_status: PaymentStatus
    lifecycle_stage: str
    payment_provider: PaymentProvider
    payment_mode: str
    is_payable: bool
    source_quote_id: Optional[str] = None
    active_payment_id: Optional[str] = None
    event_date: Optional[datetime] = None
    created_at: Optional[datetime] = None


class QuoteCreateRequest(BaseModel):
    caterer_id: str
    description: str = Field(min_length=10, max_length=1500)
    guest_count: int = Field(ge=1, le=10000)
    budget_estimate: float = Field(ge=0)


class QuoteResponse(BaseModel):
    id: str
    caterer_id: str
    caterer_name: str
    customer_email: Optional[EmailStr] = None
    description: str
    guest_count: int
    budget_estimate: float
    status: QuoteStatus
    lifecycle_stage: str
    is_checkout_ready: bool
    approved_package_label: Optional[str] = None
    approved_price_per_head: Optional[float] = None
    approved_total: Optional[float] = None
    source_booking_id: Optional[str] = None
    created_at: datetime


class QuoteUpdate(BaseModel):
    status: QuoteStatus
    approved_package_label: Optional[str] = Field(default=None, max_length=120)
    approved_price_per_head: Optional[float] = Field(default=None, ge=0)
    approved_total: Optional[float] = Field(default=None, ge=0)


class PaymentInitiationRequest(BaseModel):
    booking_id: str


class PaymentInitiationResponse(BaseModel):
    payment_id: str
    booking_id: str
    amount: float
    phone: str
    status: PaymentStatus
    provider_reference: str
    provider: PaymentProvider
    mode: str


class TestPaymentSimulationRequest(BaseModel):
    payment_id: str
    outcome: Literal["paid", "failed"] = "paid"


class MessageCreate(BaseModel):
    recipient: EmailStr
    content: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: str
    sender: EmailStr
    recipient: EmailStr
    content: str
    timestamp: datetime
    is_read: bool = False


class ConversationSummary(BaseModel):
    id: str
    contact_email: EmailStr
    contact_name: str
    preview: str
    unread_count: int
    timestamp: datetime


class PaginatedResponse(BaseModel):
    items: list[dict]
    total: int
    limit: int
    offset: int


class Principal(BaseModel):
    user_id: str
    email: EmailStr
    role: UserRole
    username: Optional[str] = None
    full_name: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    total_bookings: int
    total_revenue: float


class VendorStatsResponse(BaseModel):
    total_bookings: int
    confirmed_bookings: int
    pending_bookings: int
    total_revenue: float
    paid_bookings: int = 0
    approved_quotes: int = 0
    pending_quotes: int = 0
    average_booking_value: float = 0.0
    inquiry_conversion_rate: float = 0.0


class ReviewCreate(BaseModel):
    caterer_id: str
    rating: float = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


class ReviewListResponse(BaseModel):
    reviews: list[Review]
    rating: float
    review_count: int


class PortfolioDeleteResponse(BaseModel):
    message: str
    deleted_image_id: str


class ApiError(BaseModel):
    detail: str


class PublicCatererListResponse(BaseModel):
    items: list[CatererSummary]
    total: int
    limit: int
    offset: int


class MessageThreadResponse(BaseModel):
    items: list[MessageResponse]
    total: int
    limit: int
    offset: int


class ConversationListResponse(BaseModel):
    items: list[ConversationSummary]
    total: int
    limit: int
    offset: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class CallbackAck(BaseModel):
    status: str


class MongoModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
