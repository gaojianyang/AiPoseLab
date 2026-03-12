import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, LayoutChangeEvent, Switch, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { Canvas, Line as SkiaLine, Circle, vec } from '@shopify/react-native-skia';
import { VisionCameraProxy } from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { PoseSmoother } from '../PoseSmoother';
import type { PoseLandmark } from '../PoseSmoother';
import { ALL_EXERCISES } from '../exercises';
import { updateRepCounterFromExercise } from '../exerciseRuntime';
import type { ExerciseBase } from '../types/workout';
import type { RepCounterRuntimeState } from '../exerciseRuntime';
import type { PoseFrameLog, PoseLogFile } from '../types/poseLog';
import type { VideoFile } from 'react-native-vision-camera';

const poseDetectorPlugin = VisionCameraProxy.initFrameProcessorPlugin('poseDetector', {});

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16],
  [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26],
  [25, 27], [26, 28],
  [27, 29], [28, 30],
  [29, 31], [30, 32],
  [27, 31], [28, 32],
];

const LEFT_LANDMARK_INDICES = new Set<number>([
  1, 2, 3, 7, 9,
  11, 13, 15, 17, 19, 21,
  23, 25, 27, 29, 31,
]);

const RIGHT_LANDMARK_INDICES = new Set<number>([
  4, 5, 6, 8, 10,
  12, 14, 16, 18, 20, 22,
  24, 26, 28, 30, 32,
]);

const LEFT_POINT_COLOR = '#34B3FF';
const RIGHT_POINT_COLOR = '#FF8A3C';
const NEUTRAL_POINT_COLOR = '#FFFFFF';

export interface CameraPoseScreenProps {
  exerciseId: string;
  /** 录制结束并生成 pose JSON 后，请求进入合成页 */
  onRequestSynthesis?: (videoPath: string, posePath: string) => void;
}

const POSE_LOG_FPS = 30;

