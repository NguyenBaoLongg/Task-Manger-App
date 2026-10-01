import '@testing-library/jest-native/extend-expect';
import type { EffectCallback } from 'react';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
  expoConfig: { extra: {} },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual('react') as {
    useEffect: (effect: EffectCallback, dependencies: readonly unknown[]) => void;
  };
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  };
  return {
    router,
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    useRouter: jest.fn(() => router),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    getTokens: jest.fn(),
    getCurrentUser: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isSuccessResponse: jest.fn((response: unknown) => (response as { type?: string })?.type === 'success'),
  isCancelledResponse: jest.fn(
    (response: unknown) => (response as { type?: string })?.type === 'cancelled',
  ),
  isErrorWithCode: jest.fn(),
}));

// The real Ionicons loads its font asynchronously and setStates on resolve, which fires
// act(...) warnings in every accessibility test. A synchronous stand-in renders the glyph
// name as Text; testID/accessibility props pass through unchanged.
jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual('react') as {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => unknown;
    forwardRef: (render: (props: Record<string, unknown>, ref: unknown) => unknown) => unknown;
  };
  const { Text } = jest.requireActual('react-native') as {
    Text: unknown;
  };
  const Icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const rest = { ...props };
    delete rest.name;
    delete rest.size;
    delete rest.color;
    return React.createElement(Text, { ref, ...rest, children: props.name ?? '' });
  });
  return { Ionicons: Icon };
});
