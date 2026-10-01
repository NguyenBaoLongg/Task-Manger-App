// Minimal surface of the legacy file-system API used for copying picked media into cache. The
// package's TS sources fail this repo's verbatimModuleSyntax config, so tsc is pointed here while
// Metro still loads the real module at runtime.
declare module 'expo-file-system/legacy' {
  export const cacheDirectory: string | null;
  export function copyAsync(options: { from: string; to: string }): Promise<void>;
}
