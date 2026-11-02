import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, ErrorMessage, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

export default function MoneyScreen() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['payments', 'overview'], queryFn: api.paymentOverview });
  const complete = useMutation({ mutationFn: api.completeReminder, onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['payments', 'overview'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not record this payment.') });
  const snooze = useMutation({ mutationFn: (id: string) => api.snoozeReminder(id), onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['payments', 'overview'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not snooze this payment.') });
  const archive = useMutation({ mutationFn: (id: string) => api.updateReminder(id, { status: 'archived' }), onSuccess: () => {
    setActionError(null);
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['payments', 'overview'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
  }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not archive this payment.') });
  const monthLabel = query.data?.month
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${query.data.month}-15T12:00:00`))
    : 'This month';
  return (
    <Screen>
      <TextBlock size="eyebrow" color={colors.accent}>BILL GUARD</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7 }}>Money</TextBlock>
      <TextBlock color={colors.secondary} style={{ marginTop: 7, marginBottom: 22 }}>A clear view of the payments you choose to track.</TextBlock>
      <Surface style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, marginBottom: 24, gap: 8 }}>
        <TextBlock size="eyebrow" color={colors.accent}>{monthLabel.toUpperCase()}</TextBlock>
        <TextBlock size="subheading" style={{ fontWeight: '600' }}>Payments you’ve marked paid</TextBlock>
        {query.data?.month_paid.length ? query.data.month_paid.map((item) => <TextBlock key={item.currency} size="small" color={colors.secondary}>
          {item.currency}: {item.amount.toFixed(2)} known amount{item.amount_count === 1 ? '' : 's'} · {item.count} payment{item.count === 1 ? '' : 's'} recorded
        </TextBlock>) : <TextBlock size="small" color={colors.secondary}>No payments marked paid this month yet.</TextBlock>}
        <TextBlock size="small" color={colors.secondary}>Amounts stay separate by currency. PINGO never connects to a bank.</TextBlock>
      </Surface>
      <SectionHeading title="Upcoming payments" />
      <ErrorMessage message={actionError} />
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading payments…</TextBlock>
        : query.isError ? <Surface><TextBlock color={colors.danger}>{query.error.message}</TextBlock><View style={{ marginTop: 12 }}><ActionButton title="Retry" variant="secondary" onPress={() => query.refetch()} /></View></Surface>
          : query.data?.upcoming.length ? <View style={{ gap: 10 }}>{query.data.upcoming.map((item) => <Surface key={item.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.due_at))}{item.amount !== null ? ` · ${item.amount.toFixed(2)} ${item.currency}` : ''}</TextBlock>{item.payment_state !== 'upcoming' ? <TextBlock size="small" color={item.payment_state === 'overdue' ? colors.danger : colors.accent}>{item.payment_state === 'overdue' ? 'Overdue' : 'Due today'}</TextBlock> : null}{item.recurrence !== 'none' ? <TextBlock size="small" color={colors.accent}>{item.recurrence.charAt(0).toUpperCase() + item.recurrence.slice(1)} · next due</TextBlock> : null}</View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.title} as paid`} disabled={complete.isPending} onPress={() => complete.mutate(item.id)} style={{ minHeight: 48, minWidth: 54, alignItems: 'center', justifyContent: 'center', opacity: complete.isPending ? 0.5 : 1 }}><TextBlock size="small" color={colors.accent}>Paid</TextBlock></Pressable></View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => router.push({ pathname: '/(app)/reminders/[id]', params: { id: item.id } })} style={{ minHeight: 44, minWidth: 56, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.secondary}>Edit</TextBlock></Pressable>
              {item.recurrence === 'none' ? <Pressable accessibilityRole="button" accessibilityLabel={`Snooze ${item.title} for one day`} onPress={() => snooze.mutate(item.id)} style={{ minHeight: 44, minWidth: 94, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.accent}>Snooze 1 day</TextBlock></Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Archive ${item.title}`} onPress={() => archive.mutate(item.id)} style={{ minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' }}><TextBlock size="small" color={colors.secondary}>Archive</TextBlock></Pressable>
            </View>
          </Surface>)}</View>
            : <Surface style={{ gap: 10 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>No payments tracked yet.</TextBlock><TextBlock color={colors.secondary}>Save a bill due date to see it here. No bank connection or balance is needed.</TextBlock></Surface>}
      <SectionHeading title="Payment history" />
      {query.data?.history.length ? <View style={{ gap: 8 }}>{query.data.history.map((item) => <Surface key={item.id} style={{ gap: 4 }}>
        <TextBlock style={{ fontWeight: '600' }}>{item.amount !== null ? `${item.amount.toFixed(2)} ${item.currency}` : 'Payment marked paid'}</TextBlock>
        <TextBlock size="small" color={colors.secondary}>Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.due_at))} · Paid {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.paid_at))}</TextBlock>
      </Surface>)}</View> : <TextBlock size="small" color={colors.secondary}>Your confirmed payment history will appear here.</TextBlock>}
      <View style={{ marginTop: 18 }}><ActionButton title="Add a payment reminder" onPress={() => router.push('/capture?type=payment')} /></View>
    </Screen>
  );
}
