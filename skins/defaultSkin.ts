import type { StickmanSkin } from '../types/skin';

export const defaultSkin: StickmanSkin = {
  id: 'classic_blue_orange',
  name: '经典蓝橙火柴人',
  description: '当前应用内使用的基础火柴人皮肤。',
  rarity: 'common',
  price: {
    currency: 'coin',
    amount: 0,
  },
  style: {
    line: {
      width: 4,
      color: '#FFFFFF',
      opacity: 1,
      cap: 'round',
      join: 'round',
    },
    joint: {
      radius: 5,
      leftColor: '#34B3FF',
      rightColor: '#FF8A3C',
      neutralColor: '#FFFFFF',
      highlightColor: '#FFD700',
    },
    body: {
      torso: {
        thickness: 10,
        color: '#FFFFFF',
        fillOpacity: 0.15,
      },
      limb: {
        thickness: 6,
        leftColor: '#34B3FF',
        rightColor: '#FF8A3C',
      },
    },
    head: {
      radius: 22,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      fillColor: 'transparent',
      hair: {
        style: 'short',
        color: '#FFCC00',
      },
      face: {
        eyes: {
          type: 'dot',
          color: '#FFFFFF',
          size: 3,
        },
        mouth: {
          type: 'smile',
          color: '#FFFFFF',
          width: 10,
        },
      },
    },
    effects: {
      repGlow: {
        enabled: true,
        color: '#00FFAA',
        radiusScale: 1.4,
        triggerOnRepChange: true,
      },
      trail: {
        enabled: false,
      },
    },
  },
};

