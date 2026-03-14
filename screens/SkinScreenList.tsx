import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { StickmanSkin } from '../types/skin';
import { defaultSkin } from '../skins/defaultSkin';

export interface SkinScreenListProps {
  onBack: () => void;
  /** 预留：选中皮肤回调，当前可不传，仅展示列表 */
  onSelectSkin?: (skin: StickmanSkin) => void;
}

const SKINS_DEMO: StickmanSkin[] = [
  defaultSkin,
  {
    id: 'neon_purple_cyan',
    name: '霓虹紫青',
    rarity: 'epic',
    price: { currency: 'coin', amount: 500 },
    style: {
      line: {
        width: 4,
        color: '#E0E0FF',
        opacity: 1,
        cap: 'round',
        join: 'round',
      },
      joint: {
        radius: 6,
        leftColor: '#00E5FF',
        rightColor: '#D500F9',
        neutralColor: '#FFFFFF',
        highlightColor: '#FFFF00',
      },
      body: {
        torso: {
          thickness: 10,
          color: '#E0E0FF',
          fillOpacity: 0.25,
        },
        limb: {
          thickness: 6,
          leftColor: '#00E5FF',
          rightColor: '#D500F9',
        },
      },
      head: {
        radius: 26,
        borderWidth: 3,
        borderColor: '#E0E0FF',
        fillColor: '#1A1A2E',
        hair: {
          style: 'spiky',
          color: '#FFEA00',
        },
        face: {
          eyes: { type: 'dot', color: '#FFFFFF', size: 3 },
          mouth: { type: 'flat', color: '#FFFFFF', width: 10 },
        },
      },
      effects: {
        repGlow: {
          enabled: true,
          color: '#00E5FF',
          radiusScale: 1.6,
          triggerOnRepChange: true,
        },
        trail: { enabled: true },
      },
      attachments: [
        {
          id: 'neon_crown',
          bone: 'HEAD',
          offset: { x: 0, y: -0.9 },
          size: 0.5,
          shape: 'circle',
          color: '#FFEA00',
        },
      ],
    },
  },
  {
    id: 'sunset_orange',
    name: '日落晨曦',
    rarity: 'rare',
    price: { currency: 'coin', amount: 300 },
    style: {
      line: {
        width: 5,
        color: '#FFE0B2',
        opacity: 1,
        cap: 'round',
        join: 'round',
      },
      joint: {
        radius: 7,
        leftColor: '#FF7043',
        rightColor: '#FFB74D',
        neutralColor: '#FFF3E0',
        highlightColor: '#FFFFFF',
      },
      body: {
        torso: {
          thickness: 11,
          color: '#FFE0B2',
          fillOpacity: 0.2,
        },
        limb: {
          thickness: 7,
          leftColor: '#FF7043',
          rightColor: '#FFB74D',
        },
      },
      head: {
        radius: 24,
        borderWidth: 3,
        borderColor: '#FFE0B2',
        fillColor: 'transparent',
        hair: {
          style: 'short',
          color: '#FFCC80',
        },
        face: {
          eyes: { type: 'dot', color: '#FFFFFF', size: 3 },
          mouth: { type: 'smile', color: '#FFECB3', width: 12 },
        },
      },
      effects: {
        repGlow: {
          enabled: true,
          color: '#FFB74D',
          radiusScale: 1.5,
          triggerOnRepChange: true,
        },
        trail: { enabled: false },
      },
      attachments: [
        {
          id: 'sunset_headband',
          bone: 'HEAD',
          offset: { x: 0, y: -0.4 },
          size: 0.4,
          shape: 'rect',
          color: '#FFCC80',
        },
      ],
    },
  },
  {
    id: 'mint_fresh',
    name: '薄荷清爽',
    rarity: 'common',
    price: { currency: 'coin', amount: 100 },
    style: {
      line: {
        width: 4,
        color: '#E0F2F1',
        opacity: 1,
        cap: 'round',
        join: 'round',
      },
      joint: {
        radius: 5,
        leftColor: '#4DB6AC',
        rightColor: '#80CBC4',
        neutralColor: '#B2DFDB',
        highlightColor: '#FFFFFF',
      },
      body: {
        torso: {
          thickness: 9,
          color: '#E0F2F1',
          fillOpacity: 0.18,
        },
        limb: {
          thickness: 6,
          leftColor: '#4DB6AC',
          rightColor: '#80CBC4',
        },
      },
      head: {
        radius: 24,
        borderWidth: 3,
        borderColor: '#E0F2F1',
        fillColor: 'transparent',
        hair: {
          style: 'none',
          color: '#004D40',
        },
        face: {
          eyes: { type: 'dot', color: '#FFFFFF', size: 3 },
          mouth: { type: 'flat', color: '#B2DFDB', width: 10 },
        },
      },
      effects: {
        repGlow: {
          enabled: true,
          color: '#A5D6A7',
          radiusScale: 1.4,
          triggerOnRepChange: true,
        },
        trail: { enabled: false },
      },
      attachments: [
        {
          id: 'mint_leaf',
          bone: 'CHEST',
          offset: { x: 0, y: -0.2 },
          size: 0.6,
          shape: 'circle',
          color: '#A5D6A7',
        },
      ],
    },
  },
  {
    id: 'cyber_gold',
    name: '赛博金甲',
    rarity: 'legendary',
    price: { currency: 'coin', amount: 1200 },
    style: {
      line: {
        width: 5,
        color: '#FFF59D',
        opacity: 1,
        cap: 'round',
        join: 'round',
      },
      joint: {
        radius: 7,
        leftColor: '#FFEB3B',
        rightColor: '#FFC107',
        neutralColor: '#FFFDE7',
        highlightColor: '#FFFFFF',
      },
      body: {
        torso: {
          thickness: 12,
          color: '#FFF59D',
          fillOpacity: 0.3,
        },
        limb: {
          thickness: 7,
          leftColor: '#FBC02D',
          rightColor: '#FFEB3B',
        },
      },
      head: {
        radius: 26,
        borderWidth: 3,
        borderColor: '#FFF59D',
        fillColor: 'transparent',
        hair: {
          style: 'spiky',
          color: '#FFD54F',
        },
        face: {
          eyes: { type: 'circle', color: '#FFFDE7', size: 4 },
          mouth: { type: 'flat', color: '#FFECB3', width: 10 },
        },
      },
      effects: {
        repGlow: {
          enabled: true,
          color: '#FFEB3B',
          radiusScale: 1.8,
          triggerOnRepChange: true,
        },
        trail: { enabled: true },
      },
      attachments: [
        {
          id: 'gold_crown',
          bone: 'HEAD',
          offset: { x: 0, y: -1.0 },
          size: 0.55,
          shape: 'rect',
          color: '#FFEB3B',
        },
      ],
    },
  },
  {
    id: 'pirate_captain',
    name: '海盗船长',
    rarity: 'epic',
    price: { currency: 'coin', amount: 600 },
    style: {
      line: {
        width: 4,
        color: '#8B4513',
        opacity: 1,
        cap: 'round',
        join: 'round',
      },
      joint: {
        radius: 6,
        leftColor: '#D2691E',
        rightColor: '#CD853F',
        neutralColor: '#DEB887',
        highlightColor: '#FFD700',
      },
      body: {
        torso: { thickness: 10, color: '#8B4513', fillOpacity: 0.2 },
        limb: { thickness: 6, leftColor: '#D2691E', rightColor: '#CD853F' },
      },
      head: {
        radius: 24,
        borderWidth: 3,
        borderColor: '#8B4513',
        fillColor: 'transparent',
        asset: 'pirate_hat',
        showHeadCircle: false,
        showFaceSkeleton: false,
        hair: { style: 'none', color: '#8B4513' },
        face: {
          eyes: { type: 'dot', color: '#FFFFFF', size: 3 },
          mouth: { type: 'smile', color: '#DEB887', width: 10 },
        },
      },
      effects: {
        repGlow: { enabled: true, color: '#FFD700', radiusScale: 1.5, triggerOnRepChange: true },
        trail: { enabled: false },
      },
      attachments: [],
    },
  },
];

