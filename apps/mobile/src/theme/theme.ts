import { tokens } from './tokens';

export type AppTheme = {
  color: { [key in keyof typeof tokens.color]: string };
  spacing: typeof tokens.spacing;
  radius: typeof tokens.radius;
  typography: typeof tokens.typography;
  touchTarget: number;
};

export const lightTheme: AppTheme = tokens;

export const darkTheme: AppTheme = {
  ...tokens,
  color: {
    ...tokens.color,
    ink: '#EDF5FF',
    muted: '#A9B9CC',
    canvas: '#091525',
    surface: '#10233A',
    surfaceMuted: '#162C46',
    border: '#29435F',
    primary: '#56A7F1',
    primaryPressed: '#83C1F7',
    primarySoft: '#173B60',
    primaryMuted: '#255985',
    accent: '#57C7EF',
    accentSoft: '#123B4C',
    dangerSoft: '#4C2028',
    successSoft: '#153C2F',
    info: '#8BB1FF',
    infoSoft: '#1B315D',
    warning: '#F2B64D',
    warningSoft: '#4A3716',
    inkInverted: '#071422',
  },
};

export type RuntimeThemeInput = {
  colorScheme?: 'light' | 'dark' | null;
  launchArgs?: Record<string, string | boolean | undefined>;
};

export const resolveRuntimeTheme = ({ colorScheme, launchArgs = {} }: RuntimeThemeInput) => {
  const forcedAppearance = launchArgs['ui-test-appearance'];
  if (forcedAppearance === 'dark') return darkTheme;
  if (forcedAppearance === 'light') return lightTheme;
  return colorScheme === 'dark' ? darkTheme : lightTheme;
};
