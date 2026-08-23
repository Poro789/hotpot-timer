import {
  DEFAULT_SETTINGS,
  STATE_VERSION,
  type AppState,
  type MyFood,
  type PersistedState,
  type PersistedTimer,
  type Settings,
  type Timer,
  type TimerState,
} from '../core/types';
import { defaultState } from '../core/store';
import { settleOnLoad } from '../core/time';

/**
 * 存储 key 沿用旧版（v2 数据可读），内容带 version 字段做迁移链：
 * v2（旧版形状：remainingTime/isRunning，含冗余 foodAddCounts）
 *   -> v3（毫秒 + 状态机 + 设置项，移除 foodAddCounts 冗余计数）
 */
const KEY = 'hotpot-timer-state-v2';

// ---------- 迁移（纯函数，可单测） ----------

interface LegacyFood {
  baseName?: string;
  name: string;
  time?: number;
  totalTime?: number;
  desc?: string;
  custom?: boolean;
}

interface LegacyTimer {
  id: number;
  food: LegacyFood;
  totalTime?: number;
  remainingTime?: number;
  isRunning?: boolean;
  endAt?: number | null;
}

/** 原始 JSON -> v3 PersistedState；无法识别/损坏返回 null */
export function migrate(raw: unknown): PersistedState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === 'number' ? o.version : 2;
  switch (version) {
    case 2:
      return migrateV2(o);
    case 3:
      return sanitizeV3(o);
    default:
      return null; // 来自更新版本的存档：不降级，按空状态处理
  }
}

/** v3 存档：结构校验（timers 形状损坏 -> 整体拒收；个别坏条目 -> 过滤） */
function sanitizeV3(o: Record<string, unknown>): PersistedState | null {
  if (!Array.isArray(o.timers)) return null;
  const timers = (o.timers as PersistedTimer[]).filter(validPersistedTimer);
  return {
    version: STATE_VERSION,
    timers,
    myFoods: parseMyFoods(o.myFoods),
    settings: parseSettings(o.settings),
    nextTimerId:
      typeof o.nextTimerId === 'number'
        ? o.nextTimerId
        : (timers.length > 0 ? Math.max(...timers.map((t) => t.id)) : 0) + 1,
    customFoodCounter: typeof o.customFoodCounter === 'number' ? o.customFoodCounter : 1,
  };
}

function validPersistedTimer(t: PersistedTimer): boolean {
  return (
    typeof t?.id === 'number' &&
    typeof t?.food?.name === 'string' &&
    t.food.name.length > 0 &&
    typeof t?.food?.totalMs === 'number' &&
    t.food.totalMs > 0 &&
    typeof t?.remainingMs === 'number' &&
    (t.state === 'running' || t.state === 'paused' || t.state === 'done')
  );
}

/** 兼容 v2（time）与 v3（timeSec）两种形状，保证迁移幂等 */
function parseMyFoods(raw: unknown): MyFood[] {
  return Array.isArray(raw)
    ? (raw as Array<{ name?: unknown; time?: unknown; timeSec?: unknown }>)
        .filter(
          (f) =>
            typeof f?.name === 'string' &&
            f.name.trim().length > 0 &&
            (typeof f.timeSec === 'number'
              ? f.timeSec > 0
              : typeof f.time === 'number' && f.time > 0),
        )
        .map((f) => ({
          name: (f.name as string).trim(),
          timeSec: typeof f.timeSec === 'number' ? f.timeSec : (f.time as number),
        }))
    : [];
}

/** 设置项严格消毒：类型不符/越界一律回退默认值（损坏存档不能产生半真半假的状态） */
function parseSettings(raw: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (typeof raw !== 'object' || raw === null) return s;
  const o = raw as Record<string, unknown>;
  if (typeof o.sound === 'boolean') s.sound = o.sound;
  if (typeof o.vibrate === 'boolean') s.vibrate = o.vibrate;
  if (typeof o.systemNotify === 'boolean') s.systemNotify = o.systemNotify;
  if (typeof o.installDismissed === 'boolean') s.installDismissed = o.installDismissed;
  // 越界音量视为脏数据（回退默认 0.3），而不是静默 clamp 成 0 或 1
  if (typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1) {
    s.volume = o.volume;
  }
  return s;
}

