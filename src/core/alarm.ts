import type { AlarmState } from './types';

/** 循环提醒间隔（毫秒） */
export const ALARM_LOOP_MS = 2000;
/** 循环提醒最长持续（毫秒），到点后自动停止（卡片仍保持完成态） */
export const ALARM_MAX_MS = 60_000;

export const NO_ALARM: AlarmState = { active: false, queue: [], startedAtWall: 0 };

/** 把新到期的条目并入队列；首次入队时激活告警 */
export function enqueueDone(s: AlarmState, id: number, wallNow: number): AlarmState {
  if (s.queue.includes(id)) return s;
  const queue = [...s.queue, id];
  if (s.active) return { ...s, queue };
  return { active: true, queue, startedAtWall: wallNow };
}

/** 确认某条目；队列清空后告警结束 */
export function confirmAlarm(s: AlarmState, id: number): AlarmState {
  const queue = s.queue.filter((x) => x !== id);
  if (queue.length === 0) return NO_ALARM;
  return { ...s, queue };
}

export function confirmAllAlarms(): AlarmState {
  return NO_ALARM;
}

/**
 * 与计时列表对账：把指向「已被删除条目」的 id 从队列里移除。
 * 不对账的后果：删掉一条已到点但未确认的计时（本标签删除，或另一个标签页删除后水合进来），
 * 确认面板会残留一行空名字 + 一个无效的「知道了」。
 * 队列空了视为告警结束（循环提醒随之停止）。
 * 无变化时返回原对象：调用方每次 commit 都调用也不会产生新状态。
 */
export function pruneQueue(s: AlarmState, alive: (id: number) => boolean): AlarmState {
  if (s.queue.length === 0) return s;
  const queue = s.queue.filter(alive);
  if (queue.length === s.queue.length) return s;
  if (queue.length === 0) return NO_ALARM;
  return { ...s, queue };
}

/** 告警是否已超时应停止 */
export function alarmExpired(s: AlarmState, wallNow: number): boolean {
  return s.active && wallNow - s.startedAtWall >= ALARM_MAX_MS;
}
