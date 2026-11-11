import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    mode: 'light' as const,
    isDark: false,
    background: '#F6F9FC',
    surface: '#FFFFFF',
    surfaceMuted: '#EDF2F7',
    surfaceRaised: '#FFFFFF',
    text: '#102033',
    secondary: '#56697E',
    border: '#E5EAF0',
    accent: '#087A5B',
    accentSolid: '#00D68F',
    accentSoft: '#DEF7EC',
    blue: '#256FB8',
    blueSoft: '#E5F1FF',
    gold: '#94600A',
    goldSoft: '#FFF3D8',
    success: '#087A5B',
    warning: '#98610A',
    warningSoft: '#FFF2D7',
    danger: '#AD3742',
    dangerSoft: '#FDE9EA',
    inverse: '#FFFFFF',
    onAccent: '#062218',
    hero: '#07111F',
    heroRaised: '#0B1728',
    heroText: '#FFFFFF',
    heroMuted: '#D8E4F0',
  },
  dark: {
    mode: 'dark' as const,
    isDark: true,
    background: '#071321',
    surface: '#102237',
    surfaceMuted: '#172B43',
    surfaceRaised: '#1B3048',
    text: '#F5F8FC',
    secondary: '#AAB9CB',
    border: '#2A3E56',
    accent: '#57DDAA',
    accentSolid: '#2ACB91',
    accentSoft: '#163A34',
    blue: '#75BFFF',
    blueSoft: '#173651',
    gold: '#FFD276',
    goldSoft: '#49391D',
    success: '#57DDAA',
    warning: '#F2C36E',
    warningSoft: '#42361D',
    danger: '#FF9296',
    dangerSoft: '#482B31',
    inverse: '#071321',
    onAccent: '#062218',
    hero: '#071728',
    heroRaised: '#142D46',
    heroText: '#FFFFFF',
    heroMuted: '#C9D7E7',
  },
};

export function usePingoTheme() {
  const scheme = useColorScheme();
  return palettes[scheme === 'dark' ? 'dark' : 'light'];
}

export type PingoColors = ReturnType<typeof usePingoTheme>;
