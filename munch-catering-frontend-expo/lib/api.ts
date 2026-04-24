import { Platform } from 'react-native';

import Constants from 'expo-constants';

import {
  Booking,
  CatererCardData,
  CatererProfile,
  CatererProfileDraft,
  ChatMessage,
  Conversation,
  Paginated,
  PaymentInitiation,
  PortfolioItem,
  Quote,
  Session,
  UserProfile,
  VendorStats,
} from '@/lib/munch-data';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type BackendSession = {
  token: string;
  user: {
    id: string;
    full_name: string;
    username: string;
    email: string;
    role: UserProfile['role'];
    created_at?: string;
  };
};

type BackendPortfolio = {
  id: string;
  filename: string;
  url: string;
  caption: string;
  description?: string;
  is_primary?: boolean;
  uploaded_at?: string;
};

type BackendReview = {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  comment: string;
  created_at: string;
};

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

function resolveAssetUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${baseURL}${url}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseURL}${path}`, {
    method: options.method || 'GET',
    headers,
    body:
      options.body == null
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = payload?.detail;
    if (Array.isArray(detail)) {
      const message = detail
        .map(item => {
          const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : 'field';
          return `${field}: ${item?.msg || 'Invalid value'}`;
        })
        .join('\n');
      throw new Error(message || 'Request failed');
    }

    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
  }

  return payload as T;
}

function mapSession(payload: BackendSession): Session {
  return {
    token: payload.token,
    user: {
      id: payload.user.id,
      fullName: payload.user.full_name,
      username: payload.user.username,
      email: payload.user.email,
      role: payload.user.role,
      createdAt: payload.user.created_at,
    },
  };
}

function mapPortfolio(item: BackendPortfolio): PortfolioItem {
  return {
    id: item.id,
    filename: item.filename,
    imageUrl: resolveAssetUrl(item.url),
    caption: item.caption,
    description: item.description || '',
    isPrimary: !!item.is_primary,
    uploadedAt: item.uploaded_at,
  };
}

function mapCatererCard(item: any): CatererCardData {
  return {
    id: item.id,
    businessName: item.business_name,
    description: item.description,
    phone: item.phone,
    location: item.location,
    rating: item.rating,
    reviewCount: item.review_count,
    priceFrom: item.price_from,
    heroTagline: item.hero_tagline,
    cuisines: item.cuisines || [],
    portfolioPreview: item.portfolio_preview ? mapPortfolio(item.portfolio_preview) : undefined,
  };
}

function mapCatererProfile(item: any): CatererProfile {
  return {
    id: item.id,
    businessName: item.business_name,
    ownerId: item.owner_id,
    ownerEmail: item.owner_email,
    description: item.description,
    phone: item.phone,
    location: item.location,
    rating: item.rating,
    reviewCount: item.review_count,
    portfolio: (item.portfolio || []).map(mapPortfolio),
    reviews: (item.reviews || []).map((review: BackendReview) => ({
      id: review.id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_name,
      reviewerEmail: review.reviewer_email,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
    })),
    tiers: (item.tiers || []).map((tier: any) => ({
      name: tier.name,
      pricePerHead: tier.price_per_head,
      items: tier.items || [],
    })),
    priceFrom: item.price_from,
    heroTagline: item.hero_tagline,
    cuisines: item.cuisines || [],
  };
}

function mapBooking(item: any): Booking {
  return {
    id: item.id,
    catererId: item.caterer_id,
    catererName: item.caterer_name,
    customerPhone: item.customer_phone,
    guestCount: item.guest_count,
    selectedTier: item.selected_tier,
    pricePerHead: item.price_per_head,
    total: item.total,
    deposit: item.deposit,
    balance: item.balance,
    status: item.status,
    paymentStatus: item.payment_status,
    lifecycleStage: item.lifecycle_stage,
    paymentProvider: item.payment_provider,
    paymentMode: item.payment_mode,
    isPayable: item.is_payable,
    sourceQuoteId: item.source_quote_id,
    activePaymentId: item.active_payment_id,
    eventDate: item.event_date,
    createdAt: item.created_at,
  };
}

function mapQuote(item: any): Quote {
  return {
    id: item.id,
    catererId: item.caterer_id,
    catererName: item.caterer_name,
    customerEmail: item.customer_email,
    description: item.description,
    guestCount: item.guest_count,
    budgetEstimate: item.budget_estimate,
    status: item.status,
    lifecycleStage: item.lifecycle_stage,
    isCheckoutReady: item.is_checkout_ready,
    approvedPackageLabel: item.approved_package_label,
    approvedPricePerHead: item.approved_price_per_head,
    approvedTotal: item.approved_total,
    sourceBookingId: item.source_booking_id,
    createdAt: item.created_at,
  };
}

function mapConversation(item: any): Conversation {
  return {
    id: item.id,
    contactEmail: item.contact_email,
    contactName: item.contact_name,
    preview: item.preview,
    unreadCount: item.unread_count,
    timestamp: item.timestamp,
  };
}

function mapMessage(item: any): ChatMessage {
  return {
    id: item.id,
    sender: item.sender,
    recipient: item.recipient,
    content: item.content,
    timestamp: item.timestamp,
    isRead: item.is_read,
  };
}

function mapPaginated<T>(payload: any, mapper: (item: any) => T): Paginated<T> {
  return {
    items: (payload.items || []).map(mapper),
    total: payload.total || 0,
    limit: payload.limit || 25,
    offset: payload.offset || 0,
  };
}

export const api = {
  baseURL,
  async login(email: string, password: string) {
    const payload = await request<BackendSession>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    return mapSession(payload);
  },
  async register(input: { fullName: string; username: string; email: string; password: string; role: 'customer' | 'caterer' }) {
    const payload = await request<BackendSession>('/auth/register', {
      method: 'POST',
      body: {
        full_name: input.fullName,
        username: input.username,
        email: input.email,
        password: input.password,
        role: input.role,
      },
    });
    return mapSession(payload);
  },
  async getMe(token: string) {
    const payload = await request<any>('/user/me', { token });
    return {
      id: payload.id,
      fullName: payload.full_name,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      createdAt: payload.created_at,
    } as UserProfile;
  },
  async updateMe(token: string, input: { fullName: string; username: string }) {
    const payload = await request<any>('/user/me', {
      method: 'PATCH',
      token,
      body: {
        full_name: input.fullName,
        username: input.username,
      },
    });
    return {
      id: payload.id,
      fullName: payload.full_name,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      createdAt: payload.created_at,
    } as UserProfile;
  },
  async getCaterers() {
    const payload = await request<any>('/search/caterers');
    return mapPaginated(payload, mapCatererCard);
  },
  async getCatererDetail(catererId: string) {
    const payload = await request<any>(`/search/caterers/${catererId}`);
    return mapCatererProfile(payload);
  },
  async getBookings(token: string) {
    const payload = await request<any>('/bookings', { token });
    return mapPaginated(payload, mapBooking);
  },
  async getBookingDetail(token: string, bookingId: string) {
    const payload = await request<any>(`/bookings/${bookingId}`, { token });
    return mapBooking(payload);
  },
  async createBooking(
    token: string,
    input: { catererId: string; customerPhone: string; guestCount: number; selectedTier?: string; quoteId?: string },
  ) {
    const payload = await request<any>('/bookings', {
      method: 'POST',
      token,
      body: {
        caterer_id: input.catererId,
        customer_phone: input.customerPhone,
        guest_count: input.guestCount,
        selected_tier: input.selectedTier,
        quote_id: input.quoteId,
      },
    });
    return mapBooking(payload);
  },
  async getQuotes(token: string) {
    const payload = await request<any>('/bookings/quotes/history', { token });
    return mapPaginated(payload, mapQuote);
  },
  async requestQuote(token: string, input: { catererId: string; description: string; guestCount: number; budgetEstimate: number }) {
    const payload = await request<any>('/bookings/quotes', {
      method: 'POST',
      token,
      body: {
        caterer_id: input.catererId,
        description: input.description,
        guest_count: input.guestCount,
        budget_estimate: input.budgetEstimate,
      },
    });
    return mapQuote(payload);
  },
  async updateQuote(token: string, quoteId: string, status: Quote['status']) {
    const payload = await request<any>(`/bookings/quotes/${quoteId}`, {
      method: 'PATCH',
      token,
      body: { status },
    });
    return mapQuote(payload);
  },
  async getConversations(token: string) {
    const payload = await request<any>('/messages/conversations', { token });
    return mapPaginated(payload, mapConversation);
  },
  async getThread(token: string, contactEmail: string) {
    const payload = await request<any>(`/messages/thread/${encodeURIComponent(contactEmail)}`, { token });
    return mapPaginated(payload, mapMessage);
  },
  async sendMessage(token: string, input: { recipient: string; content: string }) {
    const payload = await request<any>('/messages', {
      method: 'POST',
      token,
      body: {
        recipient: input.recipient,
        content: input.content,
      },
    });
    return mapMessage(payload);
  },
  async markConversationRead(token: string, contactEmail: string) {
    return request(`/messages/conversations/${encodeURIComponent(contactEmail)}/read`, {
      method: 'PUT',
      token,
    });
  },
  async getVendorStats(token: string) {
    const payload = await request<any>('/caterer/stats', { token });
    return {
      totalBookings: payload.total_bookings,
      confirmedBookings: payload.confirmed_bookings,
      pendingBookings: payload.pending_bookings,
      totalRevenue: payload.total_revenue,
      paidBookings: payload.paid_bookings || 0,
      approvedQuotes: payload.approved_quotes || 0,
      pendingQuotes: payload.pending_quotes || 0,
      averageBookingValue: payload.average_booking_value || 0,
      inquiryConversionRate: payload.inquiry_conversion_rate || 0,
    } as VendorStats;
  },
  async getMyCatererProfile(token: string) {
    const payload = await request<any>('/user/me/caterer', { token });
    return mapCatererProfile(payload);
  },
  async updateMyCatererProfile(token: string, draft: CatererProfileDraft) {
    const payload = await request<any>('/user/me/caterer', {
      method: 'PUT',
      token,
      body: {
        business_name: draft.businessName,
        description: draft.description,
        phone: draft.phone,
        location: draft.location,
        hero_tagline: draft.heroTagline,
        cuisines: draft.cuisines,
        tiers: draft.tiers.map(tier => ({
          name: tier.name,
          price_per_head: tier.pricePerHead,
          items: tier.items,
        })),
      },
    });
    return mapCatererProfile(payload);
  },
  async getMyPortfolio(token: string) {
    const payload = await request<any>('/portfolio/me', { token });
    return (payload.items || []).map(mapPortfolio);
  },
  async uploadPortfolioImage(token: string, input: { uri: string; type: string; name: string; file?: File | Blob | string; caption: string; description?: string; isPrimary?: boolean }) {
    const formData = new FormData();
    formData.append('caption', input.caption);
    formData.append('description', input.description || '');
    formData.append('is_primary', input.isPrimary ? 'true' : 'false');

    if (Platform.OS === 'web') {
      let webFile: Blob | File | null = null;

      if (input.file && typeof input.file !== 'string') {
        webFile = input.file;
      } else {
        const assetResponse = await fetch(input.uri);
        webFile = await assetResponse.blob();
      }

      formData.append('file', webFile, input.name);
    } else {
      formData.append('file', {
        uri: input.uri,
        type: input.type,
        name: input.name,
      } as unknown as Blob);
    }

    const payload = await request<any>('/portfolio/images', {
      method: 'POST',
      token,
      body: formData,
    });
    return mapPortfolio(payload);
  },
  async updatePortfolioImage(token: string, imageId: string, input: { caption?: string; description?: string; isPrimary?: boolean }) {
    const payload = await request<any>(`/portfolio/images/${imageId}`, {
      method: 'PATCH',
      token,
      body: {
        caption: input.caption,
        description: input.description,
        is_primary: input.isPrimary,
      },
    });
    return mapPortfolio(payload);
  },
  async deletePortfolioImage(token: string, imageId: string) {
    return request(`/portfolio/images/${imageId}`, {
      method: 'DELETE',
      token,
    });
  },
  async initiateDeposit(token: string, bookingId: string) {
    const payload = await request<any>('/payments/initiate', {
      method: 'POST',
      token,
      body: { booking_id: bookingId },
    });
    return {
      paymentId: payload.payment_id,
      bookingId: payload.booking_id,
      amount: payload.amount,
      phone: payload.phone,
      status: payload.status,
      providerReference: payload.provider_reference,
      provider: payload.provider,
      mode: payload.mode,
    } as PaymentInitiation;
  },
  async completeTestPayment(token: string, paymentId: string, outcome: 'paid' | 'failed' = 'paid') {
    return request<any>('/payments/test/complete', {
      method: 'POST',
      token,
      body: { payment_id: paymentId, outcome },
    });
  },
};
