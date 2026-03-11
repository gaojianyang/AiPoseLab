export type ExerciseId = string;

/**
 * MediaPipe Pose 33 个关键点索引（0~32）
 * 这里用 number 以保持 JSON 友好；如需更强类型可再引入 enum。
 */
export type LandmarkIndex = number;

export type Side = 'left' | 'right' | 'both' | 'none';

/**
 * 用“纯数据”描述：为了判断这个动作，需要哪些关键点/关节信息。
 * - indices: 至少要提供这些关键点（例如弯举需要 shoulder/elbow/wrist）
 * - side: 该规则偏向左/右/双侧
 */
export interface PoseRequirement {
  side: Side;
  indices: LandmarkIndex[];
}

/**
 * 计数/计分规则：保持 JSON 可序列化，用判别联合表达不同规则类型。
 * 后续新增动作，只需要新增一种 rule.type 并在代码里实现解释器。
 */
export type ScoringRule =
  | {
      /** 计“次数”：例如深蹲、弯举 */
      type: 'repCounter';
      /** 角度关节：用三点定义角度（at 为顶点） */
      angleAt: {
        a: LandmarkIndex; // 例如 hip/shoulder
        b: LandmarkIndex; // 例如 knee/elbow（角度顶点）
        c: LandmarkIndex; // 例如 ankle/wrist
      };
      /** 阈值：从 down -> up 触发 +1；up -> down 复位 */
      thresholds: {
        upDeg: number; // 小于该角度认为进入 up
        downDeg: number; // 大于该角度认为进入 down
      };
      /** 左右侧：left/right/both/none */
      side: Side;
      /**
       * 可选：为了避免“骨架没画出来但计数”的误判
       * true 表示参与判定的关键点必须在 (0..1) 范围内。
       */
      requireInView?: boolean;
      /** 可选：最小时间间隔（ms），防止抖动导致连跳 */
      minIntervalMs?: number;
    }
  | {
      /** 计“保持时间”：例如瑜伽体式保持 */
      type: 'holdTimer';
      /** 达成条件：简单阈值示例（例如某关节角度在范围内算保持成功） */
      angleRangeAt?: {
        a: LandmarkIndex;
        b: LandmarkIndex;
        c: LandmarkIndex;
        minDeg: number;
        maxDeg: number;
      };
      /** 需要连续满足条件的最短时间（ms） */
      holdMs: number;
      side: Side;
      requireInView?: boolean;
    }
  | {
      /** 自定义评分：把关键点需求和阈值留给服务端/配置端解释 */
      type: 'custom';
      schemaVersion: number;
      payload: Record<string, unknown>;
    };

/**
 * 动作基础定义：可直接 JSON 序列化入库/上传。
 */
export interface ExerciseBase {
  /** 动作 ID，例如 'squat'、'bicep_curl' */
  id: ExerciseId;
  /** 展示名，例如 '深蹲'、'哑铃弯举' */
  name: string;
  /** 姿态检测所需的关键点/关节逻辑（纯数据描述） */
  poseRequirements: PoseRequirement[];
  /** 计分/计数标准（纯数据规则） */
  scoring: ScoringRule;
  /** 可选：描述、难度、标签等，方便扩展 */
  description?: string;
  tags?: string[];
}

/**
 * 计划里的单个任务：引用某个 ExerciseBase，并指定目标次数/目标时长等。
 * - 为了 JSON 友好，这里用 exerciseId 来引用动作定义（数据库里可做外键/引用）。
 */
export type WorkoutTask =
  | {
      type: 'reps';
      exerciseId: ExerciseId;
      targetReps: number;
    }
  | {
      type: 'hold';
      exerciseId: ExerciseId;
      targetHoldMs: number;
    };

/**
 * 训练计划：可直接 JSON 序列化入库/上传。
 */
export interface WorkoutPlan {
  name: string;
  creator: string;
  tasks: WorkoutTask[];
  /** 可选：创建/更新时间戳，便于同步（ISO 字符串，JSON 友好） */
  createdAt?: string;
  updatedAt?: string;
  /** 可选：版本号，便于后续迁移 */
  version?: number;
}

