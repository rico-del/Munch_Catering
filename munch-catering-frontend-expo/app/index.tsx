import React from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { ButtonRow, GhostButton, PrimaryButton, SecondaryButton } from '@/components/munch/buttons';
import { Field } from '@/components/munch/field';
import { Avatar, BusyStripe, InlineError, StatusPill } from '@/components/munch/feedback';
import { Header, HeroCard, MotionCard, MunchBrandLockup, Screen, SectionHeader, SettingStat } from '@/components/munch/shell';
import { TabBar } from '@/components/munch/tab-bar';
import { ThemeToggleBar } from '@/components/munch/theme-toggle-bar';
import { AuthFlow } from '@/features/auth/auth-flow';
import { AuthScreen, LoginDraft, PasswordResetDraft, SignupDraft } from '@/features/auth/types';
import { api } from '@/lib/api';
import {
  getBookingStatusTone,
  getTierPreviewItems,
  resolvePrimaryPortfolioItem,
  toIndependentTiers,
  toSentenceCase,
  uniqueItems,
} from '@/lib/munch-helpers';
import { clearSession, loadSession, loadThemePreference, saveSession, saveThemePreference } from '@/lib/session';
import { fonts, typeScale } from '@/lib/typography';
import { ThemeContext, darkTheme, lightTheme, useThemeTokens } from '@/lib/theme-context';
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
  VendorStats,
  ThemeMode,
  formatCurrency,
  formatShortDate,
  palette,
  radius,
  spacing,
} from '@/lib/munch-data';

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

// New caterers start with a blank board: three empty tier templates they fill
// in themselves. Each tier is fully independent — no inheritance from lower
// tiers. Existing caterers' saved Standard/Premium/Deluxe data is preserved.
const tierBlueprints: MenuTier[] = [
  { name: 'Standard', pricePerHead: 2200, items: [] },
  { name: 'Premium', pricePerHead: 3600, items: [] },
  { name: 'Deluxe', pricePerHead: 5200, items: [] },
];
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

const serviceAuthMessage = 'Sign in or create an account to request quotes, book caterers, message vendors, and manage your event details.';
const cateringHeroImage = require('@/assets/generated/catering-hero.png');
const cateringDetailImage = require('@/assets/generated/catering-detail.png');

const emptySignupDraft: SignupDraft = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  role: 'customer',
};

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

function confirmDestructiveAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function Index() {
  const [booting, setBooting] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>('light');
  const [session, setSession] = React.useState<Session | null>(null);
  const [route, setRoute] = React.useState<AppRoute>({ name: 'customer' });
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
  const [activeDetailImageIndex, setActiveDetailImageIndex] = React.useState(0);
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
            setCustomerTab('home');
            setRoute({ name: 'customer' });
            try {
              const catererPayload = await api.getCaterers();
              if (mounted) {
                setCaterers(catererPayload.items);
              }
            } catch {
              // Silently stay on customer dashboard
            }
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
          setCustomerTab('home');
          setRoute({ name: 'customer' });
          try {
            const catererPayload = await api.getCaterers();
            if (mounted) {
              setCaterers(catererPayload.items);
            }
          } catch {
            // Keep customer on home dashboard
          }
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

  const loadPublicData = React.useCallback(async () => {
    const catererPayload = await api.getCaterers();
    setCaterers(catererPayload.items);
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
        tiers: profile.tiers.length ? toIndependentTiers(profile.tiers) : starterTiers,
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
      if (showSpinner) setRefreshing(true);
      setError(null);
      try {
        if (!session) {
          await loadPublicData();
        } else if (session.user.role === 'caterer') {
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
    [handleApiError, loadCustomerData, loadPublicData, loadVendorData, session],
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
    setCustomerTab('home');
    setRoute({ name: 'customer' });
    try {
      await loadPublicData();
    } catch {
      setError('Could not refresh public caterers. Pull to refresh and try again.');
    }
  }, [loadPublicData]);

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

  const promptForLogin = React.useCallback((message = serviceAuthMessage) => {
    setError(message);
    setRoute({ name: 'auth', screen: 'login' });
  }, []);

  const requireCustomerSession = React.useCallback(
    (next: () => void, message?: string) => {
      if (!session) {
        promptForLogin(message);
        return;
      }
      next();
    },
    [promptForLogin, session],
  );

  const handleCustomerTabChange = React.useCallback(
    (value: string) => {
      const nextTab = value as CustomerTab;
      if (!session && (nextTab === 'messages' || nextTab === 'bookings' || nextTab === 'profile')) {
        promptForLogin('Sign in to view your messages, bookings, and account workspace.');
        return;
      }
      setCustomerTab(nextTab);
    },
    [promptForLogin, session],
  );

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
      setActiveDetailImageIndex(0);
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
        tiers: toIndependentTiers(catererDraft.tiers),
      });
      setMyCatererProfile(profile);
      setCatererDraft({
        businessName: profile.businessName,
        description: profile.description,
        phone: profile.phone || '',
        location: profile.location || '',
        heroTagline: profile.heroTagline,
        cuisines: profile.cuisines,
        tiers: profile.tiers.length ? toIndependentTiers(profile.tiers) : starterTiers,
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
    confirmDestructiveAction(
      'Disable account?',
      'Your account will be signed out and blocked from use. Caterer profiles are removed from discovery while disabled.',
      () => {
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
    );
  }, [handleApiError, session, signOut]);

  const deleteAccount = React.useCallback(() => {
    if (!session) return;
    confirmDestructiveAction(
      'Permanently delete account?',
      'This removes your account and related account data. This action cannot be undone.',
      () => {
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
    );
  }, [handleApiError, session, signOut]);

  const addCatererTier = React.useCallback(() => {
    setCatererDraft(current => {
      const usedNames = new Set(current.tiers.map(item => item.name));
      const nextTemplate =
        tierBlueprints.find(item => !usedNames.has(item.name)) || {
          name: `Tier ${current.tiers.length + 1}`,
          pricePerHead: (current.tiers.at(-1)?.pricePerHead || 2200) + 800,
          items: [],
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

  const deletePortfolioImage = React.useCallback(
    (imageId: string) => {
      if (!session) return;
      confirmDestructiveAction(
        'Delete portfolio image?',
        'This removes the image from your public caterer portfolio.',
        () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await api.deletePortfolioImage(session.token, imageId);
              setMyCatererProfile(current =>
                current
                  ? {
                    ...current,
                    portfolio: current.portfolio.filter(item => item.id !== imageId),
                  }
                  : current,
              );
              await refreshAll();
              Alert.alert('Image deleted', 'The image has been removed from your portfolio.');
            } catch (err) {
              await handleApiError(err);
            } finally {
              setBusy(false);
            }
          })();
        },
      );
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
  const orderedPortfolio = resolvedCaterer
    ? [...resolvedCaterer.portfolio].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
    : [];
  const featuredPortfolioImage =
    orderedPortfolio[activeDetailImageIndex] || (resolvedCaterer ? resolvePrimaryPortfolioItem(resolvedCaterer.portfolio) : null);
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
                      ? 'Banquet Order'
                      : route.name === 'gallery'
                        ? 'Tasting Gallery'
                        : route.name === 'quote-request'
                          ? 'Bespoke Proposal'
                          : route.name === 'checkout'
                            ? 'Date Reservation'
                            : session?.user.role === 'caterer'
                              ? 'Culinary Dispatch'
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
            onAuthAction={
              route.name === 'auth'
                ? () => {
                    setCustomerTab('home');
                    setRoute({ name: 'customer' });
                  }
                : !session
                  ? () => navigateAuth('login')
                  : undefined
            }
            authActionLabel={
              route.name === 'auth'
                ? 'Explore'
                : !session
                  ? 'Sign in'
                  : undefined
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
                <View style={styles.detailImageSection}>
                  <Pressable onPress={() => setRoute({ name: 'gallery', catererId: resolvedCaterer.id })}>
                    <Image source={{ uri: featuredPortfolioImage.imageUrl }} style={styles.detailImage} />
                  </Pressable>
                  {orderedPortfolio.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
                      {orderedPortfolio.map((item, index) => (
                        <Pressable
                          key={item.id}
                          onPress={() => setActiveDetailImageIndex(index)}
                          style={[
                            styles.thumbnailWrap,
                            index === activeDetailImageIndex ? styles.thumbnailWrapActive : undefined,
                          ]}
                        >
                          <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
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
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>From {formatCurrency(tier.pricePerHead)} / cover</Text>
                  <Text style={[styles.bodyText, { color: theme.textMuted }]}>{tier.items.join(' . ')}</Text>
                  <PrimaryButton
                    label="Book this tier"
                    onPress={() =>
                      requireCustomerSession(
                        () => setRoute({ name: 'checkout', catererId: resolvedCaterer.id, tierName: tier.name }),
                        'Sign in to create a booking and start the deposit flow for this caterer.',
                      )
                    }
                  />
                </MotionCard>
              ))}
              <ButtonRow>
                <SecondaryButton
                  label="Request quote"
                  onPress={() =>
                    requireCustomerSession(
                      () => setRoute({ name: 'quote-request', catererId: resolvedCaterer.id }),
                      'Sign in to send a quote request and keep the inquiry tied to your account.',
                    )
                  }
                />
                <GhostButton label="Tasting gallery" onPress={() => setRoute({ name: 'gallery', catererId: resolvedCaterer.id })} />
              </ButtonRow>
            </Screen>
          ) : route.name === 'gallery' && resolvedCaterer ? (
            <Screen>
              <PortfolioGallerySection
                title={`${resolvedCaterer.businessName} tasting gallery`}
                subtitle="Signature plate presentations, course flights, and banquet spreads."
                items={orderedPortfolio}
              />
            </Screen>
          ) : route.name === 'quote-request' && resolvedCaterer ? (
            <Screen>
              <SectionHeader title="Request a bespoke proposal" subtitle="Submit your event specs, guest headcount (covers), and culinary preferences directly to the kitchen." />
              <Field label="Catering event brief & menu specs" value={quoteDraft.description} onChangeText={value => setQuoteDraft(current => ({ ...current, description: value }))} multiline />
              <Field label="Guest covers (headcount)" value={quoteDraft.guestCount} onChangeText={value => setQuoteDraft(current => ({ ...current, guestCount: value }))} />
              <Field label="Target catering allocation" value={quoteDraft.budgetEstimate} onChangeText={value => setQuoteDraft(current => ({ ...current, budgetEstimate: value }))} />
              <PrimaryButton label="Send quote request" onPress={submitQuote} />
            </Screen>
          ) : route.name === 'checkout' && resolvedCaterer ? (
            <Screen>
              <SectionHeader title="Secure your event date" subtitle="Lock in your banquet reservation date and initiate the secure culinary deposit." />
              <MotionCard>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{resolvedCaterer.businessName}</Text>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {activeApprovedQuote?.approvedPackageLabel || route.tierName || resolvedCaterer.tiers[0]?.name || 'Selected tier'}
                </Text>
                {activeApprovedQuote ? (
                  <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                    Approved bespoke proposal for {activeApprovedQuote.guestCount} covers . Total{' '}
                    {formatCurrency(activeApprovedQuote.approvedTotal || activeApprovedQuote.budgetEstimate)}
                  </Text>
                ) : null}
              </MotionCard>
              <Field label="M-Pesa contact phone" value={checkoutDraft.customerPhone} onChangeText={value => setCheckoutDraft(current => ({ ...current, customerPhone: value }))} hint="Used for the M-Pesa deposit prompt." />
              {activeApprovedQuote ? (
                <MotionCard>
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>Approved culinary scope</Text>
                  <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                    This booking will use the approved custom proposal terms instead of falling back to a standard tier package.
                  </Text>
                </MotionCard>
              ) : (
                <Field label="Guest covers (headcount)" value={checkoutDraft.guestCount} onChangeText={value => setCheckoutDraft(current => ({ ...current, guestCount: value }))} />
              )}
              <PrimaryButton label="Create booking and request deposit" onPress={createBooking} />
            </Screen>
          ) : route.name === 'booking-detail' && activeBooking ? (
            <Screen>
              <SectionHeader title={activeBooking.catererName} subtitle={`Event date ${formatShortDate(activeBooking.eventDate)}`} />
              <MotionCard>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>Reservation status</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{toSentenceCase(activeBooking.status)}</Text>
                <StatusPill label={toSentenceCase(activeBooking.paymentStatus)} muted={activeBooking.paymentStatus !== 'paid'} />
                <BookingProgress booking={activeBooking} />
              </MotionCard>
              <MotionCard>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>Banquet summary</Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  {activeBooking.guestCount} covers on {activeBooking.selectedTier}
                </Text>
                <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                  Retainer {formatCurrency(activeBooking.deposit)} . Balance {formatCurrency(activeBooking.balance)}
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
                        requireCustomerSession(() => {
                          setCustomerTab('bookings');
                          setRoute({ name: 'customer' });
                        }, 'Sign in to view your bookings and approved quote requests.');
                      }}
                    />
                    <SecondaryButton
                      label="Messages"
                      onPress={() => {
                        requireCustomerSession(() => {
                          setCustomerTab('messages');
                          setRoute({ name: 'customer' });
                        }, 'Sign in to view messages connected to your event inquiries.');
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
                    <SectionHeader eyebrow="Executive dispatch" title="A commanding view of your catering operations & event pipeline." />
                    <View style={styles.metricsGrid}>
                      <MotionCard style={styles.metricCard}>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.totalBookings}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Total banquet contracts</Text>
                      </MotionCard>
                      <MotionCard style={styles.metricCard}>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{formatCurrency(vendorStats.totalRevenue)}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Gross secured revenue</Text>
                      </MotionCard>
                      <MotionCard style={styles.metricCard}>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.approvedQuotes}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Approved proposals</Text>
                      </MotionCard>
                      <MotionCard style={styles.metricCard}>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.pendingQuotes}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Active event briefs</Text>
                      </MotionCard>
                    </View>
                    <MotionCard style={styles.statsCard}>
                      <View>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.confirmedBookings}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Confirmed banquets</Text>
                      </View>
                      <View>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.paidBookings}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Settled contracts</Text>
                      </View>
                    </MotionCard>
                    <MotionCard style={styles.statsCard}>
                      <View>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{formatCurrency(vendorStats.averageBookingValue)}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Avg. event yield</Text>
                      </View>
                      <View>
                        <Text style={[styles.statValue, typeScale.heroTitle, { color: theme.text }]}>{vendorStats.inquiryConversionRate}%</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>Proposal win rate</Text>
                      </View>
                    </MotionCard>
                    {bookings.slice(0, 3).map(item => (
                      <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                    ))}
                  </>
                ) : null}
                {vendorTab === 'inquiries' ? (
                  <>
                    <SectionHeader title="Active event briefs" subtitle="Client inquiries and event specifications awaiting chef decision." />
                    {pendingQuotes.map(item => (
                      <MotionCard key={item.id}>
                        <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{item.guestCount} covers . Budget {formatCurrency(item.budgetEstimate)}</Text>
                        <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text>
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
                          <GhostButton label="Decline" onPress={() => void rejectQuote(item.id)} />
                          <PrimaryButton label="Approve proposal" onPress={() => void approveQuote(item.id)} />
                        </ButtonRow>
                      </MotionCard>
                    ))}
                    {!pendingQuotes.length ? (
                      <MotionCard>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>No pending event briefs</Text>
                        <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                          New customer event briefs will appear here until you approve or decline them.
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
                    <SectionHeader title="Banquets & service pipeline" subtitle="Approved proposals awaiting checkout are separated from bookings awaiting deposit, confirmed banquets, and history." />
                    {approvedQuotes.map(item => (
                      <MotionCard key={item.id}>
                        <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{item.guestCount} covers . Allocation {formatCurrency(item.budgetEstimate)}</Text>
                        <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text>
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
                    onDelete={deletePortfolioImage}
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
                    <CulinaryHero
                      onExplore={() => setCustomerTab('discover')}
                      onRequest={() =>
                        requireCustomerSession(
                          () => {
                            setCustomerTab('discover');
                          },
                          'Sign in to request a tailored quote from a caterer you like.',
                        )
                      }
                    />
                    <FeatureImageCard />
                    <SectionHeader eyebrow="Signature houses" title="Curated caterers" subtitle="Premier culinary studios with verified guest reviews, exquisite plating, and scalable banquet service." />
                    {caterers.slice(0, 4).map(item => (
                      <CatererCard key={item.id} caterer={item} onPress={() => void openCaterer(item.id)} />
                    ))}
                  </>
                ) : null}
                {customerTab === 'discover' ? (
                  <>
                    <SectionHeader title="Explore culinary studios" subtitle="Filter by banquet style, signature cuisine, or event scale." />
                    <SearchField value={search} onChangeText={setSearch} placeholder="Search culinary houses, cuisines, or venues" />
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
                    <SectionHeader title="Banquets & reservations" subtitle="Briefs, approved proposals, active date reservations, and completed banquets." />
                    {actionableBookings.map(item => (
                      <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                    ))}
                    {confirmedBookings.map(item => (
                      <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                    ))}
                    <SectionHeader eyebrow="Ready to book" title="Approved proposals" subtitle="When a caterer approves your brief, you can move straight into checkout from here." />
                    {approvedQuotes.length ? (
                      approvedQuotes.map(item => (
                        <MotionCard key={item.id}>
                          <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                          <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{item.guestCount} covers . {formatCurrency(item.budgetEstimate)}</Text>
                          <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>
                            {item.approvedPackageLabel || 'Custom proposal'} . Total {formatCurrency(item.approvedTotal || item.budgetEstimate)}
                          </Text>
                          <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text>
                          <ButtonRow>
                            <StatusPill label="Awaiting payment" />
                            <PrimaryButton
                              label="Continue to checkout"
                              onPress={() =>
                                requireCustomerSession(
                                  () => void continueApprovedQuote(item),
                                  'Sign in to continue checkout for an approved quote.',
                                )
                              }
                            />
                          </ButtonRow>
                        </MotionCard>
                      ))
                    ) : (
                      <MotionCard>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>No approved proposals yet</Text>
                        <Text style={[styles.bodyText, { color: theme.textMuted }]}>
                          Once a chef approves your event brief, your customized proposal will appear here ready for reservation.
                        </Text>
                      </MotionCard>
                    )}
                    <SectionHeader eyebrow="Inquiries" title="Pending review" subtitle="Event briefs currently undergoing chef review and menu costing." />
                    {pendingQuotes.map(item => (
                      <MotionCard key={item.id}>
                        <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{item.guestCount} covers . Allocation {formatCurrency(item.budgetEstimate)}</Text>
                        <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text>
                        <StatusPill label={toSentenceCase(item.lifecycleStage)} muted />
                      </MotionCard>
                    ))}
                    {rejectedQuotes.length ? (
                      <>
                        <SectionHeader eyebrow="Inquiries" title="Declined" subtitle="Inquiries declined by a caterer stay here for reference instead of remaining in active lists." />
                        {rejectedQuotes.map(item => (
                          <MotionCard key={item.id}>
                            <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.catererName}</Text>
                            <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{item.guestCount} covers . Allocation {formatCurrency(item.budgetEstimate)}</Text>
                            <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text>
                            <StatusPill label="Declined" muted />
                          </MotionCard>
                        ))}
                      </>
                    ) : null}
                    {completedBookings.length ? (
                      <>
                        <SectionHeader eyebrow="Archive" title="Completed banquets" />
                        {completedBookings.map(item => (
                          <BookingCard key={item.id} booking={item} onPress={() => void openBooking(item.id)} />
                        ))}
                      </>
                    ) : null}
                    {cancelledBookings.length ? (
                      <>
                        <SectionHeader eyebrow="Archive" title="Cancelled reservations" />
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
                          <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{currentUser?.fullName || 'User'}</Text>
                          <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{currentUser?.email || ''}</Text>
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
                onChange={handleCustomerTabChange}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function CulinaryHero(props: { onExplore: () => void; onRequest: () => void }) {
  const theme = useThemeTokens();
  const float = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [float, pulse]);

  const cardLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.45] });

  return (
    <MotionCard style={[styles.culinaryHero, { backgroundColor: theme.mode === 'dark' ? '#071112' : '#EAF2EF' }]}>
      <Image source={cateringHeroImage} style={styles.culinaryHeroImage} />
      <LinearGradient colors={['rgba(7,17,18,0.25)', 'rgba(7,17,18,0.76)', 'rgba(7,17,18,0.94)']} style={styles.culinaryHeroOverlay} />
      <Animated.View style={[styles.heroOrb, styles.heroOrbOne, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]} />
      <Animated.View style={[styles.heroGlassPanel, { transform: [{ translateY: cardLift }] }]}>
        <Text style={[styles.heroPill, typeScale.label]}>Haute Cuisine . Bespoke Banquets . Private Dining</Text>
        <Text style={[styles.culinaryHeroTitle, typeScale.heroTitle]}>Catered moments, curated with calm precision.</Text>
        <Text style={[styles.culinaryHeroBody, typeScale.body]}>
          Explore exceptional caterers, browse signature tasting menus, and craft an unforgettable culinary experience for your celebration.
        </Text>
        <ButtonRow>
          <PrimaryButton label="Explore caterers" onPress={props.onExplore} />
          <GhostButton label="Request service" onPress={props.onRequest} />
        </ButtonRow>
      </Animated.View>
    </MotionCard>
  );
}

function FeatureImageCard() {
  const theme = useThemeTokens();
  const lift = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration: 3800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 3800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start();
  }, [lift]);

  return (
    <MotionCard style={styles.featureImageCard}>
      <Animated.Image
        source={cateringDetailImage}
        style={[
          styles.featureImage,
          {
            transform: [
              {
                scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
              },
            ],
          },
        ]}
      />
      <LinearGradient colors={['rgba(7,17,18,0.08)', 'rgba(7,17,18,0.72)']} style={styles.featureImageShade} />
      <View style={styles.featureImageContent}>
        <Text style={[styles.heroPill, typeScale.label]}>{"Chef's Tasting Board & Mise en Place"}</Text>
        <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.inverseText }]}>See the artistry before you commit.</Text>
        <Text style={[styles.featureImageText, typeScale.body]}>Portfolio-first browsing keeps planning your event visual, inspiring, and effortless.</Text>
      </View>
    </MotionCard>
  );
}

