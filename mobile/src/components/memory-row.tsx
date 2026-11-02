import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Surface, TextBlock } from '@/components/ui';
import type { Artikull } from '@/data/artikujt';
import { usePingoTheme } from '@/lib/theme';

export function MemoryRow({ artikulli }: { artikulli: Artikull }) {
  const colors = usePingoTheme();

  return (
    <Link href={{ pathname: '/artikull/[id]', params: { id: artikulli.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Hap ' + artikulli.titulli}
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
      >
        <Surface style={{ minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <TextBlock size="eyebrow" color={colors.accent}>{artikulli.kategoria.slice(0, 1)}</TextBlock>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <TextBlock style={{ fontWeight: '600' }}>{artikulli.titulli}</TextBlock>
            <TextBlock size="small" color={colors.secondary} numberOfLines={1}>{artikulli.pershkrimi}</TextBlock>
          </View>
          <TextBlock color={colors.secondary} style={{ fontSize: 22 }}>›</TextBlock>
        </Surface>
      </Pressable>
    </Link>
  );
}
