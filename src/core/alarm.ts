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

/** 告警是否已超时应停止 */
export function alarmExpired(s: AlarmState, wallNow: number): boolean {
  return s.active && wallNow - s.startedAtWall >= ALARM_MAX_MS;
}
