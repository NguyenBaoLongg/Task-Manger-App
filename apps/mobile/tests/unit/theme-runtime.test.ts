import { darkTheme, lightTheme, resolveRuntimeTheme } from '@/theme/theme';

describe('runtime theme', () => {
  it('selects semantic light and dark themes from launch profile', () => {
    expect(resolveRuntimeTheme({ colorScheme: 'dark' }).color.canvas).toBe(darkTheme.color.canvas);
    expect(resolveRuntimeTheme({ colorScheme: 'light' }).color.canvas).toBe(
      lightTheme.color.canvas,
    );
    expect(resolveRuntimeTheme({ launchArgs: { 'ui-test-appearance': 'dark' } }).color.canvas).toBe(
      darkTheme.color.canvas,
    );
  });
});
