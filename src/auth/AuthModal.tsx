import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/auth/AuthContext';
import { PrivacyPolicyContent } from '@/auth/PrivacyPolicyModal';
import { PRIVACY_POLICY_URL } from '@/config';
import { colors, radii, shadows, spacing, touchTargets } from '@/theme/tokens';

type AuthTab = 'signin' | 'signup' | 'forgot';

export interface AuthModalProps {
  language: 'en' | 'tr';
}

function mapFirebaseAuthError(err: unknown, language: 'en' | 'tr'): string {
  const isTr = language === 'tr';
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return isTr ? 'E-posta veya şifre hatalı.' : 'Incorrect email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return isTr
        ? 'Bu e-posta zaten kayıtlı. Lütfen giriş yapın.'
        : 'Email is already in use. Please sign in.';
    }
    if (code === 'auth/weak-password') {
      return isTr
        ? 'Şifre en az 8 karakter olmalı.'
        : 'Password must be at least 8 characters.';
    }
    if (code === 'auth/invalid-email') {
      return isTr
        ? 'Geçerli bir e-posta adresi girin.'
        : 'Please enter a valid email address.';
    }
    if (code === 'auth/network-request-failed') {
      return isTr
        ? 'İnternet bağlantısı kurulamadı. Lütfen tekrar deneyin.'
        : 'Network error. Please check your connection and try again.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return isTr
    ? 'Bir hata oluştu. Lütfen tekrar deneyin.'
    : 'An error occurred. Please try again.';
}

