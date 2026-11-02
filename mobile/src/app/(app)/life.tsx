import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, ErrorMessage, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

export default function LifeScreen() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['reminders'], queryFn: () => api.reminders() });
  const complete = useMutation({ mutationFn: api.completeReminder, onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    client.invalidateQueries({ queryKey: ['trip'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not complete this reminder.') });
  const snooze = useMutation({ mutationFn: (id: string) => api.snoozeReminder(id), onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not snooze this reminder.') });
  const archive = useMutation({ mutationFn: (id: string) => api.updateReminder(id, { status: 'archived' }), onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    client.invalidateQueries({ queryKey: ['trip'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not archive this reminder.') });
  const items = query.data?.filter((item) => item.kind !== 'payment') || [];
  return (
    <Screen>
      <TextBlock size="eyebrow" color={colors.accent}>DEADLINES · APPOINTMENTS · TRIPS</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7 }}>Life</TextBlock>
      <TextBlock color={colors.secondary} style={{ marginTop: 7, marginBottom: 22 }}>Keep the things you need to follow up on in one place.</TextBlock>
      <SectionHeading title="Your reminders" />
      <ErrorMessage message={actionError} />
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading reminders…</TextBlock>
        : query.isError ? <Surface><TextBlock color={colors.danger}>{query.error.message}</TextBlock><View style={{ marginTop: 12 }}><ActionButton title="Retry" variant="secondary" onPress={() => query.refetch()} /></View></Surface>
          : items.length ? <View style={{ gap: 10 }}>{items.map((item) => <Surface key={item.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{item.kind} · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.due_at))}</TextBlock>{item.note ? <TextBlock size="small" color={colors.secondary}>{item.note}</TextBlock> : null}</View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Complete ${item.title}`} onPress={() => complete.mutate(item.id)} style={{ minHeight: 48, minWidth: 52, alignItems: 'center', justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>Done</TextBlock></Pressable></View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => router.push({ pathname: '/(app)/reminders/[id]', params: { id: item.id } })} style={{ minHeight: 44, minWidth: 56, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.secondary}>Edit</TextBlock></Pressable>
              {item.recurrence === 'none' ? <Pressable accessibilityRole="button" accessibilityLabel={`Snooze ${item.title} for one day`} onPress={() => snooze.mutate(item.id)} style={{ minHeight: 44, minWidth: 94, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.accent}>Snooze 1 day</TextBlock></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Archive ${item.title}`} onPress={() => archive.mutate(item.id)} style={{ minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.secondary}>Archive</TextBlock></Pressable>
            </View>
          </Surface>)}</View>
            : <Surface style={{ gap: 10 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>Nothing on your list yet.</TextBlock><TextBlock color={colors.secondary}>Add a document date, appointment, or travel reminder when you need one.</TextBlock></Surface>}
      <View style={{ marginTop: 18 }}><ActionButton title="Add a reminder" onPress={() => router.push('/capture?type=deadline')} /></View>
      <View style={{ marginTop: 24, gap: 10 }}>
        <SectionHeading title="Travel" />
        <Surface style={{ gap: 10 }}>
          <TextBlock style={{ fontWeight: '600' }}>Trips, bookings and preparations</TextBlock>
          <TextBlock size="small" color={colors.secondary}>Keep travel documents, reservation details and a simple checklist together.</TextBlock>
          <ActionButton title="Open trips" variant="secondary" onPress={() => router.push('/(app)/trips')} />
        </Surface>
      </View>
    </Screen>
  );
}
