import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { SkinPrice } from '../types/skin';

export interface SkinStoreScreenProps {
  onBack: () => void;
}

/** 商店单件商品：用于头顶/脸部/身体部位的皮肤资源 */
export interface SkinStoreItem {
  id: string;
  name: string;
  price: SkinPrice;
  /** 图片路径：本地 require 或远程 uri */
  path: string;
  /** 资源标识，如 pirate_hat、pirate_face、prirate_body */
  asset?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

const TABS = [
  { key: 'headTop', label: '头顶' },
  { key: 'face', label: '脸部' },
  { key: 'body', label: '身体' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** 模拟数据：头顶 */
const MOCK_HEAD_ITEMS: SkinStoreItem[] = [
  { id: 'h1', name: '海盗帽', price: { currency: 'coin', amount: 100 }, path: '', asset: 'pirate_hat', rarity: 'rare' },
  { id: 'h2', name: '经典圆顶', price: { currency: 'coin', amount: 0 }, path: '', asset: 'classic', rarity: 'common' },
  { id: 'h3', name: '霓虹帽', price: { currency: 'coin', amount: 200 }, path: '', asset: 'neon_hat', rarity: 'epic' },
  { id: 'h4', name: '皇冠', price: { currency: 'coin', amount: 500 }, path: '', asset: 'crown', rarity: 'legendary' },
  { id: 'h5', name: '棒球帽', price: { currency: 'coin', amount: 80 }, path: '', asset: 'cap', rarity: 'common' },
  { id: 'h6', name: '魔法帽', price: { currency: 'coin', amount: 350 }, path: '', asset: 'wizard_hat', rarity: 'epic' },
];

/** 模拟数据：脸部 */
const MOCK_FACE_ITEMS: SkinStoreItem[] = [
  { id: 'f1', name: '海盗脸', price: { currency: 'coin', amount: 100 }, path: '', asset: 'pirate_face', rarity: 'rare' },
  { id: 'f2', name: '默认脸', price: { currency: 'coin', amount: 0 }, path: '', asset: 'default_face', rarity: 'common' },
  { id: 'f3', name: '机械脸', price: { currency: 'coin', amount: 280 }, path: '', asset: 'cyber_face', rarity: 'epic' },
  { id: 'f4', name: '像素脸', price: { currency: 'coin', amount: 150 }, path: '', asset: 'pixel_face', rarity: 'rare' },
  { id: 'f5', name: '动物脸', price: { currency: 'coin', amount: 180 }, path: '', asset: 'animal_face', rarity: 'rare' },
  { id: 'f6', name: '炫彩脸', price: { currency: 'coin', amount: 400 }, path: '', asset: 'rainbow_face', rarity: 'legendary' },
];

/** 模拟数据：身体 */
const MOCK_BODY_ITEMS: SkinStoreItem[] = [
  { id: 'b1', name: '海盗躯干', price: { currency: 'coin', amount: 100 }, path: '', asset: 'prirate_body', rarity: 'rare' },
  { id: 'b2', name: '经典躯干', price: { currency: 'coin', amount: 0 }, path: '', asset: 'classic_body', rarity: 'common' },
  { id: 'b3', name: '机甲躯干', price: { currency: 'coin', amount: 320 }, path: '', asset: 'mecha_body', rarity: 'epic' },
  { id: 'b4', name: '运动服', price: { currency: 'coin', amount: 120 }, path: '', asset: 'sport_body', rarity: 'rare' },
  { id: 'b5', name: '西装', price: { currency: 'coin', amount: 250 }, path: '', asset: 'suit_body', rarity: 'epic' },
  { id: 'b6', name: '黄金战甲', price: { currency: 'coin', amount: 600 }, path: '', asset: 'gold_armor', rarity: 'legendary' },
];

const DATA_BY_TAB: Record<TabKey, SkinStoreItem[]> = {
  headTop: MOCK_HEAD_ITEMS,
  face: MOCK_FACE_ITEMS,
  body: MOCK_BODY_ITEMS,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const NUM_COLUMNS = 4;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 0.9;

function formatPrice(p: SkinPrice): string {
  if (p.currency === 'coin') return `${p.amount} 币`;
  if (p.currency === 'rmb') return `¥${p.amount}`;
  return `$${p.amount}`;
}

export default function SkinStoreScreen({ onBack }: SkinStoreScreenProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('headTop');
  const [searchQuery, setSearchQuery] = useState('');

  const listData = useMemo(() => {
    const raw = DATA_BY_TAB[activeTab];
    if (!searchQuery.trim()) return raw;
    const q = searchQuery.trim().toLowerCase();
    return raw.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeTab, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: SkinStoreItem }) => (
      <View style={styles.card}>
        <View style={styles.cardImage}>
          <Text style={styles.cardImagePlaceholder} numberOfLines={1}>
            {item.asset || item.id}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
        </View>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Toolbar: 返回 + 搜索框 */}
      <View style={styles.toolbar}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </Pressable>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索皮肤..."
          placeholderTextColor="rgba(255,255,255,0.45)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
      {/* Tab */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* 图片列表 4 列 */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        key={activeTab}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 4,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(45,107,255,0.7)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  columnWrapper: {
    flexDirection: 'row',
    marginBottom: GAP,
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholder: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  cardFooter: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 2,
  },
  cardPrice: {
    color: '#FFCA28',
    fontSize: 11,
  },
});
