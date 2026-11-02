import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    background: '#F7F6F2',
    surface: '#FFFFFF',
    surfaceMuted: '#EFEEE9',
    text: '#191A18',
    secondary: '#6B6C67',
    border: '#E6E4DC',
    accent: '#765E35',
    accentSoft: '#F0E8D8',
    success: '#34745A',
    warning: '#A66A19',
    danger: '#A54136',
    inverse: '#FFFFFF',
  },
  dark: {
    background: '#191A18',
    surface: '#232421',
    surfaceMuted: '#2D2E2A',
    text: '#F7F6F2',
    secondary: '#B8B8B0',
    border: '#3B3C37',
    accent: '#C5A96D',
    accentSoft: '#393328',
    success: '#8BC5A5',
    warning: '#E0B56B',
    danger: '#E18B7F',
    inverse: '#191A18',
  },
};

export function usePingoTheme() {
  const scheme = useColorScheme();
  return palettes[scheme === 'dark' ? 'dark' : 'light'];
}

export type PingoColors = ReturnType<typeof usePingoTheme>;
