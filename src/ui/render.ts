import type { Store } from '../core/store';
import type { Timer } from '../core/types';
import { formatMs } from '../core/time';
import { CATEGORIES, foodDatabase, type Category } from '../core/catalog';
import { escapeHtml } from './html';
import type { Elements } from './elements';

export interface TimerRefs {
  card: HTMLElement;
  time: HTMLElement;
  toggle: HTMLButtonElement;
}

export type CategoryTab = Category | 'myfoods';

/**
 * 渲染层：
 * - 计时器卡片只在 structureVersion 变化时重建（增/删/重置/水合）；
 * - 时间文本由调度循环通过 updateTime 直写（每帧，不重建 DOM）；
 * - 卡片状态（running/completed 类名与按钮文案）由 updateCardState 单独刷新。
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

    this.el.timersContainer.querySelectorAll('.timer-card').forEach((n) => n.remove());
    this.refs.clear();

    const timers = this.store.snapshot.timers;
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
    card.innerHTML = `
        <div class="timer-card-header">
            <h3 class="timer-food-name">${escapeHtml(t.food.name)}</h3>
        </div>
        <div class="timer-card-body">
            <div class="timer-info">
                <div class="timer-time">${formatMs(t.remainingMs)}</div>
            </div>
            <div class="timer-card-controls">
                <button class="btn-toggle btn-small" data-id="${t.id}"></button>
                <button class="btn-delete btn-small" data-id="${t.id}">删除</button>
            </div>
        </div>
        <div class="timer-desc">${escapeHtml(t.food.desc || '')}</div>
    `;
    const time = card.querySelector<HTMLElement>('.timer-time')!;
    const toggle = card.querySelector<HTMLButtonElement>('.btn-toggle')!;
    this.refs.set(t.id, { card, time, toggle });
    this.applyCardState(t, { card, time, toggle });
    return card;
  }

  /** 每帧只写时间文本（O(1)，无 DOM 查询） */
  updateTime(id: number, ms: number): void {
    const ref = this.refs.get(id);
    if (ref) ref.time.textContent = formatMs(ms);
  }

  /** 状态变化后刷新单卡（类名 + 按钮文案） */
  updateCardState(id: number): void {
    const t = this.store.getTimer(id);
    const ref = this.refs.get(id);
    if (!t || !ref) return;
    this.applyCardState(t, ref);
    ref.time.textContent = formatMs(t.remainingMs);
  }

  private applyCardState(t: Timer, ref: TimerRefs): void {
    ref.card.classList.toggle('running', t.state === 'running');
    ref.card.classList.toggle('completed', t.state === 'done');
    ref.toggle.textContent =
      t.state === 'done' ? '加一份' : t.state === 'running' ? '暂停' : '继续';
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

  /** 由 app 注入：点"我的食材"卡片=开计时；✕=从库中移除 */
  onRemoveMyFood: ((name: string) => void) | null = null;
  onPickFood: ((name: string, timeSec: number, desc: string, custom: boolean) => void) | null =
    null;

  /** 食物网格统一事件委托（含键盘可达性） */
  attachFoodGrid(): void {
    this.el.foodGrid.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.food-card');
      if (!card || (e.target as HTMLElement).closest('.food-remove-btn')) return;
      this.pickFromCard(card);
    });
    this.el.foodGrid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = (e.target as HTMLElement).closest<HTMLElement>('.food-card');
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
