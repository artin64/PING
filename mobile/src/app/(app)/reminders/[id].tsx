import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ReminderComposer } from '@/components/reminder-composer';
import { ActionButton, BackButton, Screen, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

export default function ReminderDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const colors = usePingoTheme();
  const query = useQuery({ queryKey: ['reminders', 'edit-source'], queryFn: () => api.reminders() });
  const reminder = query.data?.find((item) => item.id === id);
  const due = reminder ? new Date(reminder.due_at) : null;
  const date = due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}` : '';
  const time = due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '09:00';

  return (
    <Screen>
      <BackButton title="Life" onPress={() => router.back()} />
      <TextBlock size="eyebrow" color={colors.accent}>FOLLOW THROUGH</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 7, marginBottom: 18 }}>Edit reminder</TextBlock>
      {query.isLoading ? <TextBlock color={colors.secondary}>Loading reminder…</TextBlock>
        : query.isError ? <Surface style={{ gap: 12 }}><TextBlock color={colors.danger}>{query.error.message}</TextBlock><ActionButton title="Try again" variant="secondary" onPress={() => query.refetch()} /></Surface>
          : reminder ? <Surface><ReminderComposer
            key={reminder.id}
            reminderId={reminder.id}
            initialKind={reminder.kind}
            initialDate={date}
            initialTime={time}
            initialTitle={reminder.title}
            initialNote={reminder.note}
            initialAmount={reminder.amount === null ? '' : String(reminder.amount)}
            initialCurrency={reminder.currency || ''}
            initialRecurrence={reminder.recurrence}
            initialOffsets={reminder.reminder_offsets_minutes}
            onSaved={() => router.back()}
          /></Surface>
            : <Surface style={{ gap: 12 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>Reminder not available</TextBlock><TextBlock color={colors.secondary}>It may have been completed or archived on another device.</TextBlock><ActionButton title="Back to Life" onPress={() => router.replace('/(app)/life')} /></Surface>}
    </Screen>
  );
}
