import '@testing-library/jest-native/extend-expect';

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
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return {
    router,
    useRouter: jest.fn(() => router),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});
