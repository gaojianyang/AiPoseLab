export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SkinPrice {
  currency: 'coin' | 'rmb' | 'usd';
  amount: number;
}

export interface SkinPreview {
  thumbnailUrl?: string;
  // 预留：本地资源 id，比如 'classic_thumb'
  localAssetName?: string;
}

export interface LineStyle {
  width: number;
  color: string;
  opacity?: number;
  cap?: 'round' | 'square';
  join?: 'round' | 'bevel' | 'miter';
}

export interface JointStyle {
  radius: number;
  leftColor: string;
  rightColor: string;
  neutralColor: string;
  highlightColor?: string;
}

export interface TorsoStyle {
  thickness: number;
  color: string;
  fillOpacity?: number;
}

export interface LimbStyle {
  thickness: number;
  leftColor: string;
  rightColor: string;
}

export interface HairStyle {
  style: 'none' | 'short' | 'spiky' | 'long';
  color: string;
}

export interface FaceEyesStyle {
  type: 'none' | 'dot' | 'circle';
  color: string;
  size: number;
}

export interface FaceMouthStyle {
  type: 'none' | 'smile' | 'flat';
  color: string;
  width: number;
}

export interface HeadStyle {
  radius: number;
  borderWidth: number;
  borderColor: string;
  fillColor?: string;
  /** 原生头饰贴图：如 'pirate_hat' 表示使用 assets/pirate_hat.png，仅该皮肤会绘制 */
  asset?: string;
  /** 是否绘制代表头的圆（及发型）。显示脸部挂件时可设为 false */
  showHeadCircle?: boolean;
  /** 是否绘制面部骨架连线（眼睛、嘴巴等）。显示脸部挂件时可设为 false */
  showFaceSkeleton?: boolean;
  hair?: HairStyle;
  face?: {
    eyes?: FaceEyesStyle;
    mouth?: FaceMouthStyle;
  };
}

export interface RepGlowEffect {
  enabled: boolean;
  color: string;
  radiusScale: number;
  triggerOnRepChange: boolean;
}

export interface TrailEffect {
  enabled: boolean;
}

export interface SkinEffects {
  repGlow?: RepGlowEffect;
  trail?: TrailEffect;
}

export type AttachmentBone = 'HEAD' | 'CHEST' | 'LEFT_HAND' | 'RIGHT_HAND';

export interface AttachmentSprite {
  id: string;
  bone: AttachmentBone;
  /** 相对于身体基准单位（如肩宽）的偏移比例 */
  offset: { x: number; y: number };
  /** 尺寸比例：最终像素大小 = size * bodyUnit */
  size: number;
  /** 简单形状，首版仅支持 circle/rect */
  shape: 'circle' | 'rect';
  color: string;
}

/**
 * 单个皮肤的完整样式描述。
 * MediaPipe 骨骼结构由代码固定，皮肤只负责“怎么画”。
 */
export interface StickmanSkinStyle {
  line: LineStyle;
  joint: JointStyle;
  body?: {
    torso?: TorsoStyle;
    limb?: LimbStyle;
  };
  head?: HeadStyle;
  effects?: SkinEffects;
   /** 2D 挂件：根据骨骼挂载的“饰品” */
  attachments?: AttachmentSprite[];
}

export interface StickmanSkin {
  id: string;
  name: string;
  description?: string;
  rarity: SkinRarity;
  price: SkinPrice;
  preview?: SkinPreview;
  style: StickmanSkinStyle;
}

/**
 * 皮肤包：方便从远端/本地一次加载多套皮肤。
 */
export interface StickmanSkinPack {
  version: number;
  skins: StickmanSkin[];
}

