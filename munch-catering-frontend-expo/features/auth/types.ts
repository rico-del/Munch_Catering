export type AuthScreen = 'welcome' | 'login' | 'signup' | 'forgot-password' | 'reset-password';

export type SignupDraft = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: 'customer' | 'caterer';
};

export type LoginDraft = {
  email: string;
  password: string;
};

export type PasswordResetDraft = {
  email: string;
  token: string;
  newPassword: string;
};
