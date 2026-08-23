import { describe, expect, it } from 'vitest';
import {
  ALARM_LOOP_MS,
  ALARM_MAX_MS,
  NO_ALARM,
  alarmExpired,
  confirmAlarm,
  confirmAllAlarms,
  enqueueDone,
} from '../../src/core/alarm';

describe('告警队列（完成合并模型）', () => {
  it('首次入队激活告警', () => {
    const s = enqueueDone(NO_ALARM, 1, 1000);
    expect(s.active).toBe(true);
    expect(s.queue).toEqual([1]);
    expect(s.startedAtWall).toBe(1000);
  });

  it('多个条目同时完成合并为一次告警', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 2, 1000);
    s = enqueueDone(s, 3, 1000);
    expect(s.active).toBe(true);
    expect(s.queue).toEqual([1, 2, 3]);
    // startedAtWall 只取首次入队时刻（决定 60s 封顶的起算点）
    expect(s.startedAtWall).toBe(1000);
  });

  it('重复入队同一 id 不重复计数', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 1, 2000);
    expect(s.queue).toEqual([1]);
  });

  it('逐条确认；队列清空后告警结束', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 2, 1000);
    s = confirmAlarm(s, 1);
    expect(s.active).toBe(true);
    expect(s.queue).toEqual([2]);
    s = confirmAlarm(s, 2);
    expect(s.active).toBe(false);
    expect(s.queue).toEqual([]);
  });

  it('一键全部确认', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 2, 1000);
    s = confirmAllAlarms();
    expect(s).toEqual(NO_ALARM);
  });

  it('60s 封顶判定', () => {
    const s = enqueueDone(NO_ALARM, 1, 1000);
    expect(alarmExpired(s, 1000 + ALARM_LOOP_MS)).toBe(false);
    expect(alarmExpired(s, 1000 + ALARM_MAX_MS)).toBe(true);
    // 未激活的告警永不"过期"
    expect(alarmExpired(NO_ALARM, 1e12)).toBe(false);
  });
});
