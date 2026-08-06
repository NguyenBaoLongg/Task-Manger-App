import { lightTheme, darkTheme } from '@/theme/theme';
import { mobileFixture } from '../fixtures/mobile-fixture';

describe('mobile foundation', () => {
  it('keeps accessible touch targets stable across themes', () => {
    expect(lightTheme.touchTarget).toBeGreaterThanOrEqual(44);
    expect(darkTheme.touchTarget).toBe(lightTheme.touchTarget);
  });

  it('uses the blue ADSUP brand identity as the primary action color', () => {
    expect(lightTheme.color.primary).toBe('#1268C4');
    expect(lightTheme.color.accent).toBe('#28AEE4');
  });

  it('uses deterministic tenant fixtures with a branch scope', () => {
    expect(mobileFixture.tenant.id).toBe('tenant-demo');
    expect(mobileFixture.branches).toHaveLength(1);
  });
});
