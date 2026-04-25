import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '@/lib/api';
import { clearSession, loadSession, loadThemePreference, saveSession, saveThemePreference } from '@/lib/session';
import {
  Booking,
  CatererCardData,
  CatererProfile,
  CatererProfileDraft,
  ChatMessage,
  Conversation,
  MenuTier,
  PortfolioItem,
  Quote,
  Session,
  ThemeMode,
  VendorStats,
  formatCurrency,
  formatShortDate,
  palette,
  radius,
  spacing,
} from '@/lib/munch-data';

type AuthScreen = 'welcome' | 'login' | 'signup' | 'forgot-password' | 'reset-password';
type CustomerTab = 'home' | 'discover' | 'messages' | 'bookings' | 'profile';
type VendorTab = 'dashboard' | 'inquiries' | 'messages' | 'bookings' | 'portfolio' | 'profile';
type AppRoute =
  | { name: 'auth'; screen: AuthScreen }
  | { name: 'customer' }
  | { name: 'vendor' }
  | { name: 'caterer-detail'; catererId: string }
  | { name: 'gallery'; catererId: string }
  | { name: 'quote-request'; catererId: string }
  | { name: 'checkout'; catererId: string; tierName?: string; quoteId?: string }
  | { name: 'booking-detail'; bookingId: string }
  | { name: 'chat'; contactEmail: string; contactName: string }
  | { name: 'settings' };

type SignupDraft = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: 'customer' | 'caterer';
};

type LoginDraft = {
  email: string;
  password: string;
};

type PasswordResetDraft = {
  email: string;
  token: string;
  newPassword: string;
};

type UploadDraft = {
  id: string;
  uri: string;
  name: string;
  type: string;
  file?: File | Blob;
  caption: string;
  description: string;
  isPrimary: boolean;
};

type ThemeTokens = {
  mode: ThemeMode;
  page: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  headerBadge: string;
  shell: string;
  shellBorder: string;
  field: string;
  fieldBorder: string;
  ghost: string;
  overlay: string;
  inverseText: string;
};

const lightTheme: ThemeTokens = {
  mode: 'light',
  page: palette.cloud100,
  surface: palette.white,
  surfaceMuted: '#FFF8F2',
  surfaceElevated: '#F6EBDD',
  text: palette.ink950,
  textMuted: palette.slate700,
  border: palette.border,
  headerBadge: '#F7E2D4',
  shell: 'rgba(255, 248, 242, 0.9)',
  shellBorder: 'rgba(230, 212, 193, 0.88)',
  field: '#FFF9F3',
  fieldBorder: 'rgba(201, 109, 67, 0.14)',
  ghost: 'rgba(255, 252, 248, 0.55)',
  overlay: 'rgba(24, 32, 25, 0.56)',
  inverseText: '#FFF8F2',
};

const darkTheme: ThemeTokens = {
  mode: 'dark',
  page: '#111613',
  surface: '#1A221B',
  surfaceMuted: '#202821',
  surfaceElevated: '#242E26',
  text: '#F5EEE5',
  textMuted: '#C3B7A9',
  border: '#344134',
  headerBadge: '#2B352B',
  shell: 'rgba(24, 32, 25, 0.92)',
  shellBorder: 'rgba(52, 65, 52, 0.96)',
  field: '#202821',
  fieldBorder: 'rgba(201, 109, 67, 0.28)',
  ghost: 'rgba(36, 46, 38, 0.8)',
  overlay: 'rgba(14, 18, 15, 0.66)',
  inverseText: '#FFF8F2',
};

const ThemeContext = React.createContext<ThemeTokens>(lightTheme);

function useThemeTokens() {
  return React.useContext(ThemeContext);
}

const emptyStats: VendorStats = {
  totalBookings: 0,
  confirmedBookings: 0,
  pendingBookings: 0,
  totalRevenue: 0,
  paidBookings: 0,
  approvedQuotes: 0,
  pendingQuotes: 0,
  averageBookingValue: 0,
  inquiryConversionRate: 0,
};

const tierBlueprints: MenuTier[] = [
  { name: 'Standard', pricePerHead: 2200, items: ['Buffet service', '2 mains', '2 sides', 'Service team', 'Basic table setup'] },
  { name: 'Premium', pricePerHead: 3600, items: ['Signature welcome bites', 'Dessert bar', 'Enhanced tablescape', 'Menu consultation'] },
  { name: 'Deluxe', pricePerHead: 5200, items: ['Live stations', 'Custom plating', 'Lead event captain', 'Late service extension'] },
];
const preferredTierNames = ['Standard', 'Premium', 'Deluxe'];

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));
}

