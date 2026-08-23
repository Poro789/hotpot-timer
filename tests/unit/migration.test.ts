import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/platform/storage';
import { DEFAULT_SETTINGS, STATE_VERSION } from '../../src/core/types';

/** 旧版（v2）存档的完整形状，含冗余 foodAddCounts */
const V2_FIXTURE = {
  timers: [
    {
      id: 1,
      food: { baseName: '🥩 毛肚', name: '🥩 毛肚', time: 15, desc: '七上八下，口感脆' },
      totalTime: 15,
      remainingTime: 9,
      isRunning: true,
      endAt: 1_900_000_000_000,
    },
    {
      id: 2,
      food: { name: '自定义食材1', time: 60, desc: '自定义时长1分钟', custom: true },
      totalTime: 60,
      remainingTime: 0,
      isRunning: false,
      endAt: null,
    },
    {
      // 缺失 baseName（防御性场景）：回退为 name
      id: 3,
      food: { name: '鲜鸭血x2', time: 90, desc: '' },
      totalTime: 90,
      remainingTime: 45,
      isRunning: false,
      endAt: null,
    },
    // 损坏行：缺 food.name，应被丢弃
    { id: 4, food: { time: 10 } as never, totalTime: 10, remainingTime: 10, isRunning: false },
  ],
  nextTimerId: 5,
  customFoodCounter: 2,
  foodAddCounts: { '🥩 毛肚': 3 },
  myFoods: [
    { name: '鲜鸭血', time: 90 },
    { name: '', time: 10 }, // 空名丢弃
    { name: '坏数据', time: 0 }, // 非正时长丢弃
  ],
};

describe('migrate（持久化迁移链）', () => {
  it('v2 -> v3：字段映射正确', () => {
    const s = migrate(V2_FIXTURE);
    expect(s).not.toBeNull();
    expect(s!.version).toBe(STATE_VERSION);
    expect(s!.timers).toHaveLength(3);

    const t1 = s!.timers[0]!;
    expect(t1).toMatchObject({
      id: 1,
      state: 'running',
      remainingMs: 9_000,
      endAt: 1_900_000_000_000,
      missed: false,
    });
    expect(t1.food).toMatchObject({
      baseName: '🥩 毛肚',
      totalMs: 15_000,
      desc: '七上八下，口感脆',
    });

    // 已完成条目（remainingTime 0）
    expect(s!.timers[1]!.state).toBe('done');
    expect(s!.timers[1]!.food.custom).toBe(true);

    // 暂停条目：缺失 baseName 时回退到 name
    expect(s!.timers[2]!.food.baseName).toBe('鲜鸭血x2');
    expect(s!.timers[2]!.state).toBe('paused');

    // 冗余 foodAddCounts 不再携带（计数改为派生）
    expect('foodAddCounts' in s!).toBe(false);

    expect(s!.myFoods).toEqual([{ name: '鲜鸭血', timeSec: 90 }]);
    expect(s!.nextTimerId).toBe(5);
    expect(s!.customFoodCounter).toBe(2);
    expect(s!.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('v2：isRunning 但 remainingTime=0 视为完成', () => {
    const s = migrate({
      timers: [
        { id: 1, food: { name: '虾滑', time: 3 }, remainingTime: 0, isRunning: true, endAt: null },
      ],
      nextTimerId: 2,
    });
    expect(s!.timers[0]!.state).toBe('done');
  });

  it('v3 存档原样通过', () => {
    const s = migrate(V2_FIXTURE);
    const again = migrate(s!);
    expect(again).toEqual(s!);
  });

  it('未来版本不降级（返回 null）', () => {
    expect(migrate({ version: 99, timers: [] })).toBeNull();
  });

  it('垃圾输入安全丢弃（非对象 -> null；v2 形状损坏 -> 宽容空状态，与原版行为一致）', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('x')).toBeNull();
    const lenient = migrate({ timers: 'nope' });
    expect(lenient).not.toBeNull();
    expect(lenient!.timers).toEqual([]);
    // v3 形状损坏 -> 严格拒收
    expect(migrate({ version: 3, timers: 'nope' })).toBeNull();
  });

  it('v2：缺失可选字段时用安全默认值', () => {
    const s = migrate({});
    expect(s).not.toBeNull();
    expect(s!.timers).toEqual([]);
    expect(s!.myFoods).toEqual([]);
    expect(s!.nextTimerId).toBe(1);
    expect(s!.customFoodCounter).toBe(1);
  });

  it('nextTimerId 缺失时取最大 id + 1（不与现有 id 碰撞）', () => {
    const s = migrate({
      timers: [
        { id: 5, food: { name: '虾', time: 60 }, remainingTime: 30, isRunning: false, endAt: null },
        {
          id: 9,
          food: { name: '蟹', time: 120 },
          remainingTime: 60,
          isRunning: false,
          endAt: null,
        },
      ],
    });
    expect(s!.nextTimerId).toBe(10);
  });

  it('settings 严格消毒：脏值回退默认，不产生半真半假状态', () => {
    const s = migrate({
      version: 3,
      timers: [],
      settings: { sound: 'no', vibrate: 1, systemNotify: null, volume: 42, extra: 'x' },
    });
    expect(s!.settings).toEqual({ ...DEFAULT_SETTINGS }); // 全部回退
  });

  it('settings 合法值保留；volume 越界视为脏数据回退默认', () => {
    const s = migrate({
      version: 3,
      timers: [],
      settings: { sound: false, vibrate: false, systemNotify: true, volume: 0.7 },
    });
    expect(s!.settings).toEqual({
      sound: false,
      vibrate: false,
      systemNotify: true,
      volume: 0.7,
      installDismissed: false,
    });
    const bad = migrate({ version: 3, timers: [], settings: { volume: 1.5 } });
    expect(bad!.settings.volume).toBe(DEFAULT_SETTINGS.volume);
  });
});
