import { describe, expect, it } from 'vitest';
import { Store, defaultState, displayOrder, timerDisplayName } from '../../src/core/store';
import type { TimeSource } from '../../src/core/time';
import type { AppState, Timer } from '../../src/core/types';

class FakeClock implements TimeSource {
  wall(): number {
    return 1_000_000;
  }
  mono(): number {
    return 0;
  }
}
const ts = new FakeClock();

/** 可推进的时钟：applyTick 的测试需要时间真的往前走 */
class TickingClock implements TimeSource {
  private t = 0;
  wall(): number {
    return 1_000_000 + this.t;
  }
  mono(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

function timerWith(baseName: string, name: string, over: Partial<Timer> = {}): Timer {
  return {
    id: 100,
    food: { baseName, name, totalMs: 15_000, desc: '' },
    remainingMs: 15_000,
    state: 'paused',
    endAt: null,
    endAtMono: null,
    missed: false,
    ...over,
  };
}

describe('timerDisplayName（份数实时派生，不烘进状态）', () => {
  it('单份不带后缀', () => {
    const store = new Store(defaultState());
    const a = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(timerDisplayName(store.snapshot.timers, a)).toBe('毛肚');
  });
  it('两份时两张卡片显示同一个读数（不是一份标一份不标）', () => {
    const store = new Store(defaultState());
    const a = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const b = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(timerDisplayName(store.snapshot.timers, a)).toBe('毛肚x2');
    expect(timerDisplayName(store.snapshot.timers, b)).toBe('毛肚x2');
  });
  it('删掉一份后剩下的那份立刻回退（旧实现把 x2 烘进状态，删完还挂着过期标签）', () => {
    const store = new Store(defaultState());
    const a = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const b = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    store.removeTimer(a.id);
    expect(timerDisplayName(store.snapshot.timers, b)).toBe('毛肚');
  });
  it('状态里不存后缀：food.name 就是 baseName', () => {
    const store = new Store(defaultState());
    const b = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(b.food.baseName).toBe('毛肚');
    expect(b.food.name).toBe(b.food.baseName);
  });
});

describe('addQuickTimer（快速计时）', () => {
  it('新增自定义条目并自动开计时', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, ts);
    const t = store.snapshot.timers[0]!;
    expect(t.food.custom).toBe(true);
    expect(t.food.baseName).toBe('鲜鸭血');
    expect(t.state).toBe('running');
    expect(t.food.desc).toBe('自定义时长1分钟');
  });

  it('同名同时长：运行中 -> 暂停（切换状态，不新增）', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, ts);
    store.addQuickTimer('鲜鸭血', 60, ts);
    expect(store.snapshot.timers).toHaveLength(1);
    expect(store.snapshot.timers[0]!.state).toBe('paused');
  });

  it('同名同时长：已完成 -> 重置并重新开计时', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, clock);
    clock.advance(60_000);
    store.applyTick(clock);
    store.addQuickTimer('鲜鸭血', 60, clock);
    const t = store.snapshot.timers[0]!;
    expect(t.state).toBe('running');
    expect(t.remainingMs).toBe(60_000);
  });

  it('同名同时长：暂停 -> 继续', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, ts);
    const id = store.snapshot.timers[0]!.id;
    store.toggleTimer(id, ts); // 暂停
    store.addQuickTimer('鲜鸭血', 60, ts);
    expect(store.snapshot.timers).toHaveLength(1);
    expect(store.snapshot.timers[0]!.state).toBe('running');
  });

  it('同名异时长共存，互不删除（修复旧版静默删除 bug）', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, ts);
    store.addQuickTimer('鲜鸭血', 120, ts);
    expect(store.snapshot.timers).toHaveLength(2);
    // 名字本身不带后缀，x2 只在显示时按 baseName 派生
    expect(store.snapshot.timers.map((t) => t.food.name)).toEqual(['鲜鸭血', '鲜鸭血']);
    expect(timerDisplayName(store.snapshot.timers, store.snapshot.timers[1]!)).toBe('鲜鸭血x2');
  });
});

describe('toggleTimer / applyTick', () => {
  it('运行中 -> 暂停', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const id = store.snapshot.timers[0]!.id;
    store.toggleTimer(id, ts);
    expect(store.getTimer(id)?.state).toBe('paused');
  });
  it('已完成 -> 加一份（重置并开计时）', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    const id = store.snapshot.timers[0]!.id;
    clock.advance(15_000);
    store.applyTick(clock);
    store.toggleTimer(id, clock);
    const t = store.getTimer(id)!;
    expect(t.state).toBe('running');
    expect(t.remainingMs).toBe(15_000);
  });
});

