import { render } from '@testing-library/react-native';
import { AppButton, ScreenFrame } from '@/components/ui/ScreenPrimitives';

describe('shared screen primitives', () => {
  it('exposes a semantic heading and a full-size primary action', () => {
    const screen = render(
      <ScreenFrame
        testID="screen"
        eyebrow="TODAY"
        title="Dashboard"
        subtitle="Your work at a glance"
      >
        <AppButton label="Open attendance" onPress={jest.fn()} />
      </ScreenFrame>,
    );

    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open attendance' })).toBeTruthy();
  });
});
