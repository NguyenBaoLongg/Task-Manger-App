import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, StatusPill } from '@/components/ui/ScreenPrimitives';
import { runAttendanceVideoCheckInFlow } from '@/features/attendance/video-check-in-flow';
import { getAuthenticatedClient } from '@/features/auth/session-runtime';
import { useTenantContextStore } from '@/tenant/tenant-context-store';
import { tokens } from '@/theme/tokens';

const todayBusinessDate = () => new Date().toISOString().slice(0, 10);

const putVideoFile = (
  videoUri: string,
  uploadUrl: string,
  requiredHeaders: Record<string, string> | undefined,
  onProgress: (progressPercent: number) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', 'video/mp4');
    for (const [name, value] of Object.entries(requiredHeaders ?? {}))
      xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`UPLOAD_HTTP_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('UPLOAD_NETWORK'));
    // RN streams a file body from disk for { uri } payloads; a raw ArrayBuffer would
    // be dropped by the native networking module.
    xhr.send({ uri: videoUri } as unknown as ArrayBuffer);
  });

const BackButton = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    testID="attendance.video.back"
    accessibilityRole="button"
    accessibilityLabel="Quay lại"
    onPress={onPress}
    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
  >
    <Text style={styles.backGlyph}>‹</Text>
  </Pressable>
);

export default function VideoCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [videoUri, setVideoUri] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<string>();
  const context = useTenantContextStore((state) => state.context);
  const cameraRef = useRef<CameraViewType>(null);
  const router = useRouter();
  const canGoBack = router.canGoBack();

  const record = async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    setStatus(undefined);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) setVideoUri(result.uri);
      else setStatus('Chua quay duoc video. Thu lai hoac chon video co san.');
    } catch {
      setStatus('Chua quay duoc video. Thu lai hoac chon video co san.');
    } finally {
      setRecording(false);
    }
  };

  const stop = () => {
    if (cameraRef.current && recording) {
      setRecording(false);
      cameraRef.current.stopRecording();
    }
  };

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) {
        setVideoUri(uri);
        setStatus(undefined);
        setUploadProgress(0);
      }
    } catch {
      setStatus('Chua mo duoc thu vien video. Thu lai.');
    }
  };

  const discard = () => {
    if (videoUri) {
      const file = new File(videoUri);
      if (file.exists) file.delete();
    }
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
      const bytes = await new File(videoUri).bytes();
      const client = await getAuthenticatedClient();
      await runAttendanceVideoCheckInFlow(client, context.tenantId, {
        businessDate: todayBusinessDate(),
        bytes,
        idempotencyKey: `attendance-video-${todayBusinessDate()}`,
        upload: async ({ uploadUrl, requiredHeaders, onProgress }) => {
          if (!uploadUrl || !/^https?:/i.test(uploadUrl)) {
            // Dev storage returns a memory:// URL without a reachable upload target.
            onProgress(100);
            return;
          }
          await putVideoFile(videoUri, uploadUrl, requiredHeaders, onProgress);
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
        {canGoBack ? <BackButton onPress={() => router.back()} /> : null}
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
        {canGoBack ? <BackButton onPress={() => router.back()} /> : null}
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
          recording ? (
            <AppButton
              testID="attendance.video.stop"
              label="Dừng quay"
              variant="secondary"
              onPress={stop}
            />
          ) : (
            <>
              <AppButton
                testID="attendance.video.record"
                label="Start recording"
                onPress={() => void record()}
              />
              <AppButton
                testID="attendance.video.pick"
                label="Chọn video có sẵn"
                variant="secondary"
                onPress={() => void pick()}
              />
            </>
          )
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
              onPress={discard}
            />
            <AppButton
              testID="attendance.video.pick-again"
              label="Chọn video khác"
              variant="quiet"
              onPress={() => void pick()}
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
  backButton: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    marginLeft: -10,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: { opacity: 0.7 },
  backGlyph: { color: tokens.color.ink, fontSize: 32, lineHeight: 34, fontWeight: '700' },
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