function BootScreen() {
  const fade = React.useRef(new Animated.Value(0)).current;
  const glow = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.5, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ]).start();
  }, [fade, glow]);

  return (
    <ThemeContext.Provider value={darkTheme}>
      <SafeAreaView style={styles.bootContainer}>
        <Animated.View
          style={{
            opacity: fade,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }}
        >
          <Animated.View style={[styles.bootGlow, { opacity: glow }]} />
          <MunchBrandLockup theme="dark" />
        </Animated.View>
      </SafeAreaView>
    </ThemeContext.Provider>
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
        <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{props.caterer.businessName}</Text>
        <Text style={[styles.cardKicker, typeScale.caption]}>{props.caterer.heroTagline}</Text>
        <RatingRow rating={props.caterer.rating} reviewCount={props.caterer.reviewCount} priceFrom={props.caterer.priceFrom} />
        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{props.caterer.location || 'Location shared after profile completion'}</Text>
        <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{props.caterer.description}</Text>
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
          <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{props.booking.catererName}</Text>
          <StatusPill label={toSentenceCase(props.booking.lifecycleStage)} muted={getBookingStatusTone(props.booking) === 'muted'} />
        </View>
        <Text style={[styles.metaText, typeScale.meta, { color: theme.textMuted }]}>{formatShortDate(props.booking.eventDate)} . {props.booking.selectedTier}</Text>
        <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>
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
            <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{props.item.contactName}</Text>
            <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{props.item.preview}</Text>
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
  const targetPercent = paid ? 100 : pending ? 72 : 42;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: targetPercent,
      tension: 40,
      friction: 7,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, targetPercent]);

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressRail, { backgroundColor: theme.mode === 'dark' ? '#1C3133' : '#D8E1DE' }]}>
        <Animated.View style={[styles.progressBar, { width: widthInterpolated }]} />
        <View style={[styles.progressDot, { borderColor: theme.surface }, paid ? styles.progressDotPaid : undefined]} />
      </View>
      <View style={styles.progressMetaRow}>
        <Text style={[styles.progressText, typeScale.caption, { color: theme.textMuted }]}>
          Retainer {paid ? 'secured' : pending ? 'processing' : 'not started'}
        </Text>
        <Text style={[styles.progressText, typeScale.caption, { color: theme.textMuted }]}>{toSentenceCase(props.booking.lifecycleStage)}</Text>
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
      <View style={[styles.ratingBadge, { backgroundColor: theme.mode === 'dark' ? '#183034' : '#E5F0EB' }]}>
        <Ionicons name="star" size={14} color={palette.gold500} />
        <Text style={[styles.ratingValue, typeScale.caption, { color: theme.text }]}>{resolvedRating}</Text>
      </View>
      <Text style={[styles.ratingMeta, typeScale.meta, { color: theme.textMuted }]}>{hasReviews ? `${props.reviewCount} verified reviews` : 'New culinary house'}</Text>
      {props.priceFrom > 0 ? <Text style={[styles.ratingMeta, typeScale.meta, { color: theme.textMuted }]}>From {formatCurrency(props.priceFrom)} / cover</Text> : null}
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

