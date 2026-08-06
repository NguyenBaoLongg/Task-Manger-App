import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, StatusPill } from '@/components/ui/ScreenPrimitives';
import { runAttendanceVideoCheckInFlow } from '@/features/attendance/video-check-in-flow';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

const uriBytes = (uri: string) => Uint8Array.from(uri, (char) => char.charCodeAt(0) % 255);
const todayBusinessDate = () => new Date().toISOString().slice(0, 10);

export default function VideoCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [videoUri, setVideoUri] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<string>();
  const context = useTenantContextStore((state) => state.context);
  const cameraRef = useRef<CameraViewType>(null);

  const record = async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) setVideoUri(result.uri);
    } finally {
      setRecording(false);
    }
  };

  const discard = async () => {
    if (videoUri) await FileSystem.deleteAsync(videoUri, { idempotent: true });
    setVideoUri(undefined);
    setStatus(undefined);
    setUploadProgress(0);
  };

  const submit = async () => {
    if (!context || !videoUri) {
      setStatus('Can dang nhap workspace truoc khi gui check-in.');
      return;
    }
    setSubmitting(true);
    setStatus(undefined);
    try {
      const client = await getAuthenticatedClient();
      await runAttendanceVideoCheckInFlow(client, context.tenantId, {
        businessDate: todayBusinessDate(),
        bytes: uriBytes(videoUri),
        idempotencyKey: `attendance-video-${todayBusinessDate()}`,
        upload: async ({ onProgress }) => {
          onProgress(50);
          onProgress(100);
        },
        onProgress: setUploadProgress,
      });
      setStatus('Da gui video check-in va cho he thong ghi nhan.');
    } catch {
      setStatus('Chua gui duoc video check-in. Kiem tra mang roi thu lai.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission?.granted)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View testID="attendance.video.permission" style={styles.permissionCard}>
          <StatusPill label="Camera permission" tone="info" />
          <Text accessibilityRole="header" style={styles.title}>
            Video check-in
          </Text>
          <Text style={styles.body}>
            Video must show the full person and the real work area. Camera permission is required.
          </Text>
          <AppButton
            testID="attendance.video.allow-camera"
            label="Allow camera"
            onPress={() => void requestPermission()}
          />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            Video check-in
          </Text>
          <Text style={styles.body}>
            Keep the frame on uniform, full body, and the actual work area.
          </Text>
        </View>
        <StatusPill label={recording ? 'Recording' : videoUri ? 'Ready' : 'Standby'} tone="info" />
      </View>

      <View testID="attendance.video.camera-frame" style={styles.cameraFrame}>
        {!videoUri ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video" />
        ) : (
          <View
            testID="attendance.video.review"
            accessibilityLabel="Recorded video"
            style={styles.reviewState}
          >
            <Text style={styles.reviewTitle}>Video ready</Text>
            <Text style={styles.body}>Upload it to submit the attendance check-in for today.</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {!videoUri ? (
          <AppButton
            testID="attendance.video.record"
            label={recording ? 'Recording...' : 'Start recording'}
            onPress={() => void record()}
            disabled={recording}
          />
        ) : (
          <>
            <AppButton
              testID="attendance.video.upload"
              label={submitting ? `Uploading ${uploadProgress}%` : 'Upload check-in'}
              onPress={() => void submit()}
              disabled={submitting}
            />
            <AppButton
              testID="attendance.video.record-again"
              label="Record again"
              variant="secondary"
              onPress={() => void discard()}
            />
          </>
        )}
      </View>
      {status ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {status}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.color.canvas,
  },
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  headerCopy: { flex: 1, gap: 6 },
  title: {
    color: tokens.color.ink,
    fontSize: tokens.typography.title,
    lineHeight: 34,
    fontWeight: '900',
  },
  body: { color: tokens.color.muted, fontSize: tokens.typography.bodySmall, lineHeight: 21 },
  cameraFrame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.primaryMuted,
    backgroundColor: tokens.color.ink,
  },
  camera: { flex: 1 },
  reviewState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.xl,
    backgroundColor: tokens.color.primarySoft,
  },
  reviewTitle: { color: tokens.color.ink, fontSize: tokens.typography.heading, fontWeight: '900' },
  actions: { gap: tokens.spacing.sm },
  status: { color: tokens.color.info, fontSize: tokens.typography.bodySmall, lineHeight: 20 },
});
