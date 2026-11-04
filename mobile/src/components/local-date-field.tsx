import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { ActionButton, Field, TextBlock } from '@/components/ui';
import { usePingoTheme } from '@/lib/theme';

function asDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function asString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function LocalDateField({ label, value, onChange, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; optional?: boolean;
}) {
  const colors = usePingoTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  if (Platform.OS === 'web') {
    return <Field label={optional ? `${label} (optional)` : label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" />;
  }
  return (
    <View style={{ gap: 8 }}>
      <TextBlock size="small" color={colors.secondary}>{optional ? `${label} (optional)` : label}</TextBlock>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(asDate(value) || new Date())}` : `Choose ${label.toLowerCase()}`}
        onPress={() => { setDraft(value || asString(new Date())); setOpen(true); }}
        style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <TextBlock color={value ? colors.text : colors.secondary}>{value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(asDate(value) || new Date()) : 'Choose a date'}</TextBlock>
      </Pressable>
      {open ? <View style={{ gap: 8 }}>
        <DateTimePicker
          value={asDate(draft) || new Date()}
          mode="date"
          presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
          onValueChange={(_event, selected) => {
            if (!selected) return;
            const next = asString(selected);
            setDraft(next);
            if (Platform.OS === 'android') { onChange(next); setOpen(false); }
          }}
          onDismiss={Platform.OS === 'android' ? () => setOpen(false) : undefined}
        />
        {Platform.OS === 'ios' ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton title="Cancel" variant="quiet" onPress={() => setOpen(false)} />
          <ActionButton title="Done" variant="secondary" onPress={() => { onChange(draft); setOpen(false); }} />
        </View> : null}
      </View> : null}
    </View>
  );
}

export function zonedDateTimeToIso(date: string, time: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const valid = new Date(year, month - 1, day);
  if (valid.getFullYear() !== year || valid.getMonth() !== month - 1 || valid.getDate() !== day || hour > 23 || minute > 59) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    let timestamp = desired;
    for (let index = 0; index < 3; index += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      timestamp += desired - represented;
    }
    const result = new Date(timestamp);
    const finalParts = Object.fromEntries(formatter.formatToParts(result).map((part) => [part.type, part.value]));
    if (Number(finalParts.year) !== year || Number(finalParts.month) !== month || Number(finalParts.day) !== day || Number(finalParts.hour) !== hour || Number(finalParts.minute) !== minute) return null;
    return result.toISOString();
  } catch {
    return null;
  }
}
