import Constants from 'expo-constants';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, resolveRuntimeTheme, type AppTheme } from './theme';

const ThemeContext = createContext<AppTheme>(lightTheme);

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();
  const theme = useMemo(
    () =>
      resolveRuntimeTheme({
        colorScheme,
        launchArgs: Constants.expoConfig?.extra as Record<string, string | boolean | undefined>,
      }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
