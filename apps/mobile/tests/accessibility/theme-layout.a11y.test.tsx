import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

describe('theme and responsive layout', () => {
  it('keeps light/dark semantic tokens and touch targets stable', () => {
    expect(lightTheme.color.canvas).not.toBe(darkTheme.color.canvas);
    expect(tokens.touchTarget).toBeGreaterThanOrEqual(44);
    expect(tokens.spacing.xxl).toBeGreaterThan(tokens.spacing.sm);
  });
});
