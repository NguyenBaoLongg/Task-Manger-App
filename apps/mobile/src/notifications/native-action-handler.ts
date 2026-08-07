import type { TenantContext } from '@/tenant/tenant-context';
import { resolveActionItemRoute, type DeepLinkIntent } from '@/navigation/action-item-route';
import { createQuickActionFlow } from './arrived-proof-action';
import { createCancelRescheduleFlow } from './cancel-reschedule-action';

export type NativeBookingAction = 'ARRIVED_PROOF' | 'CANCEL_OR_RESCHEDULE';

const nativeActionAliases: Record<string, NativeBookingAction> = {
  ARRIVED_PROOF: 'ARRIVED_PROOF',
  ADSUP_ARRIVED_PROOF: 'ARRIVED_PROOF',
  COM_ADSUP_ACTION_ARRIVED_PROOF: 'ARRIVED_PROOF',
  CANCEL_OR_RESCHEDULE: 'CANCEL_OR_RESCHEDULE',
  ADSUP_CANCEL_OR_RESCHEDULE: 'CANCEL_OR_RESCHEDULE',
  COM_ADSUP_ACTION_CANCEL_OR_RESCHEDULE: 'CANCEL_OR_RESCHEDULE',
};

const normalizeIdentifierKey = (identifier: string) =>
  identifier.trim().replace(/[-.]/g, '_').toUpperCase();

export const normalizeNativeAction = (input: { identifier: string; platform: string }) => {
  const action = nativeActionAliases[normalizeIdentifierKey(input.identifier)];
  if (!action) throw new Error('UNSUPPORTED_NATIVE_ACTION');
  return { action, platform: input.platform };
};

export const handleNativeAction = async (
  input: { identifier: string; platform: string; intent: DeepLinkIntent },
  options: {
    context: TenantContext;
    now: number;
    authenticated: boolean;
    permissions: readonly string[];
    submit: () => Promise<void>;
    resolveProof: () => Promise<boolean>;
  },
) => {
  const action = normalizeNativeAction(input);
  const resolved = resolveActionItemRoute(input.intent, options);
  if (resolved.kind !== 'open') return resolved;
  if (action.action === 'ARRIVED_PROOF')
    await createQuickActionFlow({ resolve: options.resolveProof, submit: options.submit }).run();
  else
    await createCancelRescheduleFlow({
      resolve: options.resolveProof,
      submit: options.submit,
    }).run();
  return resolved;
};

export const createNativeActionResponseHandler =
  (options: Parameters<typeof handleNativeAction>[1]) =>
  (input: { identifier: string; platform: string; intent: DeepLinkIntent }) =>
    handleNativeAction(input, options);
