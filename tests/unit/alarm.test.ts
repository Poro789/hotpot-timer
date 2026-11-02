import { describe, expect, it } from 'vitest';
import {
  ALARM_LOOP_MS,
  ALARM_MAX_MS,
  NO_ALARM,
  alarmExpired,
  confirmAlarm,
  confirmAllAlarms,
  enqueueDone,
  pruneQueue,
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

describe('pruneQueue（告警队列与计时列表对账）', () => {
  const alive = (id: number): boolean => id !== 2;

  it('条目被删除后从队列移除，其余保留', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 2, 1000);
    s = pruneQueue(s, alive);
    expect(s.queue).toEqual([1]);
    expect(s.active).toBe(true);
  });

  it('队列清空后告警结束（循环提醒随之停止）', () => {
    const s = pruneQueue(enqueueDone(NO_ALARM, 2, 1000), alive);
    expect(s).toEqual(NO_ALARM);
    expect(s.active).toBe(false);
  });

  it('无变化时返回同一对象（每次 commit 都调用也不会产生新状态）', () => {
    const s = enqueueDone(NO_ALARM, 1, 1000);
    expect(pruneQueue(s, alive)).toBe(s);
    expect(pruneQueue(NO_ALARM, alive)).toBe(NO_ALARM);
  });

  it('封顶起算点不因对账而改变', () => {
    let s = enqueueDone(NO_ALARM, 1, 1000);
    s = enqueueDone(s, 2, 1000);
    s = pruneQueue(s, alive);
    expect(s.startedAtWall).toBe(1000);
  });
});
