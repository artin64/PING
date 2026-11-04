import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    mode: 'light' as const,
    isDark: false,
    background: '#F5F8FB',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF3F7',
    surfaceRaised: '#FFFFFF',
    text: '#102033',
    secondary: '#5C6F83',
    border: '#E1E8EF',
    accent: '#007A59',
    accentSolid: '#00B981',
    accentSoft: '#DDF8ED',
    success: '#007A59',
    warning: '#94600A',
    warningSoft: '#FFF2D4',
    danger: '#B43E3E',
    dangerSoft: '#FCE9E7',
    inverse: '#FFFFFF',
    onAccent: '#07111F',
    hero: '#0B1728',
    heroRaised: '#14273D',
    heroText: '#FFFFFF',
    heroMuted: '#B5C6D8',
  },
  dark: {
    mode: 'dark' as const,
    isDark: true,
    background: '#07111F',
    surface: '#101E30',
    surfaceMuted: '#16263A',
    surfaceRaised: '#1B2D43',
    text: '#F4F8FC',
    secondary: '#A9B8C9',
    border: '#24374C',
    accent: '#43E7AC',
    accentSolid: '#00D68F',
    accentSoft: '#113D35',
    success: '#43E7AC',
    warning: '#F6C66A',
    warningSoft: '#423416',
    danger: '#FF8585',
    dangerSoft: '#47262B',
    inverse: '#07111F',
    onAccent: '#07111F',
    hero: '#0B1728',
    heroRaised: '#14273D',
    heroText: '#FFFFFF',
    heroMuted: '#B5C6D8',
  },
};

export function usePingoTheme() {
  const scheme = useColorScheme();
  return palettes[scheme === 'dark' ? 'dark' : 'light'];
}

export type PingoColors = ReturnType<typeof usePingoTheme>;
