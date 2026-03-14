import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  BackHandler,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { WorkoutVideoGenerator } from '../WorkoutVideoGenerator';

export interface SynthesisScreenProps {
  videoPath: string;
  posePath: string;
  onBack: () => void;
}

export default function SynthesisScreen({
  videoPath,
  posePath,
  onBack,
}: SynthesisScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [outputUri, setOutputUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [debugFrameWatermark, setDebugFrameWatermark] = useState(true);
  // undefined 表示自动 probe 原视频 FPS
  const [targetFps, setTargetFps] = useState<number | undefined>(undefined);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const runSynthesis = useCallback(async () => {
    try {
      if (isSynthesizing) return;
      setIsSynthesizing(true);
      setProgress(0);
      setOutputUri(null);
      const result = await WorkoutVideoGenerator.generate({
        inputVideoUri: videoPath,
        poseJsonPath: posePath,
        targetFps,
        debugFrameWatermark,
        // Android 上强制走原生合成路径（当前原生实现仅做转码拷贝，占位）
        useNativeRenderer: true,
        onProgress: (p) => setProgress(p),
      });
      setOutputUri(result.outputVideoPath);
      console.log('[Synthesis] 已生成:', result.outputVideoPath);
    } catch (e) {
      console.warn('[Synthesis] 合成失败', e);
    } finally {
      setIsSynthesizing(false);
    }
  }, [isSynthesizing, videoPath, posePath, targetFps, debugFrameWatermark]);

  const runHighlightSynthesis = useCallback(async () => {
    try {
      if (isSynthesizing) return;
      setIsSynthesizing(true);
      setProgress(0);
      setOutputUri(null);
      const result = await WorkoutVideoGenerator.generateHighlights({
        inputVideoUri: videoPath,
        poseJsonPath: posePath,
        targetFps,
        debugFrameWatermark,
        // 默认：每 10 下取一次，每次 ±3s，总时长上限 60s
        windowMs: 3000,
        everyN: 10,
        maxTotalMs: 60_000,
        onProgress: (p) => setProgress(p),
      });
      setOutputUri(result.outputVideoPath);
      console.log('[Synthesis] 高光已生成:', result.outputVideoPath);
    } catch (e) {
      console.warn('[Synthesis] 高光合成失败', e);
    } finally {
      setIsSynthesizing(false);
    }
  }, [isSynthesizing, videoPath, posePath, targetFps, debugFrameWatermark]);

  const saveToGallery = useCallback(async () => {
    if (!outputUri || isSaving) return;
    setIsSaving(true);
    try {
      await CameraRoll.save(outputUri, { type: 'video' });
      console.log('[Synthesis] 已保存到相册:', outputUri);
    } catch (e) {
      console.warn('[Synthesis] 保存失败', e);
    } finally {
      setIsSaving(false);
    }
  }, [outputUri, isSaving]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </Pressable>
      </View>

      {isSynthesizing && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        </View>
      )}

      {!isSynthesizing && !outputUri && (
        <View style={styles.paramsSection}>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>帧序号水印</Text>
            <Switch value={debugFrameWatermark} onValueChange={setDebugFrameWatermark} />
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>输出帧率</Text>
            <View style={styles.fpsRow}>
              <Pressable
                style={[styles.fpsBtn, targetFps == null && styles.fpsBtnActive]}
                onPress={() => setTargetFps(undefined)}
              >
                <Text style={[styles.fpsBtnText, targetFps == null && styles.fpsBtnTextActive]}>Auto</Text>
              </Pressable>
              {[24, 25, 30, 60].map((fps) => (
                <Pressable
                  key={fps}
                  style={[styles.fpsBtn, targetFps === fps && styles.fpsBtnActive]}
                  onPress={() => setTargetFps(fps)}
                >
                  <Text style={[styles.fpsBtnText, targetFps === fps && styles.fpsBtnTextActive]}>{fps}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={styles.controls}>
        {!isSynthesizing && !outputUri && (
          <>
            <Pressable
              style={styles.primaryBtn}
              onPress={runSynthesis}
            >
              <Text style={styles.primaryBtnText}>完整合成</Text>
            </Pressable>
            <View style={{ height: 8 }} />
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: '#FF9F1C' }]}
              onPress={runHighlightSynthesis}
            >
              <Text style={styles.primaryBtnText}>高光生成</Text>
            </Pressable>
          </>
        )}
        {outputUri && (
          <Pressable
            style={[styles.primaryBtn, isSaving && styles.primaryBtnDisabled]}
            onPress={saveToGallery}
            disabled={isSaving}
          >
            <Text style={styles.primaryBtnText}>{isSaving ? '保存中...' : '保存到相册'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  text: { color: '#fff', marginTop: 12 },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: '#fff', fontSize: 16 },
  paramsSection: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  paramLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  fpsRow: { flexDirection: 'row', gap: 8 },
  fpsBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  fpsBtnActive: { backgroundColor: '#2D6BFF' },
  fpsBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  fpsBtnTextActive: { color: '#fff', fontWeight: '600' },
  progressWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#2D6BFF',
    borderRadius: 12,
  },
  progressText: { color: '#fff', textAlign: 'center', fontSize: 12 },
  controls: { padding: 16, paddingBottom: 32 },
  primaryBtn: {
    backgroundColor: '#2D6BFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
