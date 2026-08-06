import { create } from 'zustand';
import type { TenantContextValue } from './tenant-context';

type TenantContextStore = {
  context?: TenantContextValue;
  setContext: (context: TenantContextValue) => void;
  clear: () => void;
};

export const useTenantContextStore = create<TenantContextStore>((set) => ({
  context: undefined,
  setContext: (context) => set({ context }),
  clear: () => set({ context: undefined }),
}));
