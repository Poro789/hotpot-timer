import { displayOrder, type Store } from '../core/store';
import {
  DONENESS_STATUS_LABELS,
  deriveDonenessStatus,
  type DonenessStatus,
  type Timer,
} from '../core/types';
import { formatMs } from '../core/time';
import { CATEGORIES, foodDatabase, type Category } from '../core/catalog';
import { escapeHtml } from './html';
import type { Elements } from './elements';

export interface TimerRefs {
  card: HTMLElement;
  time: HTMLElement;
  toggle: HTMLButtonElement;
  status: HTMLElement;
}

export type CategoryTab = Category | 'myfoods';

/**
 * 渲染层：
 * - 计时器卡片在 structureVersion 变化时重建（增/删/重置/水合）；
 * - 到点流程显式调用 forceRebuildTimers（到点条目置顶 + 状态样式）；
 * - 时间文本与熟度状态由调度循环通过 updateTime 直写（每帧，不重建 DOM）。
 */
export class Render {
  private refs = new Map<number, TimerRefs>();
  private structuralSeen = -1;

  constructor(
    private store: Store,
    private el: Elements,
  ) {}

  // ---------- 计时器 ----------

  renderTimers(): void {
    const v = this.store.structureVersion;
    if (v === this.structuralSeen) return;
    this.structuralSeen = v;
    this.rebuildTimers();
  }

  /**
   * 无条件重建计时区域。
   * 到点流程专用：tickTimers/markDone 在前台路径上通常不产生结构版本变化
   * （状态由 tick 直接置位），到点置顶需要显式重建一次。
   */
  forceRebuildTimers(): void {
    this.structuralSeen = this.store.structureVersion;
    this.rebuildTimers();
  }

  private rebuildTimers(): void {
    this.el.timersContainer.querySelectorAll('.timer-card').forEach((n) => n.remove());
    this.refs.clear();

    // 到点条目置顶（最需要被看到），其余保持添加顺序
    const timers = displayOrder(this.store.snapshot.timers);
    if (timers.length === 0) {
      this.el.emptyState.style.display = 'block';
    } else {
      this.el.emptyState.style.display = 'none';
      for (const t of timers) this.el.timersContainer.appendChild(this.buildCard(t));
    }
    this.updateGlobalButtons();
  }

  private buildCard(t: Timer): HTMLElement {
    const card = document.createElement('div');
    card.className = 'timer-card';
    card.dataset.timerId = String(t.id);
    // 熟度状态行（仅目录食材有三档阈值）+ 判据/风险提示
    const hasStatus = !!t.food.times;
    const status = hasStatus
      ? `<div class="timer-status" data-status=""><span class="status-label"></span></div>`
      : '';
    const note = t.food.risk
      ? `<div class="timer-desc timer-risk">⚠️ ${escapeHtml(t.food.risk)}</div>`
      : t.food.cues
        ? `<div class="timer-desc">👁 ${escapeHtml(t.food.cues.medium)}</div>`
        : `<div class="timer-desc">${escapeHtml(t.food.desc || '')}</div>`;
    card.innerHTML = `
        <div class="timer-card-header">
            <h3 class="timer-food-name">${escapeHtml(t.food.name)}</h3>
        </div>
        <div class="timer-card-body">
            <div class="timer-info">
                <div class="timer-time">${formatMs(t.remainingMs)}</div>
                ${status}
            </div>
            <div class="timer-card-controls">
                <button class="btn-toggle btn-small" data-id="${t.id}"></button>
                <button class="btn-delete btn-small" data-id="${t.id}">删除</button>
            </div>
        </div>
        ${note}
    `;
    const time = card.querySelector<HTMLElement>('.timer-time')!;
    const toggle = card.querySelector<HTMLButtonElement>('.btn-toggle')!;
    const statusEl = card.querySelector<HTMLElement>('.timer-status')!;
    this.refs.set(t.id, { card, time, toggle, status: statusEl });
    this.applyCardState(t, { card, time, toggle, status: statusEl });
    return card;
  }

  /** 每帧写时间文本 + 熟度状态（O(1)，无 DOM 查询）；仅运行中卡片 */
  updateTime(id: number, ms: number): void {
    const ref = this.refs.get(id);
    if (!ref) return;
    ref.time.textContent = formatMs(ms);
    const t = this.store.getTimer(id);
    if (t && t.food.times) {
      const elapsed = t.food.totalMs - ms;
      const st = deriveDonenessStatus(elapsed, t.food.times);
      this.applyStatus(ref, st, t);
    }
  }

  private applyStatus(ref: TimerRefs, st: DonenessStatus | null, t: Timer): void {
    const el = ref.status;
    if (!el) return;
    if (!st) {
      el.dataset.status = '';
      el.querySelector('.status-label')!.textContent = '';
      return;
    }
    el.dataset.status = st;
    el.querySelector('.status-label')!.textContent = DONENESS_STATUS_LABELS[st];
    // 判据随状态切换
    const cue = t.food.cues?.[st];
    const descEl = ref.card.querySelector<HTMLElement>('.timer-desc');
    if (descEl && cue && !t.food.risk) {
      descEl.textContent = `👁 ${cue}`;
    }
  }

