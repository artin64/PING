import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, Badge, ErrorMessage, PingoIcon, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
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

function ReminderRow({ reminder, onComplete, busy }: { reminder: Reminder; onComplete: (id: string) => void; busy: boolean }) {
  const colors = usePingoTheme();
  const badge = dueBadge(reminder);
  return (
    <Surface style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={[styles.typeIcon, { backgroundColor: reminder.kind === 'payment' ? colors.accentSoft : colors.surfaceMuted }]}>
        <PingoIcon name={reminder.kind === 'payment' ? 'receipt' : 'reminder'} size={19} color={reminder.kind === 'payment' ? colors.accent : colors.secondary} />
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
        onPress={() => onComplete(reminder.id)}
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
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.72 }]}>
      <View style={[styles.quickIcon, { backgroundColor: colors.surfaceMuted }]}><PingoIcon name={icon} size={19} color={colors.accent} /></View>
      <View style={{ flex: 1 }}><TextBlock size="small" style={{ fontWeight: '600' }}>{title}</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 3 }}>{subtitle}</TextBlock></View>
      <PingoIcon name="chevron" size={15} color={colors.secondary} />
    </Pressable>
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

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.brandMark, { backgroundColor: colors.accentSolid }]}><TextBlock color={colors.onAccent} style={{ fontSize: 18, lineHeight: 22, fontWeight: '800' }}>P</TextBlock></View>
          <View><TextBlock size="small" style={{ fontWeight: '800', letterSpacing: 2.1 }}>PINGO</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 1 }}>NEVER MISS WHAT MATTERS</TextBlock></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.push('/(app)/settings')} accessibilityRole="button" accessibilityLabel="Account settings" style={[styles.roundButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <PingoIcon name="settings" size={19} color={colors.secondary} />
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/settings')} accessibilityRole="button" accessibilityLabel="Account settings" style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
            <TextBlock size="small" color={colors.accent} style={{ fontWeight: '700' }}>{user?.email.slice(0, 1).toUpperCase() || 'P'}</TextBlock>
          </Pressable>
        </View>
      </View>

      <View style={styles.greeting}>
        <TextBlock size="small" color={colors.secondary}>{date}</TextBlock>
        <TextBlock size="title" style={{ marginTop: 5 }}>{greeting}{displayName ? `, ${displayName}.` : '.'}</TextBlock>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <View style={styles.heroOrb} />
        <View style={styles.heroOrbRing} />
        <View style={styles.heroTop}>
          <View style={styles.heroLabel}><PingoIcon name="sparkles" size={15} color="#00D68F" /><TextBlock size="eyebrow" color="#B5C6D8">YOUR DAILY BRIEF</TextBlock></View>
          <PingoIcon name="arrow" size={17} color="#B5C6D8" />
        </View>
        {query.isLoading ? <TextBlock color="#B5C6D8" style={{ marginTop: 21 }}>Checking what needs your attention…</TextBlock>
          : query.isError ? <TextBlock color="#FFB1AD" style={{ marginTop: 21 }}>Your overview could not load. Retry below.</TextBlock>
            : <View style={styles.heroSummary}>
              <TextBlock style={{ color: '#00D68F', fontSize: 46, lineHeight: 52, fontWeight: '700', letterSpacing: -1.4 }}>{attention.length}</TextBlock>
              <View style={{ flex: 1, paddingBottom: 3 }}>
                <TextBlock size="subheading" color="#FFFFFF" style={{ fontWeight: '600' }}>{attention.length === 0 ? 'You’re clear for today.' : attention.length === 1 ? 'thing needs your attention' : 'things need your attention'}</TextBlock>
                <TextBlock size="small" color="#B5C6D8" style={{ marginTop: 4 }}>{attention.length === 0 ? 'Your saved reminders are right here when you need them.' : 'Payments and deadlines, gathered in one place.'}</TextBlock>
              </View>
            </View>}
        <View style={styles.heroFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><PingoIcon name="clock" size={15} color="#B5C6D8" /><TextBlock size="small" color="#B5C6D8">{upcoming.length} coming up</TextBlock></View>
          <Pressable onPress={() => router.push('/capture')} accessibilityRole="button" style={({ pressed }) => [styles.heroAction, pressed && { opacity: 0.75 }]}>
            <PingoIcon name="add" size={16} color="#07111F" /><TextBlock size="small" color="#07111F" style={{ fontWeight: '700' }}>Capture</TextBlock>
          </Pressable>
        </View>
      </View>

      {actionError ? <ErrorMessage message={actionError} /> : null}
      {query.isError ? <View style={{ marginTop: 12 }}><ActionButton title="Try again" icon="arrow" variant="secondary" onPress={() => query.refetch()} /></View> : null}

      <SectionHeading title="Needs attention" style={{ marginTop: 25 }} action={<Pressable onPress={() => router.push('/(app)/life')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>See all</TextBlock></Pressable>} />
      {query.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Loading your reminders…</TextBlock></Surface>
        : attention.length ? <View style={{ gap: 10, marginBottom: 19 }}>
          {attention.slice(0, 4).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(id) => complete.mutate(id)} busy={complete.isPending && complete.variables === item.id} />)}
        </View> : !query.isError ? <Surface tone="raised" style={styles.calmEmpty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="check" size={20} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><TextBlock style={{ fontWeight: '600' }}>Nothing urgent right now</TextBlock><TextBlock size="small" color={colors.secondary} style={{ marginTop: 3 }}>We’ll keep your upcoming payments and dates close.</TextBlock></View>
        </Surface> : null}

      {upcoming.length ? <>
        <SectionHeading title="Coming up" action={<Pressable onPress={() => router.push('/(app)/life')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>Open Life</TextBlock></Pressable>} />
        <View style={{ gap: 10, marginBottom: 20 }}>{upcoming.slice(0, 3).map((item) => <ReminderRow key={item.id} reminder={item} onComplete={(id) => complete.mutate(id)} busy={complete.isPending && complete.variables === item.id} />)}</View>
      </> : null}

      {query.data?.upcoming_trips.length ? <>
        <SectionHeading title="Your next trip" action={<Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>All trips</TextBlock></Pressable>} />
        <View style={{ gap: 10, marginBottom: 20 }}>{query.data.upcoming_trips.slice(0, 2).map((trip) => (
          <Pressable key={trip.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } })}>
            <Surface style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
              <View style={[styles.tripIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="flight" size={20} color={colors.accent} /></View>
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
            <View style={[styles.recentIcon, { backgroundColor: colors.surfaceMuted }]}><PingoIcon name={item.kind === 'screenshot' ? 'photo' : item.kind === 'document' ? 'document' : item.kind === 'link' ? 'link' : 'note'} size={18} color={colors.accent} /></View>
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
  topBar: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 23 },
  brandMark: { width: 37, height: 37, borderRadius: 13, justifyContent: 'center' as const, alignItems: 'center' as const },
  roundButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, justifyContent: 'center' as const, alignItems: 'center' as const },
  avatar: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, justifyContent: 'center' as const, alignItems: 'center' as const },
  greeting: { marginBottom: 18 },
  hero: { borderRadius: 27, padding: 21, overflow: 'hidden' as const },
  heroOrb: { position: 'absolute' as const, width: 190, height: 190, borderRadius: 95, right: -77, top: -89, backgroundColor: '#163451', opacity: 0.78 },
  heroOrbRing: { position: 'absolute' as const, width: 245, height: 245, borderRadius: 125, borderWidth: 1, borderColor: '#2C4964', right: -125, top: 62, opacity: 0.48 },
  heroTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  heroLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  heroSummary: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 13, marginTop: 19, minHeight: 62 },
  heroFooter: { borderTopWidth: 1, borderTopColor: '#294057', paddingTop: 14, marginTop: 17, flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  heroAction: { minHeight: 37, paddingHorizontal: 13, borderRadius: 19, backgroundColor: '#00D68F', flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  sectionAction: { minHeight: 40, justifyContent: 'center' as const, paddingHorizontal: 5 },
  typeIcon: { width: 41, height: 41, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const },
  completeButton: { width: 36, height: 36, borderWidth: 1, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const },
  emptyCircle: { width: 17, height: 17, borderWidth: 1.5, borderRadius: 9 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  calmEmpty: { flexDirection: 'row' as const, gap: 12, alignItems: 'center' as const, marginBottom: 20 },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  tripIcon: { width: 45, height: 45, borderRadius: 16, justifyContent: 'center' as const, alignItems: 'center' as const },
  recentIcon: { width: 38, height: 38, borderRadius: 13, justifyContent: 'center' as const, alignItems: 'center' as const },
  quickLink: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  quickIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
};
