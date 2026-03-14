import { useEffect, useState } from 'react';
import type { StickmanSkin } from './types/skin';
import { defaultSkin } from './skins/defaultSkin';

let currentSkin: StickmanSkin = defaultSkin;

type SkinListener = (skin: StickmanSkin) => void;
const listeners = new Set<SkinListener>();

export function getCurrentSkin(): StickmanSkin {
  return currentSkin;
}

export function setCurrentSkin(skin: StickmanSkin) {
  currentSkin = skin;
  listeners.forEach((cb) => cb(currentSkin));
}

export function subscribeSkin(listener: SkinListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React 组件中使用的 Hook：提供当前皮肤和切换函数，并在全局变更时自动刷新。
 */
export function useSkin(): [StickmanSkin, (skin: StickmanSkin) => void] {
  const [skin, setSkinState] = useState<StickmanSkin>(getCurrentSkin());

  useEffect(() => {
    return subscribeSkin(setSkinState);
  }, []);

  const setSkin = (next: StickmanSkin) => {
    setCurrentSkin(next);
    setSkinState(next);
  };

  return [skin, setSkin];
}

