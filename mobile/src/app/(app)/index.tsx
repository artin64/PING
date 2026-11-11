import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, Badge, ErrorMessage, Field, PingoIcon, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { DailyBrief } from '@/components/daily-brief';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import type { Reminder } from '@/lib/types';

function dateLabel(value: string) {
  const due = new Date(value);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(due);
}

function dueBadge(reminder: Reminder) {
  const due = new Date(reminder.due_at);
  const now = new Date();
  if (due < now) return { label: 'Overdue', tone: 'danger' as const };
  if (due.toDateString() === now.toDateString()) return { label: 'Due today', tone: 'warning' as const };
  return { label: 'Coming up', tone: 'neutral' as const };
}

function amountLabel(reminder: Reminder) {
  if (reminder.amount === null || !reminder.currency) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: reminder.currency }).format(reminder.amount); }
  catch { return `${reminder.amount.toFixed(2)} ${reminder.currency}`; }
}

function ReminderRow({ reminder, onComplete, busy }: { reminder: Reminder; onComplete: (item: Reminder) => void; busy: boolean }) {
  const colors = usePingoTheme();
  const badge = dueBadge(reminder);
  const tone = reminder.kind === 'payment' ? { foreground: colors.gold, background: colors.goldSoft }
    : reminder.kind === 'trip' ? { foreground: colors.blue, background: colors.blueSoft }
      : { foreground: colors.accent, background: colors.accentSoft };
  return (
    <Surface style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={[styles.typeIcon, { backgroundColor: tone.background }]}>
        <PingoIcon name={reminder.kind === 'payment' ? 'receipt' : reminder.kind === 'trip' ? 'flight' : 'reminder'} size={19} color={tone.foreground} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <TextBlock style={{ fontWeight: '600' }} numberOfLines={1}>{reminder.title}</TextBlock>
        <TextBlock size="small" color={colors.secondary} numberOfLines={1}>
          {dateLabel(reminder.due_at)}{amountLabel(reminder) ? ` · ${amountLabel(reminder)}` : ''}
        </TextBlock>
        {reminder.note ? <TextBlock size="small" color={colors.secondary} numberOfLines={1}>{reminder.note}</TextBlock> : null}
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Complete ${reminder.title}`}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => onComplete(reminder)}
        style={({ pressed }) => [styles.completeButton, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }, pressed && { opacity: 0.65 }]}
      >
        {busy ? <View style={[styles.checkCircle, { backgroundColor: colors.accentSolid }]}><PingoIcon name="check" size={14} color={colors.onAccent} /></View>
          : <View style={[styles.emptyCircle, { borderColor: colors.secondary }]} />}
      </Pressable>
    </Surface>
  );
}

function QuickLink({ icon, title, subtitle, onPress }: { icon: 'memory' | 'money' | 'life' | 'flight'; title: string; subtitle: string; onPress: () => void }) {
  const colors = usePingoTheme();
  const tone = icon === 'money' ? { foreground: colors.gold, background: colors.goldSoft }
    : icon === 'life' ? { foreground: colors.accent, background: colors.accentSoft }
      : { foreground: colors.blue, background: colors.blueSoft };
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}>
      <View style={[styles.quickIcon, { backgroundColor: tone.background }]}><PingoIcon name={icon} size={19} color={tone.foreground} /></View>
      <View style={{ flex: 1 }}><TextBlock size="small" style={{ fontWeight: '600' }}>{title}</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 3 }}>{subtitle}</TextBlock></View>
      <PingoIcon name="chevron" size={15} color={colors.secondary} />
    </Pressable>
  );
}

export default function TodayScreen() {
  const colors = usePingoTheme();
  const user = useSession((state) => state.user);
  const [actionError, setActionError] = useState<string | null>(null);
  const [homeSearch, setHomeSearch] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const complete = useMutation({
    mutationFn: api.completeReminder,
    onSuccess: () => {
      setActionError(null);
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['reminders'] });
      client.invalidateQueries({ queryKey: ['payments', 'overview'] });
    },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not complete this reminder.'),
  });

  const now = new Date();
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email.split('@')[0]?.split(/[._-]/)[0];
  const displayName = firstName ? `${firstName.slice(0, 1).toUpperCase()}${firstName.slice(1)}` : '';
  const attention = query.data?.needs_attention ?? [];
  const upcoming = query.data?.upcoming ?? [];
  const openMemorySearch = () => {
    const term = homeSearch.trim();
    router.push(term ? { pathname: '/(app)/memory', params: { q: term } } : '/(app)/memory');
  };

  return (
    <Screen>
      <DailyBrief
        date={date}
        greeting={greeting}
        displayName={displayName}
        userInitial={user?.email.slice(0, 1).toUpperCase() || 'P'}
        attentionCount={attention.length}
        upcomingCount={upcoming.length}
        loading={query.isLoading}
        error={query.isError}
        onCapture={() => router.push('/capture')}
        onSettings={() => router.push('/(app)/settings')}
      />

      <View style={{ marginTop: 20 }}>
        <Field
          label="FIND IT IN MEMORY"
          value={homeSearch}
          onChangeText={setHomeSearch}
          onSubmitEditing={openMemorySearch}
          placeholder="Try “flight to Germany”"
          autoCapitalize="none"
          left={<PingoIcon name="search" size={19} color={colors.blue} />}
          right={<Pressable onPress={openMemorySearch} accessibilityRole="button" accessibilityLabel="Search PINGO memory" hitSlop={8} style={({ pressed }) => [styles.searchAction, { backgroundColor: colors.blue }, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}><PingoIcon name="arrow" size={17} color="#FFFFFF" /></Pressable>}
        />
      </View>

      {actionError ? <ErrorMessage message={actionError} /> : null}
      {query.isError ? <View style={{ marginTop: 12 }}><ActionButton title="Try again" icon="arrow" variant="secondary" onPress={() => query.refetch()} /></View> : null}

      <SectionHeading title="Needs attention" style={{ marginTop: 25 }} action={<Pressable onPress={() => router.push('/(app)/life')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>See all</TextBlock></Pressable>} />
      {query.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Loading your reminders…</TextBlock></Surface>
        : attention.length ? <View style={{ gap: 10, marginBottom: 19 }}>
          {attention.slice(0, 4).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(reminder) => complete.mutate({ id: reminder.id, due_at: reminder.due_at })} busy={complete.isPending && complete.variables?.id === item.id} />)}
        </View> : !query.isError ? <Surface tone="raised" style={styles.calmEmpty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="check" size={20} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><TextBlock style={{ fontWeight: '600' }}>Nothing urgent right now</TextBlock><TextBlock size="small" color={colors.secondary} style={{ marginTop: 3 }}>We’ll keep your upcoming payments and dates close.</TextBlock></View>
        </Surface> : null}

      {upcoming.length ? <>
        <SectionHeading title="Coming up" action={<Pressable onPress={() => router.push('/(app)/life')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>Open Life</TextBlock></Pressable>} />
        <View style={{ gap: 10, marginBottom: 20 }}>{upcoming.slice(0, 3).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(reminder) => complete.mutate({ id: reminder.id, due_at: reminder.due_at })} busy={complete.isPending && complete.variables?.id === item.id} />)}</View>
      </> : null}

      {query.data?.upcoming_trips.length ? <>
        <SectionHeading title="Your next trip" action={<Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>All trips</TextBlock></Pressable>} />
        <View style={{ gap: 10, marginBottom: 20 }}>{query.data.upcoming_trips.slice(0, 2).map((trip) => (
          <Pressable key={trip.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } })}>
            <Surface style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
              <View style={[styles.tripIcon, { backgroundColor: colors.blueSoft }]}><PingoIcon name="flight" size={20} color={colors.blue} /></View>
              <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{trip.destination}</TextBlock><TextBlock size="small" color={colors.secondary}>{trip.title} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: trip.timezone }).format(new Date(trip.starts_at))}</TextBlock></View>
              <PingoIcon name="chevron" size={17} color={colors.secondary} />
            </Surface>
          </Pressable>
        ))}</View>
      </> : null}

      <SectionHeading title="Recently saved" action={<Pressable onPress={() => router.push('/(app)/memory')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>Memory</TextBlock></Pressable>} />
      {query.data?.recent_captures.length ? <View style={{ gap: 9, marginBottom: 21 }}>
        {query.data.recent_captures.slice(0, 3).map((item) => <Pressable key={item.id} onPress={() => router.push(`/(app)/memory/${item.id}`)} accessibilityRole="button">
          <Surface style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}>
            <View style={[styles.recentIcon, { backgroundColor: item.kind === 'note' ? colors.goldSoft : colors.blueSoft }]}><PingoIcon name={item.kind === 'screenshot' ? 'photo' : item.kind === 'document' ? 'document' : item.kind === 'link' ? 'link' : 'note'} size={18} color={item.kind === 'note' ? colors.gold : colors.blue} /></View>
            <View style={{ flex: 1, gap: 4 }}><TextBlock size="small" style={{ fontWeight: '600' }} numberOfLines={1}>{item.title}</TextBlock><TextBlock size="eyebrow" color={colors.secondary}>{item.kind.toUpperCase()} · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.created_at))}</TextBlock></View>
            <PingoIcon name="chevron" size={16} color={colors.secondary} />
          </Surface>
        </Pressable>)}
      </View> : !query.isLoading && !query.isError ? <Surface tone="raised" style={{ marginBottom: 21 }}><TextBlock size="small" color={colors.secondary}>Save a note, screenshot, or document and it will be easy to find here.</TextBlock></Surface> : null}

      <SectionHeading title="Your PINGO spaces" />
      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 10 }}>
        <QuickLink icon="memory" title="Memory" subtitle="Saved details" onPress={() => router.push('/(app)/memory')} />
        <QuickLink icon="money" title="Money" subtitle="Bill reminders" onPress={() => router.push('/(app)/money')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <QuickLink icon="life" title="Life" subtitle="Dates & tasks" onPress={() => router.push('/(app)/life')} />
        <QuickLink icon="flight" title="Travel" subtitle="Trips & bookings" onPress={() => router.push('/(app)/trips')} />
      </View>
    </Screen>
  );
}

const styles = {
  searchAction: { width: 44, height: 44, marginRight: -7, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  sectionAction: { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: 5 },
  typeIcon: { width: 41, height: 41, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const },
  completeButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  emptyCircle: { width: 17, height: 17, borderWidth: 1.5, borderRadius: 9 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  calmEmpty: { flexDirection: 'row' as const, gap: 12, alignItems: 'center' as const, marginBottom: 20 },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  tripIcon: { width: 45, height: 45, borderRadius: 16, justifyContent: 'center' as const, alignItems: 'center' as const },
  recentIcon: { width: 38, height: 38, borderRadius: 13, justifyContent: 'center' as const, alignItems: 'center' as const },
  quickLink: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  quickIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
};
