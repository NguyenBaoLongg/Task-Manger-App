export type GoogleAuthResult = {
  idToken?: string;
  email?: string;
  displayName?: string;
  cancelled?: boolean;
};

export type GoogleProvider = {
  signIn: () => Promise<GoogleAuthResult>;
  signOut: () => Promise<void>;
};
