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

/** 15000 -> "15秒"；90000 -> "1分30秒"；600000 -> "10分"（向上取整：刚启动显示完整时长） */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}秒`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
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

/** 运行中条目的实时剩余（毫秒）；非运行中返回 stored remainingMs */
export function liveRemainingMs(t: Timer, ts: TimeSource): number {
  if (t.state !== 'running' || t.endAtMono === null) return Math.max(0, t.remainingMs);
  return Math.max(0, t.endAtMono - ts.mono());
}

/** 推进所有运行中条目（单调钟）。返回刚好到期的 id 列表 */
export function tickTimers(timers: readonly Timer[], ts: TimeSource): number[] {
  const due: number[] = [];
  for (const t of timers) {
    if (t.state !== 'running' || t.endAtMono === null) continue;
    const rem = t.endAtMono - ts.mono();
    if (rem <= 0) {
      t.remainingMs = 0;
      t.state = 'done';
      t.endAt = null;
      t.endAtMono = null;
      t.missed = false;
      due.push(t.id);
    } else {
      t.remainingMs = rem;
    }
  }
  return due;
}

/**
 * 页面加载后，把"持久化为运行中"的条目按墙钟结算：
 * 期间已到期的 -> done + missed；未到期 -> 保留剩余时间，等待 reanchorRunning 重锚。
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
        t.endAt = null;
        t.missed = true;
        missed.push(t.id);
      } else {
        t.remainingMs = rem;
      }
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
