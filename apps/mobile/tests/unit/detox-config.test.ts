import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('canonical Detox matrix', () => {
  it('defines phone/tablet and light/dark profiles for both platforms', () => {
    const source = readFileSync(join(__dirname, '../../.detoxrc.js'), 'utf8');
    for (const profile of [
      'ios.phone.light',
      'ios.phone.dark',
      'ios.tablet.light',
      'ios.tablet.dark',
      'android.phone.light',
      'android.phone.dark',
      'android.tablet.light',
      'android.tablet.dark',
    ]) {
      expect(source).toContain(profile);
    }
  });

  it('builds Android from the generated native project on Windows and Unix', () => {
    const source = readFileSync(join(__dirname, '../../.detoxrc.js'), 'utf8');

    expect(source).toContain(
      "'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug'",
    );
    expect(source).toContain(
      "'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'",
    );
  });
});
