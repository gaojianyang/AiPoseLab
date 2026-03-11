export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
};

export type PoseMode = 'yoga' | 'squat';

/**
 * 一维 One Euro Filter 实现
 * 参考论文: "The One Euro Filter: Simple, general and fast"
 */
class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private readonly minCutoff: number, // 基础截止频率
    private readonly beta: number, // 响应速度与导数的权重
    private readonly dCutoff: number // 导数的截止频率
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  private lowPass(x: number, prev: number, alpha: number): number {
    return alpha * x + (1.0 - alpha) * prev;
  }

  /**
   * @param x 当前输入值
   * @param t 当前时间（秒或毫秒，但必须单调递增，内部只用差值）
   */
  filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      // 首帧直接通过
      this.xPrev = x;
      this.tPrev = t;
      this.dxPrev = 0;
      return x;
    }

    // dt：相邻两帧时间间隔，防止异常为 0
    let dt = t - this.tPrev;
    if (dt <= 0) {
      // 时间不前进时退化为简单低通
      dt = 1 / 60;
    }

    // 1. 导数估计并滤波
    const dx = (x - this.xPrev) / dt;
    const alphaD = this.alpha(this.dCutoff, dt);
    const dxHat = this.lowPass(dx, this.dxPrev, alphaD);

    // 2. 根据导数动态调整 cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const alpha = this.alpha(cutoff, dt);

    // 3. 对原始信号做低通
    const xHat = this.lowPass(x, this.xPrev, alpha);

    // 更新状态
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;

    return xHat;
  }
}

/**
 * 同时平滑 33 个关键点 (x,y,z) 的姿态平滑器
 * - 支持「瑜伽保持」和「深蹲计数」两种模式的预设参数
 * - 未来可以很容易再加其他模式
 */
export class PoseSmoother {
  private readonly filters: OneEuroFilter[] = [];
  private readonly landmarkCount: number;

  /**
   * @param mode "yoga" | "squat"
   * @param landmarkCount 关键点数量，默认 33
   */
  constructor(mode: PoseMode, landmarkCount: number = 33) {
    this.landmarkCount = landmarkCount;

    const { minCutoff, beta, dCutoff } = PoseSmoother.getPreset(mode);

    // 为每个关键点的 x / y / z 各建一个 OneEuroFilter
    const totalDims = landmarkCount * 3;
    for (let i = 0; i < totalDims; i++) {
      this.filters.push(new OneEuroFilter(minCutoff, beta, dCutoff));
    }
  }

  /**
   * 预设参数：
   * - yoga: 更平滑、延迟略高，适合姿势保持
   * - squat: 更跟手、延迟低，适合计数
   */
  private static getPreset(mode: PoseMode) {
    switch (mode) {
      case 'yoga':
        return {
          // 更强平滑：基础截止频率低，beta 小
          minCutoff: 0.8, // Hz
          beta: 0.1,
          dCutoff: 1.0,
        };
      case 'squat':
      default:
        return {
          // 更跟手：基础截止频率略高，beta 更大
          minCutoff: 1.5, // Hz
          beta: 0.4,
          dCutoff: 1.0,
        };
    }
  }

  /**
   * 更新一帧姿态并返回平滑后的关键点数组。
   *
   * @param landmarks 原始关键点数组（长度通常为 33）
   * @param timestamp 当前时间（推荐秒；若使用毫秒，也要全程统一）
   */
  update(landmarks: PoseLandmark[], timestamp: number): PoseLandmark[] {
    if (!landmarks || landmarks.length === 0) {
      return [];
    }

    const count = Math.min(landmarks.length, this.landmarkCount);
    const smoothed: PoseLandmark[] = new Array(count);

    for (let i = 0; i < count; i++) {
      const lm = landmarks[i];
      const base = i * 3;

      const x = this.filters[base + 0].filter(lm.x, timestamp);
      const y = this.filters[base + 1].filter(lm.y, timestamp);
      const z = this.filters[base + 2].filter(lm.z, timestamp);

      smoothed[i] = { x, y, z };
    }

    return smoothed;
  }
}

