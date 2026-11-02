import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { ActionButton, ErrorMessage, Screen, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import { disableDeviceNotifications, enableDeviceNotifications, readNotificationMode, syncReminderNotifications, type NotificationMode } from '@/lib/notifications';

export default function SettingsScreen() {
  const colors = usePingoTheme();
  const user = useSession((state) => state.user);
  const clearSession = useSession((state) => state.clearSession);
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('off');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [aiConsentBusy, setAiConsentBusy] = useState(false);
  const [aiConsentOverride, setAiConsentOverride] = useState<boolean | null>(null);
  const aiConsent = aiConsentOverride ?? Boolean(user?.ai_external_consent);
  const notificationStatus = useQuery({ queryKey: ['notification-status'], queryFn: api.notificationStatus });
  const remove = useMutation({ mutationFn: api.deleteAccount, onSuccess: async () => {
    await disableDeviceNotifications().catch(() => undefined);
    clearSession();
    client.clear();
    router.replace('/sign-in');
  }, onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not delete the account.') });

  useEffect(() => { void readNotificationMode().then(setNotificationMode).catch(() => undefined); }, []);
  async function changeAiConsent(enabled: boolean) {
    setAiConsentOverride(enabled);
    setAiConsentBusy(true);
    setError(null);
    try {
      const updated = await api.updateExternalAiConsent(enabled);
      const token = useSession.getState().token;
      if (token) useSession.getState().setSession(token, updated);
      setAiConsentOverride(null);
    } catch (cause) {
      setAiConsentOverride(Boolean(user?.ai_external_consent));
      setError(cause instanceof Error ? cause.message : 'Could not update AI privacy settings.');
    } finally {
      setAiConsentBusy(false);
    }
  }

  async function toggleNotifications() {
    setNotificationBusy(true);
    setError(null);
    try {
      if (notificationMode === 'off') {
        const mode = await enableDeviceNotifications();
        setNotificationMode(mode);
        if (mode === 'local') await syncReminderNotifications(await api.reminders());
        if (mode === 'off') setError('Notification permission is off. Enable it in your device settings to receive reminders.');
      } else {
        try { await disableDeviceNotifications(); }
        finally { setNotificationMode('off'); }
      }
      await notificationStatus.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update notification settings.');
    } finally {
      setNotificationBusy(false);
    }
  }

  async function download() {
    setExporting(true);
    setError(null);
    try { await api.exportAccount(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare the export.'); }
    finally { setExporting(false); }
  }

  async function signOut() {
    await disableDeviceNotifications().catch(() => undefined);
    await api.logout().catch(() => undefined);
    clearSession();
    client.clear();
    router.replace('/sign-in');
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}><TextBlock color={colors.secondary}>‹  Today</TextBlock></Pressable>
      <TextBlock size="eyebrow" color={colors.accent}>ACCOUNT & PRIVACY</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7, marginBottom: 20 }}>Your account</TextBlock>
      <Surface style={{ gap: 6, marginBottom: 16 }}>
        <TextBlock size="small" color={colors.secondary}>SIGNED IN AS</TextBlock>
        <TextBlock>{user?.email || 'Your PINGO account'}</TextBlock>
        <TextBlock size="small" color={colors.secondary}>Account data is private to this sign-in. Attachments are served only after authorization.</TextBlock>
      </Surface>
      <Surface style={{ gap: 12, marginBottom: 16 }}>
        <TextBlock size="subheading" style={{ fontWeight: '600' }}>Your data</TextBlock>
        <TextBlock size="small" color={colors.secondary}>Download your saved items, reminders and original attachments as a ZIP file.</TextBlock>
        <ActionButton title="Download my data" onPress={download} busy={exporting} variant="secondary" />
      </Surface>
      <Surface style={{ gap: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 7 }}>
            <TextBlock size="subheading" style={{ fontWeight: '600' }}>External AI processing</TextBlock>
            <TextBlock size="small" color={colors.secondary}>Off by default. When you turn this on and the server uses Gemini, saved text may be sent to Google for analysis. Original files are not sent. This does not enable AI by itself.</TextBlock>
          </View>
          <Switch accessibilityLabel="Allow saved text to be processed by an external AI provider" value={aiConsent} disabled={aiConsentBusy} onValueChange={(value) => { void changeAiConsent(value); }} trackColor={{ true: colors.accent }} />
        </View>
        <TextBlock size="small" color={colors.secondary}>Local Ollama processing does not send your records to a paid AI provider.</TextBlock>
      </Surface>
      <Surface style={{ gap: 12, marginBottom: 16 }}>
        <TextBlock size="subheading" style={{ fontWeight: '600' }}>Reminders on this device</TextBlock>
        <TextBlock size="small" color={colors.secondary}>
          {notificationMode === 'push'
            ? `Push is registered on this device. ${notificationStatus.data?.failed ? `${notificationStatus.data.failed} recent delivery failures need attention.` : 'Delivery still depends on Apple and Google push credentials.'}`
            : notificationMode === 'local'
              ? 'This device schedules up to 56 upcoming alerts locally. Keep PINGO installed and allow notifications in system settings.'
              : notificationMode === 'unsupported'
                ? 'Browser notifications are not configured. Your saved reminders remain available in PINGO.'
                : 'Reminders are saved in PINGO. Turn on notifications to receive alerts when the app is closed.'}
        </TextBlock>
        {notificationMode !== 'unsupported' ? <ActionButton title={notificationMode === 'off' ? 'Enable notifications' : 'Turn off notifications'} onPress={toggleNotifications} busy={notificationBusy} variant="secondary" /> : null}
        {notificationMode === 'push' ? <TextBlock size="small" color={colors.secondary}>{notificationStatus.data?.push_devices ?? 0} push device(s) · {notificationStatus.data?.pending ?? 0} queued alert(s)</TextBlock> : null}
      </Surface>
      <Surface style={{ gap: 12, marginBottom: 18 }}>
        <TextBlock size="subheading" style={{ fontWeight: '600' }}>Sign out</TextBlock>
        <ActionButton title="Sign out" onPress={() => { void signOut(); }} variant="secondary" />
      </Surface>
      <Surface style={{ gap: 12, borderColor: colors.danger }}>
        <TextBlock size="subheading" color={colors.danger} style={{ fontWeight: '600' }}>Delete account</TextBlock>
        <TextBlock size="small" color={colors.secondary}>This permanently removes your PINGO account, saved items, reminders and attachments.</TextBlock>
        {confirmingDelete ? <>
          <TextBlock size="small" color={colors.danger}>This can’t be undone. Download your data first if you want to keep a copy.</TextBlock>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><ActionButton title="Keep account" onPress={() => setConfirmingDelete(false)} variant="secondary" /></View>
            <View style={{ flex: 1 }}><ActionButton title="Delete forever" onPress={() => remove.mutate()} busy={remove.isPending} variant="danger" /></View>
          </View>
        </> : <ActionButton title="Delete my account" onPress={() => setConfirmingDelete(true)} variant="danger" />}
      </Surface>
      <View style={{ marginTop: 13 }}><ErrorMessage message={error} /></View>
    </Screen>
  );
}
