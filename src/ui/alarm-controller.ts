import type { Store } from '../core/store';
import {
  ALARM_LOOP_MS,
  NO_ALARM,
  alarmExpired,
  confirmAlarm,
  confirmAllAlarms,
  enqueueDone,
} from '../core/alarm';
import type { AlarmState } from '../core/types';
import { beep } from '../platform/audio';
import { vibrate } from '../platform/haptics';
import { systemNotify } from '../platform/notify';

export interface AlarmOptions {
  /** 发声（需要用户手势解锁过音频；silent 用于"离开期间到期"的补报） */
  sound: boolean;
  /** 系统通知（逐条） */
  notify: boolean;
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
 * - 循环音/震动每 2s 一次，直到全部确认或 60s 封顶；
 * - silent 入队（离开期间到期）：不发声，只亮面板；用户首次交互后循环音自动接管。
 */
export class AlarmController {
  private state: AlarmState = NO_ALARM;
  private lastPulseWall = 0;
  private loopId: number | null = null;

  constructor(private deps: Deps) {}

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
      const name = t?.food.name ?? '';
      this.state = enqueueDone(this.state, id, wallNow);
      if (opts.announce) this.deps.announce(`${name} 时间到！`);
      if (opts.notify) systemNotify(`${name} 时间到！`);
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

  confirm(id: number): void {
    this.state = confirmAlarm(this.state, id);
    this.afterConfirm();
  }

  confirmAll(): void {
    this.state = confirmAllAlarms();
    this.afterConfirm();
  }

  private afterConfirm(): void {
    if (!this.state.active) this.stopLoop();
    this.deps.onQueueChange(this.state.queue);
  }

  private pulse(): void {
    const settings = this.deps.store.snapshot.settings;
    this.lastPulseWall = Date.now();
    if (settings.sound) beep(settings.volume);
    if (settings.vibrate) vibrate([200, 100, 200]);
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
  }
}
