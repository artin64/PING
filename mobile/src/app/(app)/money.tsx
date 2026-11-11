import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, Badge, ErrorMessage, PingoIcon, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';
import type { Reminder } from '@/lib/types';

function currency(value: number, code: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value); }
  catch { return `${value.toFixed(2)} ${code}`; }
}

function paymentStatus(item: Reminder) {
  if (item.payment_state === 'overdue') return { label: 'Overdue', tone: 'danger' as const };
  if (item.payment_state === 'due') return { label: 'Due today', tone: 'warning' as const };
  return { label: 'Upcoming', tone: 'neutral' as const };
}

export default function MoneyScreen() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['payments', 'overview'], queryFn: api.paymentOverview });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['reminders'] });
    client.invalidateQueries({ queryKey: ['payments', 'overview'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const complete = useMutation({ mutationFn: api.completeReminder, onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not record this payment.') });
  const snooze = useMutation({ mutationFn: (id: string) => api.snoozeReminder(id), onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not snooze this payment.') });
  const archive = useMutation({ mutationFn: (id: string) => api.updateReminder(id, { status: 'archived' }), onSuccess: () => { setActionError(null); invalidate(); }, onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not archive this payment.') });
  const monthLabel = query.data?.month ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${query.data.month}-15T12:00:00`)) : 'This month';
  const upcomingAmounts = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of query.data?.upcoming ?? []) if (item.amount !== null && item.currency) grouped.set(item.currency, (grouped.get(item.currency) ?? 0) + item.amount);
    return [...grouped.entries()];
  }, [query.data?.upcoming]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.goldSoft }]}><PingoIcon name="money" size={21} color={colors.gold} /></View>
        <View style={{ flex: 1 }}><TextBlock size="eyebrow" color={colors.gold}>BILL GUARD</TextBlock><TextBlock size="title" style={{ marginTop: 4 }}>Money</TextBlock></View>
        <Pressable onPress={() => router.push('/capture?type=payment')} accessibilityRole="button" accessibilityLabel="Add payment reminder" style={[styles.smallAdd, { backgroundColor: colors.accentSolid }]}><PingoIcon name="add" size={21} color={colors.onAccent} /></Pressable>
      </View>
      <TextBlock color={colors.secondary} style={{ marginTop: -6, marginBottom: 18 }}>Know what’s due. Keep a clear record of what you’ve paid.</TextBlock>

      <View style={[styles.overview, { backgroundColor: colors.hero }]}>
        <View style={styles.overviewTop}>
          <View style={styles.monthPill}><PingoIcon name="chart" size={14} color="#FFD276" /><TextBlock size="eyebrow" color="#D1DFEC">{monthLabel.toUpperCase()}</TextBlock></View>
          <PingoIcon name="receipt" size={18} color="#B5C6D8" />
        </View>
        <TextBlock size="small" color="#B5C6D8" style={{ marginTop: 19 }}>Payments you’ve marked as paid</TextBlock>
        {query.isLoading ? <TextBlock color="#FFFFFF" style={{ marginTop: 6 }}>Loading your overview…</TextBlock>
          : query.isError ? <TextBlock color="#FFB1AD" style={{ marginTop: 6 }}>Your payment overview could not load.</TextBlock>
            : query.data?.month_paid.length ? <View style={styles.amountGroup}>
              {query.data.month_paid.map((item) => <View key={item.currency} style={{ flex: 1, minWidth: 130 }}>
                <TextBlock style={{ color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '700', letterSpacing: -0.5 }}>{currency(item.amount, item.currency)}</TextBlock>
                <TextBlock size="small" color="#B5C6D8" style={{ marginTop: 2 }}>{item.count} payment{item.count === 1 ? '' : 's'} recorded</TextBlock>
              </View>)}
            </View> : <TextBlock size="heading" color="#FFFFFF" style={{ marginTop: 7 }}>No payments recorded yet</TextBlock>}
        <View style={styles.overviewFoot}>
          <PingoIcon name="security" size={14} color="#B5C6D8" />
          <TextBlock size="small" color="#B5C6D8">Amounts stay separate by currency · No bank connection</TextBlock>
        </View>
      </View>

      <View style={styles.metrics}>
        <Surface style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: colors.warningSoft }]}><PingoIcon name="clock" size={17} color={colors.warning} /></View>
          <TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 11 }}>UPCOMING</TextBlock>
          <TextBlock size="heading" style={{ marginTop: 2 }}>{query.data?.upcoming.length ?? '—'}</TextBlock>
        </Surface>
        <Surface style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: colors.blueSoft }]}><PingoIcon name="receipt" size={17} color={colors.blue} /></View>
          <TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 11 }}>KNOWN AMOUNTS DUE</TextBlock>
          {upcomingAmounts.length ? <TextBlock size="small" style={{ fontWeight: '700', marginTop: 3 }}>{upcomingAmounts.map(([code, value]) => currency(value, code)).join(' · ')}</TextBlock>
            : <TextBlock size="small" color={colors.secondary} style={{ marginTop: 5 }}>Not set</TextBlock>}
        </Surface>
      </View>

      <SectionHeading title="Upcoming payments" style={{ marginTop: 23 }} action={<Pressable onPress={() => router.push('/capture?type=payment')} accessibilityRole="button" style={styles.sectionAction}><TextBlock size="small" color={colors.accent}>+ Add bill</TextBlock></Pressable>} />
      <ErrorMessage message={actionError} />
      {query.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Loading payments…</TextBlock></Surface>
        : query.isError ? <Surface style={{ gap: 12 }}><TextBlock size="small" color={colors.danger}>{query.error.message}</TextBlock><ActionButton title="Retry" variant="secondary" onPress={() => query.refetch()} /></Surface>
          : query.data?.upcoming.length ? <View style={{ gap: 10 }}>
            {query.data.upcoming.map((item) => {
              const status = paymentStatus(item);
              return <Surface key={item.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.paymentIcon, { backgroundColor: colors.goldSoft }]}><PingoIcon name="receipt" size={19} color={colors.gold} /></View>
                  <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }} numberOfLines={1}>{item.title}</TextBlock>
                    <TextBlock size="small" color={colors.secondary}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.due_at))}{item.amount !== null && item.currency ? ` · ${currency(item.amount, item.currency)}` : ''}</TextBlock>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.title} as paid`} disabled={complete.isPending} onPress={() => complete.mutate({ id: item.id, due_at: item.due_at })} style={({ pressed }) => [styles.paidButton, { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.65 }]}>
                    <PingoIcon name="check" size={15} color={colors.accent} /><TextBlock size="small" color={colors.accent} style={{ fontWeight: '700' }}>{complete.isPending && complete.variables?.id === item.id ? 'Saving' : 'Paid'}</TextBlock>
                  </Pressable>
                </View>
                {item.recurrence !== 'none' ? <TextBlock size="small" color={colors.secondary}>{item.recurrence.charAt(0).toUpperCase() + item.recurrence.slice(1)} · recurring</TextBlock> : null}
                <View style={[styles.rowActions, { borderTopColor: colors.border }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => router.push({ pathname: '/(app)/reminders/[id]', params: { id: item.id } })} style={styles.actionLink}><TextBlock size="small" color={colors.secondary}>Edit</TextBlock></Pressable>
                  {item.recurrence === 'none' ? <Pressable accessibilityRole="button" accessibilityLabel={`Snooze ${item.title} for one day`} onPress={() => snooze.mutate(item.id)} style={styles.actionLink}><TextBlock size="small" color={colors.accent}>{snooze.isPending && snooze.variables === item.id ? 'Snoozing…' : 'Snooze 1 day'}</TextBlock></Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Archive ${item.title}`} onPress={() => archive.mutate(item.id)} style={styles.actionLink}><TextBlock size="small" color={colors.secondary}>Archive</TextBlock></Pressable>
                </View>
              </Surface>;
            })}
          </View> : <Surface style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}><PingoIcon name="receipt" size={21} color={colors.secondary} /></View>
            <TextBlock size="subheading" style={{ fontWeight: '600' }}>No bills tracked yet</TextBlock>
            <TextBlock color={colors.secondary} style={{ textAlign: 'center' }}>Add a due date and amount if you know it. PINGO keeps each currency separate.</TextBlock>
            <View style={{ width: '100%' }}><ActionButton title="Add a payment reminder" icon="add" onPress={() => router.push('/capture?type=payment')} /></View>
          </Surface>}

      <SectionHeading title="Payment history" style={{ marginTop: 25 }} />
      {query.data?.history.length ? <View style={{ gap: 8 }}>{query.data.history.map((item) => <Surface key={item.id} style={styles.historyRow}>
        <View style={[styles.historyIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="check" size={17} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 3 }}><TextBlock style={{ fontWeight: '600' }}>{item.amount !== null && item.currency ? currency(item.amount, item.currency) : 'Payment marked paid'}</TextBlock>
          <TextBlock size="small" color={colors.secondary}>Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.due_at))} · Paid {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.paid_at))}</TextBlock></View>
      </Surface>)}</View> : <TextBlock size="small" color={colors.secondary}>Your confirmed payments will appear here.</TextBlock>}
      <View style={{ marginTop: 19 }}><ActionButton title="Add a payment reminder" icon="add" onPress={() => router.push('/capture?type=payment')} /></View>
    </Screen>
  );
}

const styles = {
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 11 },
  headerIcon: { width: 47, height: 47, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  smallAdd: { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  overview: { borderRadius: 25, padding: 20, overflow: 'hidden' as const },
  overviewTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  monthPill: { flexDirection: 'row' as const, gap: 7, alignItems: 'center' as const },
  amountGroup: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 14, marginTop: 5 },
  overviewFoot: { borderTopWidth: 1, borderTopColor: '#294057', paddingTop: 13, marginTop: 17, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7 },
  metrics: { flexDirection: 'row' as const, gap: 10, marginTop: 12 },
  metricCard: { flex: 1, minWidth: 0, padding: 14 },
  metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  sectionAction: { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: 5 },
  paymentIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  paidButton: { minHeight: 44, borderRadius: 22, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingHorizontal: 12 },
  rowActions: { borderTopWidth: 1, flexDirection: 'row' as const, justifyContent: 'flex-end' as const, alignItems: 'center' as const, gap: 8, marginTop: 2, paddingTop: 6 },
  actionLink: { minHeight: 44, minWidth: 58, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 5 },
  emptyCard: { alignItems: 'center' as const, gap: 12, paddingVertical: 23 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const },
  historyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 13 },
  historyIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const },
};
