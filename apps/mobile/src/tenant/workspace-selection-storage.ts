import * as SecureStore from 'expo-secure-store';

/**
 * The workspace and branch the user last chose.
 *
 * This stores a *preference*, never authority. Membership status, role, permissions and branch
 * scope are re-read from the backend on every restore, so a stale or tampered value can at most
 * select which workspace to ask the backend about — it can never grant access. That boundary is
 * required by FR-019 and CR-002: local storage must not become authoritative for tenant,
 * permission or scope.
 */
export type WorkspaceSelection = {
  tenantId: string;
  branchId?: string;
};

const SELECTION_KEY = 'adsup.mobile.workspace-selection.v1';

const isSelection = (value: unknown): value is WorkspaceSelection => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.tenantId !== 'string' || candidate.tenantId.length === 0) return false;
  return candidate.branchId === undefined || typeof candidate.branchId === 'string';
};

export const createWorkspaceSelectionStorage = () => ({
  async load(): Promise<WorkspaceSelection | undefined> {
    const value = await SecureStore.getItemAsync(SELECTION_KEY);
    if (!value) return undefined;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!isSelection(parsed)) {
        await SecureStore.deleteItemAsync(SELECTION_KEY);
        return undefined;
      }
      return { tenantId: parsed.tenantId, branchId: parsed.branchId };
    } catch {
      await SecureStore.deleteItemAsync(SELECTION_KEY);
      return undefined;
    }
  },
  save(value: WorkspaceSelection): Promise<void> {
    return SecureStore.setItemAsync(
      SELECTION_KEY,
      JSON.stringify({ tenantId: value.tenantId, branchId: value.branchId }),
    );
  },
  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(SELECTION_KEY);
  },
});
