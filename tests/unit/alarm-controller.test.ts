import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmController } from '../../src/ui/alarm-controller';
import { Store, defaultState } from '../../src/core/store';
import type { AppState, Timer } from '../../src/core/types';
import { beep } from '../../src/platform/audio';

/** AlarmController 只用到 beep，不碰 DOM —— 桩掉音频就能在 node 环境单测 */
vi.mock('../../src/platform/audio', () => ({ beep: vi.fn() }));

function doneTimer(id: number, baseName: string): Timer {
  return {
    id,
    food: { baseName, name: baseName, totalMs: 15_000, desc: '', overtime: 'hard' },
    remainingMs: -3_000,
    state: 'done',
    endAt: 997_000,
    endAtMono: null,
    missed: false,
  };
}

function makeStore(timers: Timer[]): Store {
  const state: AppState = {
    ...defaultState(),
    timers,
    nextTimerId: Math.max(0, ...timers.map((t) => t.id)) + 1,
  };
  return new Store(state);
}

function setup(timers: Timer[] = [doneTimer(1, '🥩 毛肚')]) {
  const store = makeStore(timers);
  const flash = vi.fn();
  const announce = vi.fn();
  const onQueueChange = vi.fn();
  const ctrl = new AlarmController({ store, flash, announce, onQueueChange });
  return { store, ctrl, flash, announce, onQueueChange };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  vi.stubGlobal('window', globalThis); // controller 用 window.setInterval / clearInterval
  vi.mocked(beep).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AlarmController（确认模型：队列、循环音、对账）', () => {
  it('两份同时到点：只闪一次，逐条播报实时派生的名字', () => {
    const { ctrl, flash, announce } = setup([doneTimer(1, '🥩 毛肚'), doneTimer(2, '🥩 毛肚')]);
    ctrl.handleDue([1, 2], { sound: false, flash: true, announce: true });
    expect(flash).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls.map((c) => c[0])).toEqual([
      '🥩 毛肚x2 时间到！',
      '🥩 毛肚x2 时间到！',
    ]);
    expect(ctrl.queue).toEqual([1, 2]);
    expect(ctrl.active).toBe(true);
  });

  it('补报（sound:false）不发声；用户首次手势接管循环音，之后每 2s 一次', () => {
    const { ctrl } = setup();
    ctrl.handleDue([1], { sound: false, flash: false, announce: true });
    expect(beep).not.toHaveBeenCalled();

    ctrl.onUserGesture();
    expect(beep).toHaveBeenCalledTimes(1); // 立即一次
    vi.advanceTimersByTime(2_000);
    expect(beep).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1_000); // 未到下一拍（间隔 500ms 轮询 + 2s 节流）
    expect(beep).toHaveBeenCalledTimes(2);
  });

  it('settings.sound 关掉：即便请求发声也不响（pulse 内部按设置判定）', () => {
    const { store, ctrl } = setup();
    store.updateSettings({ sound: false });
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    expect(beep).not.toHaveBeenCalled();
    expect(ctrl.active).toBe(true); // 面板仍然要出现，只是不出声
  });

  it('全部确认：队列清空、循环停止', () => {
    const { ctrl, onQueueChange } = setup([doneTimer(1, '🥩 毛肚'), doneTimer(2, '虾滑')]);
    ctrl.handleDue([1, 2], { sound: true, flash: true, announce: true });
    const before = vi.mocked(beep).mock.calls.length;
    ctrl.confirmAll();
    expect(ctrl.active).toBe(false);
    expect(onQueueChange).toHaveBeenLastCalledWith([]);
    vi.advanceTimersByTime(10_000);
    expect(beep).toHaveBeenCalledTimes(before);
  });

  it('删掉未确认的条目：每次 commit 对账撤掉队列项并停止循环音', () => {
    const { store, ctrl, onQueueChange } = setup();
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    const before = vi.mocked(beep).mock.calls.length;
    store.removeTimer(1); // 本标签删除，或别的标签删除后水合进来
    expect(ctrl.active).toBe(false);
    expect(onQueueChange).toHaveBeenLastCalledWith([]);
    vi.advanceTimersByTime(6_000);
    expect(beep).toHaveBeenCalledTimes(before);
  });

  it('按「加一份」重新开始的条目也从队列撤掉', () => {
    const { store, ctrl } = setup();
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    store.toggleTimer(1, { wall: () => Date.now(), mono: () => performance.now() });
    expect(store.getTimer(1)?.state).toBe('running');
    expect(ctrl.active).toBe(false);
  });

  it('循环提醒 60s 封顶：到点自动停，卡片仍是完成态', () => {
    const { store, ctrl } = setup();
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    vi.advanceTimersByTime(59_000);
    const atFiftyNine = vi.mocked(beep).mock.calls.length;
    expect(atFiftyNine).toBeGreaterThan(25); // 每 2s 一次
    vi.advanceTimersByTime(10_000);
    expect(vi.mocked(beep).mock.calls.length).toBe(atFiftyNine); // 60s 后不再响
    expect(store.getTimer(1)?.state).toBe('done');
  });

  it('告警已激活时新到点的条目：并入队列但不重复起环', () => {
    const { ctrl } = setup([doneTimer(1, '🥩 毛肚'), doneTimer(2, '虾滑')]);
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    const afterFirst = vi.mocked(beep).mock.calls.length;
    vi.advanceTimersByTime(500);
    ctrl.handleDue([2], { sound: true, flash: true, announce: true });
    expect(ctrl.queue).toEqual([1, 2]);
    // 第二份没有再起一个 interval：环的节拍不受影响（2s 网格锚在首次告警时刻）
    expect(vi.mocked(beep).mock.calls.length).toBe(afterFirst);
    vi.advanceTimersByTime(2_000); // t=2.5s：只跨过 2s 这一格
    expect(vi.mocked(beep).mock.calls.length).toBe(afterFirst + 1);
    vi.advanceTimersByTime(2_000); // t=4.5s：再跨 4s
    expect(vi.mocked(beep).mock.calls.length).toBe(afterFirst + 2);
  });

  it('dispose 停环并退订', () => {
    const { store, ctrl } = setup();
    ctrl.handleDue([1], { sound: true, flash: true, announce: true });
    ctrl.dispose();
    const before = vi.mocked(beep).mock.calls.length;
    vi.advanceTimersByTime(10_000);
    expect(beep).toHaveBeenCalledTimes(before);
    store.removeTimer(1); // 退订后不再对账（不会重新起环）
    vi.advanceTimersByTime(10_000);
    expect(beep).toHaveBeenCalledTimes(before);
  });
});
