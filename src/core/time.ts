import type { Timer } from './types';

/** 双时钟源：墙钟用于持久化/跨会话续算，单调钟用于会话内计时（防系统改时漂移） */
export interface TimeSource {
  wall(): number;
  mono(): number;
}

export const systemTime: TimeSource = {
  wall: () => Date.now(),
  mono: () => performance.now(),
};

/**
 * 计时显示（向上取整到 0.1 秒，到点前不出现 0秒）：
 * - < 60s：显示一位小数，如 "14.3秒"
 * - >= 60s：整数分秒（分钟级精度足够，且避免宽度溢出），如 "1分30秒"、"10分"
 */
export function formatMs(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 60_000) {
    const tenth = Math.ceil(total / 100); // 0.1s 位，向上取整
    const sec = Math.floor(tenth / 10);
    const d = tenth % 10;
    return d === 0 ? `${sec}秒` : `${sec}.${d}秒`;
  }
  const totalSec = Math.ceil(total / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec === 0 ? `${min}分` : `${min}分${sec}秒`;
}

/** 开始/继续计时。返回是否发生了状态变化 */
export function startTimer(t: Timer, ts: TimeSource): boolean {
  if (t.state === 'running' || t.remainingMs <= 0) return false;
  t.state = 'running';
  t.endAt = ts.wall() + t.remainingMs;
  t.endAtMono = ts.mono() + t.remainingMs;
  return true;
}

/** 暂停计时（按单调钟结算剩余）。返回是否发生了状态变化 */
export function pauseTimer(t: Timer, ts: TimeSource): boolean {
  if (t.state !== 'running') return false;
  t.remainingMs = liveRemainingMs(t, ts);
  t.state = 'paused';
  t.endAt = null;
  t.endAtMono = null;
  return true;
}

/** 推进所有运行中条目（单调钟）。返回刚好到期的 id 列表 */
export function tickTimers(timers: readonly Timer[], ts: TimeSource): number[] {
  const due: number[] = [];
  for (const t of timers) {
    if (t.state === 'running' && t.endAtMono !== null) {
      const rem = t.endAtMono - ts.mono();
      if (rem <= 0) {
        t.remainingMs = 0;
        t.state = 'done';
        t.missed = false;
        // 保留 endAtMono：到点后继续算超时时间
        due.push(t.id);
      } else {
        t.remainingMs = rem;
      }
    } else if (t.state === 'done' && t.endAtMono !== null) {
      // 已到期：继续算超时（remainingMs 为负）
      t.remainingMs = t.endAtMono - ts.mono();
    }
  }
  return due;
}

/** 运行中/已到期条目的实时剩余（毫秒）；已到期返回负数（超时）；非运行中返回 stored remainingMs */
export function liveRemainingMs(t: Timer, ts: TimeSource): number {
  if (t.endAtMono === null) return Math.max(0, t.remainingMs);
  if (t.state === 'running' || t.state === 'done') {
    return t.endAtMono - ts.mono();
  }
  return Math.max(0, t.remainingMs);
}

/**
 * 页面加载后，把"持久化为运行中"的条目按墙钟结算：
 * 期间已到期的 -> done + missed；未到期 -> 保留剩余时间，等待 reanchorRunning 重锚。
 * 已 done 的条目：保留 endAt 用于算超时。
 */
export function settleOnLoad(timers: readonly Timer[], wallNow: number): number[] {
  const missed: number[] = [];
  for (const t of timers) {
    t.endAtMono = null;
    if (t.state === 'running' && t.endAt !== null) {
      const rem = t.endAt - wallNow;
      if (rem <= 0) {
        t.remainingMs = 0;
        t.state = 'done';
        t.missed = true;
        // 保留 endAt：用于算超时
        missed.push(t.id);
      } else {
        t.remainingMs = rem;
      }
    } else if (t.state === 'done' && t.endAt !== null) {
      // 已到期：结算超时（remainingMs 为负）
      t.remainingMs = t.endAt - wallNow;
    }
  }
  return missed;
}

/** 为"运行中但未锚定单调钟"的条目重新锚定（加载/外部水合后调用） */
export function reanchorRunning(timers: readonly Timer[], ts: TimeSource): void {
  for (const t of timers) {
    if (t.state === 'running' && t.endAtMono === null) {
      t.endAtMono = ts.mono() + t.remainingMs;
    }
  }
}
