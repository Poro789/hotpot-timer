import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadState, saveState, watchExternalChanges } from '../../src/platform/storage';
import { defaultState } from '../../src/core/store';
import type { AppState, Timer } from '../../src/core/types';

const KEY = 'hotpot-timer-state-v2';

/** 内存版 localStorage：saveState 走的是无 navigator.locks 的降级分支 */
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function timer(over: Partial<Timer>): Timer {
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

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveState / loadState（remainingMs 的符号约定）', () => {
  it('running / done 不存没人读的 remainingMs：真相在 endAt，加载时重算', async () => {
    const now = Date.now();
    const state: AppState = {
      ...defaultState(),
      nextTimerId: 4,
      timers: [
        timer({
          id: 1,
          state: 'running',
          endAt: now + 30_000,
          endAtMono: 5_000,
          remainingMs: 30_000,
        }),
        timer({ id: 2, state: 'done', endAt: now - 8_000, remainingMs: -8_000 }),
        timer({ id: 3, state: 'paused', remainingMs: 12_000 }),
      ],
    };
    await saveState(state);
    const raw = globalThis.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as {
      timers: Array<{ remainingMs: number; endAt: number | null }>;
    };
    // running / done：占位 0，避免多一份可能与 endAt 不一致的读数
    expect(persisted.timers[0]?.remainingMs).toBe(0);
    expect(persisted.timers[1]?.remainingMs).toBe(0);
    // 暂停条目：remainingMs 才是权威值（没有 endAt 可算）
    expect(persisted.timers[2]?.remainingMs).toBe(12_000);
    // endAt 保留：这是 running/done 续算的唯一依据
    expect(persisted.timers[0]?.endAt).toBe(now + 30_000);
    expect(persisted.timers[1]?.endAt).toBe(now - 8_000);
  });

  it('存进去的占位 0 不会泄漏到运行时：loadState 按 endAt 重算剩余与超时', async () => {
    const now = Date.now();
    const state: AppState = {
      ...defaultState(),
      nextTimerId: 4,
      timers: [
        timer({
          id: 1,
          state: 'running',
          endAt: now + 30_000,
          endAtMono: 5_000,
          remainingMs: 30_000,
        }),
        timer({ id: 2, state: 'done', endAt: now - 8_000, remainingMs: -8_000 }),
      ],
    };
    await saveState(state);
    const loaded = loadState();
    const running = loaded.timers.find((t) => t.id === 1)!;
    const done = loaded.timers.find((t) => t.id === 2)!;
    // 剩余时间从 endAt 重算（不是 0）
    expect(running.remainingMs).toBeGreaterThan(28_000);
    expect(running.remainingMs).toBeLessThanOrEqual(30_000);
    // 已过期的 done：超时为负
    expect(done.remainingMs).toBeLessThan(0);
  });

  it('跨会话期间到期的条目：加载后补报 missed，且保留 endAt 继续算超时', async () => {
    const state: AppState = {
      ...defaultState(),
      timers: [
        timer({
          id: 1,
          state: 'running',
          endAt: Date.now() - 5_000,
          endAtMono: 1_000,
          remainingMs: 0,
        }),
      ],
    };
    await saveState(state);
    const loaded = loadState();
    expect(loaded.timers[0]?.state).toBe('done');
    expect(loaded.timers[0]?.missed).toBe(true);
    expect(loaded.timers[0]?.endAt).not.toBeNull();
    expect(loaded.timers[0]!.remainingMs).toBeLessThanOrEqual(0);
  });
});

describe('watchExternalChanges（别的标签页写盘后同步本标签页）', () => {
  class FakeWindow {
    private listeners = new Map<string, Set<(e: unknown) => void>>();
    addEventListener(type: string, fn: (e: unknown) => void): void {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      (this.listeners.get(type) as Set<(e: unknown) => void>).add(fn);
    }
    removeEventListener(type: string, fn: (e: unknown) => void): void {
      this.listeners.get(type)?.delete(fn);
    }
    dispatch(type: string, e: unknown): void {
      for (const fn of this.listeners.get(type) ?? []) fn(e);
    }
  }

  function setupWatcher() {
    const win = new FakeWindow();
    vi.stubGlobal('window', win);
    const onChange = vi.fn();
    const off = watchExternalChanges(onChange);
    return { win, onChange, off };
  }

  it('合法 v3 存档：水合成运行时状态（endAtMono 置空，等待重新锚定）', () => {
    const { win, onChange } = setupWatcher();
    win.dispatch('storage', {
      key: KEY,
      newValue: JSON.stringify({
        version: 3,
        timers: [
          {
            id: 7,
            food: { baseName: '虾滑', name: '虾滑', totalMs: 180_000, desc: '' },
            remainingMs: 180_000,
            state: 'running',
            endAt: Date.now() + 180_000,
            missed: false,
          },
        ],
        myFoods: [],
        settings: { sound: true, volume: 0.3, installDismissed: false },
        nextTimerId: 8,
      }),
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const state = onChange.mock.calls[0]?.[0] as AppState;
    expect(state.timers.map((t) => t.id)).toEqual([7]);
    expect(state.timers[0]?.endAtMono).toBeNull();
    expect(state.nextTimerId).toBe(8);
  });

  it('忽略：别的 key、清空（newValue=null）、坏 JSON、未来版本', () => {
    const { win, onChange } = setupWatcher();
    win.dispatch('storage', { key: 'someone-else', newValue: '{}' });
    win.dispatch('storage', { key: KEY, newValue: null });
    win.dispatch('storage', { key: KEY, newValue: '{坏 JSON' });
    win.dispatch('storage', { key: KEY, newValue: JSON.stringify({ version: 99, timers: [] }) });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('退订后不再收事件', () => {
    const { win, onChange, off } = setupWatcher();
    off();
    win.dispatch('storage', {
      key: KEY,
      newValue: JSON.stringify({
        version: 3,
        timers: [],
        myFoods: [],
        settings: {},
        nextTimerId: 1,
      }),
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
