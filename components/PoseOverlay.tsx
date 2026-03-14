import React from 'react';
import { requireNativeComponent, ViewStyle } from 'react-native';
import type { StickmanSkinStyle } from '../types/skin';

export interface PoseLandmarkPoint {
  x: number;
  y: number;
  z: number;
}

type PoseOverlayNativeProps = {
  style?: ViewStyle;
  /** 当前帧关键点（归一化 0–1），由原生按 view 尺寸做 toView 绘制 */
  landmarks: PoseLandmarkPoint[] | null;
  /** 皮肤样式，与合成模块一致：line, joint, head, attachments */
  skinConfig: StickmanSkinStyle | null;
};

const NativePoseOverlay = requireNativeComponent<PoseOverlayNativeProps>('PoseOverlay');

export function PoseOverlay(props: PoseOverlayNativeProps) {
  return <NativePoseOverlay {...props} />;
}