function PortfolioGallerySection(props: { title: string; subtitle: string; items: { id: string; imageUrl: string; caption: string; description: string; isPrimary: boolean }[] }) {
  const theme = useThemeTokens();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const carouselRef = React.useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = Math.min(screenWidth - 48, 720);

  React.useEffect(() => {
    if (activeIndex >= props.items.length) {
      setActiveIndex(0);
    }
  }, [props.items.length, activeIndex]);

  if (!props.items.length) {
    return (
      <>
        <SectionHeader title={props.title} subtitle={props.subtitle} />
        <MotionCard>
          <Text style={[styles.cardTitle, { color: theme.text }]}>No portfolio images yet</Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            This caterer has not published portfolio work yet. Check back soon.
          </Text>
        </MotionCard>
      </>
    );
  }

  const activeItem = props.items[activeIndex];

  return (
    <>
      <SectionHeader title={props.title} subtitle={props.subtitle} />
      <MotionCard style={styles.galleryCard}>
        <Animated.ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={event => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
            setActiveIndex(Math.max(0, Math.min(nextIndex, props.items.length - 1)));
          }}
          scrollEventThrottle={16}
        >
          {props.items.map(item => (
            <View key={item.id} style={{ width: cardWidth }}>
              <Image source={{ uri: item.imageUrl }} style={[styles.galleryCarouselImage, { width: cardWidth }]} />
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.galleryDots}>
          {props.items.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setActiveIndex(index);
                carouselRef.current?.scrollTo({ x: index * cardWidth, animated: true });
              }}
              style={[styles.galleryDot, index === activeIndex ? styles.galleryDotActive : undefined]}
            />
          ))}
        </View>

        <View style={styles.portfolioMetaRow}>
          {activeItem.caption ? <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{activeItem.caption}</Text> : null}
          {activeItem.isPrimary ? <StatusPill label="Main image" /> : null}
        </View>
        {activeItem.description ? <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{activeItem.description}</Text> : null}

        {props.items.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
            {props.items.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setActiveIndex(index);
                  carouselRef.current?.scrollTo({ x: index * cardWidth, animated: true });
                }}
                style={[
                  styles.thumbnailWrap,
                  index === activeIndex ? styles.thumbnailWrapActive : undefined,
                ]}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </MotionCard>
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
  onDelete: (imageId: string) => void;
}) {
  const theme = useThemeTokens();
  return (
    <>
      <SectionHeader title="Curated Culinary Portfolio" subtitle="Curate your studio portfolio, highlight signature dishes, and showcase high-end plated courses." />
      <ButtonRow>
        <SecondaryButton label="Select plate imagery" onPress={props.onPick} />
        {props.uploads.length ? <PrimaryButton label={`Upload ${props.uploads.length} plate${props.uploads.length > 1 ? 's' : ''}`} onPress={props.onUpload} /> : null}
      </ButtonRow>
      {props.uploads.map(item => (
        <MotionCard key={item.id}>
          <Image source={{ uri: item.uri }} style={styles.galleryImage} />
          <View style={styles.portfolioMetaRow}>
            {item.isPrimary ? <StatusPill label="Signature showcase" /> : <GhostButton label="Set signature" onPress={() => props.onSetDraftPrimary(item.id)} />}
            <GhostButton label="Remove" onPress={() => props.onRemoveDraft(item.id)} />
          </View>
          <Field label="Plate / course title" value={item.caption} onChangeText={value => props.onUpdateDraft(item.id, { caption: value })} hint="E.g. Seared King Salmon, Artisanal Canapé Station." />
          <Field
            label="Culinary description"
            value={item.description}
            onChangeText={value => props.onUpdateDraft(item.id, { description: value })}
            hint="Describe the plating, flavor profile, or banquet service context."
            multiline
          />
        </MotionCard>
      ))}
      {props.portfolio.map(item => (
        <MotionCard key={item.id}>
          <Image source={{ uri: item.imageUrl }} style={styles.galleryImage} />
          <View style={styles.portfolioMetaRow}>
            {item.caption ? <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{item.caption}</Text> : null}
            {item.isPrimary ? <StatusPill label="Signature showcase" /> : <GhostButton label="Set signature" onPress={() => props.onMakePrimary(item.id)} />}
            <GhostButton label="Delete" onPress={() => props.onDelete(item.id)} />
          </View>
          {item.description ? <Text style={[styles.bodyText, typeScale.body, { color: theme.textMuted }]}>{item.description}</Text> : null}
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
      <SectionHeader title="Bespoke service tiers" subtitle="Each service tier is fully independent — specify all courses, stations, and staffing inclusions for every package." />
      <ButtonRow>
        <SecondaryButton label="Add service tier" onPress={props.onAdd} />
      </ButtonRow>
      {props.tiers.map((tier, index) => {
        const tierItems = getTierPreviewItems(props.tiers, index);
        return (
          <MotionCard key={`${tier.name}-${index}`}>
            <View style={styles.portfolioMetaRow}>
              <Text style={[styles.cardTitle, typeScale.cardTitle, { color: theme.text }]}>{tier.name}</Text>
              <GhostButton label="Remove" onPress={() => props.onRemove(index)} />
            </View>
            <Field
              label="Tier name"
              value={tier.name}
              onChangeText={value => props.onUpdate(index, { name: value })}
              hint="Standard, Premium, and Deluxe are strong defaults, but you can rename them."
            />
            <Field
              label="Price per cover (Pax)"
              value={String(tier.pricePerHead)}
              onChangeText={value => props.onUpdate(index, { pricePerHead: Number(value.replace(/[^0-9.]/g, '')) || 0 })}
              hint="Set the per-cover rate for this bespoke menu package."
              keyboardType="numeric"
            />
            <Field
              label="Menu courses & inclusions"
              value={tier.items.join('\n')}
              onChangeText={value => props.onUpdate(index, { items: value.split('\n').map(item => item.trim()).filter(Boolean) })}
              hint="One course or service spec per line. Enter the complete culinary offering included in this tier."
              multiline
            />
            <View style={styles.settingsList}>
              <Text style={[styles.settingLabel, { color: theme.textMuted }]}>Client sees</Text>
              <View style={styles.tagRow}>
                {tierItems.map(item => (
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.cloud100,
  },
  appChrome: {
    flex: 1,
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
    backgroundColor: '#183034',
    opacity: 0.72,
  },
  bootMark: {
    alignItems: 'center',
    gap: spacing.md,
  },
  bootLogo: {
    fontFamily: fonts.display,
    color: palette.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
  },
  bootCaption: {
    fontFamily: fonts.body,
    color: '#DCE2EF',
    fontSize: 15,
  },
  settingsHeroCard: {
    gap: spacing.lg,
  },
  settingsHeroMeta: {
    gap: spacing.md,
  },
  bodyText: {
    fontFamily: fonts.body,
    color: palette.slate700,
    lineHeight: 22,
    fontSize: 15,
  },
  culinaryHero: {
    minHeight: 520,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
    backgroundColor: palette.ink950,
  },
  culinaryHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  culinaryHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.28,
  },
  heroOrbOne: {
    right: -82,
    top: 38,
    backgroundColor: '#B7CFC3',
  },
  heroGlassPanel: {
    marginTop: 230,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217, 231, 223, 0.28)',
    backgroundColor: 'rgba(7, 17, 18, 0.62)',
    gap: spacing.md,
    boxShadow: '0px 24px 44px rgba(0, 0, 0, 0.22)',
  },
  heroPill: {
    fontFamily: fonts.body,
    alignSelf: 'flex-start',
    color: '#D9E7DF',
    borderColor: 'rgba(217, 231, 223, 0.32)',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  culinaryHeroTitle: {
    fontFamily: fonts.heading,
    color: '#FBFCFA',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  culinaryHeroBody: {
    fontFamily: fonts.body,
    color: '#DCE8E4',
    fontSize: 15,
    lineHeight: 23,
  },
  featureImageCard: {
    minHeight: 300,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
  },
  featureImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featureImageShade: {
    ...StyleSheet.absoluteFillObject,
  },
  featureImageContent: {
    marginTop: 128,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  featureImageText: {
    fontFamily: fonts.body,
    color: '#DCE8E4',
    lineHeight: 22,
    fontSize: 15,
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
  galleryCard: {
    gap: spacing.md,
  },
  galleryCarouselImage: {
    height: 300,
    borderRadius: radius.lg,
  },
  galleryDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  galleryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.slate500,
  },
  galleryDotActive: {
    backgroundColor: palette.gold500,
    width: 22,
  },
  thumbnailStrip: {
    flexGrow: 0,
  },
  thumbnailWrap: {
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailWrapActive: {
    borderColor: palette.gold500,
  },
  thumbnailImage: {
    width: 72,
    height: 56,
    borderRadius: radius.md,
  },
  detailImageSection: {
    gap: spacing.sm,
  },
  detailImage: {
    width: '100%',
    height: 280,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    color: palette.ink950,
    fontSize: 20,
    fontWeight: '800',
  },
  cardKicker: {
    fontFamily: fonts.body,
    color: palette.gold500,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaText: {
    fontFamily: fonts.body,
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
    backgroundColor: '#E5F0EB',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ratingValue: {
    fontFamily: fonts.body,
    color: palette.ink950,
    fontWeight: '800',
  },
  ratingMeta: {
    fontFamily: fonts.body,
    color: palette.slate700,
    fontWeight: '600',
  },
  progressWrap: {
    gap: spacing.sm,
  },
  progressRail: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#D8E1DE',
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
    backgroundColor: '#526568',
    borderWidth: 2,
    borderColor: '#FBFCFA',
  },
  progressDotPaid: {
    backgroundColor: palette.gold500,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontFamily: fonts.body,
    color: palette.slate700,
    fontSize: 12,
    fontWeight: '700',
  },
  searchField: {
    backgroundColor: '#F8FBFA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(111, 143, 132, 0.18)',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchInput: {
    fontFamily: fonts.body,
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
  settingLabel: {
    fontFamily: fonts.body,
    color: palette.slate500,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  portfolioMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
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
    fontFamily: fonts.heading,
    color: palette.ink950,
    fontSize: 22,
    fontWeight: '900',
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
    fontFamily: fonts.body,
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
    fontFamily: fonts.body,
    flex: 1,
    backgroundColor: '#E7F0EC',
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
