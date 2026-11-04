import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, BackButton, ErrorMessage, Field, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { LocalDateField, zonedDateTimeToIso } from '@/components/local-date-field';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';
import type { Trip } from '@/lib/types';

function localDateOffset(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function tripDates(trip: Trip) {
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: trip.timezone }).format(new Date(value));
  return `${format(trip.starts_at)} – ${format(trip.ends_at)}`;
}

export default function TripsScreen() {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['trips'], queryFn: api.trips });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(localDateOffset(1));
  const [endDate, setEndDate] = useState(localDateOffset(4));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const create = useMutation({
    mutationFn: () => {
      setFormError(null);
      const starts_at = zonedDateTimeToIso(startDate, '09:00', zone);
      const ends_at = zonedDateTimeToIso(endDate, '18:00', zone);
      if (!title.trim() || !destination.trim()) throw new Error('Add a trip name and destination.');
      if (!starts_at || !ends_at || new Date(ends_at) <= new Date(starts_at)) throw new Error('Choose valid dates. The return date must be after departure.');
      return api.createTrip({ title: title.trim(), destination: destination.trim(), starts_at, ends_at, timezone: zone, notes: notes.trim() });
    },
    onSuccess: (trip) => {
      client.invalidateQueries({ queryKey: ['trips'] });
      setAdding(false);
      setTitle(''); setDestination(''); setNotes(''); setStartDate(localDateOffset(1)); setEndDate(localDateOffset(4));
      router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } });
    },
    onError: (cause) => setFormError(cause instanceof Error ? cause.message : 'Could not save this trip.'),
  });

  return (
    <Screen>
      <BackButton title="Life" onPress={() => router.replace('/(app)/life')} />
      <TextBlock size="eyebrow" color={colors.accent}>TRAVEL, KEPT TOGETHER</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7 }}>Your trips</TextBlock>
      <TextBlock color={colors.secondary} style={{ marginTop: 7, marginBottom: 22 }}>Keep bookings, travel notes and a short preparation list in one place.</TextBlock>

      {adding ? <Surface style={{ gap: 14, marginBottom: 22 }}>
        <TextBlock size="subheading" style={{ fontWeight: '600' }}>Plan a trip</TextBlock>
        <Field label="Trip name" value={title} onChangeText={setTitle} placeholder="A week in Berlin" />
        <Field label="Destination" value={destination} onChangeText={setDestination} placeholder="Berlin, Germany" />
        <LocalDateField label="Departure date" value={startDate} onChange={setStartDate} />
        <LocalDateField label="Return date" value={endDate} onChange={setEndDate} />
        <TextBlock size="small" color={colors.secondary}>Dates use your current time zone ({zone}). Add flight times in the booking details if they use another zone.</TextBlock>
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything to remember before you go" multiline />
        <ErrorMessage message={formError} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><ActionButton title="Cancel" variant="secondary" onPress={() => { setAdding(false); setFormError(null); }} /></View>
          <View style={{ flex: 1 }}><ActionButton title="Save trip" onPress={() => create.mutate()} busy={create.isPending} disabled={!title.trim() || !destination.trim()} /></View>
        </View>
      </Surface> : <View style={{ marginBottom: 22 }}><ActionButton title="Plan a trip" onPress={() => setAdding(true)} /></View>}

      <SectionHeading title="Upcoming and saved" />
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading your trips…</TextBlock>
        : query.isError ? <Surface style={{ gap: 12 }}><TextBlock color={colors.danger}>{query.error.message}</TextBlock><ActionButton title="Try again" variant="secondary" onPress={() => query.refetch()} /></Surface>
          : query.data?.length ? <View style={{ gap: 10 }}>{query.data.map((trip) => <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`Open ${trip.title} in ${trip.destination}`} onPress={() => router.push({ pathname: '/(app)/trips/[id]', params: { id: trip.id } })}>
            <Surface style={{ gap: 6 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><TextBlock size="subheading" style={{ flex: 1, fontWeight: '600' }}>{trip.title}</TextBlock><TextBlock color={colors.accent}>›</TextBlock></View><TextBlock color={colors.secondary}>{trip.destination} · {tripDates(trip)}</TextBlock><TextBlock size="small" color={colors.secondary}>{trip.bookings.length} booking{trip.bookings.length === 1 ? '' : 's'} · {trip.checklist.filter((item) => item.completed).length}/{trip.checklist.length} preparations done</TextBlock></Surface>
          </Pressable>)}</View>
            : <Surface style={{ gap: 10 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>No trips saved yet.</TextBlock><TextBlock color={colors.secondary}>Add a trip, then attach a booking, save a travel document, and make a preparation list.</TextBlock><ActionButton title="Plan your first trip" onPress={() => setAdding(true)} variant="secondary" /></Surface>}
    </Screen>
  );
}
