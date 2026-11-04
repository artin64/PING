import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, Badge, ErrorMessage, PingoIcon, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';
import type { Reminder } from '@/lib/types';

type Filter = 'all' | 'deadline' | 'appointment' | 'trip';
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'deadline', label: 'Deadlines' }, { key: 'appointment', label: 'Appointments' }, { key: 'trip', label: 'Travel reminders' },
];

function deadlineStatus(item: Reminder) {
  const due = new Date(item.due_at);
  const now = new Date();
  if (due < now) return { label: 'Overdue', tone: 'danger' as const };
  if (due.toDateString() === now.toDateString()) return { label: 'Today', tone: 'warning' as const };
  return { label: item.recurrence === 'none' ? 'Upcoming' : `${item.recurrence} reminder`, tone: 'neutral' as const };
}

export default function LifeScreen() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['reminders'], queryFn: () => api.reminders() });
  const tripsQuery = useQuery({ queryKey: ['trips'], queryFn: api.trips });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    client.invalidateQueries({ queryKey: ['trips'] });
    client.invalidateQueries({ queryKey: ['payments', 'overview'] });
  };
  const complete = useMutation({ mutationFn: api.completeReminder, onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not complete this reminder.') });
  const snooze = useMutation({ mutationFn: (id: string) => api.snoozeReminder(id), onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not snooze this reminder.') });
  const archive = useMutation({ mutationFn: (id: string) => api.updateReminder(id, { status: 'archived' }), onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not archive this reminder.') });
  const reminders = query.data?.filter((item) => item.kind !== 'payment') ?? [];
  const visible = reminders.filter((item) => filter === 'all' || item.kind === filter);
  const deadlines = reminders.filter((item) => item.kind === 'deadline').length;
  const trips = tripsQuery.data ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}><TextBlock size="eyebrow" color={colors.accent}>DEADLINES · APPOINTMENTS · TRAVEL</TextBlock><TextBlock size="title" style={{ marginTop: 5 }}>Life</TextBlock></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a reminder" onPress={() => router.push('/capture?type=deadline')} style={[styles.addButton, { backgroundColor: colors.accentSolid }]}><PingoIcon name="add" size={21} color={colors.onAccent} /></Pressable>
      </View>
      <TextBlock color={colors.secondary} style={{ marginTop: -7, marginBottom: 17 }}>Important dates and plans, kept within reach.</TextBlock>

      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <View style={styles.heroOrb} />
        <View style={styles.heroHeader}><PingoIcon name="life" size={16} color="#00D68F" /><TextBlock size="eyebrow" color="#B5C6D8">YOUR LIFE, IN ONE PLACE</TextBlock></View>
        <TextBlock size="heading" color="#FFFFFF" style={{ marginTop: 15 }}>
          {query.isLoading || tripsQuery.isLoading ? 'Gathering your plans…'
            : query.isError && tripsQuery.isError ? 'Your plans are ready when you are.'
              : reminders.length + trips.length === 0 ? 'Nothing to follow up on yet.'
                : `${reminders.length + trips.length} dates and plans to keep in view`}
        </TextBlock>
        <TextBlock size="small" color="#B5C6D8" style={{ marginTop: 5 }}>Documents, dates and trips you’ve chosen to save.</TextBlock>
        <View style={styles.heroStats}>
          <View style={styles.stat}><TextBlock color="#00D68F" style={{ fontSize: 22, lineHeight: 27, fontWeight: '700' }}>{query.isLoading ? '—' : deadlines}</TextBlock><TextBlock size="eyebrow" color="#B5C6D8">DEADLINES</TextBlock></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><TextBlock color="#00D68F" style={{ fontSize: 22, lineHeight: 27, fontWeight: '700' }}>{tripsQuery.isLoading ? '—' : trips.length}</TextBlock><TextBlock size="eyebrow" color="#B5C6D8">TRIPS</TextBlock></View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={styles.tripAction}><PingoIcon name="flight" size={15} color="#07111F" /><TextBlock size="small" color="#07111F" style={{ fontWeight: '700' }}>Plan a trip</TextBlock></Pressable>
        </View>
      </View>

      <View style={styles.shortcutRow}>
        <Pressable onPress={() => router.push('/capture?type=deadline')} accessibilityRole="button" style={[styles.shortcut, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.shortcutIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="document" size={19} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><TextBlock size="small" style={{ fontWeight: '600' }}>Document date</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 3 }}>EXPIRATIONS</TextBlock></View>
          <PingoIcon name="chevron" size={15} color={colors.secondary} />
        </Pressable>
        <Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={[styles.shortcut, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.shortcutIcon, { backgroundColor: colors.surfaceMuted }]}><PingoIcon name="flight" size={19} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><TextBlock size="small" style={{ fontWeight: '600' }}>Travel plans</TextBlock><TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 3 }}>TRIPS</TextBlock></View>
          <PingoIcon name="chevron" size={15} color={colors.secondary} />
        </Pressable>
      </View>

      <SectionHeading title="Your reminders" style={{ marginTop: 23 }} action={<Pressable onPress={() => router.push('/capture?type=deadline')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>+ Add</TextBlock></Pressable>} />
      <View style={styles.filters}>
        {filters.map((item) => {
          const active = filter === item.key;
          return <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filter, { backgroundColor: active ? colors.accentSolid : colors.surface, borderColor: active ? colors.accentSolid : colors.border }]}>
            <TextBlock size="small" color={active ? colors.onAccent : colors.secondary} style={{ fontWeight: active ? '700' : '500' }}>{item.label}</TextBlock>
          </Pressable>;
        })}
      </View>
      <ErrorMessage message={actionError} />
      {query.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Loading your reminders…</TextBlock></Surface>
        : query.isError ? <Surface style={{ gap: 12 }}><TextBlock size="small" color={colors.danger}>{query.error.message}</TextBlock><ActionButton title="Retry" variant="secondary" onPress={() => query.refetch()} /></Surface>
          : visible.length ? <View style={{ gap: 10 }}>
            {visible.map((item) => {
              const status = deadlineStatus(item);
              return <Surface key={item.id} style={{ gap: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.reminderIcon, { backgroundColor: item.kind === 'trip' ? colors.accentSoft : colors.surfaceMuted }]}><PingoIcon name={item.kind === 'trip' ? 'flight' : 'reminder'} size={19} color={colors.accent} /></View>
                  <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }} numberOfLines={1}>{item.title}</TextBlock>
                    <TextBlock size="small" color={colors.secondary}>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.due_at))}</TextBlock>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Complete ${item.title}`} disabled={complete.isPending} onPress={() => complete.mutate(item.id)} style={({ pressed }) => [styles.doneButton, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.7 }]}>
                    <PingoIcon name="check" size={15} color={colors.accent} /><TextBlock size="small" color={colors.accent} style={{ fontWeight: '700' }}>{complete.isPending && complete.variables === item.id ? 'Saving' : 'Done'}</TextBlock>
                  </Pressable>
                </View>
                {item.note ? <TextBlock size="small" color={colors.secondary}>{item.note}</TextBlock> : null}
                <View style={[styles.rowActions, { borderTopColor: colors.border }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => router.push({ pathname: '/(app)/reminders/[id]', params: { id: item.id } })} style={styles.actionLink}><TextBlock size="small" color={colors.secondary}>Edit</TextBlock></Pressable>
                  {item.recurrence === 'none' ? <Pressable accessibilityRole="button" accessibilityLabel={`Snooze ${item.title} for one day`} onPress={() => snooze.mutate(item.id)} style={styles.actionLink}><TextBlock size="small" color={colors.accent}>{snooze.isPending && snooze.variables === item.id ? 'Snoozing…' : 'Snooze 1 day'}</TextBlock></Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Archive ${item.title}`} onPress={() => archive.mutate(item.id)} style={styles.actionLink}><TextBlock size="small" color={colors.secondary}>Archive</TextBlock></Pressable>
                </View>
              </Surface>;
            })}
          </View> : <Surface style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}><PingoIcon name="check" size={21} color={colors.accent} /></View>
            <TextBlock size="subheading" style={{ fontWeight: '600' }}>{reminders.length ? 'Nothing in this view' : 'Your list is clear'}</TextBlock>
            <TextBlock color={colors.secondary} style={{ textAlign: 'center' }}>{reminders.length ? 'Choose another filter to see your saved reminders.' : 'Add an appointment, document date, or travel reminder when you need one.'}</TextBlock>
            {!reminders.length ? <View style={{ width: '100%' }}><ActionButton title="Add a reminder" icon="add" onPress={() => router.push('/capture?type=deadline')} /></View> : null}
          </Surface>}

      <SectionHeading title="Travel" style={{ marginTop: 25 }} action={<Pressable onPress={() => router.push('/(app)/trips')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>All trips</TextBlock></Pressable>} />
      {tripsQuery.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Checking your trips…</TextBlock></Surface>
        : tripsQuery.isError ? <Surface style={{ gap: 10 }}><TextBlock size="small" color={colors.danger}>{tripsQuery.error.message}</TextBlock><ActionButton title="Retry trips" variant="secondary" onPress={() => tripsQuery.refetch()} /></Surface>
          : trips.length ? <View style={{ gap: 9 }}>{trips.slice(0, 3).map((trip) => <Pressable key={trip.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } })}>
            <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.tripIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="flight" size={20} color={colors.accent} /></View>
              <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{trip.destination}</TextBlock><TextBlock size="small" color={colors.secondary}>{trip.title} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: trip.timezone }).format(new Date(trip.starts_at))}</TextBlock></View>
              <PingoIcon name="chevron" size={16} color={colors.secondary} />
            </Surface>
          </Pressable>)}</View> : <Surface style={{ gap: 10 }}>
            <TextBlock size="small" color={colors.secondary}>Save trip dates, bookings and preparation items together.</TextBlock>
            <ActionButton title="Create a trip" variant="secondary" icon="flight" onPress={() => router.push('/(app)/trips')} />
          </Surface>}
    </Screen>
  );
}

