import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSkin } from '../skinStore';
import type { StickmanSkin, SkinPartKey, SkinPartEntry, SkinPartConfig } from '../types/skin';

export interface SkinConfigScreenProps {
  onBack: () => void;
}

const PART_LABELS: Record<SkinPartKey, string> = {
  headTop: '头顶部位',
  face: '脸部位',
  body: '躯体部位',
  leftThigh: '左大腿',
  leftCalf: '左小腿',
  rightThigh: '右大腿',
  rightCalf: '右小腿',
  leftElbow: '左手肘',
  leftArm: '左手臂',
  rightElbow: '右手肘',
  rightArm: '右手臂',
};

const PART_ORDER: SkinPartKey[] = [
  'headTop',
  'face',
  'body',
  'leftThigh',
  'leftCalf',
  'rightThigh',
  'rightCalf',
  'leftElbow',
  'leftArm',
  'rightElbow',
  'rightArm',
];

function getDefaultPartEntry(
  key: SkinPartKey,
  skin: StickmanSkin
): SkinPartEntry {
  const lineWidth = skin.style.line?.width ?? 4;
  switch (key) {
    case 'headTop':
      return {
        visible: skin.style.head?.visible ?? true,
        type: skin.style.head?.asset ? 'image' : 'line',
        lineWidth: skin.style.head?.borderWidth ?? 3,
        imageAsset: skin.style.head?.asset,
      };
    case 'face':
      return {
        visible: true,
        type: skin.style.head?.asset ? 'image' : 'line',
        lineWidth: skin.style.line?.width ?? 4,
        imageAsset: skin.style.head?.asset ? 'pirate_face' : undefined,
      };
    case 'body':
      return {
        visible: true,
        type: skin.style.body?.asset ? 'image' : 'line',
        lineWidth: skin.style.body?.torso?.thickness ?? 10,
        imageAsset: skin.style.body?.asset,
      };
    default:
      return {
        visible: true,
        type: 'line',
        lineWidth,
      };
  }
}

function getPartConfigFromSkin(skin: StickmanSkin): SkinPartConfig {
  const config = skin.style.partConfig ?? {};
  const out: SkinPartConfig = {};
  for (const key of PART_ORDER) {
    out[key] = config[key] ?? getDefaultPartEntry(key, skin);
  }
  return out;
}

function skinFromPartConfig(
  skin: StickmanSkin,
  partConfig: SkinPartConfig
): StickmanSkin {
  const headTop = partConfig.headTop;
  const face = partConfig.face;
  const bodyPart = partConfig.body;
  return {
    ...skin,
    style: {
      ...skin.style,
      partConfig,
      line: {
        ...skin.style.line,
        width: bodyPart?.type === 'line' && bodyPart?.lineWidth != null
          ? bodyPart.lineWidth
          : skin.style.line.width,
      },
      head: skin.style.head
        ? {
            ...skin.style.head,
            visible: headTop?.visible ?? true,
            asset:
              headTop?.visible && headTop?.type === 'image'
                ? headTop.imageAsset
                : undefined,
            showHeadCircle: headTop?.visible && headTop?.type === 'line',
            showFaceSkeleton: face?.visible && face?.type === 'line',
          }
        : undefined,
      body: skin.style.body
        ? {
            ...skin.style.body,
            asset:
              bodyPart?.visible && bodyPart?.type === 'image'
                ? bodyPart.imageAsset
                : undefined,
            torso:
              bodyPart?.type === 'line' && bodyPart?.lineWidth != null
                ? { ...skin.style.body?.torso, thickness: bodyPart.lineWidth }
                : skin.style.body?.torso,
          }
        : undefined,
    },
  };
}

