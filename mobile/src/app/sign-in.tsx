import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, ErrorMessage, Field, PingoIcon, Screen, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';

export default function SignInScreen() {
  const colors = usePingoTheme();
  const setSession = useSession((state) => state.setSession);
  const token = useSession((state) => state.token);
  const [hydrated, setHydrated] = useState(useSession.persist.hasHydrated());
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => useSession.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => { if (hydrated && token) router.replace('/'); }, [hydrated, token]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = registering ? await api.register(email.trim(), password) : await api.login(email.trim(), password);
      setSession(session.access_token, session.user, session.refresh_token);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: Math.max(insets.top, 18), justifyContent: 'center', paddingBottom: 20 }}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: colors.accentSolid }]}><TextBlock color={colors.onAccent} style={{ fontSize: 24, lineHeight: 28, fontWeight: '800' }}>P</TextBlock></View>
          <View><TextBlock style={{ fontWeight: '800', letterSpacing: 2.5 }}>PINGO</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 2 }}>NEVER MISS WHAT MATTERS</TextBlock></View>
        </View>

        <View style={[styles.introCard, { backgroundColor: colors.hero }]}>
          <View style={styles.introOrb} />
          <View style={[styles.introIcon, { backgroundColor: '#14273D' }]}><PingoIcon name="memory" size={20} color="#00D68F" /></View>
          <TextBlock size="title" color="#FFFFFF" style={{ marginTop: 16, maxWidth: 330 }}>Your life, remembered.</TextBlock>
          <TextBlock color="#B5C6D8" style={{ marginTop: 8, maxWidth: 340 }}>Keep important details, payments, dates and travel plans within reach.</TextBlock>
          <View style={styles.promiseRow}>
            <PingoIcon name="security" size={16} color="#00D68F" />
            <TextBlock size="small" color="#D4E1EC">Your private memories stay in your account.</TextBlock>
          </View>
        </View>

        <Surface tone="raised" style={{ gap: 15, marginTop: 13 }}>
          <View style={{ gap: 3 }}><TextBlock size="heading">{registering ? 'Create your account' : 'Welcome back'}</TextBlock><TextBlock size="small" color={colors.secondary}>{registering ? 'Start building a memory you can find.' : 'Sign in to pick up where you left off.'}</TextBlock></View>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" left={<PingoIcon name="person" size={18} color={colors.secondary} />} />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder={registering ? 'At least 10 characters' : 'Your password'} secureTextEntry autoCapitalize="none" />
          <ErrorMessage message={error} />
          <ActionButton title={registering ? 'Create account' : 'Sign in'} icon="arrow" onPress={submit} busy={busy} disabled={!email.trim() || password.length < (registering ? 10 : 1)} />
          <View style={styles.switchRow}>
            <TextBlock size="small" color={colors.secondary}>{registering ? 'Already have an account?' : 'New to PINGO?'}</TextBlock>
            <Pressable onPress={() => { setRegistering(!registering); setError(null); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 5 }}>
              <TextBlock size="small" color={colors.accent} style={{ fontWeight: '700' }}>{registering ? 'Sign in' : 'Create account'}</TextBlock>
            </Pressable>
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = {
  brandRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11, marginBottom: 19 },
  brandMark: { width: 47, height: 47, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const },
  introCard: { borderRadius: 25, padding: 21, overflow: 'hidden' as const },
  introOrb: { position: 'absolute' as const, width: 180, height: 180, borderRadius: 90, right: -85, top: -102, backgroundColor: '#173653', opacity: 0.82 },
  introIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  promiseRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderTopWidth: 1, borderTopColor: '#294057', marginTop: 17, paddingTop: 13 },
  switchRow: { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 5 },
};
