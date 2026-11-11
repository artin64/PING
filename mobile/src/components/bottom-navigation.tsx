import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PingoIcon } from '@/components/ui';
import { usePingoTheme } from '@/lib/theme';

const entries = [
  { label: 'Today', path: '/(app)', icon: 'home', route: 'today' },
  { label: 'Memory', path: '/(app)/memory', icon: 'memory', route: 'memory' },
  { label: 'Add', path: '/capture', icon: 'add', route: 'add' },
  { label: 'Money', path: '/(app)/money', icon: 'money', route: 'money' },
  { label: 'Life', path: '/(app)/life', icon: 'life', route: 'life' },
] as const;

export function BottomNavigation() {
  const colors = usePingoTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const isActive = (route: typeof entries[number]['route']) => {
    if (route === 'today') return path === '/';
    if (route === 'memory') return path.startsWith('/memory');
    if (route === 'add') return path === '/capture';
    if (route === 'money') return path === '/money';
    return path === '/life' || path.startsWith('/trips') || path.startsWith('/reminders') || path === '/settings';
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 7) }]}>
      {entries.map((entry) => {
        const active = isActive(entry.route);
        const add = entry.route === 'add';
        return (
          <Pressable
            key={entry.route}
            accessibilityRole="button"
            accessibilityLabel={entry.label === 'Add' ? 'Add something to PINGO' : `Open ${entry.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(entry.path)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.72 }]}
          >
            {add ? (
              <View style={[styles.addCircle, { backgroundColor: colors.accentSolid, borderColor: colors.surface }]}><PingoIcon name="add" size={26} color={colors.onAccent} /></View>
            ) : (
              <View style={styles.navIcon}>
                {active ? <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} /> : null}
                <PingoIcon name={entry.icon} size={21} color={active ? colors.accent : colors.secondary} />
              </View>
            )}
            <Text style={{ color: add ? colors.secondary : active ? colors.accent : colors.secondary, fontSize: 11, lineHeight: 14, fontWeight: active ? '700' : '500', letterSpacing: 0.05 }}>{entry.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7 },
  item: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIcon: { height: 27, minWidth: 30, alignItems: 'center', justifyContent: 'flex-end' },
  activeIndicator: { position: 'absolute', top: 0, width: 17, height: 3, borderRadius: 2 },
  addCircle: { width: 47, height: 47, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -14, borderWidth: 4 },
});