function AuthModalBody({
  language,
  privacyOpen,
  onOpenPrivacy,
  onClosePrivacy,
}: AuthModalProps & {
  privacyOpen: boolean;
  onOpenPrivacy: () => void;
  onClosePrivacy: () => void;
}) {
  const {
    closeAuthModal,
    isFirebaseConfigured,
    authReason,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isTr = language === 'tr';

  if (privacyOpen) {
    return (
      <View style={styles.privacyBackdrop}>
        <PrivacyPolicyContent
          language={language}
          backMode
          onClose={onClosePrivacy}
          onOpenExternal={() => {
            void Linking.openURL(PRIVACY_POLICY_URL);
          }}
        />
      </View>
    );
  }

  const switchTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setError(null);
    setSuccess(null);
  };

  const handleGooglePress = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapFirebaseAuthError(err, language));
    } finally {
      setLoading(false);
    }
  };

  const handleApplePress = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(mapFirebaseAuthError(err, language));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError(
        isTr
          ? 'Lütfen ebeveyn e-posta adresini girin.'
          : "Please enter a parent's email address.",
      );
      return;
    }
    if (tab !== 'forgot' && !password) {
      setError(
        isTr ? 'Lütfen şifrenizi girin.' : 'Please enter your password.',
      );
      return;
    }
    if (tab === 'signup' && password.length < 8) {
      setError(
        isTr
          ? 'Şifre en az 8 karakter olmalı.'
          : 'Password must be at least 8 characters.',
      );
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signin') {
        await signInWithEmail(email, password);
      } else if (tab === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await resetPassword(email);
        setSuccess(
          isTr
            ? 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.'
            : 'Password reset link sent to your email!',
        );
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err, language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card} accessibilityViewIsModal>
          <Pressable
            testID="auth-modal-close"
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Giriş penceresini kapat' : 'Close sign in dialog'}
            hitSlop={10}
            onPress={closeAuthModal}
            style={styles.closeBtn}
          >
            <X size={20} color={colors.textDark} />
          </Pressable>

          <Text style={styles.title}>
            {tab === 'signin'
              ? isTr
                ? 'Ebeveyn Girişi'
                : 'Parent Sign In'
              : tab === 'signup'
                ? isTr
                  ? 'Ebeveyn Hesabı Oluştur'
                  : 'Create Parent Account'
                : isTr
                  ? 'Şifre Sıfırlama'
                  : 'Reset Password'}
          </Text>

          <Text style={styles.subtitle}>
            {authReason ||
              (isTr
                ? 'İlerlemeyi ve oyun puanlarını kaydetmek için bir ebeveyn girişi gereklidir. Kartlar herkese açıktır.'
                : 'A parent account saves streaks, story progress, and leaderboard scores. Flashcards are always free without signing in.')}
          </Text>

          {!isFirebaseConfigured ? (
            <View style={styles.warningBox}>
              <AlertCircle size={16} color={colors.orange} />
              <Text style={styles.warningText}>
                {isTr
                  ? 'Firebase yapılandırması eksik (.env.local).'
                  : 'Firebase is not configured (.env.local missing).'}
              </Text>
            </View>
          ) : null}

          <View style={styles.tabsRow}>
            <Pressable
              testID="auth-tab-signin"
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'signin' }}
              accessibilityLabel={isTr ? 'Giriş Yap' : 'Sign In'}
              onPress={() => switchTab('signin')}
              style={[styles.tabBtn, tab === 'signin' && styles.tabBtnActive]}
            >
              <LogIn
                size={16}
                color={tab === 'signin' ? colors.white : colors.navy}
              />
              <Text
                style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}
              >
                {isTr ? 'Giriş Yap' : 'Sign In'}
              </Text>
            </Pressable>

            <Pressable
              testID="auth-tab-signup"
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'signup' }}
              accessibilityLabel={isTr ? 'Kayıt Ol' : 'Sign Up'}
              onPress={() => switchTab('signup')}
              style={[styles.tabBtn, tab === 'signup' && styles.tabBtnActive]}
            >
              <UserPlus
                size={16}
                color={tab === 'signup' ? colors.white : colors.navy}
              />
              <Text
                style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}
              >
                {isTr ? 'Kayıt Ol' : 'Sign Up'}
              </Text>
            </Pressable>

            <Pressable
              testID="auth-tab-forgot"
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'forgot' }}
              accessibilityLabel={isTr ? 'Şifremi Unuttum' : 'Forgot Password'}
              onPress={() => switchTab('forgot')}
              style={[styles.tabBtn, tab === 'forgot' && styles.tabBtnActive]}
            >
              <KeyRound
                size={16}
                color={tab === 'forgot' ? colors.white : colors.navy}
              />
              <Text
                style={[styles.tabText, tab === 'forgot' && styles.tabTextActive]}
              >
                {isTr ? 'Sıfırla' : 'Reset'}
              </Text>
            </Pressable>
          </View>

          {tab !== 'forgot' ? (
            <View style={styles.providersBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isTr ? 'Google ile devam et' : 'Continue with Google'
                }
                disabled={loading || !isFirebaseConfigured}
                onPress={() => void handleGooglePress()}
                style={({ pressed }) => [
                  styles.googleBtn,
                  (loading || !isFirebaseConfigured) && styles.disabledBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleBtnText}>
                  {isTr ? 'Google ile Devam Et' : 'Continue with Google'}
                </Text>
              </Pressable>

              {Platform.OS === 'ios' ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={radii.md}
                  style={styles.appleBtn}
                  onPress={() => void handleApplePress()}
                />
              ) : null}

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {isTr ? 'veya e-posta ile' : 'or with email'}
                </Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <View style={styles.inputRow}>
              <Mail size={18} color={colors.textMuted} />
              <TextInput
                testID="auth-modal-email"
                accessibilityLabel={isTr ? 'Ebeveyn e-postası' : "Parent's email"}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={isTr ? 'Ebeveyn e-postası' : "Parent's email"}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={email}
              />
            </View>

            {tab !== 'forgot' ? (
              <View style={styles.inputRow}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  testID="auth-modal-password"
                  accessibilityLabel={isTr ? 'Şifre' : 'Password'}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleSubmit()}
                  placeholder={isTr ? 'Şifre' : 'Password'}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorRow} accessibilityRole="alert">
              <AlertCircle size={16} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successRow}>
              <CheckCircle2 size={16} color={colors.green} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <Pressable
            testID="auth-modal-submit"
            accessibilityRole="button"
            accessibilityLabel={
              tab === 'signin'
                ? isTr
                  ? 'Giriş Yap'
                  : 'Sign In'
                : tab === 'signup'
                  ? isTr
                    ? 'Hesap Oluştur'
                    : 'Create Account'
                  : isTr
                    ? 'Sıfırlama Bağlantısı Gönder'
                    : 'Send Reset Link'
            }
            disabled={loading || !isFirebaseConfigured}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitBtn,
              (loading || !isFirebaseConfigured) && styles.disabledBtn,
              pressed && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>
                {tab === 'signin'
                  ? isTr
                    ? 'Giriş Yap'
                    : 'Sign In'
                  : tab === 'signup'
                    ? isTr
                      ? 'Hesap Oluştur'
                      : 'Create Account'
                    : isTr
                      ? 'Sıfırlama Bağlantısı Gönder'
                      : 'Send Reset Link'}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
            onPress={onOpenPrivacy}
            style={({ pressed }) => [styles.privacyBtn, pressed && styles.pressed]}
          >
            <Text style={styles.privacyText}>
              {isTr ? 'Gizlilik Politikası' : 'Privacy Policy'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthModal({ language }: AuthModalProps) {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(isAuthModalOpen);

  if (wasOpen !== isAuthModalOpen) {
    setWasOpen(isAuthModalOpen);
    if (!isAuthModalOpen && privacyOpen) {
      setPrivacyOpen(false);
    }
  }

  const handleRequestClose = () => {
    if (privacyOpen) {
      setPrivacyOpen(false);
      return;
    }
    closeAuthModal();
  };

  return (
    <Modal
      visible={isAuthModalOpen}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {isAuthModalOpen ? (
        <AuthModalBody
          language={language}
          privacyOpen={privacyOpen}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onClosePrivacy={() => setPrivacyOpen(false)}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  privacyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 3,
    borderColor: colors.amberLight,
    ...shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
    paddingRight: spacing.xxl,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.orangeLight,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: radii.md,
  },
  tabBtn: {
    flex: 1,
    minHeight: touchTargets.nav,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.blue,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
  },
  tabTextActive: {
    color: colors.white,
  },
  providersBlock: {
    gap: spacing.sm,
  },
  googleBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.blueLight,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.blue,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  appleBtn: {
    width: '100%',
    height: touchTargets.min,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  inputRow: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#f8fafc',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textDark,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fef2f2',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.red,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#ecfdf5',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
  },
  submitBtn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  privacyBtn: {
    minHeight: touchTargets.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.skyDark,
    textDecorationLine: 'underline',
  },
});
