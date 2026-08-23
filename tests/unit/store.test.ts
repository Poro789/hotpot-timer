import { describe, expect, it } from 'vitest';
import { Store, defaultState, displayOrder, nextDisplayName } from '../../src/core/store';
import type { TimeSource } from '../../src/core/time';
import type { Timer } from '../../src/core/types';

class FakeClock implements TimeSource {
  wall(): number {
    return 1_000_000;
  }
  mono(): number {
    return 0;
  }
}
const ts = new FakeClock();

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

describe('nextDisplayName（派生计数，修复旧版计数器不清减 bug）', () => {
  it('列表为空时不带后缀', () => {
    expect(nextDisplayName([], '毛肚')).toBe('毛肚');
  });
  it('已有同 baseName 条目时递增', () => {
    const timers = [timerWith('毛肚', '毛肚')];
    expect(nextDisplayName(timers, '毛肚')).toBe('毛肚x2');
  });
  it('删除后自动回退（不再残留 x3）', () => {
    const store = new Store(defaultState());
    const a = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const b = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(b.food.name).toBe('毛肚x2');
    store.removeTimer(a.id);
    const c = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    // 列表里只剩 b（1 份），新的一份是 x2
    expect(c.food.name).toBe('毛肚x2');
  });
  it('全部删除后回到无后缀', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    store.deleteAllTimers();
    const c = store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    expect(c.food.name).toBe('毛肚');
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
    const store = new Store(defaultState());
    store.addQuickTimer('鲜鸭血', 60, ts);
    store.markDone([store.snapshot.timers[0]!.id]);
    store.addQuickTimer('鲜鸭血', 60, ts);
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
    expect(store.snapshot.timers[1]!.food.name).toBe('鲜鸭血x2');
  });
});

describe('toggleTimer / markDone', () => {
  it('运行中 -> 暂停', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const id = store.snapshot.timers[0]!.id;
    store.toggleTimer(id, ts);
    expect(store.getTimer(id)?.state).toBe('paused');
  });
  it('已完成 -> 加一份（重置并开计时）', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const id = store.snapshot.timers[0]!.id;
    store.markDone([id]);
    store.toggleTimer(id, ts);
    const t = store.getTimer(id)!;
    expect(t.state).toBe('running');
    expect(t.remainingMs).toBe(15_000);
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
  it('markDone 递增（到点条目置顶依赖重建）', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const v0 = store.structureVersion;
    store.markDone([store.snapshot.timers[0]!.id]);
    expect(store.structureVersion).toBe(v0 + 1);
  });
  it('markDone 幂等：重复调用不再递增', () => {
    const store = new Store(defaultState());
    store.addFoodTimer({ name: '毛肚', timeSec: 15, desc: '' }, ts);
    const id = store.snapshot.timers[0]!.id;
    store.markDone([id]);
    const v0 = store.structureVersion;
    store.markDone([id]);
    expect(store.structureVersion).toBe(v0);
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
