import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/munch/field';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/munch/buttons';
import { MunchBrandLockup, Screen, SectionHeader } from '@/components/munch/shell';
import { palette, radius, spacing } from '@/lib/munch-data';
import { RoleSelector } from '@/features/auth/role-selector';
import { AuthScreen, LoginDraft, PasswordResetDraft, SignupDraft } from '@/features/auth/types';

export function AuthFlow(props: {
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

const styles = StyleSheet.create({
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
});
