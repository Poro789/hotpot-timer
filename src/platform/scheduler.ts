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
  /** Worker 里是否还挂着一个待触发的 one-shot（决定要不要先发 disarm） */
  private workerArmed = false;
  private fallbackId: number | null = null;
  /** 本次武装的目标延迟：Worker 报错时用它改走主线程回退 */
  private pendingDelay: number | null = null;

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
      this.clearPendingFire();
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
    this.clearPendingFire();
    const deadline = this.nextDeadlineWall();
    if (deadline === null) return;
    const delay = Math.max(0, deadline - Date.now());
    this.pendingDelay = delay;
    const worker = this.ensureWorker();
    if (worker) {
      try {
        worker.postMessage({ type: 'arm', delay });
        this.workerArmed = true;
        return;
      } catch {
        this.dropWorker();
      }
    }
    this.armFallback(delay);
  }

  /**
   * 常驻 Worker：整个页面生命周期里只建一个，重新武装靠 arm/disarm 消息。
   * 旧实现每次武装都 new + terminate——隐藏期间每次增删改都要重建一个 Worker，
   * one-shot 触发后也销毁，下次再建（重建成本 + 期间没有任何后台提醒兜着）。
   */
  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    try {
      const worker = new Worker(`${import.meta.env.BASE_URL}timer-worker.js`);
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'fire') {
          this.workerArmed = false;
          this.pendingDelay = null;
          this.wake();
        }
      };
      worker.onerror = () => {
        // Worker 挂了（离线、构造被拦、内部抛错）：丢掉它，本次改走主线程 setTimeout；
        // 下一次武装会重新尝试建 Worker。
        this.dropWorker();
        if (this.pendingDelay !== null) this.armFallback(this.pendingDelay);
      };
      this.worker = worker;
      return worker;
    } catch {
      return null;
    }
  }

  private armFallback(delay: number): void {
    this.fallbackId = window.setTimeout(() => {
      this.fallbackId = null;
      this.pendingDelay = null;
      this.wake();
    }, delay);
  }

  /** 取消「待触发」，但保留 Worker 本身（下次隐藏还要用它） */
  private clearPendingFire(): void {
    if (this.worker && this.workerArmed) {
      try {
        this.worker.postMessage({ type: 'disarm' });
      } catch {
        this.dropWorker();
      }
    }
    this.workerArmed = false;
    this.pendingDelay = null;
    if (this.fallbackId !== null) {
      clearTimeout(this.fallbackId);
      this.fallbackId = null;
    }
  }

  private dropWorker(): void {
    if (!this.worker) return;
    try {
      this.worker.terminate();
    } catch {
      /* 已终止 */
    }
    this.worker = null;
    this.workerArmed = false;
  }

  /**
   * 后台到期唤醒：先结算（hooks.onWake），再按当前可见性恢复驱动。
   * 唤醒瞬间页面可能已回前台（rAF 已停摆且无人重启）——
   * 不恢复的话运行中的计时会冻结，直到下次 visibilitychange。
   */
  private wake(): void {
    this.hooks.onWake();
    if (typeof document !== 'undefined' && !document.hidden) this.startRaf();
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
    this.clearPendingFire();
    this.dropWorker();
  }
}
