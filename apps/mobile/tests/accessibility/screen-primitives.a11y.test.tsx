import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
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

  it('shows a back button when navigation history exists', () => {
    const router = useRouter();
    jest.mocked(router.canGoBack).mockReturnValueOnce(true);

    const screen = render(
      <ScreenFrame title="Dashboard">
        <AppButton label="Open attendance" onPress={jest.fn()} />
      </ScreenFrame>,
    );

    const backButton = screen.getByRole('button', { name: 'Quay lại' });
    expect(backButton).toBeTruthy();
    fireEvent.press(backButton);
    expect(router.back).toHaveBeenCalled();
  });
});
