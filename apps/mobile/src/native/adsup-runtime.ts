import { NativeModules } from 'react-native';

export type DashboardStartupMeasurement = {
  durationMs: number;
  endedAtUptimeMs: number;
  sequence: number;
  source: 'process' | 'navigation' | 'javascript-process' | 'javascript-navigation';
  startedAtUptimeMs: number;
};

export type SignInReadyMeasurement = {
  durationMs: number;
  startedAtUptimeMs: number;
  endedAtUptimeMs: number;
};

type AdsupRuntimeNativeModule = {
  getE2eGoogleSubject?: () => Promise<unknown>;
  googleForceReal?: unknown;
  markDashboardActionable?: () => Promise<unknown>;
  markSignInActionable?: () => Promise<unknown>;
  processStartUptimeMs?: unknown;
  startDashboardNavigationMeasurement?: () => void;
  testApiBaseUrl?: unknown;
};

const nowUptimeMs = (): number => globalThis.performance?.now?.() ?? Date.now();
const javascriptProcessStartedAtUptimeMs = nowUptimeMs();
let javascriptNavigationStartedAtUptimeMs: number | undefined;

const getNativeModule = (): AdsupRuntimeNativeModule | undefined => {
  const value: unknown = (NativeModules as Record<string, unknown>).AdsupRuntime;
  return typeof value === 'object' && value !== null
    ? (value as AdsupRuntimeNativeModule)
    : undefined;
};

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isNativeSource = (value: unknown): value is 'process' | 'navigation' =>
  value === 'process' || value === 'navigation';

const parseNativeMeasurement = (value: unknown): DashboardStartupMeasurement => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid native startup metric');
  }
  const metric = value as Record<string, unknown>;
  if (
    !isFiniteNonNegative(metric.durationMs) ||
    !isFiniteNonNegative(metric.startedAtUptimeMs) ||
    !isFiniteNonNegative(metric.endedAtUptimeMs) ||
    !isFiniteNonNegative(metric.sequence) ||
    !isNativeSource(metric.source)
  ) {
    throw new Error('Invalid native startup metric');
  }

  return {
    durationMs: metric.durationMs,
    endedAtUptimeMs: metric.endedAtUptimeMs,
    sequence: metric.sequence,
    source: metric.source,
    startedAtUptimeMs: metric.startedAtUptimeMs,
  };
};

/** Android releaseE2e uses emulator NAT so radio shaping applies and adb reverse is unnecessary. */
export const getReleaseE2eApiBaseUrl = (): string | undefined => {
  const value = getNativeModule()?.testApiBaseUrl;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

/** Opt-in for a releaseE2e build to use the real Google OAuth provider instead of the test double. */
export const isGoogleForceReal = (): boolean => getNativeModule()?.googleForceReal === true;

/**
 * Google test-double subject cho bản releaseE2e: intent extra `ui-test-google-subject` (Detox
 * launchArgs) thắng, fallback về BuildConfig. Bản shipping không dùng test double nên không đọc.
 */
export const getE2eGoogleSubject = async (): Promise<string | undefined> => {
  const nativeGet = getNativeModule()?.getE2eGoogleSubject;
  if (!nativeGet) return undefined;
  const value = await nativeGet();
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

/** Starts the warm-cache boundary immediately before the Dashboard tab navigation. */
export const startDashboardNavigationMeasurement = () => {
  const nativeModule = getNativeModule();
  if (nativeModule?.startDashboardNavigationMeasurement) {
    nativeModule.startDashboardNavigationMeasurement();
    return;
  }
  javascriptNavigationStartedAtUptimeMs = nowUptimeMs();
};

/**
 * Marks the first committed render of the sign-in screen, measured on the native monotonic
 * uptime clock from Process.getStartUptimeMillis(). Enabled only when the E2E launch passes
 * `ui-test-metric=CR-005`; resolves undefined otherwise so non-metric builds stay silent.
 */
export const markSignInActionable = async (): Promise<SignInReadyMeasurement | undefined> => {
  const nativeMark = getNativeModule()?.markSignInActionable;
  if (!nativeMark) return undefined;
  const value = await nativeMark();
  if (typeof value !== 'object' || value === null) return undefined;
  const metric = value as Record<string, unknown>;
  if (
    !isFiniteNonNegative(metric.durationMs) ||
    !isFiniteNonNegative(metric.startedAtUptimeMs) ||
    !isFiniteNonNegative(metric.endedAtUptimeMs)
  ) {
    return undefined;
  }
  return {
    durationMs: metric.durationMs,
    startedAtUptimeMs: metric.startedAtUptimeMs,
    endedAtUptimeMs: metric.endedAtUptimeMs,
  };
};

/**
 * Marks the first committed Dashboard render for which KPI and action-center data are ready.
 * Android calculates this on the monotonic uptime clock from Process.getStartUptimeMillis(); the
 * JavaScript fallback is explicit so non-Android builds never masquerade as a native measurement.
 */
export const markDashboardActionable = async (): Promise<DashboardStartupMeasurement | undefined> => {
  const nativeMark = getNativeModule()?.markDashboardActionable;
  if (nativeMark) return parseNativeMeasurement(await nativeMark());

  const endedAtUptimeMs = nowUptimeMs();
  const navigationStart = javascriptNavigationStartedAtUptimeMs;
  javascriptNavigationStartedAtUptimeMs = undefined;
  const startedAtUptimeMs = navigationStart ?? javascriptProcessStartedAtUptimeMs;

  return {
    durationMs: Math.max(0, endedAtUptimeMs - startedAtUptimeMs),
    endedAtUptimeMs,
    sequence: 0,
    source: navigationStart === undefined ? 'javascript-process' : 'javascript-navigation',
    startedAtUptimeMs,
  };
};
