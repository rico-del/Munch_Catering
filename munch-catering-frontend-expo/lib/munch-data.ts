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
  ink950: '#182019',
  ink900: '#263127',
  slate700: '#5F685B',
  slate500: '#8A8274',
  cloud100: '#F8F1E8',
  white: '#FFFCF8',
  gold500: '#C96D43',
  gold400: '#E18B5D',
  gold300: '#F2C8A2',
  rose300: '#D98B72',
  green400: '#667E5D',
  border: '#E6D4C1',
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
