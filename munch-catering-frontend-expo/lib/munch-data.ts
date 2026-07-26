export type UserRole = 'customer' | 'caterer' | 'admin';
export type ThemeMode = 'light' | 'dark';

export type Session = {
  token: string;
  user: UserProfile;
};

export type UserProfile = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt?: string;
};

export type MenuTier = {
  name: string;
  pricePerHead: number;
  items: string[];
};

export type PortfolioItem = {
  id: string;
  filename: string;
  imageUrl: string;
  caption: string;
  description: string;
  isPrimary: boolean;
  uploadedAt?: string;
};

export type Review = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type CatererCardData = {
  id: string;
  businessName: string;
  description: string;
  phone?: string;
  location?: string;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  heroTagline: string;
  cuisines: string[];
  portfolioPreview?: PortfolioItem;
};

export type CatererProfile = {
  id: string;
  businessName: string;
  ownerId?: string;
  ownerEmail?: string;
  description: string;
  phone?: string;
  location?: string;
  rating: number;
  reviewCount: number;
  portfolio: PortfolioItem[];
  reviews: Review[];
  tiers: MenuTier[];
  priceFrom: number;
  heroTagline: string;
  cuisines: string[];
};

export type Quote = {
  id: string;
  catererId: string;
  catererName: string;
  customerEmail?: string;
  description: string;
  guestCount: number;
  budgetEstimate: number;
  status: 'pending_review' | 'contacted' | 'approved' | 'converted_to_booking' | 'rejected';
  lifecycleStage: 'request_pending' | 'quote_approved_awaiting_payment' | 'booking_converted' | 'request_rejected';
  isCheckoutReady: boolean;
  approvedPackageLabel?: string;
  approvedPricePerHead?: number;
  approvedTotal?: number;
  sourceBookingId?: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  catererId: string;
  catererName: string;
  customerPhone: string;
  guestCount: number;
  selectedTier: string;
  pricePerHead: number;
  total: number;
  deposit: number;
  balance: number;
  status: 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed';
  lifecycleStage: 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled';
  paymentProvider: 'test' | 'mpesa';
  paymentMode: string;
  isPayable: boolean;
  sourceQuoteId?: string;
  activePaymentId?: string;
  eventDate?: string;
  createdAt?: string;
};

export type PaymentInitiation = {
  paymentId: string;
  bookingId: string;
  amount: number;
  phone: string;
  status: Booking['paymentStatus'];
  providerReference: string;
  provider: Booking['paymentProvider'];
  mode: string;
};

export type Conversation = {
  id: string;
  contactEmail: string;
  contactName: string;
  preview: string;
  unreadCount: number;
  timestamp: string;
};

export type ChatMessage = {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  isRead: boolean;
};

export type VendorStats = {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  paidBookings: number;
  approvedQuotes: number;
  pendingQuotes: number;
  averageBookingValue: number;
  inquiryConversionRate: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CatererProfileDraft = {
  businessName: string;
  description: string;
  phone: string;
  location: string;
  heroTagline: string;
  cuisines: string[];
  tiers: MenuTier[];
};

export const palette = {
  ink950: '#071112',
  ink900: '#102022',
  slate700: '#526568',
  slate500: '#839295',
  cloud100: '#EEF3F1',
  white: '#FBFCFA',
  gold500: '#8FAF9F',
  gold400: '#B7CFC3',
  gold300: '#D9E7DF',
  rose300: '#C8D5D0',
  green400: '#6F8F84',
  border: '#D8E1DE',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatShortDate(value?: string) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
