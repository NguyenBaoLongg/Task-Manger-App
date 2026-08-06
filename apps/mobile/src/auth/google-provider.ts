export type GoogleAuthResult = { idToken: string; email?: string; displayName?: string };

export type GoogleProvider = {
  signIn: () => Promise<GoogleAuthResult>;
  signOut: () => Promise<void>;
};