const styles = {
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  addButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center' as const, alignItems: 'center' as const },
  hero: { borderRadius: 25, padding: 19, overflow: 'hidden' as const },
  heroOrb: { position: 'absolute' as const, width: 170, height: 170, borderRadius: 85, right: -75, top: -105, backgroundColor: '#173653', opacity: 0.8 },
  heroHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  heroStats: { borderTopWidth: 1, borderTopColor: '#294057', marginTop: 17, paddingTop: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  stat: { gap: 2 },
  statDivider: { width: 1, height: 33, backgroundColor: '#294057' },
  tripAction: { minHeight: 36, borderRadius: 18, backgroundColor: '#00D68F', paddingHorizontal: 11, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  shortcutRow: { flexDirection: 'row' as const, gap: 9, marginTop: 11 },
  shortcut: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 18, padding: 11, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  shortcutIcon: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center' as const, alignItems: 'center' as const },
  sectionAction: { minHeight: 40, justifyContent: 'center' as const, paddingHorizontal: 5 },
  filters: { flexDirection: 'row' as const, gap: 7, marginBottom: 13, flexWrap: 'wrap' as const },
  filter: { minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  reminderIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  doneButton: { minHeight: 36, borderRadius: 18, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10 },
  rowActions: { borderTopWidth: 1, marginTop: 2, paddingTop: 5, flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8 },
  actionLink: { minHeight: 36, minWidth: 58, justifyContent: 'center' as const, alignItems: 'center' as const },
  emptyCard: { alignItems: 'center' as const, gap: 11, paddingVertical: 24 },
  emptyIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  tripIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
};
