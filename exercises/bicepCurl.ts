import type { ExerciseBase } from '../types/workout';

/**
 * 右手哑铃弯举：使用右肩(12) / 右肘(14) / 右腕(16) 作为角度顶点。
 */
export const RIGHT_BICEP_CURL_EXERCISE: ExerciseBase = {
  id: 'right_bicep_curl',
  name: '右手哑铃弯举',
  description: '使用右臂完成肘关节弯曲的哑铃弯举动作。',
  tags: ['upper_body', 'biceps', 'right_arm'],

  poseRequirements: [
    {
      side: 'right',
      indices: [12, 14, 16], // 右肩、右肘、右腕
    },
  ],

  scoring: {
    type: 'repCounter',
    side: 'right',
    angleAt: {
      a: 12, // 肩
      b: 14, // 肘（角度顶点）
      c: 16, // 腕
    },
    thresholds: {
      upDeg: 50, // 小于 50° 认为“举起”
      downDeg: 160, // 大于 160° 认为“放下”
    },
    requireInView: true,
    minIntervalMs: 200,
  },
};

/**
 * 左手哑铃弯举：使用左肩(11) / 左肘(13) / 左腕(15) 作为角度顶点。
 */
export const LEFT_BICEP_CURL_EXERCISE: ExerciseBase = {
  id: 'left_bicep_curl',
  name: '左手哑铃弯举',
  description: '使用左臂完成肘关节弯曲的哑铃弯举动作。',
  tags: ['upper_body', 'biceps', 'left_arm'],

  poseRequirements: [
    {
      side: 'left',
      indices: [11, 13, 15], // 左肩、左肘、左腕
    },
  ],

  scoring: {
    type: 'repCounter',
    side: 'left',
    angleAt: {
      a: 11,
      b: 13,
      c: 15,
    },
    thresholds: {
      upDeg: 50,
      downDeg: 160,
    },
    requireInView: true,
    minIntervalMs: 200,
  },
};

/**
 * 双手哑铃弯举：
 * - 配置上标记为 side: 'both'，并在 poseRequirements 中声明左右两侧关键点。
 * - 当前 scoring 使用右臂作为计数角度来源（便于与现有 runtime 适配），
 *   以后如果需要“必须左右同时满足才计数”，可以在运行时代码里扩展解释逻辑。
 */
export const BILATERAL_BICEP_CURL_EXERCISE: ExerciseBase = {
  id: 'bilateral_bicep_curl',
  name: '双手哑铃弯举',
  description: '左右双臂同时完成肘关节弯曲的哑铃弯举动作。',
  tags: ['upper_body', 'biceps', 'both_arms'],

  poseRequirements: [
    {
      side: 'left',
      indices: [11, 13, 15],
    },
    {
      side: 'right',
      indices: [12, 14, 16],
    },
  ],

  scoring: {
    type: 'repCounter',
    side: 'both',
    // 目前以右臂角度为计数参考（简单起步版本）
    angleAt: {
      a: 12,
      b: 14,
      c: 16,
    },
    thresholds: {
      upDeg: 50,
      downDeg: 160,
    },
    requireInView: true,
    minIntervalMs: 200,
  },
};

