import { timerDisplayName, type Store } from '../core/store';
import {
  ALARM_LOOP_MS,
  NO_ALARM,
  alarmExpired,
  confirmAllAlarms,
  enqueueDone,
  pruneQueue,
} from '../core/alarm';
import type { AlarmState } from '../core/types';
import { beep } from '../platform/audio';

export interface AlarmOptions {
  /** 发声（需要用户手势解锁过音频；silent 用于"离开期间到期"的补报） */
  sound: boolean;
  /** 全屏脉冲 */
  flash: boolean;
  /** 屏幕阅读器播报 */
  announce: boolean;
}

interface Deps {
  store: Store;
  flash: () => void;
  announce: (msg: string) => void;
  onQueueChange: (ids: readonly number[]) => void;
}

/**
 * 告警控制器：完成队列 + 循环提醒（确认模型）。
 * - 多份同时到点：合并为一次告警（一次闪光 + 循环音），列表逐条确认；
 * - 循环音每 2s 一次，直到全部确认或 60s 封顶；
 * - silent 入队（离开期间到期）：不发声，只亮面板；用户首次交互后循环音自动接管；
 * - 队列每次 commit 都与计时列表对账（见 reconcile），面板不会残留无效行。
 */
export class AlarmController {
  private state: AlarmState = NO_ALARM;
  private lastPulseWall = 0;
  private loopId: number | null = null;
  private unsubscribe: () => void = () => {};

  constructor(private deps: Deps) {
    this.unsubscribe = deps.store.subscribe(() => this.reconcile());
  }

  get queue(): readonly number[] {
    return this.state.queue;
  }

  get active(): boolean {
    return this.state.active;
  }

  handleDue(ids: readonly number[], opts: AlarmOptions): void {
    if (ids.length === 0) return;
    const wallNow = Date.now();
    const wasActive = this.state.active;
    for (const id of ids) {
      const t = this.deps.store.getTimer(id);
      const name = t ? timerDisplayName(this.deps.store.snapshot.timers, t) : '';
      this.state = enqueueDone(this.state, id, wallNow);
      if (opts.announce) this.deps.announce(`${name} 时间到！`);
    }

    if (opts.flash) this.deps.flash();

    if (this.state.active && !wasActive) {
      if (opts.sound) {
        this.pulse();
        this.startLoop();
      }
    }
    this.deps.onQueueChange(this.state.queue);
  }

  /** 用户手势（页面刚交互）：若已有未确认告警且未开循环音，接管发声 */
  onUserGesture(): void {
    if (!this.state.active || this.loopId !== null) return;
    const settings = this.deps.store.snapshot.settings;
    if (!settings.sound) return;
    this.pulse();
    this.startLoop();
  }

  confirmAll(): void {
    this.state = confirmAllAlarms();
    this.afterQueueChange();
  }

  /**
   * 队列与计时列表对账（每次 commit）：条目已不在列表里（删除、全部删除、
   * 或别的标签页删除后水合进来），或已不再是完成态（按「加一份」重新开始），
   * 就从队列里撤掉。否则确认面板会留一行空名字，循环音也对着一行无效条目响。
   */
  private reconcile(): void {
    const pruned = pruneQueue(this.state, (id) => this.deps.store.getTimer(id)?.state === 'done');
    if (pruned === this.state) return;
    this.state = pruned;
    this.afterQueueChange();
  }

  private afterQueueChange(): void {
    if (!this.state.active) this.stopLoop();
    this.deps.onQueueChange(this.state.queue);
  }

  private pulse(): void {
    const settings = this.deps.store.snapshot.settings;
    this.lastPulseWall = Date.now();
    if (settings.sound) beep(settings.volume);
  }

  private startLoop(): void {
    if (this.loopId !== null) return;
    this.loopId = window.setInterval(() => {
      const wallNow = Date.now();
      if (alarmExpired(this.state, wallNow)) {
        this.stopLoop();
        return;
      }
      if (wallNow - this.lastPulseWall >= ALARM_LOOP_MS) this.pulse();
    }, 500);
  }

  private stopLoop(): void {
    if (this.loopId !== null) {
      clearInterval(this.loopId);
      this.loopId = null;
    }
  }

  dispose(): void {
    this.stopLoop();
    this.unsubscribe();
  }
}
