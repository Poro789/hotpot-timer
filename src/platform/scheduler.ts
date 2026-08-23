import type { Store } from '../core/store';

export interface SchedulerHooks {
  /** 每帧结算（前台 rAF 驱动）：刷新显示 + 判定到期 */
  onFrame(): void;
  /** 后台 one-shot 到期唤醒：结算到期并决定是否再次武装 */
  onWake(): void;
}

/**
 * 单一定时器调度器（取代"每卡一个 250ms interval"）：
 * - 前台：一个 requestAnimationFrame 循环驱动全部卡片（显示与到期判定）；
 * - 后台：tab 隐藏时 rAF 停摆，切换为单个 one-shot 定时器，指向最近到期时刻。
 *   优先用 Web Worker（后台节流更轻），失败时回退主线程 setTimeout。
 * 平台硬边界：页面被系统完全挂起（移动端锁屏）后任何 JS 都不执行，
 * 到前台/重载时由单调+墙钟结算补齐，UI 以横幅补报。
 */
export class Scheduler {
  private rafId = 0;
  private worker: Worker | null = null;
  private fallbackId: number | null = null;

  constructor(
    private store: Store,
    private hooks: SchedulerHooks,
  ) {}

  start(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.armBackground();
    } else {
      this.startRaf();
    }
  }

  /** visibilitychange 统一入口 */
  onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.armBackground();
    } else {
      this.cancelBackground();
      // 回前台立即结算一次（期间到期的会在 onFrame 里补报），再进入 rAF 循环
      this.hooks.onFrame();
      this.startRaf();
    }
  }

  /** 状态变更后调用：后台状态下重新武装 one-shot */
  onStateChange(): void {
    if (typeof document !== 'undefined' && document.hidden) this.armBackground();
  }

  private nextDeadlineWall(): number | null {
    let min: number | null = null;
    for (const t of this.store.snapshot.timers) {
      if (t.state === 'running' && t.endAt !== null) {
        min = min === null ? t.endAt : Math.min(min, t.endAt);
      }
    }
    return min;
  }

  private armBackground(): void {
    this.cancelRaf();
    this.cancelBackground();
    const deadline = this.nextDeadlineWall();
    if (deadline === null) return;
    const delay = Math.max(0, deadline - Date.now());
    const fire = (): void => {
      this.fallbackId = null;
      this.hooks.onWake();
    };
    try {
      const worker = new Worker(`${import.meta.env.BASE_URL}timer-worker.js`);
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'fire') {
          worker.terminate();
          if (this.worker === worker) this.worker = null;
          this.hooks.onWake();
        }
      };
      worker.onerror = () => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        window.setTimeout(fire, delay);
      };
      this.worker = worker;
      worker.postMessage({ type: 'arm', delay });
    } catch {
      this.fallbackId = window.setTimeout(fire, delay);
    }
  }

  private cancelBackground(): void {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'disarm' });
      } catch {
        /* 已终止 */
      }
      this.worker.terminate();
      this.worker = null;
    }
    if (this.fallbackId !== null) {
      clearTimeout(this.fallbackId);
      this.fallbackId = null;
    }
  }

  private startRaf(): void {
    this.cancelRaf();
    const loop = (): void => {
      this.hooks.onFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private cancelRaf(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  dispose(): void {
    this.cancelRaf();
    this.cancelBackground();
  }
}
