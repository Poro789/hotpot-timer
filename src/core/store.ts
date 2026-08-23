import {
  DEFAULT_SETTINGS,
  type AppState,
  type Food,
  type MyFood,
  type Settings,
  type Timer,
} from './types';
import { pauseTimer, startTimer, type TimeSource } from './time';

type Listener = () => void;

export interface NewFood {
  /** 原始名称（不带 xN 后缀）：份数统计与去重的键 */
  name: string;
  timeSec: number;
  desc: string;
  custom?: boolean;
}

function makeTimer(
  id: number,
  baseName: string,
  displayName: string,
  timeSec: number,
  desc: string,
  custom?: boolean,
): Timer {
  return {
    id,
    food: { baseName, name: displayName, totalMs: timeSec * 1000, desc, custom },
    remainingMs: timeSec * 1000,
    state: 'paused',
    endAt: null,
    endAtMono: null,
    missed: false,
  };
}

/** 显示名称：同一 baseName 在列表中有 N-1 份时，新的一份命名为 xN（纯派生，删除后自动回退） */
export function nextDisplayName(timers: readonly Timer[], baseName: string): string {
  const count = timers.filter((t) => t.food.baseName === baseName).length + 1;
  return count > 1 ? `${baseName}x${count}` : baseName;
}

/**
 * 展示顺序：已到点的置顶（最需要被看到），其余保持添加顺序（稳定排序）。
 * 纯函数，不改状态。
 */
export function displayOrder(timers: readonly Timer[]): Timer[] {
  return [...timers].sort((a, b) => Number(b.state === 'done') - Number(a.state === 'done'));
}

/**
 * 应用状态仓库：单向数据流。
 * - 所有变更通过意图方法进入，统一 commit 通知订阅者；
 * - structureVersion 仅在"卡片结构"变化（增/删/重置/水合）时递增，
 *   渲染层据此决定是否重建 DOM；时间文本由调度循环单独刷新，不触发重建。
 */
export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private structure = 0;

  constructor(initial: AppState) {
    this.state = initial;
  }

  get snapshot(): AppState {
    return this.state;
  }

  get structureVersion(): number {
    return this.structure;
  }

  getTimer(id: number): Timer | undefined {
    return this.state.timers.find((t) => t.id === id);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private commit(structural: boolean): void {
    if (structural) this.structure += 1;
    for (const fn of [...this.listeners]) fn();
  }

  // ---------- 计时器意图 ----------

  /** 目录/我的食材：添加一份并自动开计时 */
  addFoodTimer(food: NewFood, ts: TimeSource): Timer {
    const timer = makeTimer(
      this.state.nextTimerId++,
      food.name,
      nextDisplayName(this.state.timers, food.name),
      food.timeSec,
      food.desc,
      food.custom,
    );
    this.state.timers.push(timer);
    startTimer(timer, ts);
    this.commit(true);
    return timer;
  }

  /**
   * 快速计时：同名且同时长的自定义条目已存在时切换其状态
   * （运行中->暂停；已完成->重置并开计时；暂停->继续），否则新增。
   * 同名不同时长的条目彼此共存，互不删除。
   */
  addQuickTimer(name: string, seconds: number, ts: TimeSource): void {
    const existing = this.state.timers.find(
      (t) => t.food.custom && t.food.baseName === name && t.food.totalMs === seconds * 1000,
    );
    if (existing) {
      if (existing.state === 'running') {
        pauseTimer(existing, ts);
      } else if (existing.state === 'done') {
        existing.remainingMs = existing.food.totalMs;
        startTimer(existing, ts);
      } else {
        startTimer(existing, ts);
      }
      this.commit(true);
      return;
    }

    const timeDesc = seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分钟`;
    const timer = makeTimer(
      this.state.nextTimerId++,
      name,
      nextDisplayName(this.state.timers, name),
      seconds,
      `自定义时长${timeDesc}`,
      true,
    );
    this.state.timers.push(timer);
    startTimer(timer, ts);
    this.commit(true);
  }

  /** 卡片按钮：暂停 / 继续 / 加一份 */
  toggleTimer(id: number, ts: TimeSource): void {
    const t = this.getTimer(id);
    if (!t) return;
    if (t.state === 'running') {
      pauseTimer(t, ts);
    } else if (t.state === 'done') {
      t.remainingMs = t.food.totalMs;
      t.missed = false; // "加一份"重新开始：补报标记随之失效
      startTimer(t, ts);
    } else {
      startTimer(t, ts);
    }
    this.commit(true);
  }

  removeTimer(id: number): void {
    const i = this.state.timers.findIndex((t) => t.id === id);
    if (i === -1) return;
    this.state.timers.splice(i, 1);
    this.commit(true);
  }

  deleteAllTimers(): void {
    if (this.state.timers.length === 0) return;
    this.state.timers = [];
    this.state.customFoodCounter = 1;
    this.commit(true);
  }

  /**
   * 调度器判定到期：置为完成。
   * 完成会改变展示顺序（到点条目置顶），因此触发结构重建；
   * 列表通常只有个位数条目，重建开销可忽略。
   */
  markDone(ids: readonly number[]): void {
    let changed = false;
    for (const id of ids) {
      const t = this.getTimer(id);
      if (!t || t.state === 'done') continue;
      t.remainingMs = 0;
      t.state = 'done';
      t.endAt = null;
      t.endAtMono = null;
      t.missed = false;
      changed = true;
    }
    if (changed) this.commit(true);
  }

  // ---------- 我的食材 ----------

  addMyFood(name: string, timeSec: number): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const existing = this.state.myFoods.find((f) => f.name === trimmed);
    if (existing) {
      existing.timeSec = timeSec;
    } else {
      this.state.myFoods.push({ name: trimmed, timeSec });
    }
    this.commit(true);
    return true;
  }

  removeMyFood(name: string): void {
    this.state.myFoods = this.state.myFoods.filter((f) => f.name !== name);
    this.commit(true);
  }

  // ---------- 设置 ----------

  updateSettings(patch: Partial<Settings>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.commit(false);
  }

  // ---------- 快速计时默认名 ----------

  /** 取下一个默认名并递增编号（打开弹层时调用，取消也会消耗编号——与旧版一致） */
  nextQuickDefaultName(): string {
    const name = `自定义食材${this.state.customFoodCounter}`;
    this.state.customFoodCounter += 1;
    return name;
  }

  // ---------- 外部水合（跨标签页同步） ----------

  hydrate(state: AppState): void {
    this.state = state;
    this.commit(true);
  }
}

export function defaultState(): AppState {
  return {
    timers: [],
    myFoods: [],
    settings: { ...DEFAULT_SETTINGS },
    nextTimerId: 1,
    customFoodCounter: 1,
  };
}

export type { AppState, Food, MyFood };