const numColumns = 2;
const { width: screenWidth } = Dimensions.get('window');
const itemHorizontalPadding = 16;
const itemGap = 12;
const cardWidth =
  (screenWidth - itemHorizontalPadding * 2 - itemGap * (numColumns - 1)) / numColumns;

export default function SkinScreenList({ onBack, onSelectSkin }: SkinScreenListProps) {
  const renderItem = useCallback(
    ({ item }: { item: StickmanSkin }) => {
      const rarityText =
        item.rarity === 'legendary'
          ? '传说'
          : item.rarity === 'epic'
          ? '史诗'
          : item.rarity === 'rare'
          ? '稀有'
          : '普通';
      return (
        <Pressable
          style={styles.card}
          onPress={() => {
            onSelectSkin?.(item);
          }}
        >
          <View style={styles.thumb}>
            <Text style={styles.thumbText}>{item.name}</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardRarity}>{rarityText}</Text>
          </View>
        </Pressable>
      );
    },
    [onSelectSkin],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>皮肤商店</Text>
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={SKINS_DEMO}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
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
  listContent: {
    paddingHorizontal: itemHorizontalPadding,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: itemGap,
  },
  card: {
    width: cardWidth,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  thumb: {
    height: cardWidth * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  thumbText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardFooter: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    flexShrink: 1,
    marginRight: 4,
  },
  cardRarity: {
    color: '#FFCA28',
    fontSize: 12,
  },
});

