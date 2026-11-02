import {
  DEFAULT_SETTINGS,
  type AppState,
  type Doneness,
  type Food,
  type MyFood,
  type Settings,
  type Timer,
} from './types';
import { pauseTimer, startTimer, tickTimers, type TimeSource } from './time';

type Listener = () => void;

/** 快速计时的默认名前缀与「自定义食材N」解析式（默认名从计时列表推导，见 nextQuickDefaultName） */
const QUICK_DEFAULT_PREFIX = '自定义食材';
const QUICK_NAME_RE = /^自定义食材(\d+)$/;

export interface NewFood {
  /** 原始名称（不带 xN 后缀）：份数统计与去重的键 */
  name: string;
  timeSec: number;
  desc: string;
  custom?: boolean;
  /** 三档时长（秒）；仅目录食材有，用于派生熟度状态 */
  times?: { rare: number; medium: number; wellDone: number };
  /** 三档熟成判据；仅目录食材有 */
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

function makeTimer(
  id: number,
  baseName: string,
  timeSec: number,
  desc: string,
  custom?: boolean,
  times?: { rare: number; medium: number; wellDone: number },
  cues?: Record<Doneness, string>,
  risk?: string,
  technique?: string,
  overtime?: 'hard' | 'soft',
  midpoint?: number,
): Timer {
  return {
    id,
    food: {
      baseName,
      name: baseName,
      totalMs: timeSec * 1000,
      desc,
      custom,
      times,
      cues,
      risk,
      technique,
      overtime,
      midpoint,
    },
    remainingMs: timeSec * 1000,
    state: 'paused',
    endAt: null,
    endAtMono: null,
    missed: false,
  };
}

/**
 * 显示名称：同一 baseName 在当前列表里有 N 份时显示 xN。
 * **每次显示都从计时列表实时派生**——份数只有一个来源（列表本身）。
 * 旧实现把 xN 烘进 timer.food.name 存起来，删掉中间那份后，剩下的卡片还挂着「毛肚x2」的过期标签。
 * 分组口径与食材卡片上的份数角标（render.ts）一致：按 baseName。
 */
export function timerDisplayName(timers: readonly Timer[], timer: Timer): string {
  const base = timer.food.baseName;
  const count = timers.filter((t) => t.food.baseName === base).length;
  return count > 1 ? `${base}x${count}` : base;
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
 * - 所有变更通过意图方法进入，统一 commit 通知订阅者（每帧推进时钟也走 applyTick，
 *   渲染层不得直接改 snapshot 里的对象——否则到点时没人被通知，只能到处手动补）；
 * - structureVersion 仅在"卡片结构"变化（增/删/到点置顶/重置/水合）时递增，
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
      food.timeSec,
      food.desc,
      food.custom,
      food.times,
      food.cues,
      food.risk,
      food.technique,
      food.overtime,
      food.midpoint,
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
        existing.endAt = null;
        existing.endAtMono = null;
        startTimer(existing, ts);
      } else {
        startTimer(existing, ts);
      }
      this.commit(true);
      return;
    }

    const timeDesc = seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分钟`;
    const timer = makeTimer(this.state.nextTimerId++, name, seconds, `自定义时长${timeDesc}`, true);
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
      t.endAt = null; // 清超时锚点
      t.endAtMono = null;
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
    this.commit(true);
  }

  /**
   * 调度循环推进时钟（前台 rAF / 后台唤醒共用）。
   * 「到点」是状态变更，所以由 Store 来做并统一 commit：结构版本递增（到点条目置顶
   * 依赖重建），订阅者据此存盘 / 重新武装调度器 / 更新亮屏锁。
   * 未到点的每帧只更新 remainingMs（纯显示值，不落盘），因此不通知订阅者。
   * 返回刚好到期的 id 列表：调用方据此触发声音、闪光、播报。
   * 保留 endAt/endAtMono：到点后继续算超时时间。
   */
  applyTick(ts: TimeSource): number[] {
    const due = tickTimers(this.state.timers, ts);
    if (due.length > 0) this.commit(true);
    return due;
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

  /**
   * 下一个默认名：从当前列表里已有的「自定义食材N」推导 max+1。
   * **命名机制只有这一套**——旧实现另有一个持久化的 `customFoodCounter`，
   * 删条目/清空列表都得记得重置它，漏了就出现「列表里一份不剩、编号却到 7」；
   * 而且它「打开弹层就自增」，取消也消耗编号。旧存档里那个字段现在没人读，直接忽略。
   */
  nextQuickDefaultName(): string {
    let max = 0;
    for (const t of this.state.timers) {
      if (!t.food.custom) continue;
      const n = Number(QUICK_NAME_RE.exec(t.food.baseName)?.[1] ?? 0);
      if (n > max) max = n;
    }
    return `${QUICK_DEFAULT_PREFIX}${max + 1}`;
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
  };
}

export type { AppState, Food, MyFood };
