import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Store, defaultState } from '../../src/core/store';
import type { TimeSource } from '../../src/core/time';
import { Scheduler } from '../../src/platform/scheduler';

/**
 * 调度器的后台策略：一个常驻 Worker，靠 arm/disarm 消息重新武装。
 *
 * 旧实现每次武装都 `new Worker()` + `terminate()`：页面隐藏期间的每次状态变更
 * （加一份、暂停、到点）都要重建一个 Worker，fire 之后也销毁，下次再建。
 * 这些测试锁的是「Worker 只建一次」，不是某个具体消息格式。
 *
 * 不引 jsdom：Scheduler 只碰 document.hidden / requestAnimationFrame /
 * window.setTimeout / Worker 这几个全局，桩在这里就够了。
 */

/** 假时钟：墙钟就是 vitest 的假定时器时钟，单调钟自己推进 */
class FakeClock implements TimeSource {
  private offset = 0;
  wall(): number {
    return Date.now();
  }
  mono(): number {
    return this.offset;
  }
  advance(ms: number): void {
    this.offset += ms;
  }
}

type Msg = { type: string; delay?: number };

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly messages: Msg[] = [];
  terminated = false;

  constructor(readonly url: string) {
    FakeWorker.instances.push(this);
  }

  postMessage(msg: Msg): void {
    this.messages.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** 消息序列（arm/disarm 与 delay 断言用） */
  types(): string[] {
    return this.messages.map((m) => m.type);
  }

  delays(): (number | undefined)[] {
    return this.messages.map((m) => m.delay);
  }

  last(): Msg {
    return this.messages[this.messages.length - 1]!;
  }

  /** 模拟 worker 端的 one-shot 到点 */
  fire(): void {
    this.onmessage?.({ data: { type: 'fire', at: Date.now() } } as MessageEvent);
  }
}

const documentStub = { hidden: false };
let rafQueue: FrameRequestCallback[] = [];

function installGlobals(): void {
  FakeWorker.instances = [];
  documentStub.hidden = false;
  rafQueue = [];
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
    rafQueue = [];
  });
  vi.stubGlobal('window', {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
  });
}

function setup() {
  const clock = new FakeClock();
  const store = new Store(defaultState());
  let frames = 0;
  let wakes = 0;
  const scheduler = new Scheduler(store, {
    onFrame: () => {
      frames += 1;
    },
    // 与 app.ts 一样：唤醒时先结算到期（否则条目还是 running，下次武装的最近到期时刻不对）
    onWake: () => {
      wakes += 1;
      store.applyTick(clock);
    },
  });
  const addRunning = (timeSec: number): void => {
    store.addFoodTimer({ name: '毛肚', timeSec, desc: '' }, clock);
  };
  return { clock, store, scheduler, addRunning, frames: () => frames, wakes: () => wakes };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_700_000_000_000 });
  installGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('后台调度：一个常驻 Worker', () => {
  it('隐藏时武装一次只建一个 Worker，并 post arm', () => {
    const { scheduler, addRunning } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();

    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0]!.url).toContain('timer-worker.js');
    expect(FakeWorker.instances[0]!.messages).toEqual([{ type: 'arm', delay: 15_000 }]);
  });

  it('隐藏期间的每次状态变更复用同一个 Worker：先 disarm 再 arm', () => {
    const { store, scheduler, addRunning } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();

    // 加第二份（45 秒）与删掉第一份：两次 onStateChange
    addRunning(45);
    scheduler.onStateChange();
    store.removeTimer(1);
    scheduler.onStateChange();

    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0]!;
    expect(w.terminated).toBe(false);
    expect(w.types()).toEqual(['arm', 'disarm', 'arm', 'disarm', 'arm']);
    // 第二份是 45 秒，但最近到期时刻仍是第一份的 15 秒；删掉第一份后才轮到 45 秒
    expect(w.delays()).toEqual([15_000, undefined, 15_000, undefined, 45_000]);
  });

  it('Worker 触发 fire 后不销毁，下次武装继续复用', () => {
    const { clock, scheduler, addRunning, wakes } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();
    const w = FakeWorker.instances[0]!;

    // one-shot 到点：先推进假时钟再 fire，onWake 里结算为 done
    vi.advanceTimersByTime(15_000);
    clock.advance(15_000);
    w.fire();
    expect(wakes()).toBe(1);
    expect(w.terminated).toBe(false);

    // fire 之后没有待触发的 one-shot：重新武装只需 arm，不用再 disarm
    addRunning(30);
    scheduler.onStateChange();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(w.last()).toEqual({ type: 'arm', delay: 30_000 });
  });

  it('回到前台不 terminate，只 disarm；dispose 才销毁', () => {
    const { scheduler, addRunning } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();
    const w = FakeWorker.instances[0]!;

    documentStub.hidden = false;
    scheduler.onVisibilityChange();
    expect(w.terminated).toBe(false);
    expect(w.last()).toEqual({ type: 'disarm' });
    // 回前台立刻结算一次并进入 rAF 循环
    expect(rafQueue.length).toBeGreaterThan(0);

    scheduler.dispose();
    expect(w.terminated).toBe(true);
  });

  it('没有运行中条目时不建 Worker；已有的只 disarm', () => {
    const { store, scheduler, addRunning } = setup();
    documentStub.hidden = true;
    scheduler.onVisibilityChange();
    expect(FakeWorker.instances).toHaveLength(0);

    addRunning(15);
    scheduler.onStateChange();
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0]!;

    store.deleteAllTimers();
    scheduler.onStateChange();
    expect(w.last()).toEqual({ type: 'disarm' });
    expect(w.terminated).toBe(false);
  });

  it('Worker 构造失败：本次回退主线程 setTimeout，到点照样唤醒', () => {
    vi.stubGlobal('Worker', function throwing(): never {
      throw new Error('worker blocked');
    });
    const { scheduler, addRunning, wakes } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();

    vi.advanceTimersByTime(15_000);
    expect(wakes()).toBe(1);
  });

  it('Worker 报错：丢掉它并回退 setTimeout，下次武装再试 Worker', () => {
    const { clock, store, scheduler, addRunning, wakes } = setup();
    addRunning(15);
    documentStub.hidden = true;
    scheduler.onVisibilityChange();
    const w = FakeWorker.instances[0]!;

    w.onerror?.();
    vi.advanceTimersByTime(15_000);
    expect(wakes()).toBe(1);
    expect(w.terminated).toBe(true);

    // 下一次武装重新尝试 Worker，而不是永远停在回退路径
    store.addFoodTimer({ name: '虾', timeSec: 30, desc: '' }, clock);
    scheduler.onStateChange();
    expect(FakeWorker.instances).toHaveLength(2);
  });
});