export default function CameraPoseScreen({ exerciseId, onRequestSynthesis }: CameraPoseScreenProps) {
  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = frontDevice ?? backDevice;

  const cameraRef = useRef<Camera>(null);
  const [permissionStatus, setPermissionStatus] = useState<'not-determined' | 'granted' | 'denied'>('not-determined');
  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [repCount, setRepCount] = useState(0);
  const [deviceInitSlow, setDeviceInitSlow] = useState(false);
  const [showCameraFeed, setShowCameraFeed] = useState(true);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);
  const [lastPosePath, setLastPosePath] = useState<string | null>(null);
  const [lastVideoUri, setLastVideoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const prevShowCameraFeedRef = useRef(true);

  const recordStartTimeRef = useRef<number>(0);
  const poseLogRef = useRef<PoseFrameLog[]>([]);
  const isRecordingVideoRef = useRef(false);

  const exerciseRef = useRef<ExerciseBase | null>(null);
  const runtimeRef = useRef<RepCounterRuntimeState>({
    phase: 'down',
    count: 0,
    lastRepTimestampMs: undefined,
  });
  const receivedAtRef = useRef(0);
  const logCounterRef = useRef(0);
  const poseSmootherRef = useRef<PoseSmoother | null>(null);
  const lastValidLandmarksRef = useRef<PoseLandmark[] | null>(null);
  const lastValidTimeRef = useRef<number>(0);
  const LANDMARK_HOLD_MS = 400;

  // 根据 exerciseId 解析当前动作，并重置计数状态
  useEffect(() => {
    const exercise = ALL_EXERCISES.find((e) => e.id === exerciseId) ?? null;
    exerciseRef.current = exercise;
    runtimeRef.current = { phase: 'down', count: 0, lastRepTimestampMs: undefined };
    setRepCount(0);
  }, [exerciseId]);

  // 若权限已给但设备长时间为 null，提示用户可返回重试（Android 上设备枚举有时较慢）
  useEffect(() => {
    if (permissionStatus !== 'granted' || device != null) {
      setDeviceInitSlow(false);
      return;
    }
    const t = setTimeout(() => setDeviceInitSlow(true), 2500);
    return () => clearTimeout(t);
  }, [permissionStatus, device]);

  useEffect(() => {
    (async () => {
      const status = await Camera.getCameraPermissionStatus();
      if (status === 'granted') {
        setPermissionStatus('granted');
        return;
      }
      if (status === 'denied') {
        setPermissionStatus('denied');
        return;
      }
      const result = await Camera.requestCameraPermission();
      setPermissionStatus(result === 'granted' ? 'granted' : 'denied');
    })();
  }, []);

  const startVideoRecording = useCallback(() => {
    if (isRecordingVideo || !cameraRef.current) return;
    recordStartTimeRef.current = performance.now();
    poseLogRef.current = [];
    isRecordingVideoRef.current = true;
    setIsRecordingVideo(true);
    cameraRef.current.startRecording({
      onRecordingFinished: (video: VideoFile) => {
        isRecordingVideoRef.current = false;
        setIsRecordingVideo(false);
        const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
        if (!baseDir) return;
        const posePath = `${baseDir}aiposelab_pose_${recordStartTimeRef.current}.json`;
        const logFile: PoseLogFile = {
          startTime: recordStartTimeRef.current,
          fps: POSE_LOG_FPS,
          frames: poseLogRef.current,
        };
        FileSystem.writeAsStringAsync(posePath, JSON.stringify(logFile)).then(
          () => {
            setLastVideoPath(video.path);
            setLastPosePath(posePath.startsWith('file://') ? posePath : posePath);
            const uri = video.path.startsWith('file://') ? video.path : `file://${video.path}`;
            setLastVideoUri(uri);
            console.log('[Record] 纯净视频已保存:', video.path, 'pose:', posePath);
          }
        ).catch((e) => console.warn('[Record] 写入 pose JSON 失败', e));
      },
      onRecordingError: (e) => {
        isRecordingVideoRef.current = false;
        setIsRecordingVideo(false);
        console.warn('[Record] 录制错误', e);
      },
    });
  }, [isRecordingVideo]);

  const endVideoRecording = useCallback(async () => {
    if (!isRecordingVideo || !cameraRef.current) return;
    try {
      await cameraRef.current.stopRecording();
    } catch (e) {
      console.warn('[Record] stopRecording 失败', e);
    }
  }, [isRecordingVideo]);

  const saveToGallery = useCallback(async () => {
    if (!lastVideoUri || isSaving) return;
    setIsSaving(true);
    try {
      await CameraRoll.save(lastVideoUri, { type: 'video' });
      console.log('[Record] 已保存到系统相册:', lastVideoUri);
    } catch (e) {
      console.warn('[Record] 保存到相册失败', e);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, lastVideoUri]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  useLayoutEffect(() => {
    if (!landmarks) return;
    if (logCounterRef.current % 15 !== 0) return;
    const now = performance.now();
    const receiveToPaint = receivedAtRef.current > 0 ? (now - receivedAtRef.current).toFixed(1) : '-';
    console.log(`[Pose] JS 绘制完成 receive→paint=${receiveToPaint}ms`);
  }, [landmarks]);

  const onPoseResult = Worklets.createRunOnJS((data: PoseLandmark[] | null) => {
    const now = performance.now();
    receivedAtRef.current = now;
    logCounterRef.current += 1;
    if (logCounterRef.current % 15 === 0) {
      console.log(`[Pose] JS 收到数据 t=${receivedAtRef.current.toFixed(1)}ms`);
    }

    if (!data || data.length < 17) {
      // 无有效检测时：若在保留时间内则继续显示上一帧，超时再清空
      const last = lastValidLandmarksRef.current;
      const lastTime = lastValidTimeRef.current;
      if (last && lastTime > 0 && now - lastTime < LANDMARK_HOLD_MS) {
        return; // 不调用 setLandmarks，保持当前骨架
      }
      lastValidLandmarksRef.current = null;
      setLandmarks(null);
      return;
    }

    if (!poseSmootherRef.current) {
      poseSmootherRef.current = new PoseSmoother('squat');
    }
    const tSec = now / 1000;
    const smoothed = poseSmootherRef.current.update(data, tSec);
    if (!smoothed || smoothed.length < 17) {
      const last = lastValidLandmarksRef.current;
      const lastTime = lastValidTimeRef.current;
      if (last && lastTime > 0 && now - lastTime < LANDMARK_HOLD_MS) return;
      lastValidLandmarksRef.current = null;
      setLandmarks(null);
      return;
    }
    lastValidLandmarksRef.current = smoothed;
    lastValidTimeRef.current = now;
    setLandmarks(smoothed);

    const exercise = exerciseRef.current;
    if (exercise) {
      const result = updateRepCounterFromExercise(
        exercise,
        runtimeRef.current,
        smoothed,
        now
      );
      runtimeRef.current = result.state;
      if (result.didIncrement) {
        setRepCount(result.state.count);
      }
    }

    if (isRecordingVideoRef.current && recordStartTimeRef.current > 0) {
      const t = now - recordStartTimeRef.current;
      poseLogRef.current.push({
        t,
        landmarks: smoothed.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        repCount: runtimeRef.current.count,
      });
    }
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (poseDetectorPlugin == null) return;
    const result = poseDetectorPlugin.call(frame) as { landmarks?: Array<{ x: number; y: number; z: number }> } | null;
    if (result?.landmarks) {
      const points: PoseLandmark[] = [];
      for (let i = 0; i < result.landmarks.length; i++) {
        const l = result.landmarks[i];
        points.push({ x: l.x, y: l.y, z: l.z });
      }
      onPoseResult(points);
    } else {
      onPoseResult(null);
    }
  }, [onPoseResult]);

  const renderSkeleton = () => {
    const { width: viewW, height: viewH } = previewSize;
    if (!landmarks || viewW === 0 || viewH === 0) return null;

    const toView = (nx: number, ny: number) => ({
      x: nx * viewW,
      y: (1 - ny) * viewH,
    });

    return (
      <Canvas style={[styles.overlay, { width: viewW, height: viewH }]}>
        {POSE_CONNECTIONS.map(([start, end], index) => {
          const a = landmarks[start];
          const b = landmarks[end];
          if (!a || !b) return null;
          const p1 = toView(a.x, a.y);
          const p2 = toView(b.x, b.y);
          return (
            <SkiaLine
              key={`${start}-${end}-${index}`}
              p1={vec(p1.x, p1.y)}
              p2={vec(p2.x, p2.y)}
              color="#FFFFFF"
              strokeWidth={4}
            />
          );
        })}

        {landmarks.map((pt, index) => {
          const p = toView(pt.x, pt.y);
          const isLeft = LEFT_LANDMARK_INDICES.has(index);
          const isRight = RIGHT_LANDMARK_INDICES.has(index);
          const color = isLeft
            ? LEFT_POINT_COLOR
            : isRight
            ? RIGHT_POINT_COLOR
            : NEUTRAL_POINT_COLOR;
          return (
            <Circle
              key={`pt-${index}`}
              cx={p.x}
              cy={p.y}
              r={5}
              color={color}
            />
          );
        })}
      </Canvas>
    );
  };

  if (permissionStatus !== 'granted') {
    return (
      <View style={styles.center}>
        {permissionStatus === 'not-determined' ? (
          <>
            <ActivityIndicator />
            <Text style={styles.text}>正在请求相机权限...</Text>
          </>
        ) : (
          <Text style={styles.text}>需要相机权限才能使用姿态检测，请在弹窗或系统设置中允许。</Text>
        )}
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>正在初始化相机设备...</Text>
        {deviceInitSlow && (
          <Text style={[styles.text, styles.textHint]}>
            若长时间停留在此，请返回上一页后重新进入
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />
      <View style={styles.cameraContainer} onLayout={handleLayout}>
        <View
          style={[
            styles.recordLayer,
            StyleSheet.absoluteFill,
            showCameraFeed ? null : styles.recordLayerBlack,
          ]}
        >
          <Camera
              ref={cameraRef}
              style={[StyleSheet.absoluteFill, showCameraFeed ? null : styles.cameraHidden]}
              device={device}
              isActive={true}
              resizeMode="cover"
              video={true}
              frameProcessor={frameProcessor}
              onInitialized={() => setCameraReady(true)}
              androidPreviewViewType="texture-view"
            />

            {renderSkeleton()}
          <View style={styles.counterContainer}>
            <Text style={styles.counterLabel}>
              {ALL_EXERCISES.find((e) => e.id === exerciseId)?.name ?? 'Reps'}
            </Text>
            <Text style={styles.counterValue}>{repCount}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>显示相机画面</Text>
            <Switch value={showCameraFeed} onValueChange={setShowCameraFeed} />
          </View>
          <View style={styles.buttonsRow}>
            {!isRecordingVideo ? (
              <Pressable
                style={[styles.recordButton, !cameraReady ? styles.recordButtonDisabled : null]}
                onPress={startVideoRecording}
                disabled={!cameraReady}
              >
                <Text style={styles.recordButtonText}>开始录制</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.recordButtonStop} onPress={endVideoRecording}>
                <Text style={styles.recordButtonText}>结束录制</Text>
              </Pressable>
            )}
            {lastVideoPath && lastPosePath && onRequestSynthesis && (
              <Pressable
                style={styles.saveButton}
                onPress={() => onRequestSynthesis(lastVideoPath, lastPosePath)}
              >
                <Text style={styles.recordButtonText}>合成骨架视频</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.saveButton,
                (!lastVideoUri || isSaving) ? styles.recordButtonDisabled : null,
              ]}
              onPress={saveToGallery}
              disabled={!lastVideoUri || isSaving}
            >
              <Text style={styles.recordButtonText}>
                {isSaving ? '保存中...' : '保存到相册'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    marginTop: 12,
  },
  textHint: {
    marginTop: 16,
    fontSize: 13,
    opacity: 0.85,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraHidden: {
    opacity: 0,
  },
  recordLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  recordLayerBlack: {
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  counterContainer: {
    position: 'absolute',
    top: 40,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  counterLabel: {
    color: '#fff',
    fontSize: 12,
  },
  counterValue: {
    color: '#0f0',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    gap: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 14,
  },
  recordButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2D6BFF',
  },
  recordButtonStop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#C62828',
  },
  recordButtonDisabled: {
    opacity: 0.6,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#34B3FF',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
