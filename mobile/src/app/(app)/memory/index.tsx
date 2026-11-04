import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ActionButton, ErrorMessage, Field, PingoIcon, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { PrivateImage } from '@/components/private-image';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import type { Capture, Reminder, Trip } from '@/lib/types';

type Filter = 'all' | Capture['kind'];
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'document', label: 'Documents' }, { key: 'screenshot', label: 'Photos' },
  { key: 'link', label: 'Links' }, { key: 'note', label: 'Notes' },
];

function MemoryCard({ item }: { item: Capture }) {
  const colors = usePingoTheme();
  const token = useSession((state) => state.token);
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.created_at));
  const icon = item.kind === 'document' ? 'document' : item.kind === 'screenshot' ? 'photo' : item.kind === 'link' ? 'link' : 'note';
  return (
    <Pressable style={styles.memoryCard} onPress={() => router.push(`/(app)/memory/${item.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
      <Surface style={{ padding: 0, overflow: 'hidden' }}>
        {item.attachment_url && item.kind === 'screenshot' ? <PrivateImage path={item.attachment_url} token={token} style={styles.preview} resizeMode="cover" />
          : <View style={[styles.preview, { backgroundColor: item.kind === 'document' ? colors.accentSoft : colors.surfaceMuted }]}>
            <View style={[styles.previewIcon, { backgroundColor: colors.surface }]}><PingoIcon name={icon} size={23} color={colors.accent} /></View>
            <TextBlock size="eyebrow" color={colors.secondary}>{item.kind === 'document' ? 'PRIVATE PDF' : item.kind.toUpperCase()}</TextBlock>
          </View>}
        <View style={styles.cardBody}>
          <TextBlock size="small" style={{ fontWeight: '600' }} numberOfLines={2}>{item.title}</TextBlock>
          <TextBlock size="small" color={colors.secondary} numberOfLines={2} style={{ minHeight: 34, marginTop: 5 }}>{item.summary || item.extracted_text || item.body || item.source_url || 'Saved to your memory'}</TextBlock>
          <TextBlock size="eyebrow" color={colors.secondary} style={{ marginTop: 8 }}>{date.toUpperCase()}</TextBlock>
        </View>
      </Surface>
    </Pressable>
  );
}

function ReminderResult({ item }: { item: Reminder }) {
  const colors = usePingoTheme();
  const due = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.due_at));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push(item.kind === 'payment' ? '/(app)/money' : '/(app)/life')}>
      <Surface style={styles.resultRow}>
        <View style={[styles.resultIcon, { backgroundColor: item.kind === 'payment' ? colors.accentSoft : colors.surfaceMuted }]}><PingoIcon name={item.kind === 'payment' ? 'receipt' : 'reminder'} size={19} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{item.kind} · {due}{item.note ? ` · ${item.note}` : ''}</TextBlock></View>
        <PingoIcon name="chevron" size={16} color={colors.secondary} />
      </Surface>
    </Pressable>
  );
}

function TripResult({ item }: { item: Trip }) {
  const colors = usePingoTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open trip to ${item.destination}`} onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: item.id } })}>
      <Surface style={styles.resultRow}>
        <View style={[styles.resultIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="flight" size={19} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{item.destination} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: item.timezone }).format(new Date(item.starts_at))}</TextBlock></View>
        <PingoIcon name="chevron" size={16} color={colors.secondary} />
      </Surface>
    </Pressable>
  );
}

