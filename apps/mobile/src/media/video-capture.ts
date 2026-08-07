export type CapturedVideo = { uri: string; durationMs: number };
export type CameraAdapter = {
  requestPermission: () => Promise<boolean>;
  record: () => Promise<CapturedVideo>;
  cleanup: (uri: string) => Promise<void>;
};
export const captureAttendanceVideo = async (adapter: CameraAdapter) => {
  if (!(await adapter.requestPermission())) throw new Error('CAMERA_PERMISSION_DENIED');
  return adapter.record();
};
