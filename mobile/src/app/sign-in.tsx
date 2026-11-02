import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, ErrorMessage, Field, Screen, Surface, TextBlock } from '@/components/ui';
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
  useEffect(() => { if (hydrated && token) router.replace('/today'); }, [hydrated, token]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = registering ? await api.register(email.trim(), password) : await api.login(email.trim(), password);
      setSession(session.access_token, session.user, session.refresh_token);
      router.replace('/today');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: Math.max(insets.top, 24), justifyContent: 'center' }}>
        <TextBlock size="eyebrow" color={colors.accent} style={{ marginBottom: 16 }}>PINGO · NEVER MISS WHAT MATTERS</TextBlock>
        <TextBlock size="title" style={{ fontWeight: '600', maxWidth: 360 }}>Your life, remembered.</TextBlock>
        <TextBlock color={colors.secondary} style={{ marginTop: 10, marginBottom: 28, maxWidth: 360 }}>Save the details. Keep the important dates close.</TextBlock>
        <Surface style={{ gap: 15 }}>
          <TextBlock size="subheading" style={{ fontWeight: '600', marginBottom: 2 }}>{registering ? 'Create your account' : 'Welcome back'}</TextBlock>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder={registering ? 'At least 10 characters' : 'Your password'} secureTextEntry autoCapitalize="none" />
          <ErrorMessage message={error} />
          <ActionButton title={registering ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} disabled={!email.trim() || password.length < (registering ? 10 : 1)} />
          <View style={{ alignItems: 'center', paddingTop: 3 }}>
            <TextBlock size="small" color={colors.secondary}>
              {registering ? 'Already have an account? ' : 'New to PINGO? '}
              <TextBlock size="small" color={colors.accent} style={{ fontWeight: '600' }} onPress={() => { setRegistering(!registering); setError(null); }}>
                {registering ? 'Sign in' : 'Create account'}
              </TextBlock>
            </TextBlock>
          </View>
        </Surface>
        <TextBlock size="small" color={colors.secondary} style={{ marginTop: 18, textAlign: 'center' }}>Your private memories stay in your account.</TextBlock>
      </KeyboardAvoidingView>
    </Screen>
  );
}