function sortTiers(tiers: MenuTier[]) {
  return [...tiers].sort((left, right) => {
    const leftIndex = preferredTierNames.indexOf(left.name);
    const rightIndex = preferredTierNames.indexOf(right.name);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function toIncrementalTiers(tiers: MenuTier[]) {
  const running = new Set<string>();
  return sortTiers(tiers).map(tier => {
    const fullItems = uniqueItems(tier.items);
    const extras = fullItems.filter(item => !running.has(item));
    fullItems.forEach(item => running.add(item));
    return {
      ...tier,
      items: extras.length ? extras : fullItems,
    };
  });
}

function toCumulativeTiers(tiers: MenuTier[]) {
  const running: string[] = [];
  return sortTiers(tiers).map(tier => {
    const combined = uniqueItems([...running, ...tier.items]);
    running.splice(0, running.length, ...combined);
    return {
      ...tier,
      items: combined,
    };
  });
}

function getTierPreviewItems(tiers: MenuTier[], index: number) {
  return toCumulativeTiers(tiers)[index]?.items || [];
}

function toSentenceCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getBookingStatusTone(booking: Booking) {
  if (booking.lifecycleStage === 'completed') return 'muted';
  if (booking.lifecycleStage === 'cancelled') return 'muted';
  return 'default';
}

const starterTiers: MenuTier[] = tierBlueprints;

const defaultCatererDraft: CatererProfileDraft = {
  businessName: '',
  description: '',
  phone: '',
  location: '',
  heroTagline: '',
  cuisines: [],
  tiers: starterTiers,
};

const emptySignupDraft: SignupDraft = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  role: 'customer',
};

function resolvePrimaryPortfolioItem<T extends { isPrimary?: boolean }>(items: T[]): T | null {
  return items.find(item => item.isPrimary) || items[0] || null;
}

function getInitialPasswordResetParams(): Partial<PasswordResetDraft> | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('resetToken') || params.get('token') || '';
  if (!token) return null;
  return {
    email: params.get('email') || '',
    token,
    newPassword: '',
  };
}

export default function Index() {
  const [booting, setBooting] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>('light');
  const [session, setSession] = React.useState<Session | null>(null);
  const [route, setRoute] = React.useState<AppRoute>({ name: 'auth', screen: 'welcome' });
  const [customerTab, setCustomerTab] = React.useState<CustomerTab>('home');
  const [vendorTab, setVendorTab] = React.useState<VendorTab>('dashboard');
  const [caterers, setCaterers] = React.useState<CatererCardData[]>([]);
  const [activeCaterer, setActiveCaterer] = React.useState<CatererProfile | null>(null);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [activeBooking, setActiveBooking] = React.useState<Booking | null>(null);
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [vendorStats, setVendorStats] = React.useState<VendorStats>(emptyStats);
  const [myCatererProfile, setMyCatererProfile] = React.useState<CatererProfile | null>(null);
  const [uploadDrafts, setUploadDrafts] = React.useState<UploadDraft[]>([]);
  const [search, setSearch] = React.useState('');
  const [loginDraft, setLoginDraft] = React.useState<LoginDraft>({ email: '', password: '' });
  const [passwordResetDraft, setPasswordResetDraft] = React.useState<PasswordResetDraft>({ email: '', token: '', newPassword: '' });
  const [signupDraft, setSignupDraft] = React.useState<SignupDraft>(emptySignupDraft);
  const [profileDraft, setProfileDraft] = React.useState({ fullName: '', username: '' });
  const [catererDraft, setCatererDraft] = React.useState<CatererProfileDraft>(defaultCatererDraft);
  const [quoteDraft, setQuoteDraft] = React.useState({ description: '', guestCount: '80', budgetEstimate: '250000' });
  const [checkoutDraft, setCheckoutDraft] = React.useState({ customerPhone: '0712345678', guestCount: '120' });
  const [messageDraft, setMessageDraft] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const storedTheme = await loadThemePreference();
        if (mounted) {
          setThemeMode(storedTheme);
        }
        const resetParams = getInitialPasswordResetParams();
        if (resetParams) {
          if (mounted) {
            setPasswordResetDraft(current => ({ ...current, ...resetParams }));
            setRoute({ name: 'auth', screen: 'reset-password' });
          }
          return;
        }
        const stored = await loadSession();
        if (!stored) {
          if (mounted) {
            setRoute({ name: 'auth', screen: 'welcome' });
          }
          return;
        }

        const user = await api.getMe(stored.token);
        if (!mounted) return;
        setSession({ token: stored.token, user });
        setProfileDraft({ fullName: user.fullName, username: user.username });
        if (user.role === 'caterer') {
          setRoute({ name: 'vendor' });
        } else {
          setRoute({ name: 'customer' });
        }
      } catch {
        await clearSession();
        if (mounted) {
          setSession(null);
          setRoute({ name: 'auth', screen: 'login' });
        }
      } finally {
        if (mounted) setBooting(false);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const handleApiError = React.useCallback(async (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    setError(message);
    if (message.toLowerCase().includes('authentication')) {
      await clearSession();
      setSession(null);
      setRoute({ name: 'auth', screen: 'login' });
    }
  }, []);

  const loadCustomerData = React.useCallback(async (token: string) => {
    const [catererPayload, bookingPayload, quotePayload, conversationPayload] = await Promise.all([
      api.getCaterers(),
      api.getBookings(token),
      api.getQuotes(token),
      api.getConversations(token),
    ]);
    setCaterers(catererPayload.items);
    setBookings(bookingPayload.items);
    setQuotes(quotePayload.items);
    setConversations(conversationPayload.items);
  }, []);

  const loadVendorData = React.useCallback(async (token: string) => {
    const [catererPayload, bookingPayload, quotePayload, statsPayload, conversationPayload] = await Promise.all([
      api.getCaterers(),
      api.getBookings(token),
      api.getQuotes(token),
      api.getVendorStats(token),
      api.getConversations(token),
    ]);
    setCaterers(catererPayload.items);
    setBookings(bookingPayload.items);
    setQuotes(quotePayload.items);
    setVendorStats(statsPayload);
    setConversations(conversationPayload.items);

    try {
      const profile = await api.getMyCatererProfile(token);
      setMyCatererProfile(profile);
      setCatererDraft({
        businessName: profile.businessName,
        description: profile.description,
        phone: profile.phone || '',
        location: profile.location || '',
        heroTagline: profile.heroTagline,
        cuisines: profile.cuisines,
        tiers: profile.tiers.length ? toIncrementalTiers(profile.tiers) : starterTiers,
      });
    } catch (err) {
      setMyCatererProfile(null);
      setCatererDraft(defaultCatererDraft);
      if (!(err instanceof Error) || !err.message.toLowerCase().includes('not found')) {
        throw err;
      }
    }
  }, []);

  const refreshAll = React.useCallback(
    async (showSpinner = false) => {
      if (!session) return;
      if (showSpinner) setRefreshing(true);
      setError(null);
      try {
        if (session.user.role === 'caterer') {
          await loadVendorData(session.token);
        } else {
          await loadCustomerData(session.token);
        }
      } catch (err) {
        await handleApiError(err);
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [handleApiError, loadCustomerData, loadVendorData, session],
  );

  React.useEffect(() => {
    if (!session) return;
    setProfileDraft({ fullName: session.user.fullName, username: session.user.username });
    void refreshAll();
  }, [refreshAll, session]);

  const signOut = React.useCallback(async () => {
    await clearSession();
    setSession(null);
    setActiveCaterer(null);
    setActiveBooking(null);
    setMessages([]);
    setQuotes([]);
    setBookings([]);
    setConversations([]);
    setMyCatererProfile(null);
    setVendorStats(emptyStats);
    setRoute({ name: 'auth', screen: 'login' });
  }, []);

  const setAuthenticatedSession = React.useCallback(async (nextSession: Session) => {
    await saveSession(nextSession);
    setSession(nextSession);
    setProfileDraft({ fullName: nextSession.user.fullName, username: nextSession.user.username });
    if (nextSession.user.role === 'caterer') {
      setRoute({ name: 'vendor' });
    } else {
      setRoute({ name: 'customer' });
    }
  }, []);

  const navigateAuth = React.useCallback((screen: AuthScreen) => {
    if (screen === 'signup') {
      setSignupDraft(emptySignupDraft);
    }
    if (screen === 'login') {
      setLoginDraft({ email: '', password: '' });
    }
    if (screen === 'forgot-password') {
      setPasswordResetDraft(current => ({ ...current, email: loginDraft.email.trim(), token: '', newPassword: '' }));
    }
    setRoute({ name: 'auth', screen });
  }, [loginDraft.email]);

  const handleLogin = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const nextSession = await api.login(loginDraft.email.trim(), loginDraft.password);
      await setAuthenticatedSession(nextSession);
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, loginDraft.email, loginDraft.password, setAuthenticatedSession]);

  const handleReactivate = React.useCallback(async () => {
    const email = loginDraft.email.trim();
    const password = loginDraft.password;

    if (!email.includes('@')) {
      setError('Enter the email address for the disabled account.');
      return;
    }
    if (password.length < 8) {
      setError('Enter the account password to reactivate.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextSession = await api.reactivate(email, password);
      await setAuthenticatedSession(nextSession);
      Alert.alert('Account reactivated', 'Welcome back. Your account is active again.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, loginDraft.email, loginDraft.password, setAuthenticatedSession]);

  const handleRequestPasswordReset = React.useCallback(async () => {
    const email = passwordResetDraft.email.trim();
    if (!email.includes('@')) {
      setError('Enter the email address for your account.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setPasswordResetDraft(current => ({ ...current, email }));
      setRoute({ name: 'auth', screen: 'reset-password' });
      Alert.alert('Check your email', 'If an account exists, a password reset link has been sent.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, passwordResetDraft.email]);

  const handleConfirmPasswordReset = React.useCallback(async () => {
    const email = passwordResetDraft.email.trim();
    const token = passwordResetDraft.token.trim();
    const newPassword = passwordResetDraft.newPassword;

    if (!email.includes('@')) {
      setError('Enter the email address for your account.');
      return;
    }
    if (token.length < 16) {
      setError('Paste the reset token from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.confirmPasswordReset({ email, token, newPassword });
      setLoginDraft({ email, password: '' });
      setPasswordResetDraft({ email: '', token: '', newPassword: '' });
      setRoute({ name: 'auth', screen: 'login' });
      Alert.alert('Password reset', 'You can now sign in with your new password.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, passwordResetDraft]);

  const handleSignup = React.useCallback(async () => {
    const fullName = signupDraft.fullName.trim();
    const username = signupDraft.username.trim();
    const email = signupDraft.email.trim();
    const password = signupDraft.password;

    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (username.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextSession = await api.register({
        ...signupDraft,
        fullName,
        username,
        email,
      });
      await setAuthenticatedSession(nextSession);
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, setAuthenticatedSession, signupDraft]);

  const openCaterer = React.useCallback(
    async (catererId: string) => {
      setBusy(true);
      setError(null);
      try {
        const profile = await api.getCatererDetail(catererId);
        setActiveCaterer(profile);
        setRoute({ name: 'caterer-detail', catererId });
      } catch (err) {
        await handleApiError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError],
  );

  const openBooking = React.useCallback(
    async (bookingId: string) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        const booking = await api.getBookingDetail(session.token, bookingId);
        setActiveBooking(booking);
        setRoute({ name: 'booking-detail', bookingId });
      } catch (err) {
        await handleApiError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError, session],
  );

  const openConversation = React.useCallback(
    async (contactEmail: string, contactName: string) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        const thread = await api.getThread(session.token, contactEmail);
        setMessages(thread.items);
        await api.markConversationRead(session.token, contactEmail);
        await refreshAll();
        setRoute({ name: 'chat', contactEmail, contactName });
      } catch (err) {
        await handleApiError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError, refreshAll, session],
  );

  const submitQuote = React.useCallback(async () => {
    if (!session || !activeCaterer) return;
    setBusy(true);
    setError(null);
    try {
      await api.requestQuote(session.token, {
        catererId: activeCaterer.id,
        description: quoteDraft.description,
        guestCount: Number(quoteDraft.guestCount),
        budgetEstimate: Number(quoteDraft.budgetEstimate),
      });
      setQuoteDraft({ description: '', guestCount: '80', budgetEstimate: '250000' });
      await refreshAll();
      setCustomerTab('bookings');
      setRoute({ name: 'customer' });
      Alert.alert('Quote requested', 'Your event brief is now in the caterer inquiry queue.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [activeCaterer, handleApiError, quoteDraft, refreshAll, session]);

  const createBooking = React.useCallback(async () => {
    if (!session || !activeCaterer) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await api.createBooking(session.token, {
        catererId: activeCaterer.id,
        customerPhone: checkoutDraft.customerPhone,
        guestCount: Number(checkoutDraft.guestCount),
        selectedTier: route.name === 'checkout' ? route.tierName : undefined,
        quoteId: route.name === 'checkout' ? route.quoteId : undefined,
      });
      let paymentMode = 'unknown';
      try {
        const payment = await api.initiateDeposit(session.token, booking.id);
        paymentMode = payment.mode;
      } catch (err) {
        await handleApiError(err);
      }
      await refreshAll();
      const refreshedBooking = await api.getBookingDetail(session.token, booking.id);
      setActiveBooking(refreshedBooking);
      setRoute({ name: 'booking-detail', bookingId: booking.id });
      Alert.alert(
        'Booking secured',
        paymentMode === 'test'
          ? 'We created the booking in safe test mode. Confirm the simulated payment from the booking detail screen.'
          : 'We created the booking and started the deposit request.',
      );
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [activeCaterer, checkoutDraft.customerPhone, checkoutDraft.guestCount, handleApiError, refreshAll, route, session]);

  const continueApprovedQuote = React.useCallback(
    async (quote: Quote) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        const caterer = await api.getCatererDetail(quote.catererId);
        setActiveCaterer(caterer);
        setCheckoutDraft(current => ({
          ...current,
          guestCount: String(quote.guestCount || current.guestCount),
        }));
        setRoute({ name: 'checkout', catererId: quote.catererId, quoteId: quote.id });
      } catch (err) {
        await handleApiError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError, session],
  );

  const sendMessage = React.useCallback(async () => {
    if (!session || route.name !== 'chat' || !messageDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendMessage(session.token, {
        recipient: route.contactEmail,
        content: messageDraft.trim(),
      });
      const thread = await api.getThread(session.token, route.contactEmail);
      setMessages(thread.items);
      setMessageDraft('');
      await refreshAll();
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, messageDraft, refreshAll, route, session]);

  const saveProfile = React.useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.updateMe(session.token, profileDraft);
      const nextSession = { token: session.token, user };
      await setAuthenticatedSession(nextSession);
      Alert.alert('Profile updated', 'Your account details are now in sync.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, profileDraft, session, setAuthenticatedSession]);

  const saveCatererProfile = React.useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await api.updateMyCatererProfile(session.token, {
        ...catererDraft,
        tiers: toCumulativeTiers(catererDraft.tiers),
      });
      setMyCatererProfile(profile);
      setCatererDraft({
        businessName: profile.businessName,
        description: profile.description,
        phone: profile.phone || '',
        location: profile.location || '',
        heroTagline: profile.heroTagline,
        cuisines: profile.cuisines,
        tiers: profile.tiers.length ? toIncrementalTiers(profile.tiers) : starterTiers,
      });
      await refreshAll();
      Alert.alert('Brand profile updated', 'Your public caterer profile is now live.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [catererDraft, handleApiError, refreshAll, session]);

  const disableAccount = React.useCallback(() => {
    if (!session) return;
    Alert.alert(
      'Disable account?',
      'Your account will be signed out and blocked from use. Caterer profiles are removed from discovery while disabled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await api.disableMyAccount(session.token);
                await signOut();
                Alert.alert('Account disabled', 'Your account has been disabled.');
              } catch (err) {
                await handleApiError(err);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [handleApiError, session, signOut]);

  const deleteAccount = React.useCallback(() => {
    if (!session) return;
    Alert.alert(
      'Permanently delete account?',
      'This removes your account and related account data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await api.deleteMyAccount(session.token);
                await signOut();
                Alert.alert('Account deleted', 'Your account has been permanently deleted.');
              } catch (err) {
                await handleApiError(err);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [handleApiError, session, signOut]);

  const addCatererTier = React.useCallback(() => {
    setCatererDraft(current => {
      const usedNames = new Set(current.tiers.map(item => item.name));
      const nextTemplate =
        tierBlueprints.find(item => !usedNames.has(item.name)) || {
          name: `Tier ${current.tiers.length + 1}`,
          pricePerHead: (current.tiers.at(-1)?.pricePerHead || 2200) + 800,
          items: ['Tailored service upgrade'],
        };
      return {
        ...current,
        tiers: [...current.tiers, { ...nextTemplate, items: [...nextTemplate.items] }],
      };
    });
  }, []);

  const updateCatererTier = React.useCallback((index: number, patch: Partial<MenuTier>) => {
    setCatererDraft(current => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              ...patch,
              items: patch.items ? uniqueItems(patch.items) : tier.items,
            }
          : tier,
      ),
    }));
  }, []);

  const removeCatererTier = React.useCallback((index: number) => {
    setCatererDraft(current => {
      if (current.tiers.length <= 1) {
        Alert.alert('Keep one tier', 'A caterer profile needs at least one package tier.');
        return current;
      }
      return {
        ...current,
        tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index),
      };
    });
  }, []);

  const pickPortfolioImage = React.useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload portfolio imagery.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (result.canceled || !result.assets.length) return;

    setUploadDrafts(current => {
      const hasPrimary = current.some(item => item.isPrimary) || !!resolvePrimaryPortfolioItem(myCatererProfile?.portfolio || []);
      return [
        ...current,
        ...result.assets.map((asset, index) => ({
          id: `${Date.now()}-${index}-${asset.assetId || 'draft'}`,
          uri: asset.uri,
          name: asset.fileName || `portfolio-${Date.now()}-${index}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          file: (asset as ImagePicker.ImagePickerAsset & { file?: File | Blob }).file,
          caption: '',
          description: '',
          isPrimary: !hasPrimary && current.length === 0 && index === 0,
        })),
      ];
    });
  }, [myCatererProfile?.portfolio]);

  const uploadPortfolioImages = React.useCallback(async () => {
    if (!session || !uploadDrafts.length) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: PortfolioItem[] = [];
      for (const draft of uploadDrafts) {
        const image = await api.uploadPortfolioImage(session.token, {
          uri: draft.uri,
          type: draft.type,
          name: draft.name,
          file: draft.file,
          caption: draft.caption,
          description: draft.description,
          isPrimary: draft.isPrimary,
        });
        uploaded.push(image);
      }
      setMyCatererProfile(current => {
        if (!current) return current;
        const nextPortfolio = [...uploaded, ...current.portfolio.filter(existing => !uploaded.some(item => item.id === existing.id))];
        return {
          ...current,
          portfolio: nextPortfolio,
        };
      });
      setUploadDrafts([]);
      await refreshAll();
      Alert.alert('Upload complete', 'Your portfolio images are now ready on the public profile.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, refreshAll, session, uploadDrafts]);

  const setUploadDraftPrimary = React.useCallback((draftId: string) => {
    setUploadDrafts(current => current.map(item => ({ ...item, isPrimary: item.id === draftId })));
  }, []);

  const updateUploadDraft = React.useCallback((draftId: string, patch: Partial<UploadDraft>) => {
    setUploadDrafts(current => current.map(item => (item.id === draftId ? { ...item, ...patch } : item)));
  }, []);

  const removeUploadDraft = React.useCallback((draftId: string) => {
    setUploadDrafts(current => {
      const remaining = current.filter(item => item.id !== draftId);
      if (remaining.length && !remaining.some(item => item.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  }, []);

  const makePortfolioImagePrimary = React.useCallback(
    async (imageId: string) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        await api.updatePortfolioImage(session.token, imageId, { isPrimary: true });
        await refreshAll();
      } catch (err) {
        await handleApiError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleApiError, refreshAll, session],
  );

  const approveQuote = React.useCallback(async (quoteId: string) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateQuote(session.token, quoteId, 'approved');
      await refreshAll();
      setVendorTab('bookings');
      setRoute({ name: 'vendor' });
      Alert.alert('Request approved', 'The request moved into your bookings pipeline while the customer completes checkout.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, refreshAll, session]);

  const rejectQuote = React.useCallback(async (quoteId: string) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateQuote(session.token, quoteId, 'rejected');
      await refreshAll();
      Alert.alert('Request declined', 'The inquiry was removed from your open pipeline and marked as rejected for the customer.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, refreshAll, session]);

  const requestBookingPayment = React.useCallback(async (bookingId: string) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const payment = await api.initiateDeposit(session.token, bookingId);
      await refreshAll();
      if (payment.provider === 'test') {
        Alert.alert('Test payment requested', 'This booking is in safe test mode. Use the confirm action on the booking to simulate the callback.');
      } else {
        Alert.alert('Payment requested', 'The deposit prompt has been sent to the customer phone number on the booking.');
      }
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [handleApiError, refreshAll, session]);

  const completeTestBookingPayment = React.useCallback(async (paymentId: string) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.completeTestPayment(session.token, paymentId, 'paid');
      await refreshAll();
      if (route.name === 'booking-detail' && activeBooking) {
        const refreshedBooking = await api.getBookingDetail(session.token, activeBooking.id);
        setActiveBooking(refreshedBooking);
      }
      Alert.alert('Test payment confirmed', 'The booking is now confirmed without charging real money.');
    } catch (err) {
      await handleApiError(err);
    } finally {
      setBusy(false);
    }
  }, [activeBooking, handleApiError, refreshAll, route.name, session]);

  if (booting) {
    return <BootScreen />;
  }

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const searchResults = caterers.filter(item =>
    `${item.businessName} ${item.description} ${item.location} ${item.cuisines.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  );
  const currentUser = session?.user ?? null;

  const resolvedCaterer =
    route.name === 'caterer-detail' || route.name === 'gallery' || route.name === 'quote-request' || route.name === 'checkout'
      ? activeCaterer
      : null;
  const activeApprovedQuote =
    route.name === 'checkout' && route.quoteId ? quotes.find(item => item.id === route.quoteId) || null : null;
  const featuredPortfolioImage = resolvedCaterer ? resolvePrimaryPortfolioItem(resolvedCaterer.portfolio) : null;
  const orderedPortfolio = resolvedCaterer
    ? [...resolvedCaterer.portfolio].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
      : [];
  const orderedMyPortfolio = myCatererProfile ? [...myCatererProfile.portfolio].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary)) : [];
  const actionableBookings = bookings.filter(item => item.lifecycleStage === 'awaiting_payment');
  const confirmedBookings = bookings.filter(item => item.lifecycleStage === 'confirmed');
  const completedBookings = bookings.filter(item => item.lifecycleStage === 'completed');
  const cancelledBookings = bookings.filter(item => item.lifecycleStage === 'cancelled');
  const approvedQuotes = quotes.filter(item => item.lifecycleStage === 'quote_approved_awaiting_payment');
  const pendingQuotes = quotes.filter(item => item.lifecycleStage === 'request_pending');
  const rejectedQuotes = quotes.filter(item => item.lifecycleStage === 'request_rejected');

  return (
    <ThemeContext.Provider value={theme}>
      <SafeAreaView style={[styles.page, { backgroundColor: theme.page }]}>
        <View style={styles.appChrome}>
        <Header
          title={
            route.name === 'auth'
              ? 'Munch'
              : route.name === 'chat'
                ? route.contactName
                : route.name === 'settings'
                  ? 'Settings'
                  : route.name === 'booking-detail'
                    ? 'Booking'
                    : route.name === 'gallery'
                      ? 'Gallery'
                      : route.name === 'quote-request'
                        ? 'Quote request'
                        : route.name === 'checkout'
                          ? 'Checkout'
                          : session?.user.role === 'caterer'
                            ? 'Vendor view'
                            : 'Munch'
          }
          onBack={
            route.name === 'auth'
              ? undefined
              : route.name === 'customer' || route.name === 'vendor'
                ? undefined
                : () => {
                    if (route.name === 'gallery' && resolvedCaterer) {
                      setRoute({ name: 'caterer-detail', catererId: resolvedCaterer.id });
                      return;
                    }
                    if ((route.name === 'quote-request' || route.name === 'checkout') && resolvedCaterer) {
                      setRoute({ name: 'caterer-detail', catererId: resolvedCaterer.id });
                      return;
                    }
                    if (currentUser?.role === 'caterer') {
                      setRoute({ name: 'vendor' });
                    } else {
                      setRoute({ name: 'customer' });
                    }
                  }
          }
        />

        {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}
        {busy ? <BusyStripe /> : null}

        {route.name === 'auth' ? (
          <AuthFlow
            screen={route.screen}
            loginDraft={loginDraft}
            passwordResetDraft={passwordResetDraft}
            signupDraft={signupDraft}
            busy={busy}
            onNavigate={navigateAuth}
            onChangeLogin={patch => setLoginDraft(current => ({ ...current, ...patch }))}
            onChangePasswordReset={patch => setPasswordResetDraft(current => ({ ...current, ...patch }))}
            onChangeSignup={patch => setSignupDraft(current => ({ ...current, ...patch }))}
            onLogin={handleLogin}
            onReactivate={handleReactivate}
            onRequestPasswordReset={handleRequestPasswordReset}
            onConfirmPasswordReset={handleConfirmPasswordReset}
            onSignup={handleSignup}
          />
        ) : route.name === 'caterer-detail' && resolvedCaterer ? (
          <Screen onRefresh={() => refreshAll(true)} refreshing={refreshing}>
            {featuredPortfolioImage ? (
              <Pressable onPress={() => setRoute({ name: 'gallery', catererId: resolvedCaterer.id })}>
                <Image source={{ uri: featuredPortfolioImage.imageUrl }} style={styles.detailImage} />
              </Pressable>
            ) : null}
            <HeroCard eyebrow="Caterer profile" title={resolvedCaterer.businessName} body={resolvedCaterer.heroTagline} />
            <MotionCard>
              <RatingRow rating={resolvedCaterer.rating} reviewCount={resolvedCaterer.reviewCount} priceFrom={resolvedCaterer.priceFrom} />
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>{resolvedCaterer.description}</Text>
              <Text style={[styles.metaText, { color: theme.textMuted }]}>{resolvedCaterer.location || 'Location shared after profile completion'}</Text>
            </MotionCard>
            {resolvedCaterer.tiers.map(tier => (
              <MotionCard key={tier.name}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{tier.name}</Text>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>From {formatCurrency(tier.pricePerHead)} per guest</Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>{tier.items.join(' . ')}</Text>
                <PrimaryButton label="Book this tier" onPress={() => setRoute({ name: 'checkout', catererId: resolvedCaterer.id, tierName: tier.name })} />
              </MotionCard>
            ))}
            <ButtonRow>
              <SecondaryButton label="Request quote" onPress={() => setRoute({ name: 'quote-request', catererId: resolvedCaterer.id })} />
              <GhostButton label="Gallery" onPress={() => setRoute({ name: 'gallery', catererId: resolvedCaterer.id })} />
            </ButtonRow>
          </Screen>
        ) : route.name === 'gallery' && resolvedCaterer ? (
          <Screen>
            <PortfolioGallerySection
              title={`${resolvedCaterer.businessName} gallery`}
              subtitle="Recent portfolio work, optimized for a premium mobile browsing flow."
              items={orderedPortfolio}
            />
          </Screen>
        ) : route.name === 'quote-request' && resolvedCaterer ? (
          <Screen>
            <SectionHeader title="Request a tailored quote" subtitle="Send a structured brief directly into the authenticated inquiry workflow." />
            <Field label="Event brief" value={quoteDraft.description} onChangeText={value => setQuoteDraft(current => ({ ...current, description: value }))} multiline />
            <Field label="Guest count" value={quoteDraft.guestCount} onChangeText={value => setQuoteDraft(current => ({ ...current, guestCount: value }))} />
            <Field label="Budget estimate" value={quoteDraft.budgetEstimate} onChangeText={value => setQuoteDraft(current => ({ ...current, budgetEstimate: value }))} />
            <PrimaryButton label="Send quote request" onPress={submitQuote} />
          </Screen>
        ) : route.name === 'checkout' && resolvedCaterer ? (
          <Screen>
            <SectionHeader title="Secure your event date" subtitle="Create a booking that is bound to your authenticated account and trigger the deposit request securely." />
            <MotionCard>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{resolvedCaterer.businessName}</Text>
              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                {activeApprovedQuote?.approvedPackageLabel || route.tierName || resolvedCaterer.tiers[0]?.name || 'Selected tier'}
              </Text>
              {activeApprovedQuote ? (
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  Approved custom quote for {activeApprovedQuote.guestCount} guests . Total{' '}
                  {formatCurrency(activeApprovedQuote.approvedTotal || activeApprovedQuote.budgetEstimate)}
                </Text>
              ) : null}
            </MotionCard>
            <Field label="Phone number" value={checkoutDraft.customerPhone} onChangeText={value => setCheckoutDraft(current => ({ ...current, customerPhone: value }))} hint="Used for the M-Pesa deposit prompt." />
            {activeApprovedQuote ? (
              <MotionCard>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>Approved scope</Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  This booking will use the approved custom quote terms instead of falling back to a standard tier package.
                </Text>
              </MotionCard>
            ) : (
              <Field label="Guest count" value={checkoutDraft.guestCount} onChangeText={value => setCheckoutDraft(current => ({ ...current, guestCount: value }))} />
            )}
            <PrimaryButton label="Create booking and request deposit" onPress={createBooking} />
          </Screen>
        ) : route.name === 'booking-detail' && activeBooking ? (
          <Screen>
            <SectionHeader title={activeBooking.catererName} subtitle={`Event date ${formatShortDate(activeBooking.eventDate)}`} />
            <MotionCard>
              <Text style={[styles.metaText, { color: theme.textMuted }]}>Status</Text>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{toSentenceCase(activeBooking.status)}</Text>
              <StatusPill label={toSentenceCase(activeBooking.paymentStatus)} muted={activeBooking.paymentStatus !== 'paid'} />
              <BookingProgress booking={activeBooking} />
            </MotionCard>
            <MotionCard>
              <Text style={[styles.metaText, { color: theme.textMuted }]}>Booking summary</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                {activeBooking.guestCount} guests on {activeBooking.selectedTier}
              </Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                Deposit {formatCurrency(activeBooking.deposit)} . Balance {formatCurrency(activeBooking.balance)}
              </Text>
              {activeBooking.lifecycleStage === 'awaiting_payment' ? (
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  {activeBooking.paymentStatus === 'pending'
                    ? 'A deposit request is already in progress for this booking.'
                    : 'This booking is approved and waiting for a successful deposit before it becomes confirmed.'}
                </Text>
              ) : null}
              {session?.user.role === 'customer' && activeBooking.isPayable ? (
                <PrimaryButton label="Request deposit prompt" onPress={() => void requestBookingPayment(activeBooking.id)} />
              ) : null}
              {session?.user.role === 'customer' &&
              activeBooking.paymentProvider === 'test' &&
              activeBooking.paymentStatus === 'pending' &&
              activeBooking.activePaymentId ? (
                <SecondaryButton label="Confirm test payment" onPress={() => void completeTestBookingPayment(activeBooking.activePaymentId!)} />
              ) : null}
            </MotionCard>
          </Screen>
        ) : route.name === 'chat' ? (
          <View style={{ flex: 1 }}>
            <Screen>
              <SectionHeader title={route.contactName} subtitle="Private conversation" />
              {messages.map(item => {
                const mine = item.sender.toLowerCase() === session?.user.email.toLowerCase();
                return (
                  <View key={item.id} style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}>
                    <Text style={[styles.chatText, mine ? styles.chatTextMine : undefined]}>{item.content}</Text>
                  </View>
                );
              })}
            </Screen>
            <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder="Send a polished reply"
                placeholderTextColor={theme.textMuted}
                style={[styles.composerInput, { backgroundColor: theme.field, color: theme.text }]}
              />
              <Pressable style={styles.sendButton} onPress={sendMessage}>
                <Ionicons name="paper-plane" size={18} color={lightTheme.inverseText} />
              </Pressable>
            </View>
          </View>
        ) : route.name === 'settings' ? (
          <Screen>
            <SectionHeader
              title={currentUser?.role === 'caterer' ? 'Studio settings' : 'Account settings'}
              subtitle={
                currentUser?.role === 'caterer'
                  ? 'Brand, account, and workspace controls for your caterer studio.'
                  : 'Personal account, workspace, and appearance controls grounded in supported features.'
              }
            />
            <MotionCard style={styles.settingsHeroCard}>
              <MunchBrandLockup compact />
              <View style={styles.settingsHeroMeta}>
                <View style={styles.profileHeader}>
                  <Avatar label={currentUser?.fullName || 'User'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{currentUser?.fullName || 'User'}</Text>
                    <Text style={[styles.metaText, { color: theme.textMuted }]}>{currentUser?.email || ''}</Text>
                  </View>
                  <StatusPill label={currentUser?.role || 'customer'} />
                </View>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  Joined {formatShortDate(currentUser?.createdAt)}. This workspace syncs with your authenticated account, live bookings, real messages, and role-based profile data.
                </Text>
              </View>
            </MotionCard>
            <MotionCard>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Appearance</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                {currentUser?.role === 'caterer'
                  ? 'Choose how your caterer workspace should look while managing inquiries, bookings, and your studio profile.'
                  : 'Choose how your customer workspace should look while browsing caterers, bookings, and messages.'}
              </Text>
              <ThemeToggleBar
                value={themeMode}
                onChange={mode => {
                  setThemeMode(mode);
                  void saveThemePreference(mode);
                }}
              />
            </MotionCard>
            <MotionCard>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Account details</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>Update the account details used across your workspace.</Text>
              <Field label="Full name" value={profileDraft.fullName} onChangeText={value => setProfileDraft(current => ({ ...current, fullName: value }))} />
              <Field label="Username" value={profileDraft.username} onChangeText={value => setProfileDraft(current => ({ ...current, username: value }))} />
              <ButtonRow>
                <PrimaryButton label="Save changes" onPress={() => void saveProfile()} />
                <SecondaryButton label="Refresh data" onPress={() => void refreshAll(true)} />
              </ButtonRow>
            </MotionCard>
            {currentUser?.role === 'caterer' ? (
              <MotionCard>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Business studio</Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  Manage your business profile, portfolio, and marketplace presence.
                </Text>
                <View style={styles.settingsList}>
                  <SettingStat label="Business" value={myCatererProfile?.businessName || 'Complete your studio profile'} />
                  <SettingStat label="Portfolio items" value={String(myCatererProfile?.portfolio.length || 0)} />
                  <SettingStat label="Marketplace rating" value={`${(myCatererProfile?.rating || 0).toFixed(1)} . ${myCatererProfile?.reviewCount || 0} reviews`} />
                </View>
                <ButtonRow>
                  <PrimaryButton
                    label="Edit studio profile"
                    onPress={() => {
                      setVendorTab('profile');
                      setRoute({ name: 'vendor' });
                    }}
                  />
                  <SecondaryButton
                    label="Manage portfolio"
                    onPress={() => {
                      setVendorTab('portfolio');
                      setRoute({ name: 'vendor' });
                    }}
                  />
                </ButtonRow>
              </MotionCard>
            ) : (
              <MotionCard>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Quick access</Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>Go directly to your bookings, messages, or caterer directory.</Text>
                <ButtonRow>
                  <PrimaryButton
                    label="Bookings"
                    onPress={() => {
                      setCustomerTab('bookings');
                      setRoute({ name: 'customer' });
                    }}
                  />
                  <SecondaryButton
                    label="Messages"
                    onPress={() => {
                      setCustomerTab('messages');
                      setRoute({ name: 'customer' });
                    }}
                  />
                </ButtonRow>
                <GhostButton
                  label="Browse caterers"
                  onPress={() => {
                    setCustomerTab('discover');
                    setRoute({ name: 'customer' });
                  }}
                />
              </MotionCard>
            )}
            <MotionCard>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Account access</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                For password or account assistance, contact the support channel linked to {currentUser?.email || 'your account'}.
              </Text>
              <View style={styles.settingsList}>
                <SettingStat label="API" value={api.baseURL} subtle />
                <SettingStat label="Session" value="Authenticated" subtle />
              </View>
              <GhostButton label="Sign out" onPress={() => void signOut()} />
            </MotionCard>
            <MotionCard>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Account closure</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                Disable access temporarily, or permanently remove your account and related workspace data.
              </Text>
              <ButtonRow>
                <SecondaryButton label="Disable account" onPress={disableAccount} />
                <GhostButton label="Delete forever" onPress={deleteAccount} />
              </ButtonRow>
            </MotionCard>
          </Screen>
        ) : session?.user.role === 'caterer' ? (
          <>
            <Screen onRefresh={() => refreshAll(true)} refreshing={refreshing}>
              {vendorTab === 'dashboard' ? (
                <>
                  <SectionHeader eyebrow="Vendor dashboard" title="A sharper operating view for your catering business." />
                  <View style={styles.metricsGrid}>
                    <MotionCard style={styles.metricCard}>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.totalBookings}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Total bookings</Text>
                    </MotionCard>
                    <MotionCard style={styles.metricCard}>
                      <Text style={[styles.statValue, { color: theme.text }]}>{formatCurrency(vendorStats.totalRevenue)}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Paid revenue</Text>
                    </MotionCard>
                    <MotionCard style={styles.metricCard}>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.approvedQuotes}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Approved requests</Text>
                    </MotionCard>
                    <MotionCard style={styles.metricCard}>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.pendingQuotes}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Open inquiries</Text>
                    </MotionCard>
                  </View>
                  <MotionCard style={styles.statsCard}>
                    <View>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.confirmedBookings}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Confirmed bookings</Text>
                    </View>
                    <View>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.paidBookings}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Paid bookings</Text>
                    </View>
                  </MotionCard>
                  <MotionCard style={styles.statsCard}>
                    <View>
                      <Text style={[styles.statValue, { color: theme.text }]}>{formatCurrency(vendorStats.averageBookingValue)}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Average booking value</Text>
                    </View>
                    <View>
                      <Text style={[styles.statValue, { color: theme.text }]}>{vendorStats.inquiryConversionRate}%</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>Inquiry conversion</Text>
                    </View>
                  </MotionCard>
                  {bookings.slice(0, 3).map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                </>
              ) : null}

              {vendorTab === 'inquiries' ? (
                <>
                  <SectionHeader title="Pending requests" subtitle="Only customer briefs still awaiting your decision stay in this queue." />
                  {pendingQuotes.map(item => (
                    <MotionCard key={item.id}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.guestCount} guests . Budget {formatCurrency(item.budgetEstimate)}</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text>
                      <ButtonRow>
                        <SecondaryButton
                          label="Message"
                          onPress={() => {
                            if (!item.customerEmail) {
                              Alert.alert('Contact unavailable', 'This inquiry is missing customer contact information.');
                              return;
                            }
                            void openConversation(item.customerEmail, item.customerEmail);
                          }}
                        />
                        <GhostButton label="Reject" onPress={() => void rejectQuote(item.id)} />
                        <PrimaryButton label="Approve" onPress={() => void approveQuote(item.id)} />
                      </ButtonRow>
                    </MotionCard>
                  ))}
                  {!pendingQuotes.length ? (
                    <MotionCard>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>No pending requests</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                        New customer briefs will appear here until you approve or reject them.
                      </Text>
                    </MotionCard>
                  ) : null}
                </>
              ) : null}

              {vendorTab === 'messages' ? (
                <>
                  <SectionHeader title="Client inbox" subtitle="See every active customer thread in one dedicated place, separate from request approvals." />
                  {conversations.length ? (
                    conversations.map(item => (
                      <ConversationCard key={item.id} item={item} onPress={() => void openConversation(item.contactEmail, item.contactName)} />
                    ))
                  ) : (
                    <MotionCard>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>No conversations yet</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                        When a customer messages you from an inquiry or booking, the thread will live here for easy follow-up.
                      </Text>
                    </MotionCard>
                  )}
                </>
              ) : null}

              {vendorTab === 'bookings' ? (
                <>
                  <SectionHeader title="Bookings pipeline" subtitle="Approved requests awaiting checkout are separated from bookings awaiting payment, confirmed events, and history." />
                  {approvedQuotes.map(item => (
                    <MotionCard key={item.id}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.guestCount} guests . Budget {formatCurrency(item.budgetEstimate)}</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text>
                      <StatusPill label="Awaiting customer checkout" />
                    </MotionCard>
                  ))}
                  {actionableBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                  {confirmedBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                  {completedBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                  {cancelledBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                </>
              ) : null}

              {vendorTab === 'portfolio' ? (
                <VendorPortfolioSection
                  uploads={uploadDrafts}
                  portfolio={orderedMyPortfolio}
                  onPick={() => void pickPortfolioImage()}
                  onUpload={() => void uploadPortfolioImages()}
                  onSetDraftPrimary={setUploadDraftPrimary}
                  onUpdateDraft={updateUploadDraft}
                  onRemoveDraft={removeUploadDraft}
                  onMakePrimary={imageId => void makePortfolioImagePrimary(imageId)}
                />
              ) : null}

              {vendorTab === 'profile' ? (
                <>
                  <SectionHeader title="Business profile" subtitle="Refine how your catering brand appears in the marketplace." />
                  <Field label="Business name" value={catererDraft.businessName} onChangeText={value => setCatererDraft(current => ({ ...current, businessName: value }))} />
                  <Field label="Hero tagline" value={catererDraft.heroTagline} onChangeText={value => setCatererDraft(current => ({ ...current, heroTagline: value }))} />
                  <Field label="Location" value={catererDraft.location} onChangeText={value => setCatererDraft(current => ({ ...current, location: value }))} />
                  <Field label="Phone number" value={catererDraft.phone} onChangeText={value => setCatererDraft(current => ({ ...current, phone: value }))} />
                  <Field label="Cuisines" value={catererDraft.cuisines.join(', ')} onChangeText={value => setCatererDraft(current => ({ ...current, cuisines: value.split(',').map(item => item.trim()).filter(Boolean) }))} />
                  <Field label="Brand description" value={catererDraft.description} onChangeText={value => setCatererDraft(current => ({ ...current, description: value }))} multiline />
                  <TierEditorSection tiers={catererDraft.tiers} onAdd={addCatererTier} onUpdate={updateCatererTier} onRemove={removeCatererTier} />
                  <PrimaryButton label="Save profile" onPress={() => void saveCatererProfile()} />
                  <SecondaryButton label="Settings" onPress={() => setRoute({ name: 'settings' })} />
                  <GhostButton label="Sign out" onPress={() => void signOut()} />
                </>
              ) : null}
            </Screen>
            <TabBar
              items={[
                { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { key: 'inquiries', label: 'Inquiries', icon: 'mail' },
                { key: 'messages', label: 'Messages', icon: 'chatbubble' },
                { key: 'bookings', label: 'Bookings', icon: 'calendar' },
                { key: 'portfolio', label: 'Portfolio', icon: 'images' },
                { key: 'profile', label: 'Profile', icon: 'person' },
              ]}
              active={vendorTab}
              onChange={value => setVendorTab(value as VendorTab)}
            />
          </>
        ) : (
          <>
            <Screen onRefresh={() => refreshAll(true)} refreshing={refreshing}>
              {customerTab === 'home' ? (
                <>
                  <HeroCard
                    eyebrow="New season menus"
                    title="A cleaner way to book caterers for weddings, launches, and private events."
                    body="Shortlist vendors from real portfolios, compare tiers, and move from quote to deposit without leaving the app."
                    dark
                  />
                  <SectionHeader eyebrow="Featured" title="Curated caterers" subtitle="Premium vendors with strong presentation, reviews, and scalable event service." />
                  {caterers.slice(0, 4).map(item => (
                    <CatererCard key={item.id} caterer={item} onPress={() => void openCaterer(item.id)} />
                  ))}
                </>
              ) : null}

              {customerTab === 'discover' ? (
                <>
                  <SectionHeader title="Browse caterers" subtitle="Search by venue style, cuisine, or service quality." />
                  <SearchField value={search} onChangeText={setSearch} placeholder="Search caterers, cuisine, location" />
                  {searchResults.map(item => (
                    <CatererCard key={item.id} caterer={item} onPress={() => void openCaterer(item.id)} />
                  ))}
                </>
              ) : null}

              {customerTab === 'messages' ? (
                <>
                  <SectionHeader title="Messages" subtitle="Every conversation is tied to your authenticated account, not a forged sender field." />
                  {conversations.map(item => (
                    <ConversationCard key={item.id} item={item} onPress={() => void openConversation(item.contactEmail, item.contactName)} />
                  ))}
                </>
              ) : null}

              {customerTab === 'bookings' ? (
                <>
                  <SectionHeader title="Bookings" subtitle="Requests, checkout-ready quotes, active bookings, and history are separated by backend lifecycle state." />
                  {actionableBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                  {confirmedBookings.map(item => (
                    <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                  ))}
                  <SectionHeader eyebrow="Ready to book" title="Approved requests" subtitle="When a caterer approves your brief, you can move straight into checkout from here." />
                  {approvedQuotes.length ? (
                    approvedQuotes.map(item => (
                        <MotionCard key={item.id}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                          <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.guestCount} guests . {formatCurrency(item.budgetEstimate)}</Text>
                          <Text style={[styles.metaText, { color: theme.textMuted }]}>
                            {item.approvedPackageLabel || 'Custom quote'} . Total {formatCurrency(item.approvedTotal || item.budgetEstimate)}
                          </Text>
                          <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text>
                          <ButtonRow>
                            <StatusPill label="Awaiting payment" />
                            <PrimaryButton label="Continue to checkout" onPress={() => void continueApprovedQuote(item)} />
                          </ButtonRow>
                        </MotionCard>
                      ))
                  ) : (
                    <MotionCard>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>No approved requests yet</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                        Once a caterer approves one of your event briefs, it will appear here with a checkout action.
                      </Text>
                    </MotionCard>
                  )}
                  <SectionHeader eyebrow="Requests" title="Pending review" />
                  {pendingQuotes.map(item => (
                    <MotionCard key={item.id}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.guestCount} guests . {formatCurrency(item.budgetEstimate)}</Text>
                      <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text>
                      <StatusPill label={toSentenceCase(item.lifecycleStage)} muted />
                    </MotionCard>
                  ))}
                  {rejectedQuotes.length ? (
                    <>
                      <SectionHeader eyebrow="Requests" title="Rejected" subtitle="Requests declined by a caterer stay here for reference instead of remaining in active lists." />
                      {rejectedQuotes.map(item => (
                        <MotionCard key={item.id}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                          <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.guestCount} guests . {formatCurrency(item.budgetEstimate)}</Text>
                          <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text>
                          <StatusPill label="Rejected" muted />
                        </MotionCard>
                      ))}
                    </>
                  ) : null}
                  {completedBookings.length ? (
                    <>
                      <SectionHeader eyebrow="History" title="Completed bookings" />
                      {completedBookings.map(item => (
                        <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                      ))}
                    </>
                  ) : null}
                  {cancelledBookings.length ? (
                    <>
                      <SectionHeader eyebrow="History" title="Cancelled bookings" />
                      {cancelledBookings.map(item => (
                        <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                      ))}
                    </>
                  ) : null}
                </>
              ) : null}

              {customerTab === 'profile' ? (
                <>
                  <MotionCard>
                    <View style={styles.profileHeader}>
                      <Avatar label={currentUser?.fullName || 'User'} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>{currentUser?.fullName || 'User'}</Text>
                        <Text style={[styles.metaText, { color: theme.textMuted }]}>{currentUser?.email || ''}</Text>
                      </View>
                      <StatusPill label={currentUser?.role || 'customer'} />
                    </View>
                  </MotionCard>
                  <Field label="Full name" value={profileDraft.fullName} onChangeText={value => setProfileDraft(current => ({ ...current, fullName: value }))} />
                  <Field label="Username" value={profileDraft.username} onChangeText={value => setProfileDraft(current => ({ ...current, username: value }))} />
                  <PrimaryButton label="Save account details" onPress={() => void saveProfile()} />
                  <SecondaryButton label="Settings" onPress={() => setRoute({ name: 'settings' })} />
                  <GhostButton label="Sign out" onPress={() => void signOut()} />
                </>
              ) : null}
            </Screen>
            <TabBar
              items={[
                { key: 'home', label: 'Home', icon: 'home' },
                { key: 'discover', label: 'Discover', icon: 'search' },
                { key: 'messages', label: 'Messages', icon: 'chatbubble' },
                { key: 'bookings', label: 'Bookings', icon: 'calendar' },
                { key: 'profile', label: 'Profile', icon: 'person' },
              ]}
              active={customerTab}
              onChange={value => setCustomerTab(value as CustomerTab)}
            />
          </>
        )}
        </View>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function BootScreen() {
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <ThemeContext.Provider value={darkTheme}>
      <SafeAreaView style={styles.bootContainer}>
      <Animated.View style={{ opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
        <View style={styles.bootGlow} />
        <MunchBrandLockup theme="dark" />
      </Animated.View>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function AuthFlow(props: {
  screen: AuthScreen;
  loginDraft: LoginDraft;
  passwordResetDraft: PasswordResetDraft;
  signupDraft: SignupDraft;
  busy: boolean;
  onNavigate: (screen: AuthScreen) => void;
  onChangeLogin: (patch: Partial<LoginDraft>) => void;
  onChangePasswordReset: (patch: Partial<PasswordResetDraft>) => void;
  onChangeSignup: (patch: Partial<SignupDraft>) => void;
  onLogin: () => void;
  onReactivate: () => void;
  onRequestPasswordReset: () => void;
  onConfirmPasswordReset: () => void;
  onSignup: () => void;
}) {
  return (
    <Screen>
      {props.screen === 'welcome' ? (
        <>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' }}
            style={styles.welcomeHero}
            imageStyle={styles.welcomeHeroImage}
          >
            <View style={styles.welcomeOverlay}>
              <MunchBrandLockup compact />
              <Text style={styles.welcomeEyebrow}>Event dining, reimagined</Text>
              <Text style={styles.welcomeTitle}>Find caterers that feel premium before the first tasting.</Text>
              <Text style={styles.welcomeBody}>
                Browse real portfolios, request structured quotes, track bookings, and keep every vendor conversation in one polished mobile workflow.
              </Text>
            </View>
          </ImageBackground>
          <PrimaryButton label="Create account" onPress={() => props.onNavigate('signup')} />
          <SecondaryButton label="I already have an account" onPress={() => props.onNavigate('login')} />
        </>
      ) : null}

      {props.screen === 'login' ? (
        <>
          <SectionHeader eyebrow="Sign in" title="Return to your bookings, quotes, and conversations." />
          <Field
            label="Email address"
            value={props.loginDraft.email}
            onChangeText={value => props.onChangeLogin({ email: value })}
            autoComplete="off"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={props.loginDraft.password}
            onChangeText={value => props.onChangeLogin({ password: value })}
            secureTextEntry
            autoComplete="off"
            autoCapitalize="none"
          />
          <PrimaryButton label={props.busy ? 'Signing in...' : 'Sign in'} onPress={props.onLogin} />
          <SecondaryButton label="Reactivate disabled account" onPress={props.onReactivate} />
          <GhostButton label="Forgot password?" onPress={() => props.onNavigate('forgot-password')} />
          <GhostButton label="Need an account? Create one" onPress={() => props.onNavigate('signup')} />
        </>
      ) : null}

      {props.screen === 'forgot-password' ? (
        <>
          <SectionHeader eyebrow="Password reset" title="Send a secure reset link to your account email." />
          <Field
            label="Email address"
            value={props.passwordResetDraft.email}
            onChangeText={value => props.onChangePasswordReset({ email: value })}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <PrimaryButton label={props.busy ? 'Sending reset link...' : 'Send reset link'} onPress={props.onRequestPasswordReset} />
          <GhostButton label="Back to sign in" onPress={() => props.onNavigate('login')} />
        </>
      ) : null}

      {props.screen === 'reset-password' ? (
        <>
          <SectionHeader eyebrow="Set new password" title="Paste the reset token from your email and choose a new password." />
          <Field
            label="Email address"
            value={props.passwordResetDraft.email}
            onChangeText={value => props.onChangePasswordReset({ email: value })}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Reset token"
            value={props.passwordResetDraft.token}
            onChangeText={value => props.onChangePasswordReset({ token: value })}
            autoComplete="off"
            autoCapitalize="none"
          />
          <Field
            label="New password"
            value={props.passwordResetDraft.newPassword}
            onChangeText={value => props.onChangePasswordReset({ newPassword: value })}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <PrimaryButton label={props.busy ? 'Resetting password...' : 'Reset password'} onPress={props.onConfirmPasswordReset} />
          <GhostButton label="Back to sign in" onPress={() => props.onNavigate('login')} />
        </>
      ) : null}

      {props.screen === 'signup' ? (
        <>
          <SectionHeader eyebrow="Join Munch" title="Open the right side of the marketplace from the very first screen." />
          <RoleSelector value={props.signupDraft.role} onChange={value => props.onChangeSignup({ role: value })} />
          <Field
            label="Full name"
            value={props.signupDraft.fullName}
            onChangeText={value => props.onChangeSignup({ fullName: value })}
            autoComplete="name"
            autoCapitalize="words"
          />
          <Field
            label="Username"
            value={props.signupDraft.username}
            onChangeText={value => props.onChangeSignup({ username: value })}
            autoComplete="off"
            autoCapitalize="none"
          />
          <Field
            label="Email"
            value={props.signupDraft.email}
            onChangeText={value => props.onChangeSignup({ email: value })}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={props.signupDraft.password}
            onChangeText={value => props.onChangeSignup({ password: value })}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <PrimaryButton label={props.busy ? 'Creating account...' : 'Create account'} onPress={props.onSignup} />
          <GhostButton label="Back to sign in" onPress={() => props.onNavigate('login')} />
        </>
      ) : null}
    </Screen>
  );
}

function Header(props: { title: string; onBack?: () => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.header, { backgroundColor: theme.page }]}>
      {props.onBack ? (
        <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={props.onBack}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerKicker, { color: theme.textMuted }]}>Munch</Text>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{props.title}</Text>
      </View>
      <View style={[styles.headerBadge, { backgroundColor: theme.headerBadge }]}>
        <Ionicons name="sparkles" size={14} color={palette.gold500} />
      </View>
    </View>
  );
}

function MunchBrandLockup(props: { compact?: boolean; theme?: 'light' | 'dark' }) {
  const tokens = useThemeTokens();
  const dark = props.theme ? props.theme === 'dark' : tokens.mode === 'dark';
  return (
    <View style={[styles.brandLockup, props.compact ? styles.brandLockupCompact : undefined]}>
      <View style={[styles.brandSeal, dark ? styles.brandSealDark : undefined, props.compact ? styles.brandSealCompact : undefined]}>
        <View style={[styles.brandSealHalo, dark ? styles.brandSealHaloDark : undefined]} />
        <View style={[styles.brandStarBadge, dark ? styles.brandStarBadgeDark : undefined]}>
          <Ionicons name="star" size={props.compact ? 12 : 14} color={palette.gold500} />
        </View>
        <View style={[styles.brandLeafCluster, styles.brandLeafClusterLeft]}>
          <Ionicons name="leaf-outline" size={props.compact ? 14 : 16} color={dark ? palette.gold300 : palette.green400} />
          <Ionicons name="leaf-outline" size={props.compact ? 12 : 14} color={dark ? palette.gold300 : palette.green400} />
        </View>
        <View style={[styles.brandLeafCluster, styles.brandLeafClusterRight]}>
          <Ionicons name="leaf-outline" size={props.compact ? 14 : 16} color={dark ? palette.gold300 : palette.green400} />
          <Ionicons name="leaf-outline" size={props.compact ? 12 : 14} color={dark ? palette.gold300 : palette.green400} />
        </View>
        <View style={[styles.brandMedallion, dark ? styles.brandMedallionDark : undefined]}>
          <Ionicons name="restaurant-outline" size={props.compact ? 26 : 34} color={dark ? palette.gold300 : palette.ink950} />
        </View>
      </View>
      <View style={styles.brandWordmarkWrap}>
        <Text style={[styles.brandWordmark, dark ? styles.brandWordmarkDark : undefined, props.compact ? styles.brandWordmarkCompact : undefined]}>MUNCH</Text>
        <Text style={[styles.brandSubmark, dark ? styles.brandSubmarkDark : undefined]}>Catering Studio</Text>
      </View>
    </View>
  );
}

function SettingStat(props: { label: string; value: string; subtle?: boolean }) {
  const theme = useThemeTokens();
  return (
    <View
      style={[
        styles.settingStat,
        props.subtle ? styles.settingStatSubtle : undefined,
        { backgroundColor: props.subtle ? theme.surfaceMuted : theme.surfaceElevated },
      ]}
    >
      <Text style={[styles.settingLabel, { color: theme.textMuted }]}>{props.label}</Text>
      <Text style={[styles.settingValue, { color: theme.text }]}>{props.value}</Text>
    </View>
  );
}

function Screen(props: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const theme = useThemeTokens();
  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        props.onRefresh ? (
          <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} tintColor={palette.gold500} />
        ) : undefined
      }
    >
      {props.children}
    </ScrollView>
  );
}

function MotionCard(props: { children: React.ReactNode; style?: object }) {
  const theme = useThemeTokens();
  const translate = React.useRef(new Animated.Value(18)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity, transform: [{ translateY: translate }] },
        props.style,
      ]}
    >
      {props.children}
    </Animated.View>
  );
}

function HeroCard(props: { eyebrow: string; title: string; body: string; dark?: boolean }) {
  const theme = useThemeTokens();
  return (
    <MotionCard style={props.dark ? styles.darkCard : undefined}>
      {props.dark ? <LinearGradient colors={['rgba(255,255,255,0.02)', 'rgba(201,109,67,0.12)']} style={styles.heroCardGlow} /> : null}
      <Text style={[styles.eyebrow, props.dark ? styles.darkEyebrow : undefined]}>{props.eyebrow}</Text>
      <Text style={[styles.heroTitle, { color: props.dark ? theme.inverseText : theme.text }, props.dark ? styles.darkHeroTitle : undefined]}>{props.title}</Text>
      <Text style={[styles.bodyText, { color: props.dark ? '#E8DED2' : theme.textMuted }, props.dark ? styles.darkBodyText : undefined]}>{props.body}</Text>
    </MotionCard>
  );
}

function SectionHeader(props: { eyebrow?: string; title: string; subtitle?: string }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.sectionHeader}>
      {props.eyebrow ? <Text style={styles.eyebrow}>{props.eyebrow}</Text> : null}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{props.title}</Text>
      {props.subtitle ? <Text style={[styles.sectionBody, { color: theme.textMuted }]}>{props.subtitle}</Text> : null}
    </View>
  );
}

function CatererCard(props: { caterer: CatererCardData; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable onPress={props.onPress}>
      <MotionCard>
        {props.caterer.portfolioPreview?.imageUrl ? (
          <Image source={{ uri: props.caterer.portfolioPreview.imageUrl }} style={styles.cardImage} />
        ) : null}
        <Text style={[styles.cardTitle, { color: theme.text }]}>{props.caterer.businessName}</Text>
        <Text style={styles.cardKicker}>{props.caterer.heroTagline}</Text>
        <RatingRow rating={props.caterer.rating} reviewCount={props.caterer.reviewCount} priceFrom={props.caterer.priceFrom} />
        <Text style={[styles.metaText, { color: theme.textMuted }]}>{props.caterer.location || 'Location shared after profile completion'}</Text>
        <Text style={[styles.bodyText, { color: theme.textMuted }]}>{props.caterer.description}</Text>
        <View style={styles.tagRow}>
          {props.caterer.cuisines.map(item => (
            <StatusPill key={item} label={item} muted />
          ))}
        </View>
      </MotionCard>
    </Pressable>
  );
}

function BookingCard(props: { booking: Booking; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable onPress={props.onPress}>
      <MotionCard>
        <View style={styles.portfolioMetaRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{props.booking.catererName}</Text>
          <StatusPill label={toSentenceCase(props.booking.lifecycleStage)} muted={getBookingStatusTone(props.booking) === 'muted'} />
        </View>
        <Text style={[styles.metaText, { color: theme.textMuted }]}>{formatShortDate(props.booking.eventDate)} . {props.booking.selectedTier}</Text>
        <Text style={[styles.bodyText, { color: theme.textMuted }]}>
          {props.booking.guestCount} guests . Deposit {formatCurrency(props.booking.deposit)}
        </Text>
        <BookingProgress booking={props.booking} />
      </MotionCard>
    </Pressable>
  );
}

function ConversationCard(props: { item: Conversation; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable onPress={props.onPress}>
      <MotionCard>
        <View style={styles.profileHeader}>
          <Avatar label={props.item.contactName} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{props.item.contactName}</Text>
            <Text style={[styles.bodyText, { color: theme.textMuted }]}>{props.item.preview}</Text>
          </View>
          {props.item.unreadCount ? <StatusPill label={`${props.item.unreadCount}`} /> : null}
        </View>
      </MotionCard>
    </Pressable>
  );
}

function BookingProgress(props: { booking: Booking }) {
  const theme = useThemeTokens();
  const paid = props.booking.paymentStatus === 'paid' || props.booking.lifecycleStage === 'confirmed' || props.booking.lifecycleStage === 'completed';
  const pending = props.booking.paymentStatus === 'pending';
  const width = paid ? '100%' : pending ? '72%' : '42%';
  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressRail, { backgroundColor: theme.mode === 'dark' ? '#2C382D' : '#EBD8C6' }]}>
        <View style={[styles.progressBar, { width }]} />
        <View style={[styles.progressDot, { borderColor: theme.surface }, paid ? styles.progressDotPaid : undefined]} />
      </View>
      <View style={styles.progressMetaRow}>
        <Text style={[styles.progressText, { color: theme.textMuted }]}>
          Payment {paid ? 'secured' : pending ? 'processing' : 'not started'}
        </Text>
        <Text style={[styles.progressText, { color: theme.textMuted }]}>{toSentenceCase(props.booking.lifecycleStage)}</Text>
      </View>
    </View>
  );
}

function RatingRow(props: { rating: number; reviewCount: number; priceFrom: number }) {
  const theme = useThemeTokens();
  const hasReviews = props.reviewCount > 0;
  const resolvedRating = hasReviews ? props.rating.toFixed(1) : 'New';
  return (
    <View style={styles.ratingRow}>
      <View style={[styles.ratingBadge, { backgroundColor: theme.mode === 'dark' ? '#2A231F' : '#FAE6D7' }]}>
        <Ionicons name="star" size={14} color={palette.gold500} />
        <Text style={[styles.ratingValue, { color: theme.text }]}>{resolvedRating}</Text>
      </View>
      <Text style={[styles.ratingMeta, { color: theme.textMuted }]}>{hasReviews ? `${props.reviewCount} reviews` : 'Fresh studio profile'}</Text>
      {props.priceFrom > 0 ? <Text style={[styles.ratingMeta, { color: theme.textMuted }]}>From {formatCurrency(props.priceFrom)}</Text> : null}
    </View>
  );
}

function StatusPill(props: { label: string; muted?: boolean }) {
  const theme = useThemeTokens();
  return (
    <View
      style={[
        styles.badge,
        props.muted ? styles.badgeMuted : undefined,
        { backgroundColor: props.muted ? theme.surfaceMuted : theme.surfaceElevated },
      ]}
    >
      <Text style={[styles.badgeText, { color: props.muted ? theme.textMuted : theme.text }, props.muted ? styles.badgeTextMuted : undefined]}>{props.label}</Text>
    </View>
  );
}

function InlineError(props: { message: string; onDismiss: () => void }) {
  return (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorText}>{props.message}</Text>
      <Pressable onPress={props.onDismiss}>
        <Ionicons name="close" size={16} color="#8D392D" />
      </Pressable>
    </View>
  );
}

function BusyStripe() {
  const theme = useThemeTokens();
  return (
    <View style={[styles.busyStripe, { backgroundColor: theme.mode === 'dark' ? '#332A22' : '#FBECDD' }]}>
      <ActivityIndicator size="small" color={palette.gold500} />
      <Text style={[styles.busyText, { color: theme.text }]}>Syncing secure data...</Text>
    </View>
  );
}

function Avatar(props: { label: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.avatar, { backgroundColor: theme.mode === 'dark' ? '#2A332A' : palette.ink900 }]}>
      <Text style={styles.avatarText}>{props.label.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function SearchField(props: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.searchField, { backgroundColor: theme.field, borderColor: theme.fieldBorder }]}>
      <Ionicons name="search" size={16} color={theme.textMuted} />
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textMuted}
        style={[styles.searchInput, { color: theme.text }]}
      />
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  hint?: string;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
}) {
  const theme = useThemeTokens();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        multiline={props.multiline}
        autoComplete={props.autoComplete}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        keyboardType={props.keyboardType}
        autoCorrect={false}
        importantForAutofill={props.autoComplete === 'off' ? 'no' : 'auto'}
        placeholderTextColor={theme.textMuted}
        style={[styles.fieldInput, { backgroundColor: theme.field, borderColor: theme.fieldBorder, color: theme.text }, props.multiline ? styles.fieldInputMultiline : undefined]}
      />
      {props.hint ? <Text style={[styles.fieldHint, { color: theme.textMuted }]}>{props.hint}</Text> : null}
    </View>
  );
}

function RoleSelector(props: { value: 'customer' | 'caterer'; onChange: (value: 'customer' | 'caterer') => void }) {
  const theme = useThemeTokens();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>Choose your path</Text>
      <Text style={[styles.fieldHint, { color: theme.textMuted }]}>Pick the experience you want Munch to unlock first. You can still expand access later.</Text>
      <View style={styles.roleStage}>
        <Pressable
          style={[styles.roleCardEditorial, { backgroundColor: theme.surface, borderColor: theme.border }, props.value === 'customer' ? styles.roleCardEditorialActive : undefined]}
          onPress={() => props.onChange('customer')}
        >
          <View style={styles.roleTopLine}>
            <View style={styles.roleIconWrap}>
              <Ionicons name="sparkles" size={18} color={props.value === 'customer' ? palette.gold500 : palette.slate500} />
            </View>
            <StatusPill label="Booking side" muted={props.value !== 'customer'} />
          </View>
          <Text style={[styles.roleEditorialTitle, { color: theme.text }]}>Plan and book unforgettable events</Text>
          <Text style={[styles.roleEditorialBody, { color: theme.textMuted }]}>
            Browse standout caterers, compare polished menus, request tailored quotes, and manage every conversation from one premium workspace.
          </Text>
          <View style={styles.roleFootRow}>
            <Text style={[styles.roleFootLabel, { color: theme.textMuted }]}>Best for hosts, planners, and event teams</Text>
            {props.value === 'customer' ? <Ionicons name="checkmark-circle" size={20} color={palette.gold500} /> : null}
          </View>
        </Pressable>
        <Pressable
          style={[styles.roleCardEditorial, { backgroundColor: theme.surface, borderColor: theme.border }, props.value === 'caterer' ? styles.roleCardEditorialActive : undefined]}
          onPress={() => props.onChange('caterer')}
        >
          <View style={styles.roleTopLine}>
            <View style={styles.roleIconWrap}>
              <Ionicons name="restaurant" size={18} color={props.value === 'caterer' ? palette.gold500 : palette.slate500} />
            </View>
            <StatusPill label="Studio side" muted={props.value !== 'caterer'} />
          </View>
          <Text style={[styles.roleEditorialTitle, { color: theme.text }]}>Present your brand like a premium studio</Text>
          <Text style={[styles.roleEditorialBody, { color: theme.textMuted }]}>
            Receive real inquiries, publish your culinary portfolio, refine your public profile, and turn demand into confirmed bookings with clarity.
          </Text>
          <View style={styles.roleFootRow}>
            <Text style={[styles.roleFootLabel, { color: theme.textMuted }]}>Best for caterers, chefs, and hospitality brands</Text>
            {props.value === 'caterer' ? <Ionicons name="checkmark-circle" size={20} color={palette.gold500} /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function PortfolioGallerySection(props: { title: string; subtitle: string; items: { id: string; imageUrl: string; caption: string; description: string; isPrimary: boolean }[] }) {
  const theme = useThemeTokens();
  return (
    <>
      <SectionHeader title={props.title} subtitle={props.subtitle} />
      {props.items.map(item => (
        <MotionCard key={item.id}>
          <Image source={{ uri: item.imageUrl }} style={styles.galleryImage} />
          <View style={styles.portfolioMetaRow}>
            {item.caption ? <Text style={[styles.cardTitle, { color: theme.text }]}>{item.caption}</Text> : null}
            {item.isPrimary ? <StatusPill label="Main image" /> : null}
          </View>
          {item.description ? <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text> : null}
        </MotionCard>
      ))}
    </>
  );
}

function VendorPortfolioSection(props: {
  uploads: UploadDraft[];
  portfolio: PortfolioItem[];
  onPick: () => void;
  onUpload: () => void;
  onSetDraftPrimary: (draftId: string) => void;
  onUpdateDraft: (draftId: string, patch: Partial<UploadDraft>) => void;
  onRemoveDraft: (draftId: string) => void;
  onMakePrimary: (imageId: string) => void;
}) {
  const theme = useThemeTokens();
  return (
    <>
      <SectionHeader title="Portfolio" subtitle="Upload polished gallery images, set a primary cover, and add concise descriptions." />
      <ButtonRow>
        <SecondaryButton label="Choose image" onPress={props.onPick} />
        {props.uploads.length ? <PrimaryButton label={`Upload ${props.uploads.length} image${props.uploads.length > 1 ? 's' : ''}`} onPress={props.onUpload} /> : null}
      </ButtonRow>
      {props.uploads.map(item => (
        <MotionCard key={item.id}>
          <Image source={{ uri: item.uri }} style={styles.galleryImage} />
          <View style={styles.portfolioMetaRow}>
            {item.isPrimary ? <StatusPill label="Main image" /> : <GhostButton label="Set as main" onPress={() => props.onSetDraftPrimary(item.id)} />}
            <GhostButton label="Remove" onPress={() => props.onRemoveDraft(item.id)} />
          </View>
          <Field label="Title" value={item.caption} onChangeText={value => props.onUpdateDraft(item.id, { caption: value })} hint="Optional short label for the image." />
          <Field
            label="Description"
            value={item.description}
            onChangeText={value => props.onUpdateDraft(item.id, { description: value })}
            hint="Optional description shown in the public gallery."
            multiline
          />
        </MotionCard>
      ))}
      {props.portfolio.map(item => (
        <MotionCard key={item.id}>
          <Image source={{ uri: item.imageUrl }} style={styles.galleryImage} />
          <View style={styles.portfolioMetaRow}>
            {item.caption ? <Text style={[styles.cardTitle, { color: theme.text }]}>{item.caption}</Text> : null}
            {item.isPrimary ? <StatusPill label="Main image" /> : <GhostButton label="Set as main" onPress={() => props.onMakePrimary(item.id)} />}
          </View>
          {item.description ? <Text style={[styles.bodyText, { color: theme.textMuted }]}>{item.description}</Text> : null}
        </MotionCard>
      ))}
    </>
  );
}

function TierEditorSection(props: {
  tiers: MenuTier[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<MenuTier>) => void;
  onRemove: (index: number) => void;
}) {
  const theme = useThemeTokens();
  return (
    <>
      <SectionHeader title="Package tiers" subtitle="Build a clear service ladder. Each higher tier inherits the services below it, then adds its own upgrades." />
      <ButtonRow>
        <SecondaryButton label="Add tier" onPress={props.onAdd} />
      </ButtonRow>
      {props.tiers.map((tier, index) => {
        const cumulativeItems = getTierPreviewItems(props.tiers, index);
        const isBaseTier = index === 0;
        return (
          <MotionCard key={`${tier.name}-${index}`}>
            <View style={styles.portfolioMetaRow}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{tier.name}</Text>
              <GhostButton label="Remove" onPress={() => props.onRemove(index)} />
            </View>
            <Field
              label="Tier name"
              value={tier.name}
              onChangeText={value => props.onUpdate(index, { name: value })}
              hint="Standard, Premium, and Deluxe are strong defaults, but you can rename them."
            />
            <Field
              label="Price per head"
              value={String(tier.pricePerHead)}
              onChangeText={value => props.onUpdate(index, { pricePerHead: Number(value.replace(/[^0-9.]/g, '')) || 0 })}
              hint="Set the charge per guest for this package."
              keyboardType="numeric"
            />
            <Field
              label={isBaseTier ? 'Core services' : 'Additional upgrades'}
              value={tier.items.join('\n')}
              onChangeText={value => props.onUpdate(index, { items: value.split('\n').map(item => item.trim()).filter(Boolean) })}
              hint={isBaseTier ? 'One service per line. These form the foundation for every higher tier.' : 'One upgrade per line. These services are added on top of the tiers below.'}
              multiline
            />
            <View style={styles.settingsList}>
              <Text style={[styles.settingLabel, { color: theme.textMuted }]}>Customer sees</Text>
              <View style={styles.tagRow}>
                {cumulativeItems.map(item => (
                  <StatusPill key={`${tier.name}-${item}`} label={item} muted />
                ))}
              </View>
            </View>
          </MotionCard>
        );
      })}
    </>
  );
}

function TabBar(props: {
  items: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  active: string;
  onChange: (value: string) => void;
}) {
  const theme = useThemeTokens();
  return (
    <BlurView intensity={36} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.tabBarShell, { borderColor: theme.shellBorder }]}>
      <View style={[styles.tabBar, { backgroundColor: theme.shell }]}>
        {props.items.map(item => {
          const active = props.active === item.key;
          return (
            <Pressable key={item.key} style={styles.tabBarItem} onPress={() => props.onChange(item.key)}>
              <View
                style={[
                  styles.tabBarItemInner,
                  active ? styles.tabBarItemActive : undefined,
                  { backgroundColor: active ? (theme.mode === 'dark' ? '#2D372E' : '#F4E6D8') : 'rgba(0,0,0,0)' },
                ]}
              >
                <Ionicons name={item.icon} size={18} color={active ? palette.gold500 : theme.textMuted} />
                <Text style={[styles.tabBarText, { color: active ? palette.gold500 : theme.textMuted }, active ? styles.tabBarTextActive : undefined]}>{item.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

function ThemeToggleBar(props: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  const theme = useThemeTokens();
  return (
    <View style={[styles.themeToggleBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {(['light', 'dark'] as ThemeMode[]).map(item => {
        const active = props.value === item;
        return (
          <Pressable key={item} style={styles.themeToggleOption} onPress={() => props.onChange(item)}>
            <View style={[styles.themeToggleInner, { backgroundColor: active ? palette.gold500 : 'rgba(0,0,0,0)' }]}>
              <Ionicons name={item === 'light' ? 'sunny-outline' : 'moon-outline'} size={16} color={active ? lightTheme.inverseText : theme.textMuted} />
              <Text style={[styles.themeToggleText, { color: active ? lightTheme.inverseText : theme.textMuted }]}>{item === 'light' ? 'Light' : 'Dark'}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ButtonRow(props: { children: React.ReactNode }) {
  return <View style={styles.buttonRow}>{props.children}</View>;
}

function PrimaryButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={props.onPress}>
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable style={[styles.secondaryButton, { backgroundColor: theme.mode === 'dark' ? '#2A332A' : '#EFE1D0', borderColor: theme.border }]} onPress={props.onPress}>
      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

function GhostButton(props: { label: string; onPress: () => void }) {
  const theme = useThemeTokens();
  return (
    <Pressable style={[styles.ghostButton, { borderColor: theme.border, backgroundColor: theme.ghost }]} onPress={props.onPress}>
      <Text style={[styles.ghostButtonText, { color: theme.text }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.cloud100,
  },
  appChrome: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitleWrap: {
    alignItems: 'center',
    gap: 2,
  },
  headerKicker: {
    color: palette.slate500,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 42,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7E2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  heroCardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
  },
  bootContainer: {
    flex: 1,
    backgroundColor: palette.ink950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#314035',
    opacity: 0.72,
  },
  bootMark: {
    alignItems: 'center',
    gap: spacing.md,
  },
  brandLockup: {
    alignItems: 'center',
    gap: spacing.md,
  },
  brandLockupCompact: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brandSeal: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandSealCompact: {
    width: 96,
    height: 96,
  },
  brandSealDark: {
    boxShadow: '0px 12px 24px rgba(232, 170, 122, 0.08)',
  },
  brandSealHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  brandSealHaloDark: {
    backgroundColor: 'rgba(232, 170, 122, 0.11)',
  },
  brandStarBadge: {
    position: 'absolute',
    top: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandStarBadgeDark: {
    backgroundColor: '#2E382C',
  },
  brandMedallion: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: palette.green400,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMedallionDark: {
    borderColor: palette.gold300,
    backgroundColor: '#20281F',
  },
  brandLeafCluster: {
    position: 'absolute',
    top: 44,
    gap: 4,
    zIndex: 2,
  },
  brandLeafClusterLeft: {
    left: 4,
    transform: [{ rotate: '-18deg' }],
  },
  brandLeafClusterRight: {
    right: 4,
    transform: [{ rotate: '18deg' }],
  },
  brandWordmarkWrap: {
    alignItems: 'center',
    gap: 2,
  },
  brandWordmark: {
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandWordmarkCompact: {
    fontSize: 18,
    letterSpacing: 3,
  },
  brandWordmarkDark: {
    color: palette.white,
  },
  brandSubmark: {
    color: palette.slate700,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  brandSubmarkDark: {
    color: '#EADFD2',
  },
  bootLogo: {
    color: palette.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
  },
  bootCaption: {
    color: '#DCE2EF',
    fontSize: 15,
  },
  welcomeHero: {
    height: 500,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  welcomeHeroImage: {
    borderRadius: radius.lg,
  },
  welcomeOverlay: {
    backgroundColor: 'rgba(24, 32, 25, 0.56)',
    padding: spacing.xxl,
    gap: spacing.md,
    borderRadius: radius.lg,
  },
  settingsHeroCard: {
    gap: spacing.lg,
  },
  settingsHeroMeta: {
    gap: spacing.md,
  },
  welcomeEyebrow: {
    color: palette.gold400,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  welcomeTitle: {
    color: palette.white,
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  welcomeBody: {
    color: '#F3EAE0',
    fontSize: 15,
    lineHeight: 24,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 109, 67, 0.08)',
    boxShadow: '0px 12px 26px rgba(71, 49, 38, 0.10)',
    elevation: 6,
  },
  darkCard: {
    backgroundColor: palette.ink950,
  },
  eyebrow: {
    color: palette.gold500,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  darkEyebrow: {
    color: palette.gold300,
  },
  heroTitle: {
    color: palette.ink950,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 37,
    letterSpacing: -0.5,
  },
  darkHeroTitle: {
    color: palette.white,
  },
  bodyText: {
    color: palette.slate700,
    lineHeight: 22,
    fontSize: 15,
  },
  darkBodyText: {
    color: '#E8DED2',
  },
  sectionHeader: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: palette.ink950,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
    letterSpacing: -0.35,
  },
  sectionBody: {
    color: palette.slate700,
    lineHeight: 22,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
  galleryImage: {
    width: '100%',
    height: 240,
    borderRadius: radius.md,
  },
  detailImage: {
    width: '100%',
    height: 280,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  cardTitle: {
    color: palette.ink950,
    fontSize: 20,
    fontWeight: '800',
  },
  cardKicker: {
    color: palette.gold500,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaText: {
    color: palette.slate700,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAE6D7',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ratingValue: {
    color: palette.ink950,
    fontWeight: '800',
  },
  ratingMeta: {
    color: palette.slate700,
    fontWeight: '600',
  },
  progressWrap: {
    gap: spacing.sm,
  },
  progressRail: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#EBD8C6',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: {
    height: '100%',
    backgroundColor: palette.green400,
    borderRadius: radius.pill,
  },
  progressDot: {
    position: 'absolute',
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A76A4B',
    borderWidth: 2,
    borderColor: '#FFF8F2',
  },
  progressDotPaid: {
    backgroundColor: palette.gold500,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: palette.slate700,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#F3E1CC',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeMuted: {
    backgroundColor: '#F7EFE4',
  },
  badgeText: {
    color: palette.ink950,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  badgeTextMuted: {
    color: palette.slate700,
  },
  inlineError: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#F9E2DA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  inlineErrorText: {
    color: '#8A402B',
    flex: 1,
    fontWeight: '600',
  },
  busyStripe: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#FBECDD',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  busyText: {
    color: palette.ink950,
    fontWeight: '700',
  },
  fieldWrap: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: palette.ink950,
    fontWeight: '700',
  },
  fieldInput: {
    backgroundColor: '#FFF9F3',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 109, 67, 0.14)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: palette.ink950,
    minHeight: 56,
  },
  fieldInputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  fieldHint: {
    color: palette.slate500,
    fontSize: 12,
  },
  roleStage: {
    gap: spacing.md,
  },
  roleCardEditorial: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    gap: spacing.sm,
    boxShadow: '0px 8px 18px rgba(77, 54, 41, 0.05)',
    elevation: 4,
  },
  roleCardEditorialActive: {
    borderColor: palette.gold500,
    backgroundColor: '#FEF0E7',
  },
  roleTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7E2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEditorialTitle: {
    color: palette.ink950,
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
  },
  roleEditorialBody: {
    color: palette.slate700,
    lineHeight: 22,
    fontSize: 14,
  },
  roleFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  roleFootLabel: {
    color: palette.slate500,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  searchField: {
    backgroundColor: '#FFF9F4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 109, 67, 0.12)',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.lg,
    color: palette.ink950,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsList: {
    gap: spacing.sm,
  },
  settingStat: {
    backgroundColor: '#F6EBDD',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  settingStatSubtle: {
    backgroundColor: '#F6EFE7',
  },
  settingLabel: {
    color: palette.slate500,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  settingValue: {
    color: palette.ink950,
    fontSize: 15,
    fontWeight: '700',
  },
  portfolioMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F3D0AE',
    fontWeight: '900',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    width: '47%',
  },
  statValue: {
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '900',
  },
  tabBarShell: {
    marginTop: -4,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(230, 212, 193, 0.88)',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 248, 242, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tabBarItem: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  tabBarItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  tabBarItemActive: {
    backgroundColor: '#F4E6D8',
  },
  tabBarText: {
    color: palette.slate500,
    fontWeight: '700',
    fontSize: 12,
  },
  tabBarTextActive: {
    color: palette.gold500,
    fontWeight: '800',
  },
  themeToggleBar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  themeToggleOption: {
    flex: 1,
  },
  themeToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  themeToggleText: {
    fontWeight: '800',
    fontSize: 14,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: palette.ink950,
  },
  chatBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
  },
  chatText: {
    color: palette.ink950,
    lineHeight: 20,
  },
  chatTextMine: {
    color: palette.white,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#F6ECE1',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.ink950,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: palette.gold500,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    boxShadow: '0px 8px 16px rgba(138, 74, 46, 0.18)',
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFF8F2',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#EFE1D0',
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 93, 0.12)',
  },
  secondaryButtonText: {
    color: palette.ink950,
    fontWeight: '800',
    fontSize: 15,
  },
  ghostButton: {
    borderColor: '#D8B89D',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(255, 252, 248, 0.55)',
  },
  ghostButtonText: {
    color: palette.ink950,
    fontWeight: '700',
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
