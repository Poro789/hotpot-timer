/** 一份计时条目对应的食材信息 */
export interface Food {
  /** 原始名称（不带 xN 后缀），用于份数统计与去重 */
  baseName: string;
  /** 展示名称（可能带 xN 后缀） */
  name: string;
  /** 总时长（毫秒） */
  totalMs: number;
  /** 熟度提示 / 自定义说明 */
  desc: string;
  /** 是否快速计时产生的自定义条目 */
  custom?: boolean;
  /** 三档时长（秒）；仅目录食材有，用于派生熟度状态 */
  times?: { rare: number; medium: number; wellDone: number };
  /** 三档熟成判据（目视确认线索）；仅目录食材有 */
  cues?: Record<Doneness, string>;
  /** 偏生档安全提示；仅目录食材且有风险时非空 */
  risk?: string;
  /** 涮煮手法提示（一句话）；仅目录食材且有明确手法时非空 */
  technique?: string;
  /** 超时后果：hard=多煮即老（硬超时）/ soft=多煮更入味（软超时）；仅目录食材 */
  overtime?: 'hard' | 'soft';
  /** 阶段提示：已过该比例时提醒检查（0~1）；仅目录食材且中途有状态变化时设置 */
  midpoint?: number;
}

export type TimerState = 'running' | 'paused' | 'done';

export interface Timer {
  id: number;
  food: Food;
  /**
   * 剩余/超时（毫秒），**符号约定**——同一个字段三种身份，读之前先看 state：
   * - `paused`：权威剩余（正数）。它没有 endAt 可算，只有这里可信。
   * - `running` / `done`：每帧由 `tickTimers` 按 `endAtMono` 重算的**派生显示值**，
   *   正 = 还剩多少，**负 = 已超时多少**；跨会话（无 endAtMono）时按 `endAt` 墙钟续算。
   * 显示请走 `liveRemainingMs()` + `formatRemaining()` / `formatOvertime()`；
   * 别把它直接喂给格式化函数——负数会被当 0，超时读数就没了。
   */
  remainingMs: number;
  state: TimerState;
  /** 运行中：目标结束时刻（墙钟，ms epoch），仅用于跨会话续算 */
  endAt: number | null;
  /** 运行中：目标结束时刻（单调钟，performance.now 基），会话内计时依据，不受系统改时影响 */
  endAtMono: number | null;
  /** 页面关闭期间已到期，恢复时补提示（不发声） */
  missed: boolean;
}

export interface MyFood {
  name: string;
  timeSec: number;
}

/** 熟度档位（目录食材的三档时长键）：偏生 / 适中 / 偏熟 */
export type Doneness = 'rare' | 'medium' | 'wellDone';

/** 计时中的熟度状态（纯派生值，不持久化） */
export type DonenessStatus = 'rare' | 'medium' | 'wellDone';

/** 熟度状态标签 */
export const DONENESS_STATUS_LABELS: Record<DonenessStatus, string> = {
  rare: '偏生',
  medium: '适中',
  wellDone: '偏熟',
};

/**
 * 由已过时间派生熟度状态（纯函数，不持久化）：
 * - 未计时（elapsed=0）-> null（未开始）
 * - elapsed < rare 档时长 -> 'rare'（偏生）
 * - rare <= elapsed < medium 档时长 -> 'medium'（适中）
 * - elapsed >= medium 档时长 -> 'wellDone'（偏熟，含到点与超时）
 * 自定义/快速计时食材无三档阈值，返回 null。
 */
export function deriveDonenessStatus(
  elapsedMs: number,
  times: { rare: number; medium: number; wellDone: number } | undefined,
): DonenessStatus | null {
  if (!times) return null;
  if (elapsedMs <= 0) return null;
  if (elapsedMs < times.rare * 1000) return 'rare';
  if (elapsedMs < times.medium * 1000) return 'medium';
  return 'wellDone';
}

export interface Settings {
  sound: boolean;
  /** 0..1 */
  volume: number;
  installDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.3,
  installDismissed: false,
};

export interface AppState {
  timers: Timer[];
  myFoods: MyFood[];
  settings: Settings;
  nextTimerId: number;
}

/** 告警会话：完成队列 + 循环提醒状态（纯数据，供 AlarmController 使用） */
export interface AlarmState {
  active: boolean;
  /** 待确认的计时器 id 队列（合并多次完成） */
  queue: number[];
  startedAtWall: number;
}

export const STATE_VERSION = 3;

/** 持久化用的计时器快照（与运行时 Timer 的区别：不含 endAtMono） */
export interface PersistedTimer {
  id: number;
  food: Food;
  /** 只有 `paused` 条目携带权威剩余；`running`/`done` 写 0 占位（真相在 endAt，加载时按墙钟重算）。
   *  旧存档里 running/done 可能是正数或负数的实际值——不读它。 */
  remainingMs: number;
  state: TimerState;
  endAt: number | null;
  missed: boolean;
}

export interface PersistedState {
  version: number;
  timers: PersistedTimer[];
  myFoods: MyFood[];
  settings: Settings;
  nextTimerId: number;
  // 注：早期 v3 存档里可能带 customFoodCounter——不读它，默认名从计时列表推导
}
