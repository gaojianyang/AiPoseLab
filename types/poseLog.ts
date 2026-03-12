/**
 * 单帧姿态日志：录制时 MediaPipe 输出 + 时间戳 + 计数。
 * 用于训练结束后与纯净视频合成「带骨架」视频。
 */
export interface PoseFrameLog {
  /** 相对录制开始的毫秒数 */
  t: number;
  /** 33 个关键点 (x, y, z)，与 MediaPipe 顺序一致 */
  landmarks: Array<{ x: number; y: number; z: number }>;
  /** 当前 rep 计数 */
  repCount: number;
}

/**
 * 整段录制的姿态日志文件结构（可 JSON 序列化）
 */
export interface PoseLogFile {
  /** 录制开始时的绝对时间戳 (ms)，便于对齐 */
  startTime: number;
  /** 视频预估 fps，合成时用 */
  fps: number;
  frames: PoseFrameLog[];
}