export default function MemoryScreen() {
  const colors = usePingoTheme();
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 260);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['captures', 'global-search', queryText],
    queryFn: async () => queryText ? api.search(queryText) : { captures: await api.captures(), reminders: [] as Reminder[], trips: [] as Trip[] },
  });

  const captures = (query.data?.captures ?? []).filter((item) => filter === 'all' || item.kind === filter);
  const extraCount = (query.data?.reminders.length ?? 0) + (query.data?.trips.length ?? 0);
  const total = (query.data?.captures.length ?? 0) + extraCount;

  return (
    <Screen>
      <View style={styles.headerLine}>
        <View style={{ flex: 1 }}><TextBlock size="eyebrow" color={colors.accent}>YOUR PERSONAL LIBRARY</TextBlock><TextBlock size="title" style={{ marginTop: 6 }}>Memory</TextBlock></View>
        <View style={[styles.countBadge, { backgroundColor: colors.accentSoft }]}><TextBlock size="small" color={colors.accent} style={{ fontWeight: '700' }}>{query.data?.captures.length ?? '—'}</TextBlock></View>
      </View>
      <TextBlock color={colors.secondary} style={{ marginTop: -7, marginBottom: 19 }}>A private place for the details you’ll want again.</TextBlock>

      <Field label="Search your PINGO" value={search} onChangeText={setSearch} placeholder="A place, date, amount or detail…" left={<PingoIcon name="search" size={19} color={colors.secondary} />} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => {
          const active = filter === item.key;
          return <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filterChip, { backgroundColor: active ? colors.accentSolid : colors.surface, borderColor: active ? colors.accentSolid : colors.border }]}>
            <TextBlock size="small" color={active ? colors.onAccent : colors.secondary} style={{ fontWeight: active ? '700' : '500' }}>{item.label}</TextBlock>
          </Pressable>;
        })}
      </ScrollView>

      <View style={styles.savedHeading}>
        <TextBlock size="small" color={colors.secondary}>{queryText ? `${total} result${total === 1 ? '' : 's'} for “${queryText}”` : `${query.data?.captures.length ?? 0} saved item${query.data?.captures.length === 1 ? '' : 's'}`}</TextBlock>
        <Pressable onPress={() => router.push('/capture')} accessibilityRole="button" style={styles.addAction}><PingoIcon name="add" size={16} color={colors.accent} /><TextBlock size="small" color={colors.accent} style={{ fontWeight: '600' }}>Add</TextBlock></Pressable>
      </View>

      {query.isLoading ? <Surface><TextBlock size="small" color={colors.secondary}>Finding your saved items…</TextBlock></Surface>
        : query.isError ? <><ErrorMessage message={query.error.message} /><View style={{ marginTop: 12 }}><ActionButton title="Try again" variant="secondary" onPress={() => query.refetch()} /></View></>
          : total ? <>
            {captures.length ? <View style={styles.grid}>{captures.map((item) => <MemoryCard key={item.id} item={item} />)}</View>
              : query.data?.captures.length ? <Surface style={{ marginBottom: 15 }}><TextBlock size="small" color={colors.secondary}>No {filter === 'screenshot' ? 'photos' : `${filter}s`} in this result. Try another category.</TextBlock></Surface> : null}
            {queryText && query.data?.reminders.length ? <><SectionHeading title="Reminders" style={{ marginTop: 17 }} /><View style={{ gap: 9 }}>{query.data.reminders.map((item) => <ReminderResult key={item.id} item={item} />)}</View></> : null}
            {queryText && query.data?.trips.length ? <><SectionHeading title="Trips" style={{ marginTop: 19 }} /><View style={{ gap: 9 }}>{query.data.trips.map((item) => <TripResult key={item.id} item={item} />)}</View></> : null}
          </> : <Surface style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="memory" size={23} color={colors.accent} /></View>
            <TextBlock size="subheading" style={{ fontWeight: '600', textAlign: 'center' }}>{queryText ? 'Nothing saved matches that search.' : 'Your memory starts here.'}</TextBlock>
            <TextBlock color={colors.secondary} style={{ textAlign: 'center' }}>{queryText ? 'Try another name, place, or word from your saved item.' : 'Save a screenshot, document, link, or note. PINGO keeps it together and searchable.'}</TextBlock>
            {!queryText ? <View style={{ width: '100%' }}><ActionButton title="Save your first memory" icon="add" onPress={() => router.push('/capture')} /></View> : null}
          </Surface>}
    </Screen>
  );
}

const styles = {
  headerLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  countBadge: { minWidth: 40, height: 40, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 9 },
  filters: { gap: 8, paddingVertical: 16 },
  filterChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  savedHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
  addAction: { minHeight: 40, paddingHorizontal: 6, flexDirection: 'row' as const, gap: 4, alignItems: 'center' as const },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'space-between' as const, rowGap: 10 },
  memoryCard: { width: '48%' as const, marginBottom: 1 },
  preview: { width: '100%' as const, height: 104, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  previewIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardBody: { padding: 12 },
  resultRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  resultIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  emptyState: { alignItems: 'center' as const, gap: 13, paddingVertical: 27, marginTop: 7 },
  emptyIcon: { width: 54, height: 54, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const },
};