function migrateV2(o: Record<string, unknown>): PersistedState {
  const timers: PersistedTimer[] = [];
  const rawTimers = Array.isArray(o.timers) ? (o.timers as LegacyTimer[]) : [];
  for (const t of rawTimers) {
    if (typeof t?.id !== 'number' || typeof t?.food?.name !== 'string') continue;
    const timeSec =
      typeof t.food.time === 'number' ? t.food.time : Math.round((t.totalTime ?? 0) / 1000);
    if (!(timeSec > 0)) continue;
    const remainingSec = Math.max(0, typeof t.remainingTime === 'number' ? t.remainingTime : 0);
    const isRunning = t.isRunning === true && remainingSec > 0;
    const state: TimerState = remainingSec <= 0 ? 'done' : isRunning ? 'running' : 'paused';
    timers.push({
      id: t.id,
      food: {
        baseName: t.food.baseName ?? t.food.name,
        name: t.food.name,
        totalMs: timeSec * 1000,
        desc: t.food.desc ?? '',
        custom: t.food.custom === true,
      },
      remainingMs: remainingSec * 1000,
      state,
      endAt: typeof t.endAt === 'number' ? t.endAt : null,
      missed: false,
    });
  }

  return {
    version: STATE_VERSION,
    timers,
    myFoods: parseMyFoods(o.myFoods),
    settings: parseSettings(o.settings),
    nextTimerId:
      typeof o.nextTimerId === 'number'
        ? o.nextTimerId
        : (timers.length > 0 ? Math.max(...timers.map((t) => t.id)) : 0) + 1,
    customFoodCounter: typeof o.customFoodCounter === 'number' ? o.customFoodCounter : 1,
  };
}

// ---------- 运行时 <-> 持久化 ----------

function toPersisted(t: Timer): PersistedTimer {
  return {
    id: t.id,
    food: t.food,
    remainingMs:
      t.state === 'running' && t.endAt !== null ? Math.max(0, t.endAt - Date.now()) : t.remainingMs,
    state: t.state,
    endAt: t.state === 'running' ? t.endAt : null,
    missed: t.missed,
  };
}

function fromPersisted(t: PersistedTimer): Timer {
  return { ...t, endAtMono: null };
}

/** 读取存档并结算"离开期间到期"。无存档/损坏时返回默认状态 */
export function loadState(): AppState {
  let persisted: PersistedState | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) persisted = migrate(JSON.parse(raw));
  } catch {
    persisted = null;
  }
  if (!persisted) return defaultState();

  const timers = persisted.timers.map(fromPersisted);
  const missed = settleOnLoad(timers, Date.now());
  const state: AppState = {
    timers,
    myFoods: persisted.myFoods,
    settings: { ...DEFAULT_SETTINGS, ...persisted.settings },
    nextTimerId: persisted.nextTimerId,
    customFoodCounter: persisted.customFoodCounter,
  };
  if (missed.length > 0) {
    // 标记已在 settleOnLoad 内完成；此处仅为语义清晰
  }
  return state;
}

/** 保存（Web Locks 串行化，防多标签页写冲突；配额异常时静默降级） */
export async function saveState(state: AppState): Promise<void> {
  const payload: PersistedState = {
    version: STATE_VERSION,
    timers: state.timers.map(toPersisted),
    myFoods: state.myFoods,
    settings: state.settings,
    nextTimerId: state.nextTimerId,
    customFoodCounter: state.customFoodCounter,
  };
  const write = (): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
      /* 隐私模式/配额满：静默 */
    }
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request('hotpot-timer-save', write);
    } else {
      write();
    }
  } catch {
    write();
  }
}

/** 其他标签页写入后同步本标签页（last write wins，UI 重新水合） */
export function watchExternalChanges(onChange: (state: AppState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent): void => {
    if (e.key !== KEY || e.newValue === null) return;
    try {
      const persisted = migrate(JSON.parse(e.newValue));
      if (!persisted) return;
      onChange({
        timers: persisted.timers.map(fromPersisted),
        myFoods: persisted.myFoods,
        settings: { ...DEFAULT_SETTINGS, ...persisted.settings },
        nextTimerId: persisted.nextTimerId,
        customFoodCounter: persisted.customFoodCounter,
      });
    } catch {
      /* 忽略瞬时损坏 */
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
