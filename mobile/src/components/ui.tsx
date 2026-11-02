import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePingoTheme } from '@/lib/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const colors = usePingoTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      ) : <View style={[styles.inner, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

export function TextBlock({ children, size = 'body', color, style, onPress, numberOfLines }: PropsWithChildren<{
  size?: 'eyebrow' | 'small' | 'body' | 'title' | 'heading' | 'subheading';
  color?: string;
  style?: object;
  onPress?: () => void;
  numberOfLines?: number;
}>) {
  const colors = usePingoTheme();
  const font = { eyebrow: 11, small: 13, body: 15, subheading: 18, heading: 23, title: 32 }[size];
  return (
    <Text onPress={onPress} numberOfLines={numberOfLines} style={[{ color: color || colors.text, fontSize: font, lineHeight: Math.round(font * 1.38), fontWeight: size === 'eyebrow' ? '600' : '400', letterSpacing: size === 'eyebrow' ? 1.3 : 0 }, style]}>
      {children}
    </Text>
  );
}

export function Surface({ children, style }: PropsWithChildren<{ style?: object }>) {
  const colors = usePingoTheme();
  return <View style={[styles.surface, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function ActionButton({ title, onPress, variant = 'primary', disabled, busy, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
}) {
  const colors = usePingoTheme();
  const palette = {
    primary: { backgroundColor: colors.text, color: colors.inverse, borderColor: colors.text },
    secondary: { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent', color: colors.accent, borderColor: 'transparent' },
    danger: { backgroundColor: colors.danger, color: colors.inverse, borderColor: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, palette, (pressed || disabled || busy) && { opacity: pressed ? 0.78 : 0.5 }]}
    >
      {busy ? <ActivityIndicator color={palette.color} /> : <Text style={{ color: palette.color, fontSize: 15, fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize = 'sentences', secureTextEntry, right }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; secureTextEntry?: boolean; right?: ReactNode;
}) {
  const colors = usePingoTheme();
  return (
    <View style={styles.fieldWrap}>
      <TextBlock size="small" color={colors.secondary} style={{ marginBottom: 7 }}>{label}</TextBlock>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: multiline ? 108 : 52 }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.secondary}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={keyboardType !== 'email-address' && keyboardType !== 'url'}
          secureTextEntry={secureTextEntry}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12, minHeight: multiline ? 100 : 48 }}
          accessibilityLabel={label}
        />
        {right}
      </View>
    </View>
  );
}

export function ErrorMessage({ message }: { message: string | null | undefined }) {
  const colors = usePingoTheme();
  if (!message) return null;
  return <TextBlock size="small" color={colors.danger} style={{ marginTop: 10 }}>{message}</TextBlock>;
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionHeading}><TextBlock size="subheading" style={{ fontWeight: '600' }}>{title}</TextBlock>{action}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 28 },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 10 },
  surface: { borderWidth: 1, borderRadius: 18, padding: 17 },
  button: { minHeight: 50, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  fieldWrap: { gap: 0 },
  field: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
});
