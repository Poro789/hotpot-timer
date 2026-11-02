import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatOvertime,
  formatRemaining,
  isMidpointDue,
  liveRemainingMs,
  OVERTIME_HARD_MS,
  pauseTimer,
  reanchorRunning,
  settleOnLoad,
  shouldPulseOvertime,
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

describe('formatDuration / formatRemaining / formatOvertime（剩余与超时是两个语义，不靠 Math.max 兜）', () => {
  it('formatRemaining：负数（已超时）按 0 处理——超时文本必须走 formatOvertime', () => {
    expect(formatRemaining(-5_000)).toBe('0秒');
    expect(formatRemaining(-0)).toBe('0秒');
  });
  it('formatOvertime：带 + 号，读数与剩余同一口径', () => {
    expect(formatOvertime(12_300)).toBe('+12.3秒');
    expect(formatOvertime(75_000)).toBe('+1分15秒');
    expect(formatOvertime(600_000)).toBe('+10分');
  });
  it('formatDuration：纯时长（食材卡、弹层提示用）', () => {
    expect(formatDuration(15_000)).toBe('15秒');
    expect(formatDuration(90_000)).toBe('1分30秒');
  });
});

describe('formatDuration', () => {
  it('不足一分钟：一位小数（0.1s 精度）', () => {
    expect(formatDuration(15_000)).toBe('15秒');
    expect(formatDuration(0)).toBe('0秒');
    expect(formatDuration(14_300)).toBe('14.3秒');
    expect(formatDuration(14_350)).toBe('14.4秒'); // 向上取整到 0.1s
    expect(formatDuration(999)).toBe('1秒'); // 0.999s -> 1.0 -> "1秒"
    expect(formatDuration(500)).toBe('0.5秒');
  });
  it('向上取整：到点前不出现 0秒', () => {
    expect(formatDuration(14_999)).toBe('15秒');
    expect(formatDuration(60_001)).toBe('1分1秒');
  });
  it('超过一分钟：整数分秒（无小数）', () => {
    expect(formatDuration(90_000)).toBe('1分30秒');
    expect(formatDuration(600_000)).toBe('10分');
    expect(formatDuration(120_000)).toBe('2分');
    expect(formatDuration(60_500)).toBe('1分1秒'); // 60.5s -> ceil 61s
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
  it('到期的条目置为 done 并返回 id（保留 endAtMono 用于算超时）', () => {
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
    expect(a.endAtMono).not.toBeNull(); // 保留：用于算超时
    expect(b.state).toBe('running');
  });

  it('已 done 条目：继续算超时（remainingMs 为负）', () => {
    const ts = new FakeClock();
    const a = makeTimer({ id: 1 });
    startTimer(a, ts);
    ts.advance(15_000);
    tickTimers([a], ts); // 到期
    ts.advance(5_000); // 超时 5s
    tickTimers([a], ts);
    expect(a.state).toBe('done');
    expect(a.remainingMs).toBe(-5_000);
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
  it('离开期间已到期的条目 -> done + missed（保留 endAt 用于算超时）', () => {
    const t = makeTimer({ state: 'running', endAt: 2_000_000, remainingMs: 5_000 });
    const missed = settleOnLoad([t], 2_000_010); // 现在 > endAt
    expect(missed).toEqual([t.id]);
    expect(t.state).toBe('done');
    expect(t.missed).toBe(true);
    expect(t.endAt).toBe(2_000_000); // 保留：用于算超时
    expect(t.remainingMs).toBe(0);
  });

  it('已 done 条目：结算超时（remainingMs 为负）', () => {
    const t = makeTimer({ state: 'done', endAt: 2_000_000, remainingMs: 0 });
    settleOnLoad([t], 2_005_000); // 超时 5s
    expect(t.remainingMs).toBe(-5_000);
    expect(t.endAt).toBe(2_000_000);
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

describe('跨会话超时续算（liveRemainingMs）', () => {
  it('done 条目无单调锚点时按墙钟续算超时（重启页面后 +X秒 继续涨）', () => {
    const ts = new FakeClock();
    const t = makeTimer({
      state: 'done',
      endAt: 2_000_000,
      endAtMono: null, // settleOnLoad 会清空锚点
      remainingMs: 0, // settleOnLoad 对 running->done 的补报条目置 0
    });
    ts.setWall(2_011_000); // 超时 11s
    expect(liveRemainingMs(t, ts)).toBe(-11_000);
    // 有锚点时仍按单调钟（会话内不受系统改时影响）
    const anchored = makeTimer({ state: 'done', endAt: 2_000_000, endAtMono: 12_000 });
    ts.setWall(99_000_000);
    expect(liveRemainingMs(anchored, ts)).toBe(12_000 - ts.mono());
  });
});

describe('超时分级判定（shouldPulseOvertime）', () => {
  it('hard 类：超时满 10s 才判定为硬超时', () => {
    expect(OVERTIME_HARD_MS).toBe(10_000);
    expect(shouldPulseOvertime('hard', OVERTIME_HARD_MS - 1)).toBe(false);
    expect(shouldPulseOvertime('hard', OVERTIME_HARD_MS)).toBe(true);
    expect(shouldPulseOvertime('hard', 60_000)).toBe(true);
  });

  it('soft 类与未标注食材：永不判为硬超时', () => {
    expect(shouldPulseOvertime('soft', 60_000)).toBe(false);
    expect(shouldPulseOvertime(undefined, 60_000)).toBe(false);
    expect(shouldPulseOvertime('hard', 0)).toBe(false);
  });
});

describe('阶段提示判定（isMidpointDue）', () => {
  const midpointTimer = (over: Partial<Timer> = {}): Timer =>
    makeTimer({
      state: 'running',
      endAtMono: 200_000, // 目标结束时刻（单调钟）
      food: { baseName: '鸭血', name: '鸭血', totalMs: 100_000, desc: '', midpoint: 0.5 },
      ...over,
    });

  it('运行中且已过 midpoint 比例 -> true（含恰好等于）', () => {
    // 起点 = endAtMono - totalMs = 100_000；阈值 = 100_000 * 0.5 = 50s
    expect(isMidpointDue(midpointTimer(), 149_999)).toBe(false);
    expect(isMidpointDue(midpointTimer(), 150_000)).toBe(true);
    expect(isMidpointDue(midpointTimer(), 180_000)).toBe(true);
  });

  it('暂停 / 无 midpoint / 无单调锚点 -> false', () => {
    expect(isMidpointDue(midpointTimer({ state: 'paused' }), 900_000)).toBe(false);
    expect(isMidpointDue(midpointTimer({ state: 'done' }), 900_000)).toBe(false);
    expect(isMidpointDue(midpointTimer({ endAtMono: null }), 900_000)).toBe(false);
    expect(
      isMidpointDue(
        midpointTimer({ food: { baseName: '鸭血', name: '鸭血', totalMs: 100_000, desc: '' } }),
        900_000,
      ),
    ).toBe(false);
  });
});
