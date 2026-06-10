import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// A warm, editorial palette with a single confident accent (deep green).
export const colors = {
  bg: '#F3F1EC',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF9F6',
  border: '#E7E3DA',
  borderStrong: '#D8D3C7',

  ink: '#1B1A17',
  inkSoft: '#56544D',
  muted: '#8C887E',

  accent: '#1C6B4B',
  accentSoft: '#E4EEE7',

  warn: '#9A6213',
  warnSoft: '#F6ECDB',

  danger: '#A8392E',
  dangerSoft: '#F4E4E1',

  online: '#1C6B4B',
  offline: '#A8392E',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const type = {
  display: { fontSize: 68, fontWeight: '700' as const, letterSpacing: -1 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700' as const },
  label: { fontSize: 12, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
};

export const mono = Platform.select({
  web: "ui-monospace, SFMono-Regular, Menlo, monospace",
  default: 'monospace',
}) as string;

export const shadow: ViewStyle = {
  shadowColor: '#1B1A17',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 2,
};

export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  ...shadow,
};

export const labelMuted: TextStyle = {
  ...type.label,
  color: colors.muted,
  textTransform: 'uppercase',
};
