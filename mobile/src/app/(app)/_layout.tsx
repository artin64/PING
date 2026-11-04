import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import { syncReminderNotifications } from '@/lib/notifications';

export default function AppLayout() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const token = useSession((state) => state.token);
  const user = useSession((state) => state.user);
  const [hydrated, setHydrated] = useState(useSession.persist.hasHydrated());
  const notificationReminders = useQuery({
    queryKey: ['reminders', 'notification-sync'],
    queryFn: () => api.reminders(),
    enabled: hydrated && Boolean(token),
    staleTime: 15_000,
    retry: false,
  });

  useEffect(() => useSession.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => {
    if (hydrated && !token) router.replace('/sign-in');
  }, [hydrated, token]);

  useEffect(() => {
    if (!hydrated || !token || !user) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone || timezone === user.timezone) return;
    api.updateTimezone(timezone)
      .then((updated) => {
        useSession.getState().setSession(token, updated);
        client.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .catch(() => undefined);
  }, [client, hydrated, token, user]);

  useEffect(() => {
    if (notificationReminders.data) void syncReminderNotifications(notificationReminders.data).catch(() => undefined);
  }, [notificationReminders.data]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener(() => router.replace('/(app)'));
    return () => subscription.remove();
  }, []);

  if (!hydrated || !token) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="memory/index" />
        <Stack.Screen name="memory/[id]" />
        <Stack.Screen name="money" />
        <Stack.Screen name="life" />
        <Stack.Screen name="reminders/[id]" />
        <Stack.Screen name="trips/index" />
        <Stack.Screen name="trips/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
      <BottomNavigation />
    </View>
  );
}