describe('applyTick（到点经统一 commit 通道：状态变更只有一个入口）', () => {
  it('到点：返回 due、置 done、递增 structureVersion 并通知订阅者', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    const id = store.snapshot.timers[0]!.id;
    const v0 = store.structureVersion;
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    clock.advance(15_000);
    const due = store.applyTick(clock);
    expect(due).toEqual([id]);
    expect(store.getTimer(id)?.state).toBe('done');
    // 旧路径：tickTimers 在 UI 层就地置位，markDone 视为无变更 -> 不通知、不存盘，
    // 只能靠 app.ts 手动 forceRebuildTimers + saveState 补。这里要求走 commit。
    expect(store.structureVersion).toBe(v0 + 1);
    expect(notified).toBe(1);
  });

  it('未到点：返回空且不通知（每帧调用不会每帧存盘）', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    clock.advance(5_000);
    expect(store.applyTick(clock)).toEqual([]);
    expect(store.getTimer(1)?.remainingMs).toBe(10_000);
    expect(notified).toBe(0);
  });

  it('done 条目继续按单调钟算超时（remainingMs 为负），且不再通知', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    clock.advance(15_000);
    store.applyTick(clock);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    clock.advance(4_000);
    expect(store.applyTick(clock)).toEqual([]);
    expect(store.getTimer(1)?.remainingMs).toBe(-4_000);
    expect(notified).toBe(0);
  });

  it('幂等：同一条目不会第二次进入 due 列表，也不重复递增', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    clock.advance(15_000);
    expect(store.applyTick(clock)).toEqual([1]);
    const v0 = store.structureVersion;
    clock.advance(1_000);
    expect(store.applyTick(clock)).toEqual([]);
    expect(store.structureVersion).toBe(v0);
  });
});

describe('我的食材', () => {
  it('新增与同名更新', () => {
    const store = new Store(defaultState());
    expect(store.addMyFood('  鲜鸭血  ', 90)).toBe(true);
    expect(store.addMyFood('鲜鸭血', 120)).toBe(true);
    expect(store.snapshot.myFoods).toHaveLength(1);
    expect(store.snapshot.myFoods[0]).toEqual({ name: '鲜鸭血', timeSec: 120 });
  });
  it('空名拒绝', () => {
    const store = new Store(defaultState());
    expect(store.addMyFood('   ', 60)).toBe(false);
  });
  it('移除', () => {
    const store = new Store(defaultState());
    store.addMyFood('鲜鸭血', 90);
    store.removeMyFood('鲜鸭血');
    expect(store.snapshot.myFoods).toHaveLength(0);
  });
});

describe('structureVersion（渲染重建触发器）', () => {
  it('结构性操作递增，设置变更不递增', () => {
    const store = new Store(defaultState());
    const v0 = store.structureVersion;
    store.updateSettings({ sound: false });
    expect(store.structureVersion).toBe(v0);
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(store.structureVersion).toBe(v0 + 1);
  });
  it('applyTick 到点递增（到点条目置顶依赖重建）', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    const v0 = store.structureVersion;
    clock.advance(15_000);
    store.applyTick(clock);
    expect(store.structureVersion).toBe(v0 + 1);
  });
  it('applyTick 幂等：已 done 后再推进不再递增', () => {
    const clock = new TickingClock();
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, clock);
    clock.advance(15_000);
    store.applyTick(clock);
    const v0 = store.structureVersion;
    clock.advance(15_000);
    store.applyTick(clock);
    expect(store.structureVersion).toBe(v0);
  });
});

describe('三档时长透传', () => {
  it('addFoodTimer 携带 times/cues/risk', () => {
    const store = new Store(defaultState());
    const t = store.addFoodTimer(
      {
        name: '毛肚',
        timeSec: 15,
        desc: 'd',
        times: { rare: 10, medium: 15, wellDone: 25 },
        cues: { rare: '叶片微卷', medium: '七上八下', wellDone: '卷紧发硬' },
        risk: '中心未透',
      },
      ts,
    );
    expect(store.getTimer(t.id)?.food.times).toEqual({ rare: 10, medium: 15, wellDone: 25 });
    expect(store.getTimer(t.id)?.food.cues?.medium).toBe('七上八下');
    expect(store.getTimer(t.id)?.food.risk).toBe('中心未透');
  });
  it('不传三档时字段为 undefined（自定义/快速计时）', () => {
    const store = new Store(defaultState());
    const t = store.addFoodTimer({ name: '鲜鸭血', timeSec: 60, desc: '' }, ts);
    expect(store.getTimer(t.id)?.food.times).toBeUndefined();
    store.addQuickTimer('自定义', 30, ts);
    const q = store.snapshot.timers[1]!;
    expect(q.food.times).toBeUndefined();
  });
});

