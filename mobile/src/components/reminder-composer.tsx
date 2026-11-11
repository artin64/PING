import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { ActionButton, ErrorMessage, Field, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';
import type { Reminder } from '@/lib/types';

const kinds: { key: Reminder['kind']; title: string }[] = [
  { key: 'deadline', title: 'Deadline' },
  { key: 'payment', title: 'Payment' },
  { key: 'appointment', title: 'Appointment' },
  { key: 'trip', title: 'Trip' },
];

function parseLocalDate(date: string, time = '09:00'): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day && value.getHours() === hour && value.getMinutes() === minute ? value : null;
}

function formatLocalDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatLocalTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function ReminderComposer({ captureId, tripId, reminderId, initialKind = 'deadline', initialDate = '', initialTime = '09:00', initialTitle = '', initialNote = '', initialAmount = '', initialCurrency = '', initialRecurrence = 'none', initialOffsets = [1440, 60], onSaved }: {
  captureId?: string; tripId?: string; reminderId?: string; initialKind?: Reminder['kind']; initialDate?: string; initialTime?: string;
  initialTitle?: string; initialNote?: string; initialAmount?: string; initialCurrency?: string;
  initialRecurrence?: Reminder['recurrence']; initialOffsets?: number[]; onSaved?: () => void;
}) {
  const colors = usePingoTheme();
  const client = useQueryClient();
  const [kind, setKind] = useState<Reminder['kind']>(initialKind);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [amount, setAmount] = useState(initialAmount);
  const [currency, setCurrency] = useState(initialCurrency);
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>(initialRecurrence);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(initialOffsets);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const availableKinds = reminderId || tripId ? kinds.filter((item) => item.key === initialKind) : kinds;
  const mutation = useMutation({
    mutationFn: () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Add a date as YYYY-MM-DD and a time as HH:MM.');
      const due = parseLocalDate(date, time);
      if (!due) throw new Error('That date and time are not valid.');
      if (kind === 'payment' && amount && !/^[A-Za-z]{3}$/.test(currency)) throw new Error('Add a 3-letter currency code for the amount.');
      const parsedAmount = amount ? Number(amount.replace(',', '.')) : undefined;
      if (parsedAmount !== undefined && !Number.isFinite(parsedAmount)) throw new Error('Enter a valid amount.');
      if (reminderId) return api.updateReminder(reminderId, {
        title: title.trim(),
        note: note.trim(),
        due_at: due.toISOString(),
        recurrence: kind === 'payment' ? recurrence : 'none',
        reminder_offsets_minutes: reminderOffsets,
        ...(kind === 'payment' ? { amount: parsedAmount ?? null, currency: currency.trim() ? currency.toUpperCase() : null } : {}),
      });
      return api.createReminder({
        capture_id: captureId,
        trip_id: tripId,
        title: title.trim(),
        note: note.trim(),
        kind,
        due_at: due.toISOString(),
        recurrence: kind === 'payment' ? recurrence : 'none',
        reminder_offsets_minutes: reminderOffsets,
        ...(kind === 'payment' && parsedAmount !== undefined ? { amount: parsedAmount, currency: currency.toUpperCase() } : {}),
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['dashboard'] });
      client.invalidateQueries({ queryKey: ['reminders'] });
      client.invalidateQueries({ queryKey: ['payments', 'overview'] });
      setTitle(''); setNote(''); setDate(''); setTime('09:00'); setAmount(''); setCurrency(''); setRecurrence('none'); setReminderOffsets([1440, 60]);
      onSaved?.();
    },
  });
  const ready = title.trim().length > 0 && date.length > 0;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {availableKinds.map((item) => {
          const selected = kind === item.key;
          return <Pressable key={item.key} onPress={() => { setKind(item.key); if (item.key !== 'payment') setRecurrence('none'); }} accessibilityRole="button" accessibilityState={{ selected }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 22, backgroundColor: selected ? colors.text : colors.surfaceMuted }}>
            <TextBlock size="small" color={selected ? colors.inverse : colors.text}>{item.title}</TextBlock>
          </Pressable>;
        })}
      </View>
      <Field label="What should PINGO remind you about?" value={title} onChangeText={setTitle} placeholder="Passport renewal" />
      {Platform.OS === 'web' ? <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.2 }}><Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="default" autoCapitalize="none" /></View>
        <View style={{ flex: 0.8 }}><Field label="Time" value={time} onChangeText={setTime} placeholder="09:00" autoCapitalize="none" /></View>
      </View> : <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.2 }}>
            <TextBlock size="small" color={colors.secondary} style={{ marginBottom: 7 }}>Date</TextBlock>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={date ? `Reminder date, ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(parseLocalDate(date) || new Date())}` : 'Choose reminder date'}
              onPress={() => { setDraftDate(date || formatLocalDate(new Date())); setDatePickerOpen(true); setTimePickerOpen(false); }}
              style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
            ><TextBlock color={date ? colors.text : colors.secondary}>{date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parseLocalDate(date) || new Date()) : 'Choose a date'}</TextBlock></Pressable>
          </View>
          <View style={{ flex: 0.8 }}>
            <TextBlock size="small" color={colors.secondary} style={{ marginBottom: 7 }}>Time</TextBlock>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reminder time, ${time}`}
              onPress={() => { setDraftTime(time); setTimePickerOpen(true); setDatePickerOpen(false); }}
              style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
            ><TextBlock>{time}</TextBlock></Pressable>
          </View>
        </View>
        {datePickerOpen ? <View style={{ gap: 8 }}>
          <DateTimePicker
            value={parseLocalDate(draftDate, time) || new Date()}
            mode="date"
            presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
            onValueChange={(_event, value) => {
              if (!value) return;
              setDraftDate(formatLocalDate(value));
              if (Platform.OS === 'android') { setDate(formatLocalDate(value)); setDatePickerOpen(false); }
            }}
            onDismiss={Platform.OS === 'android' ? () => setDatePickerOpen(false) : undefined}
          />
          {Platform.OS === 'ios' ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <ActionButton title="Cancel" variant="quiet" onPress={() => setDatePickerOpen(false)} />
            <ActionButton title="Done" variant="secondary" onPress={() => { setDate(draftDate); setDatePickerOpen(false); }} />
          </View> : null}
        </View> : null}
        {timePickerOpen ? <View style={{ gap: 8 }}>
          <DateTimePicker
            value={parseLocalDate(date || formatLocalDate(new Date()), draftTime) || new Date()}
            mode="time"
            presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
            onValueChange={(_event, value) => {
              if (!value) return;
              setDraftTime(formatLocalTime(value));
              if (Platform.OS === 'android') { setTime(formatLocalTime(value)); setTimePickerOpen(false); }
            }}
            onDismiss={Platform.OS === 'android' ? () => setTimePickerOpen(false) : undefined}
          />
          {Platform.OS === 'ios' ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <ActionButton title="Cancel" variant="quiet" onPress={() => setTimePickerOpen(false)} />
            <ActionButton title="Done" variant="secondary" onPress={() => { setTime(draftTime); setTimePickerOpen(false); }} />
          </View> : null}
        </View> : null}
      </View>}
      {kind === 'payment' ? <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Amount (optional)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" /></View>
        <View style={{ flex: 0.7 }}><Field label="Currency" value={currency} onChangeText={setCurrency} placeholder="PLN" autoCapitalize="words" /></View>
      </View> : null}
      {kind === 'payment' ? <View style={{ gap: 9 }}>
        <TextBlock size="small" color={colors.secondary}>Repeat payment</TextBlock>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([{ key: 'none', title: 'One time' }, { key: 'weekly', title: 'Weekly' }, { key: 'monthly', title: 'Monthly' }, { key: 'yearly', title: 'Yearly' }] as const).map((item) => {
            const selected = recurrence === item.key;
            return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setRecurrence(item.key)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22, backgroundColor: selected ? colors.text : colors.surfaceMuted }}><TextBlock size="small" color={selected ? colors.inverse : colors.text}>{item.title}</TextBlock></Pressable>;
          })}
        </View>
      </View> : null}
      <View style={{ gap: 9 }}>
        <TextBlock size="small" color={colors.secondary}>Notify me</TextBlock>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([{ minutes: 1440, title: '1 day before' }, { minutes: 60, title: '1 hour before' }, { minutes: 0, title: 'At due time' }] as const).map((item) => {
            const selected = reminderOffsets.includes(item.minutes);
            return <Pressable key={item.minutes} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setReminderOffsets((current) => selected ? (current.length > 1 ? current.filter((value) => value !== item.minutes) : current) : [...current, item.minutes])} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22, backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted }}><TextBlock size="small" color={selected ? colors.accent : colors.text}>{item.title}</TextBlock></Pressable>;
          })}
        </View>
      </View>
      <Field label="A note (optional)" value={note} onChangeText={setNote} placeholder="Anything you want to remember" multiline />
      <TextBlock size="small" color={colors.secondary}>Alerts follow your device’s notification permission. Push to multiple devices also needs push credentials for the app build.</TextBlock>
      <ErrorMessage message={mutation.error instanceof Error ? mutation.error.message : null} />
      <ActionButton title={reminderId ? 'Save changes' : 'Save reminder'} onPress={() => mutation.mutate()} busy={mutation.isPending} disabled={!ready} />
    </View>
  );
}

