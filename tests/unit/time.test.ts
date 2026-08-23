import { describe, expect, it } from 'vitest';
import {
  formatMs,
  liveRemainingMs,
  pauseTimer,
  reanchorRunning,
  settleOnLoad,
  startTimer,
  tickTimers,
  type TimeSource,
} from '../../src/core/time';
import type { Timer } from '../../src/core/types';

/** 可手动推进的假时钟（mono/wall 同步走；可单独拨动 wall 模拟系统改时） */
class FakeClock implements TimeSource {
  private w = 1_000_000;
  private m = 0;
  wall(): number {
    return this.w;
  }
  mono(): number {
    return this.m;
  }
  advance(ms: number): void {
    this.w += ms;
    this.m += ms;
  }
  /** 模拟用户修改系统时间（单调钟不受影响） */
  setWall(v: number): void {
    this.w = v;
  }
}

function makeTimer(over: Partial<Timer> = {}): Timer {
  return {
    id: 1,
    food: { baseName: '毛肚', name: '毛肚', totalMs: 15_000, desc: '' },
    remainingMs: 15_000,
    state: 'paused',
    endAt: null,
    endAtMono: null,
    missed: false,
    ...over,
  };
}

describe('formatMs', () => {
  it('不足一分钟显示秒', () => {
    expect(formatMs(15_000)).toBe('15秒');
    expect(formatMs(0)).toBe('0秒');
  });
  it('向上取整：刚启动显示完整时长', () => {
    expect(formatMs(14_999)).toBe('15秒');
    expect(formatMs(60_001)).toBe('1分1秒');
  });
  it('超过一分钟显示分秒', () => {
    expect(formatMs(90_000)).toBe('1分30秒');
    expect(formatMs(600_000)).toBe('10分0秒');
  });
});

describe('startTimer / pauseTimer', () => {
  it('启动后按单调钟实时结算', () => {
    const ts = new FakeClock();
    const t = makeTimer();
    expect(startTimer(t, ts)).toBe(true);
    ts.advance(5_000);
    expect(t.state).toBe('running');
    expect(liveRemainingMs(t, ts)).toBe(10_000);
    expect(pauseTimer(t, ts)).toBe(true);
    expect(t.remainingMs).toBe(10_000);
    expect(t.state).toBe('paused');
    expect(t.endAt).toBeNull();
  });

  it('已运行/已完成的条目不能重复启动', () => {
    const ts = new FakeClock();
    const t = makeTimer();
    startTimer(t, ts);
    expect(startTimer(t, ts)).toBe(false);
    t.state = 'done';
    t.remainingMs = 0;
    expect(startTimer(t, ts)).toBe(false);
  });

  it('暂停后再继续，剩余时间连续', () => {
    const ts = new FakeClock();
    const t = makeTimer();
    startTimer(t, ts);
    ts.advance(5_000);
    pauseTimer(t, ts);
    ts.advance(999_000); // 暂停期间流逝的时间不计
    startTimer(t, ts);
    ts.advance(4_000);
    expect(liveRemainingMs(t, ts)).toBe(6_000);
  });

  it('系统改时不影响运行中条目（双时钟隔离）', () => {
    const ts = new FakeClock();
    const t = makeTimer();
    startTimer(t, ts);
    ts.advance(5_000);
    ts.setWall(ts.wall() - 86_400_000); // 系统时间被往回拨一天
    ts.advance(4_000);
    expect(liveRemainingMs(t, ts)).toBe(6_000);
  });
});

describe('tickTimers', () => {
  it('到期的条目置为 done 并返回 id', () => {
    const ts = new FakeClock();
    const a = makeTimer({ id: 1 });
    const b = makeTimer({ id: 2, remainingMs: 30_000, food: { ...a.food, name: '虾滑' } });
    startTimer(a, ts);
    startTimer(b, ts);
    ts.advance(15_000);
    const due = tickTimers([a, b], ts);
    expect(due).toEqual([1]);
    expect(a.state).toBe('done');
    expect(a.remainingMs).toBe(0);
    expect(b.state).toBe('running');
  });

  it('暂停中的条目不参与 tick', () => {
    const ts = new FakeClock();
    const t = makeTimer();
    ts.advance(100_000);
    expect(tickTimers([t], ts)).toEqual([]);
    expect(t.state).toBe('paused');
  });
});

describe('settleOnLoad（刷新/重载结算）', () => {
  it('离开期间已到期的条目 -> done + missed', () => {
    const t = makeTimer({ state: 'running', endAt: 2_000_000, remainingMs: 5_000 });
    const missed = settleOnLoad([t], 2_000_010); // 现在 > endAt
    expect(missed).toEqual([t.id]);
    expect(t.state).toBe('done');
    expect(t.missed).toBe(true);
    expect(t.endAt).toBeNull();
  });

  it('未到期条目保留剩余时间，等待重锚', () => {
    const t = makeTimer({ state: 'running', endAt: 2_000_000, remainingMs: 5_000 });
    const missed = settleOnLoad([t], 1_999_000);
    expect(missed).toEqual([]);
    expect(t.state).toBe('running');
    expect(t.remainingMs).toBe(1_000);
    expect(t.endAtMono).toBeNull();
  });

  it('重锚后继续按单调钟结算', () => {
    const ts = new FakeClock();
    const t = makeTimer({ state: 'running', endAt: 1_005_000, remainingMs: 5_000 });
    settleOnLoad([t], 1_000_000);
    reanchorRunning([t], ts);
    ts.advance(5_000);
    expect(tickTimers([t], ts)).toEqual([t.id]);
  });
});