describe('displayOrder（到点条目置顶）', () => {
  it('完成条目排在最前，其余保持原序（稳定）', () => {
    const a = timerWith('毛肚', '毛肚', { id: 1, state: 'running' });
    const b = timerWith('虾', '虾', { id: 2 });
    const c = timerWith('蟹', '蟹', { id: 3, state: 'done' });
    const d = timerWith('蛙', '蛙', { id: 4, state: 'done' });
    expect(displayOrder([a, b, c, d]).map((t) => t.id)).toEqual([3, 4, 1, 2]);
  });
  it('全未完成时顺序不变', () => {
    const a = timerWith('毛肚', '毛肚', { id: 1 });
    const b = timerWith('虾', '虾', { id: 2 });
    expect(displayOrder([a, b]).map((t) => t.id)).toEqual([1, 2]);
  });
  it('是纯函数：不修改原数组', () => {
    const a = timerWith('毛肚', '毛肚', { id: 1, state: 'done' });
    const b = timerWith('虾', '虾', { id: 2 });
    const src = [b, a];
    displayOrder(src);
    expect(src.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe('快速计时默认名（只有一个命名机制：从计时列表推导）', () => {
  it('空列表给「自定义食材1」；连续调用不消耗编号（取消后重开还是同一个名字）', () => {
    const store = new Store(defaultState());
    expect(store.nextQuickDefaultName()).toBe('自定义食材1');
    expect(store.nextQuickDefaultName()).toBe('自定义食材1');
  });

  it('已有「自定义食材3」时给 4；清空列表后回到 1', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('自定义食材3', 60, ts);
    expect(store.nextQuickDefaultName()).toBe('自定义食材4');
    store.deleteAllTimers();
    expect(store.nextQuickDefaultName()).toBe('自定义食材1');
  });

  it('非编号的自定义名不参与推导（用户改名成「牛肉」不会污染编号）', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('牛肉', 30, ts);
    expect(store.nextQuickDefaultName()).toBe('自定义食材1');
  });

  it('状态里没有 customFoodCounter：命名机制只有一套', () => {
    expect('customFoodCounter' in defaultState()).toBe(false);
    const store = new Store(defaultState());
    store.addQuickTimer('自定义食材1', 30, ts);
    expect('customFoodCounter' in store.snapshot).toBe(false);
  });
});

describe('hydrate（外部水合：别的标签页写盘后同步本标签页）', () => {
  const remote: AppState = {
    ...defaultState(),
    timers: [
      {
        id: 5,
        food: { baseName: '虾滑', name: '虾滑', totalMs: 180_000, desc: '' },
        remainingMs: 180_000,
        state: 'running',
        endAt: 2_000_000,
        endAtMono: null,
        missed: false,
      },
    ],
    nextTimerId: 6,
  };

  it('整体替换快照：订阅者收到一次通知、结构版本递增', () => {
    const store = new Store(defaultState());
    store.addQuickTimer('本地条目', 30, ts);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    const before = store.structureVersion;

    store.hydrate(structuredClone(remote));

    expect(notified).toBe(1);
    expect(store.structureVersion).toBeGreaterThan(before);
    expect(store.snapshot.timers.map((t) => t.id)).toEqual([5]);
    expect(store.getTimer(5)?.food.name).toBe('虾滑');
    expect(store.getTimer(1)).toBeUndefined(); // 本地条目被远端状态整体覆盖
    expect(store.snapshot.nextTimerId).toBe(6);
  });

  it('水合后的列表参与份数与默认名推导（没有残留的本地状态）', () => {
    const store = new Store(defaultState());
    store.hydrate({
      ...defaultState(),
      timers: [
        {
          id: 1,
          food: { baseName: '🥩 毛肚', name: '🥩 毛肚', totalMs: 15_000, desc: '' },
          remainingMs: 15_000,
          state: 'paused',
          endAt: null,
          endAtMono: null,
          missed: false,
        },
        {
          id: 2,
          food: {
            baseName: '自定义食材2',
            name: '自定义食材2',
            totalMs: 60_000,
            desc: '',
            custom: true,
          },
          remainingMs: 60_000,
          state: 'paused',
          endAt: null,
          endAtMono: null,
          missed: false,
        },
      ],
      nextTimerId: 3,
    });
    expect(timerDisplayName(store.snapshot.timers, store.snapshot.timers[0]!)).toBe('🥩 毛肚');
    expect(store.nextQuickDefaultName()).toBe('自定义食材3');
  });
});

describe('missed 标记生命周期', () => {
  it('补报的完成条目"加一份"后清除 missed', () => {
    const store = new Store(defaultState());
    const t = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    t.state = 'done';
    t.remainingMs = 0;
    t.missed = true; // 模拟离开期间到点
    const id = store.snapshot.timers[0]!.id;
    store.toggleTimer(id, ts); // 加一份
    expect(store.getTimer(id)?.missed).toBe(false);
    expect(store.getTimer(id)?.state).toBe('running');
  });
});
