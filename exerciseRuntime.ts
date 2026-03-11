import type { ExerciseBase, ScoringRule } from './types/workout';
import type { PoseLandmark } from './PoseSmoother';

/**
 * 单个动作在前端运行时的计数状态。
 * - 可以按 exerciseId + side 存在 Map 里，支持多动作/多侧并行。
 */
export interface RepCounterRuntimeState {
  /** 当前阶段：'down'（放下）或 'up'（举起） */
  phase: 'down' | 'up';
  /** 当前已计数次数 */
  count: number;
  /** 上一次成功计数的时间戳（ms），用于防抖 */
  lastRepTimestampMs?: number;
}

export interface ExerciseRuntimeResult {
  /** 更新后的计数状态 */
  state: RepCounterRuntimeState;
  /** 本次是否新完成了一次计数（从 0 变 1、从 1 变 2 等） */
  didIncrement: boolean;
}

const DEFAULT_MIN_INTERVAL_MS = 150;

const isInView = (p: PoseLandmark) =>
  p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

const computeAngleAtPoint = (a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number => {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return 180;
  let cos = dot / (magAB * magCB);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
};

/**
 * 根据 ExerciseBase 的 scoring 规则，驱动“弯举计数”等逻辑。
 * - 目前实现了 type = 'repCounter' 的解释器，后续可扩展 holdTimer/custom。
 */
export function updateRepCounterFromExercise(
  exercise: ExerciseBase,
  prevState: RepCounterRuntimeState,
  landmarks: PoseLandmark[],
  timestampMs: number
): ExerciseRuntimeResult {
  const rule = exercise.scoring;
  if (rule.type !== 'repCounter') {
    // 非次数类动作，这里暂不处理，直接原样返回
    return { state: prevState, didIncrement: false };
  }
  return updateRepCounterWithRule(rule, prevState, landmarks, timestampMs);
}

/**
 * 直接基于 ScoringRule（repCounter）驱动一次状态更新。
 * 可以在不关心 ExerciseBase 其它字段时单独使用。
 */
export function updateRepCounterWithRule(
  rule: Extract<ScoringRule, { type: 'repCounter' }>,
  prevState: RepCounterRuntimeState,
  landmarks: PoseLandmark[],
  timestampMs: number
): ExerciseRuntimeResult {
  const a = landmarks[rule.angleAt.a];
  const b = landmarks[rule.angleAt.b];
  const c = landmarks[rule.angleAt.c];
  if (!a || !b || !c) {
    return { state: prevState, didIncrement: false };
  }

  if (rule.requireInView) {
    if (!isInView(a) || !isInView(b) || !isInView(c)) {
      return { state: prevState, didIncrement: false };
    }
  }

  const minInterval = rule.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  if (
    prevState.lastRepTimestampMs != null &&
    timestampMs - prevState.lastRepTimestampMs < minInterval
  ) {
    // 时间间隔太短，直接忽略本次，防止抖动连跳
    return { state: prevState, didIncrement: false };
  }

  const angle = computeAngleAtPoint(a, b, c);
  let phase = prevState.phase;
  let count = prevState.count;
  let lastRepTimestampMs = prevState.lastRepTimestampMs;
  let didIncrement = false;

  if (phase === 'down' && angle < rule.thresholds.upDeg) {
    // down -> up，计数 +1
    phase = 'up';
    count += 1;
    lastRepTimestampMs = timestampMs;
    didIncrement = true;
  } else if (phase === 'up' && angle > rule.thresholds.downDeg) {
    // up -> down，准备下一次计数
    phase = 'down';
  }

  return {
    state: { phase, count, lastRepTimestampMs },
    didIncrement,
  };
}

