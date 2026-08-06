import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AppButton,
  ScreenFrame,
  SectionHeading,
  StatusPill,
  Surface,
} from '@/components/ui/ScreenPrimitives';
import {
  addWorkflowRequestEvidence,
  cancelWorkflowRequest,
  decideWorkflowRequest,
  getWorkflowRequest,
  requestWorkflowChanges,
} from '@/features/approvals/approval-actions';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

type WorkflowRequest = {
  id: string;
  state?: string;
  stateVersion?: number;
  requesterName?: string;
  evidenceMediaId?: string;
};

export default function ApprovalDetailScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const context = useTenantContextStore((state) => state.context);
  const [request, setRequest] = useState<WorkflowRequest>();
  const [reason, setReason] = useState('');
  const [evidenceMediaId, setEvidenceMediaId] = useState('');
  const [status, setStatus] = useState<string>();

  const load = () => {
    if (!context || !requestId) return;
    void getAuthenticatedClient()
      .then((client) => getWorkflowRequest(client, context.tenantId, requestId))
      .then((value) => setRequest(value as WorkflowRequest))
      .catch(() => setStatus('Could not load current request state.'));
  };

  useEffect(load, [context, requestId]);

  const expectedStateVersion = request?.stateVersion ?? 0;

  const withClient = async (
    action: (client: Awaited<ReturnType<typeof getAuthenticatedClient>>) => Promise<unknown>,
  ) => {
    if (!context || !requestId) return;
    try {
      const client = await getAuthenticatedClient();
      await action(client);
      setStatus('Action saved.');
      load();
    } catch {
      setStatus('State is stale or the action is not allowed. Reload and try again.');
    }
  };

  const decide = (decision: string) =>
    withClient((client) =>
      decideWorkflowRequest(client, context!.tenantId, requestId!, {
        decision,
        reason,
        expectedStateVersion,
        idempotencyKey: `decision-${requestId}-${decision}-${expectedStateVersion}`,
      }),
    );

  const addEvidence = () =>
    withClient((client) =>
      addWorkflowRequestEvidence(client, context!.tenantId, requestId!, {
        mediaId: evidenceMediaId,
        reason,
        expectedStateVersion,
        idempotencyKey: `evidence-${requestId}-${expectedStateVersion}`,
      }),
    );

  const requestChanges = () =>
    withClient((client) =>
      requestWorkflowChanges(client, context!.tenantId, requestId!, {
        reason,
        expectedStateVersion,
        idempotencyKey: `request-changes-${requestId}-${expectedStateVersion}`,
      }),
    );

  const cancel = () =>
    withClient((client) =>
      cancelWorkflowRequest(client, context!.tenantId, requestId!, {
        reason,
        expectedStateVersion,
        idempotencyKey: `cancel-${requestId}-${expectedStateVersion}`,
      }),
    );

  const reasonReady = reason.trim().length >= 3;

  return (
    <ScreenFrame
      testID="approval.detail.screen"
      eyebrow="ADSUP / APPROVAL"
      title="Approval detail"
      subtitle="Review current state, attach supplemental evidence, then decide with idempotency."
    >
      <Surface style={styles.card}>
        <SectionHeading title="Current request" detail={requestId ? `#${requestId}` : undefined} />
        <View style={styles.stateRow}>
          <StatusPill label={request?.state ?? 'LOADING'} tone="info" />
          <Text style={styles.stateText}>Version {expectedStateVersion}</Text>
        </View>
        <Text style={styles.meta}>
          {request?.requesterName ?? 'Requester'} / evidence-ready workflow
        </Text>
      </Surface>

      <Surface style={styles.card}>
        <SectionHeading title="Evidence and reason" detail="Required for audit" />
        <View style={styles.field}>
          <Text style={styles.label}>EVIDENCE MEDIA ID</Text>
          <TextInput
            accessibilityLabel="Evidence media id"
            testID="approval.detail.evidence-media"
            value={evidenceMediaId}
            onChangeText={setEvidenceMediaId}
            placeholder="media_..."
            placeholderTextColor={tokens.color.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>REASON</Text>
          <TextInput
            accessibilityLabel="Decision reason"
            testID="approval.detail.reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Explain the decision or requested change"
            placeholderTextColor={tokens.color.muted}
            multiline
            style={[styles.input, styles.textarea]}
          />
        </View>
        <AppButton
          testID="approval.detail.attach-evidence"
          label="Attach evidence"
          variant="secondary"
          onPress={() => void addEvidence()}
          disabled={!evidenceMediaId.trim()}
        />
      </Surface>

      <Surface style={styles.card}>
        <SectionHeading
          title="Decision"
          detail="Expected state version is sent with every action"
        />
        <View style={styles.actions}>
          <AppButton
            testID="approval.detail.approve"
            label="Approve"
            onPress={() => void decide('APPROVE')}
            disabled={!reasonReady}
          />
          <AppButton
            testID="approval.detail.reject"
            label="Reject"
            variant="secondary"
            onPress={() => void decide('REJECT')}
            disabled={!reasonReady}
          />
          <AppButton
            testID="approval.detail.request-changes"
            label="Request changes"
            variant="secondary"
            onPress={() => void requestChanges()}
            disabled={!reasonReady}
          />
          <AppButton
            testID="approval.detail.cancel"
            label="Cancel request"
            variant="quiet"
            onPress={() => void cancel()}
            disabled={!reasonReady}
          />
        </View>
      </Surface>
      {status ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.lg },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  stateText: {
    color: tokens.color.muted,
    fontSize: tokens.typography.bodySmall,
    fontWeight: '800',
  },
  meta: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall },
  field: { gap: 7 },
  label: { color: tokens.color.muted, fontSize: tokens.typography.label, fontWeight: '800' },
  input: {
    minHeight: 48,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
    color: tokens.color.ink,
    fontSize: tokens.typography.body,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  actions: { gap: tokens.spacing.sm },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
