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
}

export type TimerState = 'running' | 'paused' | 'done';

export interface Timer {
  id: number;
  food: Food;
  /** 暂停/完成时的权威剩余时间（毫秒）；运行中以 endAtMono 实时计算 */
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

export interface Settings {
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** @deprecated 震动功能已移除，字段保留仅为旧存档兼容（无 UI、无行为） */
  vibrate: boolean;
  /** @deprecated 系统通知功能已移除，字段保留仅为旧存档兼容（无 UI、无行为） */
  systemNotify: boolean;
  installDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.3,
  vibrate: false,
  systemNotify: false,
  installDismissed: false,
};

export interface AppState {
  timers: Timer[];
  myFoods: MyFood[];
  settings: Settings;
  nextTimerId: number;
  /** 快速计时默认名「自定义食材N」的编号 */
  customFoodCounter: number;
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
  customFoodCounter: number;
}
