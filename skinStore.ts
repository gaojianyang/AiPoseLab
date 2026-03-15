import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import type { StickmanSkin } from './types/skin';
import { defaultSkin } from './skins/defaultSkin';

const SKIN_STORAGE_FILE =
  FileSystem.documentDirectory != null
    ? `${FileSystem.documentDirectory}stickman_skin.json`
    : null;

let currentSkin: StickmanSkin = defaultSkin;

type SkinListener = (skin: StickmanSkin) => void;
const listeners = new Set<SkinListener>();

export function getCurrentSkin(): StickmanSkin {
  return currentSkin;
}

export function setCurrentSkin(skin: StickmanSkin) {
  currentSkin = skin;
  listeners.forEach((cb) => cb(currentSkin));

  // 后台持久化当前皮肤（只写 JSON，不阻塞 UI）
  if (SKIN_STORAGE_FILE) {
    FileSystem.writeAsStringAsync(SKIN_STORAGE_FILE, JSON.stringify(skin)).catch(() => {
      // 忽略持久化失败，避免影响正常使用
    });
  }
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
    const unsubscribe = subscribeSkin(setSkinState);

    // 首次挂载时尝试从本地读取上次保存的皮肤
    if (SKIN_STORAGE_FILE) {
      (async () => {
        try {
          const info = await FileSystem.getInfoAsync(SKIN_STORAGE_FILE);
          if (!info.exists) return;
          const content = await FileSystem.readAsStringAsync(SKIN_STORAGE_FILE);
          if (!content) return;
          const saved = JSON.parse(content) as StickmanSkin | null;
          if (!saved || typeof saved !== 'object') return;
          setCurrentSkin(saved);
        } catch {
          // 忽略读取错误，保持默认皮肤
        }
      })();
    }

    return unsubscribe;
  }, []);

  const setSkin = (next: StickmanSkin) => {
    setCurrentSkin(next);
    setSkinState(next);
  };

  return [skin, setSkin];
}