/** 单行：左侧文案，右侧 显示/隐藏 */
function RowVisible({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowHint}>{value ? '显示' : '隐藏'}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(45,107,255,0.8)' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

/** 单行：左侧文案，右侧 线条/图片 选择 */
function RowType({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: 'line' | 'image';
  onValueChange: (v: 'line' | 'image') => void;
}) {
  return (
    <View style={[styles.row, styles.subRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segItem, value === 'line' && styles.segItemActive]}
          onPress={() => onValueChange('line')}
        >
          <Text style={[styles.segText, value === 'line' && styles.segTextActive]}>线条</Text>
        </Pressable>
        <Pressable
          style={[styles.segItem, value === 'image' && styles.segItemActive]}
          onPress={() => onValueChange('image')}
        >
          <Text style={[styles.segText, value === 'image' && styles.segTextActive]}>图片</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 单行：线条粗细（加减 + 数字） */
function RowLineWidth({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}) {
  const v = Math.round(value);
  return (
    <View style={[styles.row, styles.subRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepperWrap}>
        <Pressable
          style={[styles.stepperBtn, v <= min && styles.stepperBtnDisabled]}
          onPress={() => onValueChange(Math.max(min, v - 1))}
          disabled={v <= min}
        >
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{v}</Text>
        <Pressable
          style={[styles.stepperBtn, v >= max && styles.stepperBtnDisabled]}
          onPress={() => onValueChange(Math.min(max, v + 1))}
          disabled={v >= max}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 单行：图片预览（占位 + 资源名） */
function RowImage({ label, imageAsset }: { label: string; imageAsset?: string }) {
  return (
    <View style={[styles.row, styles.subRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imagePlaceholderText} numberOfLines={1}>
          {imageAsset ? `${imageAsset}.png` : '—'}
        </Text>
      </View>
    </View>
  );
}

export default function SkinConfigScreen({ onBack }: SkinConfigScreenProps) {
  const [skin, setSkin] = useSkin();
  const [partConfig, setPartConfigState] = useState<SkinPartConfig>(() =>
    getPartConfigFromSkin(skin)
  );

  useEffect(() => {
    setPartConfigState(getPartConfigFromSkin(skin));
  }, [skin.id]);

  const updatePart = useCallback(
    (key: SkinPartKey, patch: Partial<SkinPartEntry>) => {
      const next: SkinPartConfig = {
        ...partConfig,
        [key]: { ...partConfig[key], ...patch } as SkinPartEntry,
      };
      setPartConfigState(next);
      setSkin(skinFromPartConfig(skin, next));
    },
    [skin, partConfig, setSkin]
  );

  const rows = useMemo(() => {
    const list: { type: 'visible' | 'type' | 'lineWidth' | 'image'; key: SkinPartKey }[] = [];
    for (const key of PART_ORDER) {
      const entry = partConfig[key] ?? getDefaultPartEntry(key, skin);
      list.push({ type: 'visible', key });
      if (entry.visible) {
        list.push({ type: 'type', key });
        if (entry.type === 'line') {
          list.push({ type: 'lineWidth', key });
        } else {
          list.push({ type: 'image', key });
        }
      }
    }
    return list;
  }, [partConfig, skin]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>皮肤配置</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((item) => {
          const entry = partConfig[item.key] ?? getDefaultPartEntry(item.key, skin);
          const label = PART_LABELS[item.key];
          if (item.type === 'visible') {
            return (
              <RowVisible
                key={`${item.key}-visible`}
                label={label}
                value={entry.visible}
                onValueChange={(v) => updatePart(item.key, { visible: v })}
              />
            );
          }
          if (item.type === 'type') {
            return (
              <RowType
                key={`${item.key}-type`}
                label={`${label}类型`}
                value={entry.type}
                onValueChange={(v) => updatePart(item.key, { type: v })}
              />
            );
          }
          if (item.type === 'lineWidth') {
            const lineWidth = entry.lineWidth ?? 4;
            return (
              <RowLineWidth
                key={`${item.key}-lineWidth`}
                label="线条粗细"
                value={lineWidth}
                min={1}
                max={20}
                onValueChange={(v) => updatePart(item.key, { lineWidth: v })}
              />
            );
          }
          return (
            <RowImage
              key={`${item.key}-image`}
              label="图片"
              imageAsset={entry.imageAsset}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05050A',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
    marginRight: 4,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 10,
  },
  subRow: {
    marginLeft: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  segItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  segItemActive: {
    backgroundColor: 'rgba(45,107,255,0.7)',
  },
  segText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  segTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(45,107,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  stepperValue: {
    color: '#FFFFFF',
    fontSize: 16,
    minWidth: 32,
    textAlign: 'center',
  },
  imagePlaceholder: {
    width: 100,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});
