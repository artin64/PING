import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReminderComposer } from '@/components/reminder-composer';
import { ActionButton, ErrorMessage, Field, Screen, SectionHeading, Surface, TextBlock } from '@/components/ui';
import { PrivateImage } from '@/components/private-image';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePingoTheme } from '@/lib/theme';

function ocrMessage(status: string) {
  if (status === 'completed') return 'Text found. Check it against the image before using it.';
  if (status === 'partial') return 'Some text was extracted. Check every page against the original document.';
  if (status === 'no_text_found') return 'No readable text was found. You can still add your own notes.';
  if (status === 'not_configured') return 'Saved. Local text recognition is not configured on the server yet.';
  if (status === 'failed') return 'Saved, but text recognition failed. You can still add your own notes.';
  return 'This item does not need text recognition.';
}

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePingoTheme();
  const token = useSession((state) => state.token);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['capture', id], queryFn: () => api.capture(id), enabled: Boolean(id) });
  const [edited, setEdited] = useState<{ id: string; title: string; body: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<{ date: string; label: string } | null>(null);
  const title = edited?.id === id ? edited.title : query.data?.title ?? '';
  const body = edited?.id === id ? edited.body : query.data?.body ?? '';

  const update = useMutation({ mutationFn: () => api.updateCapture(id, { title: title.trim(), body: body.trim() }), onSuccess: (saved) => {
    client.setQueryData(['capture', id], saved);
    client.invalidateQueries({ queryKey: ['captures'] });
  } });
  const understand = useMutation({ mutationFn: () => api.understandCapture(id), onSuccess: (saved) => {
    client.setQueryData(['capture', id], saved);
    client.invalidateQueries({ queryKey: ['captures'] });
  } });
  const remove = useMutation({ mutationFn: () => api.deleteCapture(id), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['captures'] });
    client.invalidateQueries({ queryKey: ['dashboard'] });
    router.replace('/(app)/memory');
  } });

  async function openOriginal() {
    if (!query.data?.attachment_url) return;
    setOpeningAttachment(true);
    setAttachmentError(null);
    try { await api.openAttachment(query.data.attachment_url, query.data.original_filename || 'pingo-document.pdf', query.data.content_type); }
    catch (cause) { setAttachmentError(cause instanceof Error ? cause.message : 'Could not open this private document.'); }
    finally { setOpeningAttachment(false); }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}><TextBlock color={colors.secondary}>‹  Memory</TextBlock></Pressable>
      {query.isLoading ? <TextBlock color={colors.secondary}>Opening your saved item…</TextBlock>
        : query.isError ? <Surface style={{ gap: 12 }}><TextBlock color={colors.danger}>{query.error.message}</TextBlock><ActionButton title="Back to memory" onPress={() => router.replace('/(app)/memory')} /></Surface>
          : query.data ? <View style={{ gap: 16 }}>
            {query.data.attachment_url && query.data.kind === 'screenshot' ? <PrivateImage path={query.data.attachment_url} token={token} style={{ width: '100%', aspectRatio: 1.2, borderRadius: 17, backgroundColor: colors.surfaceMuted }} resizeMode="contain" /> : null}
            {query.data.attachment_url && query.data.kind === 'document' ? <Surface style={{ gap: 10 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>Private PDF</TextBlock><TextBlock size="small" color={colors.secondary}>{query.data.original_filename || 'Saved document'}</TextBlock><ActionButton title="Open original PDF" onPress={openOriginal} busy={openingAttachment} variant="secondary" /><ErrorMessage message={attachmentError} /></Surface> : null}
            <TextBlock size="eyebrow" color={colors.accent}>{query.data.kind.toUpperCase()} · SAVED {new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(query.data.created_at)).toUpperCase()}</TextBlock>
            <Field label="Title" value={title} onChangeText={(next) => setEdited({ id, title: next, body })} />
            {query.data.source_url ? <TextBlock size="small" color={colors.accent}>{query.data.source_url}</TextBlock> : null}
            <Field label="Your notes" value={body} onChangeText={(next) => setEdited({ id, title, body: next })} placeholder="Add a note…" multiline />
            {query.data.kind === 'screenshot' || query.data.kind === 'document' ? <Surface style={{ backgroundColor: colors.surfaceMuted, gap: 7 }}>
              <TextBlock size="small" style={{ fontWeight: '600' }}>{query.data.kind === 'document' ? 'TEXT FROM THIS DOCUMENT' : 'TEXT FROM THIS IMAGE'}</TextBlock>
              <TextBlock size="small" color={colors.secondary}>{ocrMessage(query.data.ocr_status)}</TextBlock>
              {query.data.extracted_text ? <TextBlock>{query.data.extracted_text}</TextBlock> : null}
            </Surface> : null}
            <Surface style={{ gap: 10 }}>
              <TextBlock size="small" style={{ fontWeight: '600' }}>UNDERSTAND THIS MEMORY</TextBlock>
              <TextBlock size="small" color={colors.secondary}>PINGO can categorize and summarize saved text. Any detected dates are suggestions only and never become reminders automatically.</TextBlock>
              <ActionButton title={query.data.summary ? 'Refresh analysis' : 'Analyze saved text'} onPress={() => understand.mutate()} busy={understand.isPending} variant="secondary" />
              <ErrorMessage message={understand.error instanceof Error ? understand.error.message : null} />
              {query.data.summary ? <View style={{ gap: 8 }}>
                <TextBlock size="small" color={colors.accent}>{query.data.category.toUpperCase()} · {query.data.ai_provider === 'gemini' ? 'EXTERNAL AI' : 'LOCAL AI'}</TextBlock>
                <TextBlock>{query.data.summary}</TextBlock>
                <TextBlock size="small" color={colors.secondary}>Check this summary against the original saved content.</TextBlock>
                {query.data.entities.length ? <View style={{ gap: 5, marginTop: 4 }}><TextBlock size="small" style={{ fontWeight: '600' }}>Details found in the source</TextBlock>{query.data.entities.map((entity, index) => <TextBlock key={`${entity.name}-${index}`} size="small" color={colors.secondary}>{entity.name} · “{entity.source_quote}”</TextBlock>)}</View> : null}
                {query.data.date_suggestions.length ? <View style={{ gap: 8, marginTop: 6 }}>
                  <TextBlock size="small" style={{ fontWeight: '600' }}>Dates to review</TextBlock>
                  {query.data.date_suggestions.map((suggestion, index) => <Surface key={`${suggestion.date}-${index}`} style={{ gap: 7, padding: 12 }}>
                    <TextBlock style={{ fontWeight: '600' }}>{suggestion.label} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${suggestion.date}T12:00:00`))}</TextBlock>
                    <TextBlock size="small" color={colors.secondary}>Source: “{suggestion.source_quote}”</TextBlock>
                    <ActionButton title="Review and create reminder" variant="quiet" onPress={() => setSelectedSuggestion({ date: suggestion.date, label: suggestion.label })} />
                  </Surface>)}
                </View> : null}
              </View> : null}
            </Surface>
            <ErrorMessage message={update.error instanceof Error ? update.error.message : null} />
            <ActionButton title="Save changes" onPress={() => update.mutate()} busy={update.isPending} disabled={!title.trim()} />
            <SectionHeading title="Follow through" />
            <TextBlock color={colors.secondary}>Choose a date yourself. PINGO will not activate dates it reads from an image.</TextBlock>
            <Surface><ReminderComposer key={selectedSuggestion ? `${selectedSuggestion.date}-${selectedSuggestion.label}` : 'manual-reminder'} captureId={query.data.id} initialDate={selectedSuggestion?.date || ''} initialTitle={selectedSuggestion?.label || ''} onSaved={() => setSelectedSuggestion(null)} /></Surface>
            {confirmingDelete ? <Surface style={{ borderColor: colors.danger, gap: 10 }}>
              <TextBlock style={{ fontWeight: '600' }}>Permanently delete this item?</TextBlock>
              <TextBlock size="small" color={colors.secondary}>The saved item and its private image will be removed from your account.</TextBlock>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><ActionButton title="Keep item" variant="secondary" onPress={() => setConfirmingDelete(false)} /></View>
                <View style={{ flex: 1 }}><ActionButton title="Delete" variant="danger" onPress={() => remove.mutate()} busy={remove.isPending} /></View>
              </View>
              <ErrorMessage message={remove.error instanceof Error ? remove.error.message : null} />
            </Surface> : <ActionButton title="Delete saved item" onPress={() => setConfirmingDelete(true)} variant="danger" />}
          </View> : null}
    </Screen>
  );
}
