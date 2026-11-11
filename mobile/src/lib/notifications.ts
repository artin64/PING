import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from './api';
import type { Reminder } from './types';

const ENABLED_KEY = 'pingo.notifications.enabled.v1';
const MODE_KEY = 'pingo.notifications.mode.v1';
const DEVICE_KEY = 'pingo.notifications.device.v1';
const LOCAL_NOTIFICATION_LIMIT = 56;
const ANDROID_REMINDER_CHANNEL = 'pingo-reminders-v2';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type NotificationMode = 'push' | 'local' | 'off' | 'unsupported';

function localKey(reminderId: string, dueAt: string, offset: number) {
  return `v2:${reminderId}:${dueAt}:${offset}`;
}

async function prepareAndroidReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL, {
    name: 'PINGO reminders',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#22C993',
    sound: 'default',
  });
}

async function deviceId(): Promise<string> {
  let value = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!value) {
    value = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    await SecureStore.setItemAsync(DEVICE_KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  return value;
}

async function cancelLocalReminderNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.content.data?.pingoReminder === true)
    .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function readNotificationMode(): Promise<NotificationMode> {
  if (Platform.OS === 'web') return 'unsupported';
  if ((await SecureStore.getItemAsync(ENABLED_KEY)) !== 'true') return 'off';
  const mode = await SecureStore.getItemAsync(MODE_KEY);
  return mode === 'push' ? 'push' : 'local';
}

export async function enableDeviceNotifications(): Promise<NotificationMode> {
  if (Platform.OS === 'web') return 'unsupported';
  await prepareAndroidReminderChannel();

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  if (!permission.granted) return 'off';

  await SecureStore.setItemAsync(ENABLED_KEY, 'true', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  let mode: NotificationMode = 'local';
  try {
    const projectId = Constants.easConfig?.projectId
      ?? Constants.expoConfig?.extra?.eas?.projectId
      ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (Device.isDevice && projectId && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const id = await deviceId();
      await api.registerPushDevice({ device_id: id, expo_push_token: token, platform: Platform.OS, show_details: false });
      mode = 'push';
      await SecureStore.setItemAsync(DEVICE_KEY, id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
  } catch {
    // Keep local delivery active when remote push setup or network access is unavailable.
  }
  await SecureStore.setItemAsync(MODE_KEY, mode);
  return mode;
}

export async function disableDeviceNotifications() {
  if (Platform.OS === 'web') return;
  const id = await SecureStore.getItemAsync(DEVICE_KEY);
  let failure: unknown;
  try {
    if (id && (await SecureStore.getItemAsync(MODE_KEY)) === 'push') await api.unregisterPushDevice(id);
  } catch (cause) {
    failure = cause;
  } finally {
    await cancelLocalReminderNotifications().catch(() => undefined);
    await SecureStore.deleteItemAsync(ENABLED_KEY);
    await SecureStore.deleteItemAsync(MODE_KEY);
    await SecureStore.deleteItemAsync(DEVICE_KEY);
  }
  if (failure) throw failure;
}

export async function syncReminderNotifications(reminders: Reminder[]) {
  if (Platform.OS === 'web') return;
  const enabled = (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true';
  if (!enabled) return;
  await prepareAndroidReminderChannel();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await cancelLocalReminderNotifications();
    return;
  }
  if ((await SecureStore.getItemAsync(MODE_KEY)) === 'push') {
    const status = await api.notificationStatus();
    if (status.failed === 0) {
      await cancelLocalReminderNotifications();
      return;
    }
    const id = await SecureStore.getItemAsync(DEVICE_KEY);
    if (id) await api.unregisterPushDevice(id);
    await SecureStore.setItemAsync(MODE_KEY, 'local');
  }

  const desired: { key: string; reminder: Reminder; offset: number; date: Date }[] = [];
  const now = Date.now();
  for (const reminder of reminders) {
    if (reminder.status !== 'active') continue;
    const due = new Date(reminder.due_at);
    if (!Number.isFinite(due.getTime()) || due.getTime() <= now) continue;
    const offsets = reminder.reminder_offsets_minutes?.length ? reminder.reminder_offsets_minutes : [1440, 60];
    const future = offsets
      .map((offset) => ({ offset, date: new Date(due.getTime() - offset * 60_000) }))
      .filter((candidate) => candidate.date.getTime() > now);
    const selected = future.length ? future : [{ offset: 0, date: due }];
    for (const candidate of selected) {
      desired.push({ key: localKey(reminder.id, reminder.due_at, candidate.offset), reminder, ...candidate });
    }
  }
  desired.sort((a, b) => a.date.getTime() - b.date.getTime());
  const limited = desired.slice(0, LOCAL_NOTIFICATION_LIMIT);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const current = new Map(
    scheduled
      .filter((item) => item.content.data?.pingoReminder === true && typeof item.content.data?.notificationKey === 'string')
      .map((item) => [String(item.content.data?.notificationKey), item.identifier]),
  );
  const wanted = new Set(limited.map((item) => item.key));
  await Promise.all([...current.entries()]
    .filter(([key]) => !wanted.has(key))
    .map(([, id]) => Notifications.cancelScheduledNotificationAsync(id)));
  for (const item of limited) {
    if (current.has(item.key)) continue;
    const when = item.offset === 0
      ? 'It is due now.'
      : `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.reminder.due_at))}.`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'PINGO reminder',
        body: `A saved reminder is coming up. ${when} Tap to view it in PINGO.`,
        sound: 'default',
        data: { pingoReminder: true, notificationKey: item.key, reminderId: item.reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_REMINDER_CHANNEL } : {}),
      },
    });
  }
}
