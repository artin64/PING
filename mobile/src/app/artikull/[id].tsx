import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActionButton, Screen, Surface, TextBlock } from '@/components/ui';
import { gjeArtikullin } from '@/data/artikujt';
import { usePingoTheme } from '@/lib/theme';

export default function DetajetScreen() {
  const colors = usePingoTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const artikulli = gjeArtikullin(id);

  if (!artikulli) {
    return (
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel="Kthehu te lista" onPress={() => router.replace('/')} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <TextBlock color={colors.secondary}>‹  Lista</TextBlock>
        </Pressable>
        <View style={{ marginTop: 24, gap: 12 }}>
          <TextBlock size="eyebrow" color={colors.accent}>PINGO · DETAJET</TextBlock>
          <TextBlock size="heading" style={{ fontWeight: '600' }}>Artikulli nuk u gjet</TextBlock>
          <TextBlock color={colors.secondary}>ID-ja “{id || 'bosh'}” nuk lidhet me asnjë kujtim në këtë listë.</TextBlock>
          <ActionButton title="Kthehu te lista" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Kthehu te lista" onPress={() => router.replace('/')} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <TextBlock color={colors.secondary}>‹  Lista</TextBlock>
      </Pressable>

      <View style={{ marginTop: 19, marginBottom: 19 }}>
        <TextBlock size="eyebrow" color={colors.accent}>{artikulli.kategoria} · MEMORY DEMO</TextBlock>
        <TextBlock size="title" style={{ fontWeight: '600', marginTop: 8 }}>{artikulli.titulli}</TextBlock>
        <TextBlock color={colors.secondary} style={{ marginTop: 8 }}>{artikulli.pershkrimi}</TextBlock>
      </View>

      <Surface style={{ gap: 13 }}>
        <TextBlock size="eyebrow" color={colors.accent}>DETAJET E RUAJTURA</TextBlock>
        {artikulli.detaje.map((detaj) => (
          <View key={detaj} style={{ flexDirection: 'row', gap: 9 }}>
            <TextBlock color={colors.accent}>•</TextBlock>
            <TextBlock style={{ flex: 1 }}>{detaj}</TextBlock>
          </View>
        ))}
      </Surface>

      <Surface style={{ marginTop: 12, gap: 5 }}>
        <TextBlock size="eyebrow" color={colors.secondary}>BURIMI</TextBlock>
        <TextBlock>{artikulli.burimi}</TextBlock>
        <TextBlock size="small" color={colors.secondary}>Ky artikull është të dhënë fiktive për demonstrim. Nuk është rezervim, faturë ose dokument real.</TextBlock>
      </Surface>

      <View style={{ marginTop: 18 }}>
        <ActionButton title="Kthehu te lista" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
