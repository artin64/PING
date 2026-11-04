import { SymbolView } from 'expo-symbols';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePingoTheme } from '@/lib/theme';

const symbols = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  memory: { ios: 'folder', android: 'folder_open', web: 'folder_open' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  money: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  life: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  sparkles: { ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  document: { ios: 'doc.text', android: 'description', web: 'description' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  link: { ios: 'link', android: 'link', web: 'link' },
  note: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  reminder: { ios: 'calendar.badge.clock', android: 'event_upcoming', web: 'event_upcoming' },
  flight: { ios: 'airplane', android: 'flight_takeoff', web: 'flight_takeoff' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  receipt: { ios: 'receipt', android: 'receipt_long', web: 'receipt_long' },
  security: { ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' },
  chart: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  person: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
} as const;

export type PingoIconName = keyof typeof symbols;

export function PingoIcon({ name, size = 20, color, style }: {
  name: PingoIconName; size?: number; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const colors = usePingoTheme();
  return <SymbolView name={symbols[name]} size={size} tintColor={color || colors.text} weight="medium" style={style} />;
}

export function Screen({ children, scroll = true, contentStyle }: PropsWithChildren<{
  scroll?: boolean; contentStyle?: StyleProp<ViewStyle>;
}>) {
  const colors = usePingoTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, contentStyle]}>
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      ) : <View style={[styles.inner, styles.noScroll, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

export function TextBlock({ children, size = 'body', color, style, onPress, numberOfLines }: PropsWithChildren<{
  size?: 'eyebrow' | 'small' | 'body' | 'title' | 'heading' | 'subheading';
  color?: string;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
  numberOfLines?: number;
}>) {
  const colors = usePingoTheme();
  const presets = {
    eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.15 },
    small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
    subheading: { fontSize: 18, lineHeight: 25, fontWeight: '500' as const, letterSpacing: -0.25 },
    heading: { fontSize: 23, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.45 },
    title: { fontSize: 31, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.8 },
  };
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      style={[presets[size], { color: color || colors.text, fontFamily: Platform.OS === 'web' ? 'Inter, system-ui, -apple-system, sans-serif' : undefined }, style]}
    >
      {children}
    </Text>
  );
}

export function Surface({ children, style, tone = 'default' }: PropsWithChildren<{
  style?: StyleProp<ViewStyle>; tone?: 'default' | 'raised';
}>) {
  const colors = usePingoTheme();
  return (
    <View style={[
      styles.surface,
      { backgroundColor: tone === 'raised' ? colors.surfaceRaised : colors.surface, borderColor: colors.border },
      !colors.isDark && styles.lightShadow,
      style,
    ]}>
      {children}
    </View>
  );
}

export function ActionButton({ title, onPress, variant = 'primary', disabled, busy, accessibilityLabel, icon }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean; busy?: boolean; accessibilityLabel?: string; icon?: PingoIconName;
}) {
  const colors = usePingoTheme();
  const palette = {
    primary: { backgroundColor: colors.accentSolid, color: colors.onAccent, borderColor: colors.accentSolid },
    secondary: { backgroundColor: colors.surfaceRaised, color: colors.text, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent', color: colors.accent, borderColor: 'transparent' },
    danger: { backgroundColor: colors.danger, color: colors.inverse, borderColor: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, palette, (pressed || disabled || busy) && { opacity: pressed ? 0.88 : 0.48, transform: pressed ? [{ scale: 0.99 }] : undefined }]}
    >
      {busy ? <ActivityIndicator color={palette.color} /> : <View style={styles.buttonContent}>
        {icon ? <PingoIcon name={icon} size={18} color={palette.color} /> : null}
        <Text style={{ color: palette.color, fontSize: 15, fontWeight: '600', letterSpacing: 0.1 }}>{title}</Text>
      </View>}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize = 'sentences', secureTextEntry, right, left }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; secureTextEntry?: boolean; right?: ReactNode; left?: ReactNode;
}) {
  const colors = usePingoTheme();
  return (
    <View style={styles.fieldWrap}>
      <TextBlock size="small" color={colors.secondary} style={styles.fieldLabel}>{label}</TextBlock>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: multiline ? 112 : 54, alignItems: multiline ? 'flex-start' : 'center' }]}>
        {left ? <View style={{ paddingRight: 10 }}>{left}</View> : null}
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
          style={[styles.input, { color: colors.text, minHeight: multiline ? 94 : 52 }]}
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

export function SectionHeading({ title, action, style }: { title: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.sectionHeading, style]}><TextBlock size="subheading" style={{ fontWeight: '600' }}>{title}</TextBlock>{action}</View>;
}

export function BackButton({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = usePingoTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.65 }]}><PingoIcon name="back" size={18} color={colors.secondary} /><TextBlock size="small" color={colors.secondary} style={{ fontWeight: '600' }}>{title}</TextBlock></Pressable>;
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' }>) {
  const colors = usePingoTheme();
  const palette = {
    neutral: { backgroundColor: colors.surfaceMuted, color: colors.secondary },
    success: { backgroundColor: colors.accentSoft, color: colors.accent },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  }[tone];
  return <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}><Text style={{ color: palette.color, fontSize: 11, lineHeight: 15, fontWeight: '600' }}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 35 },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 21, paddingTop: 14 },
  noScroll: { flex: 1 },
  surface: { borderWidth: 1, borderRadius: 22, padding: 17, shadowColor: '#0B1728', shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  lightShadow: { shadowOpacity: 0.055, shadowRadius: 16, elevation: 2 },
  button: { minHeight: 52, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  fieldWrap: { gap: 0 },
  fieldLabel: { marginBottom: 7 },
  field: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, flexDirection: 'row' },
  input: { flex: 1, color: '#102033', fontSize: 16, lineHeight: 22, paddingVertical: 13, minWidth: 0 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 5 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, alignSelf: 'flex-start' },
  backButton: { minHeight: 43, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 10 },
});
