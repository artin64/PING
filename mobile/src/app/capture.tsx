import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { ReminderComposer } from '@/components/reminder-composer';
import { ActionButton, ErrorMessage, Field, PingoIcon, Screen, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

type Mode = 'note' | 'link' | 'screenshot' | 'document' | 'reminder';
type PickedImage = { uri: string; name: string; mimeType: string; file?: File | null };
type PickedDocument = { uri: string; name: string; mimeType: string; file?: File | null };

const modes: { key: Mode; title: string; detail: string; icon: 'photo' | 'document' | 'link' | 'note' | 'reminder' }[] = [
  { key: 'screenshot', title: 'Photo', detail: 'Screenshot or camera', icon: 'photo' },
  { key: 'document', title: 'Document', detail: 'Private PDF', icon: 'document' },
  { key: 'link', title: 'Link', detail: 'Save a page to revisit', icon: 'link' },
  { key: 'note', title: 'Note', detail: 'Keep a useful detail', icon: 'note' },
  { key: 'reminder', title: 'Reminder', detail: 'A date you need to act on', icon: 'reminder' },
];

export default function CaptureScreen() {
  const colors = usePingoTheme();
  const params = useLocalSearchParams<{ type?: string; trip_id?: string }>();
  const client = useQueryClient();
  const [mode, setMode] = useState<Mode>(params.type === 'payment' || params.type === 'deadline' || params.type === 'trip' ? 'reminder' : 'note');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [pickerError, setPickerError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'document') {
        if (!document) throw new Error('Choose a PDF document first.');
        const form = new FormData();
        if (Platform.OS === 'web' && document.file) form.append('file', document.file, document.name);
        else form.append('file', { uri: document.uri, name: document.name, type: document.mimeType } as unknown as Blob);
        if (title.trim()) form.append('title', title.trim());
        if (body.trim()) form.append('note', body.trim());
        return api.uploadCapture(form);
      }
      if (mode === 'screenshot') {
        if (!image) throw new Error('Choose a screenshot or take a photo first.');
        const form = new FormData();
        if (Platform.OS === 'web' && image.file) form.append('file', image.file, image.name);
        else form.append('file', { uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
        if (title.trim()) form.append('title', title.trim());
        if (body.trim()) form.append('note', body.trim());
        return api.uploadCapture(form);
      }
      if (!title.trim()) throw new Error('Add a short title before saving.');
      return api.createCapture({
        title: title.trim(), kind: mode === 'link' ? 'link' : 'note', body: body.trim(),
        ...(mode === 'link' ? { source_url: url.trim() } : {}),
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['captures'] });
      client.invalidateQueries({ queryKey: ['dashboard'] });
      router.replace('/(app)/memory');
    },
  });

  async function pickImage() {
    setPickerError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setImage({ uri: asset.uri, name: asset.fileName || 'pingo-screenshot.jpg', mimeType: asset.mimeType || 'image/jpeg', file: asset.file });
    setTitle(asset.fileName?.replace(/\.[^.]+$/, '') || '');
  }

  async function takePhoto() {
    setPickerError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Camera access is off. Allow it in your device settings, or choose an existing screenshot.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setImage({ uri: asset.uri, name: 'pingo-photo.jpg', mimeType: asset.mimeType || 'image/jpeg', file: asset.file });
    setTitle('');
  }

  async function pickPdf() {
    setPickerError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setDocument({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'application/pdf', file: asset.file });
      setTitle(asset.name.replace(/\.pdf$/i, ''));
    } catch (cause) {
      setPickerError(cause instanceof Error ? cause.message : 'Could not open the document picker.');
    }
  }

  function changeMode(next: Mode) {
    setMode(next);
    setPickerError(null);
    save.reset();
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close capture" style={styles.close}>
        <PingoIcon name="close" size={18} color={colors.secondary} /><TextBlock size="small" color={colors.secondary}>Close</TextBlock>
      </Pressable>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}><TextBlock size="eyebrow" color={colors.accent}>UNIVERSAL CAPTURE</TextBlock><TextBlock size="title" style={{ marginTop: 5 }}>Save it once.</TextBlock></View>
        <View style={[styles.headingMark, { backgroundColor: colors.hero }]}><PingoIcon name="sparkles" size={21} color="#00D68F" /></View>
      </View>
      <TextBlock color={colors.secondary} style={{ marginTop: -5, marginBottom: 18 }}>A screenshot, document, link, note or date. Choose what you have.</TextBlock>

      <View style={styles.modeGrid}>
        {modes.map((item) => {
          const active = mode === item.key;
          return <Pressable
            key={item.key}
            onPress={() => changeMode(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.modeCard, { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.border }, item.key === 'reminder' && styles.modeWide, pressed && { opacity: 0.72 }]}
          >
            <View style={[styles.modeIcon, { backgroundColor: active ? colors.accentSolid : colors.surfaceMuted }]}><PingoIcon name={item.icon} size={19} color={active ? colors.onAccent : colors.accent} /></View>
            <View style={{ flex: 1, gap: 2 }}><TextBlock size="small" style={{ fontWeight: '700' }}>{item.title}</TextBlock><TextBlock size="eyebrow" color={colors.secondary}>{item.detail}</TextBlock></View>
            {active ? <View style={[styles.activeDot, { backgroundColor: colors.accent }]}><PingoIcon name="check" size={11} color={colors.onAccent} /></View> : null}
          </Pressable>;
        })}
      </View>

      <Surface tone="raised" style={{ gap: 15, marginTop: 12 }}>
        <View style={styles.panelHeading}>
          <View style={[styles.panelIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name={modes.find((item) => item.key === mode)?.icon ?? 'note'} size={18} color={colors.accent} /></View>
          <View style={{ flex: 1 }}><TextBlock style={{ fontWeight: '600' }}>{mode === 'screenshot' ? 'Add a photo' : mode === 'document' ? 'Add a PDF' : mode === 'link' ? 'Save a link' : mode === 'reminder' ? 'Set a reminder' : 'Write a note'}</TextBlock><TextBlock size="small" color={colors.secondary} style={{ marginTop: 2 }}>{mode === 'reminder' ? 'Choose a date and a notification schedule.' : 'Only you can access the items in this account.'}</TextBlock></View>
        </View>

        {mode === 'screenshot' ? <View style={{ gap: 13 }}>
          {image ? <View style={{ gap: 8 }}><Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" /><Pressable onPress={pickImage} accessibilityRole="button" style={styles.inlineAction}><PingoIcon name="photo" size={15} color={colors.accent} /><TextBlock size="small" color={colors.accent} style={{ fontWeight: '600' }}>Choose a different image</TextBlock></Pressable></View>
            : <View style={[styles.uploadBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.uploadIcon, { backgroundColor: colors.surface }]}><PingoIcon name="photo" size={22} color={colors.accent} /></View>
              <TextBlock style={{ fontWeight: '600', textAlign: 'center' }}>Choose a screenshot or take a photo</TextBlock>
              <TextBlock size="small" color={colors.secondary} style={{ textAlign: 'center' }}>Your image is attached to your private memory.</TextBlock>
              <View style={styles.buttonRow}><View style={{ flex: 1 }}><ActionButton title="Choose photo" icon="photo" variant="secondary" onPress={pickImage} /></View><View style={{ flex: 1 }}><ActionButton title="Take photo" icon="add" variant="secondary" onPress={takePhoto} /></View></View>
            </View>}
          {image ? <><Field label="Title" value={title} onChangeText={setTitle} placeholder="Hotel booking in Berlin" /><Field label="Add a note (optional)" value={body} onChangeText={setBody} placeholder="Anything you already know" multiline />
            <TextBlock size="small" color={colors.secondary}>Text recognition runs on your PINGO server when configured. Confirm extracted dates and amounts before using them.</TextBlock></> : null}
          <ErrorMessage message={pickerError || (save.error instanceof Error ? save.error.message : null)} />
          {image ? <ActionButton title="Save to Memory" icon="memory" onPress={() => save.mutate()} busy={save.isPending} /> : null}
        </View> : null}

        {mode === 'document' ? <View style={{ gap: 13 }}>
          {document ? <View style={[styles.fileCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.fileIcon, { backgroundColor: colors.accentSoft }]}><PingoIcon name="document" size={22} color={colors.accent} /></View>
            <View style={{ flex: 1, gap: 3 }}><TextBlock style={{ fontWeight: '600' }} numberOfLines={2}>{document.name}</TextBlock><TextBlock size="small" color={colors.secondary}>Private PDF · maximum 20 MB</TextBlock></View>
            <Pressable onPress={pickPdf} accessibilityRole="button" accessibilityLabel="Choose a different PDF" style={styles.replaceFile}><PingoIcon name="close" size={16} color={colors.secondary} /></Pressable>
          </View> : <View style={[styles.uploadBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.uploadIcon, { backgroundColor: colors.surface }]}><PingoIcon name="document" size={22} color={colors.accent} /></View>
            <TextBlock style={{ fontWeight: '600', textAlign: 'center' }}>Choose a document to remember</TextBlock>
            <TextBlock size="small" color={colors.secondary} style={{ textAlign: 'center' }}>Save a PDF privately. Extracted text is searchable when processing is configured.</TextBlock>
            <View style={{ width: '100%' }}><ActionButton title="Choose PDF" icon="document" variant="secondary" onPress={pickPdf} /></View>
          </View>}
          {document ? <><Field label="Title" value={title} onChangeText={setTitle} placeholder="Passport scan" /><Field label="Add a note (optional)" value={body} onChangeText={setBody} placeholder="What should you remember about it?" multiline /></> : null}
          <ErrorMessage message={pickerError || (save.error instanceof Error ? save.error.message : null)} />
          {document ? <ActionButton title="Save Private PDF" icon="memory" onPress={() => save.mutate()} busy={save.isPending} disabled={!title.trim()} /> : null}
        </View> : null}

        {mode === 'note' || mode === 'link' ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 14 }}>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder={mode === 'link' ? 'A place to try' : 'Remember to…'} />
          {mode === 'link' ? <Field label="Link" value={url} onChangeText={setUrl} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" left={<PingoIcon name="link" size={18} color={colors.secondary} />} /> : null}
          <Field label={mode === 'link' ? 'Why you saved it (optional)' : 'Details'} value={body} onChangeText={setBody} placeholder={mode === 'link' ? 'What do you want to remember?' : 'Add a detail you might need later'} multiline />
          <ErrorMessage message={save.error instanceof Error ? save.error.message : null} />
          <ActionButton title={mode === 'link' ? 'Save Link' : 'Save Note'} icon={mode === 'link' ? 'link' : 'memory'} onPress={() => save.mutate()} busy={save.isPending} disabled={!title.trim() || (mode === 'link' && !url.trim())} />
        </KeyboardAvoidingView> : null}

        {mode === 'reminder' ? <ReminderComposer tripId={typeof params.trip_id === 'string' ? params.trip_id : undefined} initialKind={params.type === 'payment' ? 'payment' : params.type === 'trip' ? 'trip' : 'deadline'} onSaved={() => { client.invalidateQueries({ queryKey: ['dashboard'] }); client.invalidateQueries({ queryKey: ['reminders'] }); client.invalidateQueries({ queryKey: ['payments', 'overview'] }); router.back(); }} /> : null}
      </Surface>
    </Screen>
  );
}

const styles = {
  close: { minHeight: 44, alignSelf: 'flex-start' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, marginBottom: 8 },
  heading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  headingMark: { width: 46, height: 46, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const },
  modeGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 9 },
  modeCard: { width: '48%' as const, minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
  modeWide: { width: '100%' as const },
  modeIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const },
  activeDot: { width: 19, height: 19, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  panelHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 },
  panelIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  uploadBox: { borderWidth: 1, borderStyle: 'dashed' as const, borderRadius: 19, padding: 18, alignItems: 'center' as const, gap: 10 },
  uploadIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const },
  buttonRow: { width: '100%' as const, flexDirection: 'row' as const, gap: 9, marginTop: 3 },
  imagePreview: { width: '100%' as const, aspectRatio: 1.55, borderRadius: 16, backgroundColor: '#16263A' },
  inlineAction: { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  fileCard: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 },
  fileIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },
  replaceFile: { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
};