  private applyCardState(t: Timer, ref: TimerRefs): void {
    ref.card.classList.toggle('running', t.state === 'running');
    ref.card.classList.toggle('completed', t.state === 'done');
    ref.toggle.textContent =
      t.state === 'done' ? '加一份' : t.state === 'running' ? '暂停' : '继续';
    // 完成卡显示"时间到"而不是"0秒"；运行中的卡由 rAF 每帧直写
    ref.time.textContent = t.state === 'done' ? '时间到' : formatMs(t.remainingMs);
    // 初始熟度状态
    if (t.food.times) {
      const elapsed = t.state === 'done' ? t.food.totalMs : t.food.totalMs - t.remainingMs;
      const st = deriveDonenessStatus(elapsed, t.food.times);
      this.applyStatus(ref, st, t);
    }
  }

  updateGlobalButtons(): void {
    const { timers } = this.store.snapshot;
    const anyRunning = timers.some((t) => t.state === 'running');
    const allPaused = timers.length > 0 && timers.every((t) => t.state === 'paused');
    if (anyRunning) {
      this.el.pauseAllBtn.textContent = '全部暂停';
      this.el.pauseAllBtn.disabled = false;
    } else if (allPaused) {
      this.el.pauseAllBtn.textContent = '全部恢复';
      this.el.pauseAllBtn.disabled = false;
    } else {
      this.el.pauseAllBtn.textContent = '全部暂停';
      this.el.pauseAllBtn.disabled = true;
    }
    this.el.deleteAllBtn.disabled = timers.length === 0;
  }

  // ---------- 食材 ----------

  renderFoods(category: CategoryTab): void {
    const isMyFoods = category === 'myfoods';
    const foods = isMyFoods
      ? this.store.snapshot.myFoods
      : (foodDatabase[category as Category] ?? []);

    // 份数角标：从计时列表实时派生（删除后自动回退，不再维护独立计数器）
    const counts = new Map<string, number>();
    for (const t of this.store.snapshot.timers) {
      counts.set(t.food.baseName, (counts.get(t.food.baseName) ?? 0) + 1);
    }

    this.el.foodGrid.innerHTML = '';

    if (isMyFoods && foods.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'my-foods-empty';
      empty.textContent = '还没有自定义食材，在上方添加吧';
      this.el.foodGrid.appendChild(empty);
      return;
    }

    for (const food of foods) {
      const timeSec = 'time' in food ? food.time : food.timeSec;
      const count = counts.get(food.name) ?? 0;
      const card = document.createElement('div');
      card.className = 'food-card' + (isMyFoods ? ' food-card-custom' : '');
      card.dataset.name = food.name;
      card.dataset.time = String(timeSec);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      if (count > 0) {
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
      }
      card.innerHTML = `
        ${count > 1 ? `<div class="food-count-badge">${count}</div>` : ''}
        <div class="food-name">${escapeHtml(food.name)}</div>
        <div class="food-time">时长: <span>${formatMs(timeSec * 1000)}</span></div>
        ${isMyFoods ? '<button class="food-remove-btn" title="删除该食材" aria-label="删除该食材">✕</button>' : ''}
      `;
      if (isMyFoods) {
        card
          .querySelector<HTMLButtonElement>('.food-remove-btn')!
          .addEventListener('click', (e) => {
            e.stopPropagation();
            this.onRemoveMyFood?.(food.name);
          });
      }
      this.el.foodGrid.appendChild(card);
    }
  }

  /** 由 app 注入：点卡片=开计时（目录食材默认适中档）；✕=从库中移除 */
  onRemoveMyFood: ((name: string) => void) | null = null;
  onPickFood: ((name: string, timeSec: number, desc: string, custom: boolean) => void) | null =
    null;

  /** 食物网格统一事件委托（含键盘可达性） */
  attachFoodGrid(): void {
    this.el.foodGrid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.food-remove-btn')) return;
      const card = target.closest<HTMLElement>('.food-card');
      if (!card) return;
      this.pickFromCard(card);
    });
    this.el.foodGrid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement;
      const card = target.closest<HTMLElement>('.food-card');
      if (!card) return;
      e.preventDefault();
      this.pickFromCard(card);
    });
  }

  private pickFromCard(card: HTMLElement): void {
    if (!this.onPickFood) return;
    const name = card.dataset.name ?? '';
    const time = parseInt(card.dataset.time ?? '0', 10);
    if (!name || !(time > 0)) return;
    const isCustom = card.classList.contains('food-card-custom');
    const descEl = card.querySelector<HTMLElement>('.food-time span');
    this.onPickFood(name, time, descEl?.textContent ?? '', isCustom);
  }

  updateCategoryTabs(active: CategoryTab): void {
    this.el.categoryTabs.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === active);
    });
  }
}

export { CATEGORIES };