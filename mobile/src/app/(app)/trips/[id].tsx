import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, BackButton, ErrorMessage, Field, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { LocalDateField, zonedDateTimeToIso } from '@/components/local-date-field';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';
import type { TripBooking } from '@/lib/types';

const bookingKinds: { key: TripBooking['kind']; title: string }[] = [
  { key: 'flight', title: 'Flight' }, { key: 'hotel', title: 'Stay' },
  { key: 'transport', title: 'Transport' }, { key: 'other', title: 'Other' },
];
const checklistSuggestions = [
  { title: 'Travel documents', category: 'documents' as const },
  { title: 'Booking confirmation', category: 'booking' as const },
  { title: 'Pack essentials', category: 'packing' as const },
  { title: 'Check in', category: 'preparation' as const },
];

function formatted(value: string, zone: string, withTime = false) {
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }
    : { dateStyle: 'medium', timeZone: zone }).format(new Date(value));
}

export default function TripDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const colors = usePingoTheme();
  const client = useQueryClient();
  const tripQuery = useQuery({ queryKey: ['trip', id], queryFn: () => api.trip(id), enabled: Boolean(id) });
  const captures = useQuery({ queryKey: ['captures'], queryFn: () => api.captures(), enabled: Boolean(id) });
  const reminders = useQuery({ queryKey: ['reminders', 'trip'], queryFn: () => api.reminders('trip'), enabled: Boolean(id) });
  const [addingBooking, setAddingBooking] = useState(false);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [selectedCapture, setSelectedCapture] = useState<{ id: string; title: string } | null>(null);
  const [bookingKind, setBookingKind] = useState<TripBooking['kind']>('flight');
  const [bookingTitle, setBookingTitle] = useState('');
  const [reference, setReference] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [arrivalTime, setArrivalTime] = useState('12:00');
  const [departureZone, setDepartureZone] = useState('');
  const [arrivalZone, setArrivalZone] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistCategory, setChecklistCategory] = useState<'documents' | 'booking' | 'packing' | 'preparation' | 'other'>('preparation');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trip = tripQuery.data;

  function refreshTrip() {
    client.invalidateQueries({ queryKey: ['trip', id] });
    client.invalidateQueries({ queryKey: ['trips'] });
  }

  const createBooking = useMutation({
    mutationFn: () => {
      setError(null);
      if (!trip) throw new Error('Trip details are not loaded yet.');
      if (!bookingTitle.trim()) throw new Error('Add a name for this booking.');
      const depZone = departureZone.trim() || trip.timezone;
      const arrZone = arrivalZone.trim() || trip.timezone;
      let departure_at: string | undefined;
      let arrival_at: string | undefined;
      if (departureDate) {
        const value = zonedDateTimeToIso(departureDate, departureTime, depZone);
        if (!value) throw new Error('Check the departure date, time and time zone.');
        departure_at = value;
      }
      if (arrivalDate) {
        const value = zonedDateTimeToIso(arrivalDate, arrivalTime, arrZone);
        if (!value) throw new Error('Check the arrival date, time and time zone.');
        arrival_at = value;
      }
      if (departure_at && arrival_at && new Date(arrival_at) < new Date(departure_at)) throw new Error('Arrival must be after departure.');
      return api.createTripBooking(id, {
        kind: bookingKind,
        title: bookingTitle.trim(),
        ...(selectedCapture ? { capture_id: selectedCapture.id } : {}),
        ...(reference.trim() ? { confirmation_reference: reference.trim() } : {}),
        ...(departure_at ? { departure_at, departure_timezone: depZone } : {}),
        ...(arrival_at ? { arrival_at, arrival_timezone: arrZone } : {}),
        ...(from.trim() ? { from_location: from.trim() } : {}),
        ...(to.trim() ? { to_location: to.trim() } : {}),
      });
    },
    onSuccess: () => {
      refreshTrip();
      setAddingBooking(false); setBookingTitle(''); setReference(''); setFrom(''); setTo('');
      setDepartureDate(''); setArrivalDate(''); setDepartureTime('09:00'); setArrivalTime('12:00');
      setDepartureZone(''); setArrivalZone(''); setSelectedCapture(null);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not save this booking.'),
  });

  const addChecklist = useMutation({
    mutationFn: (entry?: { title: string; category: 'documents' | 'booking' | 'packing' | 'preparation' | 'other' }) => {
      const title = entry?.title || checklistTitle.trim();
      const category = entry?.category || checklistCategory;
      if (!title) throw new Error('Add a preparation to your list.');
      return api.createTripChecklistItem(id, { title, category });
    },
    onSuccess: () => { refreshTrip(); setChecklistTitle(''); setAddingChecklist(false); },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not update the checklist.'),
  });
  const completeChecklist = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) => api.updateTripChecklistItem(id, itemId, completed),
    onSuccess: refreshTrip,
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not update this item.'),
  });
  const removeBooking = useMutation({
    mutationFn: (bookingId: string) => api.deleteTripBooking(id, bookingId),
    onSuccess: refreshTrip,
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not remove this booking.'),
  });
  const removeChecklist = useMutation({
    mutationFn: (itemId: string) => api.deleteTripChecklistItem(id, itemId),
    onSuccess: refreshTrip,
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not remove this checklist item.'),
  });
  const removeTrip = useMutation({
    mutationFn: () => api.deleteTrip(id),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['trips'] }); router.replace('/(app)/trips'); },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not delete this trip.'),
  });

  return (
    <Screen>
      <BackButton title="Trips" onPress={() => router.replace('/(app)/trips')} />
      {tripQuery.isLoading ? <TextBlock color={colors.secondary}>Opening your trip…</TextBlock>
        : tripQuery.isError || !trip ? <Surface style={{ gap: 12 }}><TextBlock color={colors.danger}>{tripQuery.error?.message || 'Trip not found.'}</TextBlock><ActionButton title="Back to trips" onPress={() => router.replace('/(app)/trips')} /></Surface>
          : <View style={{ gap: 22 }}>
            <View style={{ gap: 6 }}>
              <TextBlock size="eyebrow" color={colors.accent}>YOUR TRIP</TextBlock>
              <TextBlock size="title" style={{ fontWeight: '600' }}>{trip.title}</TextBlock>
              <TextBlock size="subheading" color={colors.secondary}>{trip.destination}</TextBlock>
              <TextBlock color={colors.secondary}>{formatted(trip.starts_at, trip.timezone)} – {formatted(trip.ends_at, trip.timezone)}</TextBlock>
              <TextBlock size="small" color={colors.secondary}>Trip time zone · {trip.timezone}</TextBlock>
              {trip.notes ? <TextBlock style={{ marginTop: 6 }}>{trip.notes}</TextBlock> : null}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeading title="Bookings and travel details" action={<Pressable accessibilityRole="button" onPress={() => { setAddingBooking((value) => !value); setError(null); }} style={{ minHeight: 44, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>{addingBooking ? 'Close' : '+ Add'}</TextBlock></Pressable>} />
              {addingBooking ? <Surface style={{ gap: 13 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{bookingKinds.map((item) => {
                  const selected = bookingKind === item.key;
                  return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setBookingKind(item.key)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20, backgroundColor: selected ? colors.text : colors.surfaceMuted }}><TextBlock size="small" color={selected ? colors.inverse : colors.text}>{item.title}</TextBlock></Pressable>;
                })}</View>
                <Field label="Booking name" value={bookingTitle} onChangeText={setBookingTitle} placeholder={bookingKind === 'flight' ? 'Flight to Berlin' : bookingKind === 'hotel' ? 'Hotel reservation' : 'Travel detail'} />
                <Field label="Confirmation reference (optional)" value={reference} onChangeText={setReference} placeholder="Booking reference" autoCapitalize="characters" />
                {bookingKind === 'flight' || bookingKind === 'transport' ? <>
                  <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="From (optional)" value={from} onChangeText={setFrom} placeholder="Airport or station" /></View><View style={{ flex: 1 }}><Field label="To (optional)" value={to} onChangeText={setTo} placeholder="Airport or station" /></View></View>
                  <TextBlock size="small" color={colors.secondary}>Times are interpreted in the time zones below.</TextBlock>
                  <LocalDateField label="Departure" value={departureDate} onChange={setDepartureDate} optional />
                  {departureDate ? <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 0.7 }}><Field label="Departure time" value={departureTime} onChangeText={setDepartureTime} placeholder="09:00" autoCapitalize="none" /></View><View style={{ flex: 1.3 }}><Field label="Time zone" value={departureZone} onChangeText={setDepartureZone} placeholder={trip.timezone} autoCapitalize="none" /></View></View> : null}
                  <LocalDateField label="Arrival" value={arrivalDate} onChange={setArrivalDate} optional />
                  {arrivalDate ? <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 0.7 }}><Field label="Arrival time" value={arrivalTime} onChangeText={setArrivalTime} placeholder="12:00" autoCapitalize="none" /></View><View style={{ flex: 1.3 }}><Field label="Time zone" value={arrivalZone} onChangeText={setArrivalZone} placeholder={trip.timezone} autoCapitalize="none" /></View></View> : null}
                </> : null}
                <View style={{ gap: 7 }}>
                  <TextBlock size="small" color={colors.secondary}>Attach a saved document or screenshot (optional)</TextBlock>
                  <ActionButton title={selectedCapture ? `Attached · ${selectedCapture.title}` : showMemory ? 'Hide saved items' : 'Choose from Memory'} variant="secondary" onPress={() => setShowMemory((value) => !value)} />
                  {showMemory ? captures.data?.slice(0, 12).map((capture) => <Pressable key={capture.id} accessibilityRole="button" accessibilityState={{ selected: selectedCapture?.id === capture.id }} onPress={() => { setSelectedCapture(selectedCapture?.id === capture.id ? null : { id: capture.id, title: capture.title }); setShowMemory(false); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, backgroundColor: selectedCapture?.id === capture.id ? colors.accentSoft : colors.surfaceMuted }}><TextBlock size="small" color={selectedCapture?.id === capture.id ? colors.accent : colors.text}>{capture.title} · {capture.kind}</TextBlock></Pressable>) : null}
                  {showMemory && captures.isError ? <ErrorMessage message={captures.error.message} /> : null}
                </View>
                <ErrorMessage message={error} />
                <ActionButton title="Save booking" onPress={() => createBooking.mutate()} busy={createBooking.isPending} disabled={!bookingTitle.trim()} />
              </Surface> : null}
              {trip.bookings.length ? <View style={{ gap: 9 }}>{trip.bookings.map((booking) => <Surface key={booking.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ flex: 1, gap: 5 }}><TextBlock style={{ fontWeight: '600' }}>{booking.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{booking.kind.toUpperCase()}{booking.confirmation_reference ? ` · ${booking.confirmation_reference}` : ''}</TextBlock></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${booking.title}`} onPress={() => removeBooking.mutate(booking.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TextBlock size="small" color={colors.danger}>Remove</TextBlock></Pressable></View>
                {booking.from_location || booking.to_location ? <TextBlock size="small" color={colors.secondary}>{booking.from_location || '—'} → {booking.to_location || '—'}</TextBlock> : null}
                {booking.departure_at ? <TextBlock size="small" color={colors.secondary}>Departs · {formatted(booking.departure_at, booking.departure_timezone || trip.timezone, true)}</TextBlock> : null}
                {booking.arrival_at ? <TextBlock size="small" color={colors.secondary}>Arrives · {formatted(booking.arrival_at, booking.arrival_timezone || trip.timezone, true)}</TextBlock> : null}
                {booking.capture_id ? <Pressable accessibilityRole="button" accessibilityLabel="Open linked Memory item" onPress={() => router.push({ pathname: '/(app)/memory/[id]', params: { id: booking.capture_id! } })} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><TextBlock size="small" color={colors.accent}>Open saved Memory item</TextBlock></Pressable> : null}
              </Surface>)}</View> : !addingBooking ? <Surface><TextBlock size="small" color={colors.secondary}>Add a flight, stay, or travel detail. You can attach its saved PDF or screenshot from Memory.</TextBlock></Surface> : null}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeading title="Preparation list" action={<Pressable accessibilityRole="button" onPress={() => { setAddingChecklist((value) => !value); setError(null); }} style={{ minHeight: 44, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>{addingChecklist ? 'Close' : '+ Add'}</TextBlock></Pressable>} />
              {addingChecklist ? <Surface style={{ gap: 12 }}>
                <Field label="What do you need to do?" value={checklistTitle} onChangeText={setChecklistTitle} placeholder="Arrange travel insurance" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{(['preparation', 'documents', 'booking', 'packing'] as const).map((category) => {
                  const selected = checklistCategory === category;
                  return <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setChecklistCategory(category)} style={{ minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 19, backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted }}><TextBlock size="small" color={selected ? colors.accent : colors.text}>{category}</TextBlock></Pressable>;
                })}</View>
                <ErrorMessage message={error} />
                <ActionButton title="Add to list" onPress={() => addChecklist.mutate(undefined)} busy={addChecklist.isPending} disabled={!checklistTitle.trim()} />
                {!trip.checklist.length ? <View style={{ gap: 7, marginTop: 5 }}><TextBlock size="small" color={colors.secondary}>Quick add</TextBlock>{checklistSuggestions.map((item) => <Pressable key={item.title} accessibilityRole="button" onPress={() => addChecklist.mutate(item)} style={{ minHeight: 42, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>+ {item.title}</TextBlock></Pressable>)}</View> : null}
              </Surface> : null}
              {trip.checklist.length ? <View style={{ gap: 8 }}>{trip.checklist.map((item) => <Surface key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} accessibilityLabel={`${item.completed ? 'Mark as incomplete' : 'Complete'} ${item.title}`} onPress={() => completeChecklist.mutate({ itemId: item.id, completed: !item.completed })} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TextBlock color={item.completed ? colors.success : colors.secondary}>{item.completed ? '✓' : '○'}</TextBlock></Pressable>
                <View style={{ flex: 1, gap: 3 }}><TextBlock style={{ textDecorationLine: item.completed ? 'line-through' : 'none', fontWeight: '500' }}>{item.title}</TextBlock><TextBlock size="eyebrow" color={colors.secondary}>{item.category.toUpperCase()}</TextBlock></View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => removeChecklist.mutate(item.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><TextBlock size="small" color={colors.danger}>×</TextBlock></Pressable>
              </Surface>)}</View> : !addingChecklist ? <Surface style={{ gap: 10 }}><TextBlock size="small" color={colors.secondary}>A few small preparations can make travel day easier.</TextBlock><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{checklistSuggestions.map((item) => <Pressable key={item.title} accessibilityRole="button" onPress={() => addChecklist.mutate(item)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 20, backgroundColor: colors.surfaceMuted }}><TextBlock size="small" color={colors.text}>+ {item.title}</TextBlock></Pressable>)}</View><ErrorMessage message={error} /></Surface> : null}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeading title="Trip reminders" />
              {reminders.data?.filter((item) => item.trip_id === id).map((item) => <Surface key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1, gap: 4 }}><TextBlock style={{ fontWeight: '600' }}>{item.title}</TextBlock><TextBlock size="small" color={colors.secondary}>{formatted(item.due_at, trip.timezone, true)}</TextBlock></View><TextBlock size="small" color={colors.success}>{item.status === 'completed' ? 'Done' : 'Active'}</TextBlock></Surface>)}
              <ActionButton title="Add a trip reminder" variant="secondary" onPress={() => router.push({ pathname: '/capture', params: { type: 'trip', trip_id: id } })} />
            </View>

            <View style={{ gap: 10 }}>
              {error ? <ErrorMessage message={error} /> : null}
              {confirmDelete ? <Surface style={{ borderColor: colors.danger, gap: 10 }}><TextBlock size="subheading" color={colors.danger} style={{ fontWeight: '600' }}>Delete this trip?</TextBlock><TextBlock size="small" color={colors.secondary}>The trip, linked bookings and checklist will be removed. Saved documents in Memory stay in your account.</TextBlock><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><ActionButton title="Keep trip" variant="secondary" onPress={() => setConfirmDelete(false)} /></View><View style={{ flex: 1 }}><ActionButton title="Delete trip" variant="danger" onPress={() => removeTrip.mutate()} busy={removeTrip.isPending} /></View></View></Surface>
                : <ActionButton title="Delete trip" variant="danger" onPress={() => setConfirmDelete(true)} />}
            </View>
          </View>}
    </Screen>
  );
}
