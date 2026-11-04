import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { usePingoTheme } from '@/lib/theme';

export default function RootLayout() {
  const colors = usePingoTheme();
  const client = useMemo(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } },
  }), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style={colors.isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
