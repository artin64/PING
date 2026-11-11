import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, ErrorMessage, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import type { Reminder } from '@/lib/types';

function dateLabel(value: string) {
  const due = new Date(value);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(due);
}

function ReminderRow({ reminder, onComplete }: { reminder: Reminder; onComplete: (item: Reminder) => void }) {
  const colors = usePingoTheme();
  return (
    <Surface style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <TextBlock style={{ fontWeight: '600' }}>{reminder.title}</TextBlock>
        <TextBlock size="small" color={colors.secondary}>
          {dateLabel(reminder.due_at)}{reminder.kind === 'payment' && reminder.amount !== null ? `  ·  ${new Intl.NumberFormat(undefined, { style: 'currency', currency: reminder.currency || 'USD' }).format(reminder.amount)}` : ''}
        </TextBlock>
        {reminder.note ? <TextBlock size="small" color={colors.secondary}>{reminder.note}</TextBlock> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Complete ${reminder.title}`} onPress={() => onComplete(reminder)} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <TextBlock size="small" color={colors.accent} style={{ fontWeight: '600' }}>Done</TextBlock>
      </Pressable>
    </Surface>
  );
}

export default function TodayScreen() {
  const colors = usePingoTheme();
  const user = useSession((state) => state.user);
  const [actionError, setActionError] = useState<string | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const complete = useMutation({
    mutationFn: api.completeReminder,
    onSuccess: () => client.invalidateQueries({ queryKey: ['dashboard'] }),
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not complete this reminder.'),
  });

  const now = new Date();
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const greeting = now.getHours() < 12 ? 'Good morning.' : now.getHours() < 18 ? 'Good afternoon.' : 'Good evening.';
  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <View><TextBlock size="eyebrow" color={colors.accent}>TODAY · {date.toUpperCase()}</TextBlock><TextBlock size="title" style={{ fontWeight: '600', marginTop: 8 }}>{greeting}</TextBlock></View>
        <Pressable onPress={() => router.push('/(app)/settings')} accessibilityRole="button" accessibilityLabel="Account settings" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <TextBlock color={colors.secondary} style={{ fontSize: 12 }}>{user?.email.slice(0, 1).toUpperCase() || '•'}</TextBlock>
        </Pressable>
      </View>
      <Surface style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, marginBottom: 26, padding: 20 }}>
        <TextBlock size="eyebrow" color={colors.accent}>YOUR DAILY BRIEF</TextBlock>
        {query.isLoading ? <TextBlock color={colors.secondary} style={{ marginTop: 8 }}>Checking what needs your attention…</TextBlock>
          : query.isError ? <TextBlock color={colors.danger} style={{ marginTop: 8 }}>Your overview could not load. Pull down to try again.</TextBlock>
            : query.data?.needs_attention.length ? <TextBlock size="subheading" style={{ fontWeight: '600', marginTop: 8 }}>{query.data.needs_attention.length} {query.data.needs_attention.length === 1 ? 'thing needs' : 'things need'} your attention.</TextBlock>
              : <TextBlock size="subheading" style={{ fontWeight: '600', marginTop: 8 }}>Nothing pressing today.</TextBlock>}
        <TextBlock size="small" color={colors.secondary} style={{ marginTop: 5 }}>Your reminders stay here until you finish them.</TextBlock>
        <View style={{ flexDirection: 'row', marginTop: 15 }}><ActionButton title="Save something" onPress={() => router.push('/capture')} /></View>
      </Surface>

      {actionError ? <ErrorMessage message={actionError} /> : null}
      {query.isError ? <ActionButton title="Retry" variant="secondary" onPress={() => query.refetch()} /> : null}

      <SectionHeading title="Needs attention" />
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading your reminders…</TextBlock>
        : query.data?.needs_attention.length ? <View style={{ gap: 10, marginBottom: 25 }}>
          {query.data.needs_attention.slice(0, 4).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(reminder) => complete.mutate({ id: reminder.id, due_at: reminder.due_at })} />)}
        </View> : <Surface style={{ marginBottom: 25 }}><TextBlock color={colors.secondary}>When you add a deadline or payment, PINGO will keep it in view until it’s done.</TextBlock></Surface>}

      {query.data?.upcoming.length ? <>
        <SectionHeading title="Coming up" />
        <View style={{ gap: 10, marginBottom: 25 }}>{query.data.upcoming.slice(0, 3).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(reminder) => complete.mutate({ id: reminder.id, due_at: reminder.due_at })} />)}</View>
      </> : null}

      {query.data?.upcoming_trips.length ? <>
        <SectionHeading title="Your next trip" action={<Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>See trips</TextBlock></Pressable>} />
        <View style={{ gap: 10, marginBottom: 25 }}>{query.data.upcoming_trips.slice(0, 2).map((trip) => <Pressable key={trip.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } })}><Surface style={{ gap: 5 }}><TextBlock style={{ fontWeight: '600' }}>{trip.destination} · {trip.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: trip.timezone }).format(new Date(trip.starts_at))} · {trip.timezone}</TextBlock></Surface></Pressable>)}</View>
      </> : null}

      <SectionHeading title="Recently saved" action={<Pressable onPress={() => router.push('/(app)/memory')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>See memory</TextBlock></Pressable>} />
      {query.data?.recent_captures.length ? <View style={{ gap: 10 }}>
        {query.data.recent_captures.slice(0, 3).map((item) => <Pressable key={item.id} onPress={() => router.push(`/(app)/memory/${item.id}`)} accessibilityRole="button"><Surface style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ flex: 1 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary} style={{ marginTop: 4 }}>{item.kind} · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.created_at))}</TextBlock></View><TextBlock color={colors.accent}>›</TextBlock></Surface></Pressable>)}
      </View> : !query.isLoading ? <Surface><TextBlock color={colors.secondary}>Your saved notes, links and screenshots will show up here.</TextBlock></Surface> : null}
    </Screen>
  );
}
