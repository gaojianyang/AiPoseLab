import type { ExerciseBase } from '../types/workout';

/**
 * 深蹲：以髋(24) / 膝(26) / 踝(28) 为关节角度（右腿示例），side 标记为 both，后续可扩展双腿判定。
 */
export const SQUAT_EXERCISE: ExerciseBase = {
  id: 'squat',
  name: '深蹲',
  description: '标准深蹲动作，以膝关节弯曲角度计数。',
  tags: ['lower_body', 'legs', 'squat'],

  poseRequirements: [
    {
      side: 'right',
      indices: [24, 26, 28], // 右髋、右膝、右踝
    },
  ],

  scoring: {
    type: 'repCounter',
    side: 'both',
    angleAt: {
      a: 24, // 髋
      b: 26, // 膝
      c: 28, // 踝
    },
    thresholds: {
      upDeg: 70, // 小于 70° 认为“下蹲到位”
      downDeg: 160, // 大于 160° 认为“站直”
    },
    requireInView: true,
    minIntervalMs: 250,
  },
};

