import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePingoTheme } from '@/lib/theme';

const entries = [
  { label: 'Today', path: '/today' },
  { label: 'Memory', path: '/(app)/memory' },
  { label: 'Add', path: '/capture' },
  { label: 'Money', path: '/(app)/money' },
  { label: 'Life', path: '/(app)/life' },
] as const;

export function BottomNavigation() {
  const colors = usePingoTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {entries.map((entry) => {
        const active = entry.label === 'Today' ? path === '/today' : entry.label === 'Add' ? path === '/capture' : path.includes(entry.path.split('/').at(-1) || '');
        const add = entry.label === 'Add';
        return (
          <Pressable
            key={entry.label}
            accessibilityRole="button"
            accessibilityLabel={entry.label === 'Add' ? 'Add something to PINGO' : `Open ${entry.label}`}
            onPress={() => router.navigate(entry.path)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.72 }]}
          >
            {add ? (
              <View style={[styles.addCircle, { backgroundColor: colors.text }]}><Text style={{ color: colors.inverse, fontSize: 25, lineHeight: 28 }}>+</Text></View>
            ) : (
              <Text style={{ color: active ? colors.accent : colors.secondary, fontSize: 11, fontWeight: active ? '700' : '500', letterSpacing: 0.2 }}>{entry.label}</Text>
            )}
            {add && <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }}>Add</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 5 },
  item: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
