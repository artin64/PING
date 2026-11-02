import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, ErrorMessage, Field, Screen, Surface, TextBlock } from '@/components/ui';
import { PrivateImage } from '@/components/private-image';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';
import type { Capture, Reminder, Trip } from '@/lib/types';

function MemoryItem({ item }: { item: Capture }) {
  const colors = usePingoTheme();
  const token = useSession((state) => state.token);
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.created_at));
  return (
    <Pressable onPress={() => router.push(`/(app)/memory/${item.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
      <Surface style={{ flexDirection: 'row', gap: 14, padding: 12, alignItems: 'center' }}>
        {item.attachment_url && item.kind === 'screenshot' ? <PrivateImage path={item.attachment_url} token={token} style={{ width: 64, height: 64, borderRadius: 11, backgroundColor: colors.surfaceMuted }} resizeMode="cover" />
          : <View style={{ width: 64, height: 64, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><TextBlock color={colors.accent} style={{ fontSize: 20 }}>{item.kind === 'link' ? '↗' : item.kind === 'document' ? 'PDF' : 'Aa'}</TextBlock></View>}
        <View style={{ flex: 1, gap: 4 }}>
          <TextBlock style={{ fontWeight: '600' }} numberOfLines={1}>{item.title}</TextBlock>
          <TextBlock size="small" color={colors.secondary} numberOfLines={2}>{item.extracted_text || item.body || item.source_url || 'Saved to your memory'}</TextBlock>
          <TextBlock size="eyebrow" color={colors.secondary}>{item.kind.toUpperCase()} · {date.toUpperCase()}</TextBlock>
        </View>
        <TextBlock color={colors.secondary}>›</TextBlock>
      </Surface>
    </Pressable>
  );
}

function ReminderResult({ item }: { item: Reminder }) {
  const colors = usePingoTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push(item.kind === 'payment' ? '/(app)/money' : '/(app)/life')}>
      <Surface style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>{item.kind === 'payment' ? '↻' : '•'}</TextBlock></View>
        <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{item.kind} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.due_at))}{item.note ? ` · ${item.note}` : ''}</TextBlock></View>
      </Surface>
    </Pressable>
  );
}

function TripResult({ item }: { item: Trip }) {
  const colors = usePingoTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open trip to ${item.destination}`} onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: item.id } })}>
      <Surface style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>↗</TextBlock></View>
        <View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{item.destination} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: item.timezone }).format(new Date(item.starts_at))}</TextBlock></View>
      </Surface>
    </Pressable>
  );
}

export default function MemoryScreen() {
  const colors = usePingoTheme();
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['captures', 'global-search', queryText],
    queryFn: async () => queryText ? api.search(queryText) : { captures: await api.captures(), reminders: [] as Reminder[], trips: [] as Trip[] },
  });

  return (
    <Screen>
      <TextBlock size="eyebrow" color={colors.accent}>YOUR PERSONAL LIBRARY</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7, marginBottom: 20 }}>Memory</TextBlock>
      <Field label="Search anything you’ve saved" value={search} onChangeText={setSearch} placeholder="A place, amount, date, or detail…" />
      <View style={{ marginTop: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextBlock size="small" color={colors.secondary}>{queryText ? `Saved items, reminders and trips for “${queryText}”` : `${query.data?.captures.length ?? 0} saved`}</TextBlock>
        <Pressable onPress={() => router.push('/capture')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>+ Add</TextBlock></Pressable>
      </View>
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading saved items…</TextBlock>
        : query.isError ? <><ErrorMessage message={query.error.message} /><ActionButton title="Try again" variant="secondary" onPress={() => query.refetch()} /></>
          : query.data && (query.data.captures.length || query.data.reminders.length || query.data.trips.length) ? <View style={{ gap: 10 }}>{query.data.captures.map((item) => <MemoryItem key={`capture-${item.id}`} item={item} />)}{query.data.reminders.map((item) => <ReminderResult key={`reminder-${item.id}`} item={item} />)}{query.data.trips.map((item) => <TripResult key={`trip-${item.id}`} item={item} />)}</View>
            : <Surface style={{ marginTop: 4, gap: 10 }}>
              <TextBlock size="subheading" style={{ fontWeight: '600' }}>{search ? 'No saved items or reminders match that search.' : 'Your memory starts here.'}</TextBlock>
              <TextBlock color={colors.secondary}>{search ? 'Try a name, place, or a word from the original screenshot.' : 'Save a screenshot, link, or note. PINGO keeps it together so you can find it later.'}</TextBlock>
              {!search ? <ActionButton title="Save something" onPress={() => router.push('/capture')} /> : null}
            </Surface>}
    </Screen>
  );
}
