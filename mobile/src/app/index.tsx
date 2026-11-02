import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemoryRow } from '@/components/memory-row';
import { TextBlock } from '@/components/ui';
import { artikujt } from '@/data/artikujt';
import { usePingoTheme } from '@/lib/theme';

export default function ListaScreen() {
  const colors = usePingoTheme();
  const [kerkimi, setKerkimi] = useState('');
  const teFiltruar = useMemo(() => {
    const termi = kerkimi.trim().toLocaleLowerCase();
    if (!termi) return artikujt;
    return artikujt.filter((artikull) => [
      artikull.titulli,
      artikull.kategoria,
      artikull.pershkrimi,
    ].join(' ').toLocaleLowerCase().includes(termi));
  }, [kerkimi]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={teFiltruar}
        keyExtractor={(artikull) => artikull.id}
        renderItem={({ item }) => <MemoryRow artikulli={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
        contentContainerStyle={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 15, paddingBottom: 36, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ marginBottom: 19 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 }}>
              <View>
                <TextBlock size="eyebrow" color={colors.accent}>PINGO · NEVER MISS WHAT MATTERS</TextBlock>
                <TextBlock size="title" style={{ fontWeight: '600', marginTop: 8 }}>Kujtimet e tua</TextBlock>
              </View>
              <Link href="/sign-in" accessibilityRole="button" style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Hap PINGO</Link>
            </View>

            <TextBlock size="small" color={colors.secondary} style={{ marginBottom: 8 }}>LISTA → DETAJET · J3</TextBlock>
            <TextInput
              accessibilityLabel="Kërko në shembujt e memories"
              value={kerkimi}
              onChangeText={setKerkimi}
              placeholder="Kërko një kujtim…"
              placeholderTextColor={colors.secondary}
              returnKeyType="search"
              autoCapitalize="none"
              style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 15, color: colors.text, backgroundColor: colors.surface, fontSize: 16 }}
            />
            <View style={{ marginTop: 14, marginBottom: 3, padding: 11, borderRadius: 12, backgroundColor: colors.accentSoft }}>
              <TextBlock size="small" color={colors.accent}>SHEMBULL · Të dhënat në këtë listë janë fiktive.</TextBlock>
            </View>
            <TextBlock size="small" color={colors.secondary} style={{ marginTop: 14, marginBottom: 10 }}>
              {teFiltruar.length} {teFiltruar.length === 1 ? 'kujtesë' : 'kujtesa'} demonstrimi
            </TextBlock>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            <TextBlock style={{ fontWeight: '600' }}>Asnjë rezultat</TextBlock>
            <TextBlock size="small" color={colors.secondary} style={{ marginTop: 5 }}>Provo një fjalë tjetër.</TextBlock>
          </View>
        }
        ListFooterComponent={
          <View style={{ alignItems: 'center', paddingTop: 22 }}>
            <TextBlock size="small" color={colors.secondary}>Prek një rresht për të parë detajet.</TextBlock>
          </View>
        }
      />
    </SafeAreaView>
  );
}
