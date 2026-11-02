import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { ReminderComposer } from '@/components/reminder-composer';
import { ActionButton, ErrorMessage, Field, Screen, Surface, TextBlock } from '@/components/ui';
import { api } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

type Mode = 'note' | 'link' | 'screenshot' | 'document' | 'reminder';
type PickedImage = { uri: string; name: string; mimeType: string; file?: File | null };
type PickedDocument = { uri: string; name: string; mimeType: string; file?: File | null };

const modes: { key: Mode; title: string }[] = [
  { key: 'screenshot', title: 'Photo' },
  { key: 'document', title: 'PDF' },
  { key: 'link', title: 'Link' },
  { key: 'note', title: 'Note' },
  { key: 'reminder', title: 'Reminder' },
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

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}><TextBlock color={colors.secondary}>‹  Close</TextBlock></Pressable>
      <TextBlock size="eyebrow" color={colors.accent}>UNIVERSAL INBOX</TextBlock>
      <TextBlock size="title" style={{ fontWeight: '600', marginTop: 6, marginBottom: 8 }}>Save it once.</TextBlock>
      <TextBlock color={colors.secondary} style={{ marginBottom: 22 }}>Choose what you have. PINGO will keep it easy to find.</TextBlock>
      <View style={{ flexDirection: 'row', gap: 7, marginBottom: 19, flexWrap: 'wrap' }}>
        {modes.map((item) => {
          const active = mode === item.key;
          return <Pressable key={item.key} onPress={() => { setMode(item.key); save.reset(); }} accessibilityRole="button" accessibilityState={{ selected: active }} style={{ minHeight: 42, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 22, backgroundColor: active ? colors.text : colors.surfaceMuted }}><TextBlock size="small" color={active ? colors.inverse : colors.text}>{item.title}</TextBlock></Pressable>;
        })}
      </View>

      {mode === 'screenshot' ? <View style={{ gap: 15 }}>
        {image ? <Surface style={{ gap: 12 }}><Image source={{ uri: image.uri }} style={{ width: '100%', aspectRatio: 1.4, borderRadius: 12, backgroundColor: colors.surfaceMuted }} resizeMode="cover" /><Pressable onPress={pickImage} accessibilityRole="button" style={{ minHeight: 42, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>Choose a different image</TextBlock></Pressable></Surface>
          : <Surface style={{ borderStyle: 'dashed', alignItems: 'center', gap: 12, paddingVertical: 28 }}><TextBlock size="subheading" style={{ fontWeight: '600' }}>Add a screenshot or photo</TextBlock><TextBlock color={colors.secondary} style={{ textAlign: 'center' }}>Use a saved image or take a new photo. Your image stays private to your account.</TextBlock><View style={{ width: '100%', gap: 9, marginTop: 3 }}><ActionButton title="Choose from photos" onPress={pickImage} variant="secondary" /><ActionButton title="Take a photo" onPress={takePhoto} variant="secondary" /></View></Surface>}
        {image ? <>
          <Field label="Give it a title" value={title} onChangeText={setTitle} placeholder="Hotel booking in Berlin" />
          <Field label="Add a note (optional)" value={body} onChangeText={setBody} placeholder="Anything you already know" multiline />
          <TextBlock size="small" color={colors.secondary}>Text recognition runs locally on the PINGO server when configured. Any dates or amounts still need your review.</TextBlock>
        </> : null}
        <ErrorMessage message={pickerError || (save.error instanceof Error ? save.error.message : null)} />
        {image ? <ActionButton title="Save screenshot" onPress={() => save.mutate()} busy={save.isPending} /> : null}
      </View> : null}

      {mode === 'document' ? <View style={{ gap: 15 }}>
        {document ? <Surface style={{ gap: 8 }}>
          <TextBlock size="subheading" style={{ fontWeight: '600' }}>{document.name}</TextBlock>
          <TextBlock size="small" color={colors.secondary}>Private PDF · up to 20 MB · text is extracted on your PINGO server.</TextBlock>
          <Pressable onPress={pickPdf} accessibilityRole="button" style={{ minHeight: 42, justifyContent: 'center' }}><TextBlock size="small" color={colors.accent}>Choose a different PDF</TextBlock></Pressable>
        </Surface> : <Surface style={{ borderStyle: 'dashed', alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <TextBlock size="subheading" style={{ fontWeight: '600' }}>Add a document</TextBlock>
          <TextBlock color={colors.secondary} style={{ textAlign: 'center' }}>Save a PDF privately. Searchable text is extracted locally; scanned pages use local OCR when configured.</TextBlock>
          <View style={{ width: '100%', marginTop: 3 }}><ActionButton title="Choose a PDF" onPress={pickPdf} variant="secondary" /></View>
        </Surface>}
        {document ? <>
          <Field label="Give it a title" value={title} onChangeText={setTitle} placeholder="Passport scan" />
          <Field label="Add a note (optional)" value={body} onChangeText={setBody} placeholder="Anything you want to remember" multiline />
        </> : null}
        <ErrorMessage message={pickerError || (save.error instanceof Error ? save.error.message : null)} />
        {document ? <ActionButton title="Save private PDF" onPress={() => save.mutate()} busy={save.isPending} disabled={!title.trim()} /> : null}
      </View> : null}

      {mode === 'note' || mode === 'link' ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 15 }}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder={mode === 'link' ? 'A place to try' : 'Remember to…'} />
        {mode === 'link' ? <Field label="Link" value={url} onChangeText={setUrl} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" /> : null}
        <Field label={mode === 'link' ? 'Why you saved it (optional)' : 'Details'} value={body} onChangeText={setBody} placeholder={mode === 'link' ? 'What do you want to remember?' : 'Add a detail you might need later'} multiline />
        <ErrorMessage message={save.error instanceof Error ? save.error.message : null} />
        <ActionButton title="Save to memory" onPress={() => save.mutate()} busy={save.isPending} disabled={!title.trim() || (mode === 'link' && !url.trim())} />
      </KeyboardAvoidingView> : null}

      {mode === 'reminder' ? <Surface><ReminderComposer tripId={typeof params.trip_id === 'string' ? params.trip_id : undefined} initialKind={params.type === 'payment' ? 'payment' : params.type === 'trip' ? 'trip' : 'deadline'} onSaved={() => { client.invalidateQueries({ queryKey: ['dashboard'] }); client.invalidateQueries({ queryKey: ['reminders'] }); router.back(); }} /></Surface> : null}
    </Screen>
  );
}
