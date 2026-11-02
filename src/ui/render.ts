import { displayOrder, timerDisplayName, type Store } from '../core/store';
import {
  DONENESS_STATUS_LABELS,
  deriveDonenessStatus,
  type DonenessStatus,
  type Timer,
} from '../core/types';
import { formatMs, shouldPulseOvertime } from '../core/time';
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
 * - 计时器卡片只在 structureVersion 变化时重建（增/删/到点置顶/重置/水合）；
 *   没有「绕过结构版本重建」的旁路——任何需要重绘的状态变化都必须走 Store 的 commit；
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
    // 手法提示行（仅目录食材且有明确手法时显示）
    const technique = t.food.technique
      ? `<div class="timer-technique">🥢 ${escapeHtml(t.food.technique)}</div>`
      : '';
    const note = t.food.risk
      ? `<div class="timer-desc timer-risk">⚠️ ${escapeHtml(t.food.risk)}</div>`
      : t.food.cues
        ? `<div class="timer-desc">👁 ${escapeHtml(t.food.cues.medium)}</div>`
        : `<div class="timer-desc">${escapeHtml(t.food.desc || '')}</div>`;
    card.innerHTML = `
        <div class="timer-card-header">
            <h3 class="timer-food-name">${escapeHtml(timerDisplayName(this.store.snapshot.timers, t))}</h3>
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
        ${technique}
        ${note}
    `;
    const time = card.querySelector<HTMLElement>('.timer-time')!;
    const toggle = card.querySelector<HTMLButtonElement>('.btn-toggle')!;
    const statusEl = card.querySelector<HTMLElement>('.timer-status')!;
    this.refs.set(t.id, { card, time, toggle, status: statusEl });
    this.applyCardState(t, { card, time, toggle, status: statusEl });
    return card;
  }

  /** 每帧写时间文本 + 熟度状态 + 超时分级（O(1)，无 DOM 查询）；运行中 + 已到期卡片 */
  updateTime(id: number, ms: number): void {
    const ref = this.refs.get(id);
    if (!ref) return;
    // ms 为负 = 超时；刚到期（0 <= ms < 1s）显示"时间到"，避免"0秒 -> +0秒"多出一秒
    const overtime = ms < 0 ? -ms : 0;
    ref.time.textContent = ms < 0 ? `+${formatMs(-ms)}` : ms < 1000 ? '时间到' : formatMs(ms);
    // 超时分级：hard=多煮即老（红色警告）/ soft=多煮更入味（中性）
    if (overtime > 0) {
      const t = this.store.getTimer(id);
      if (shouldPulseOvertime(t?.food.overtime, overtime)) {
        ref.time.classList.add('overtime-hard');
      } else {
        ref.time.classList.remove('overtime-hard');
      }
    } else {
      ref.time.classList.remove('overtime-hard');
    }
    const t = this.store.getTimer(id);
    if (t && t.food.times) {
      const elapsed = t.food.totalMs - ms; // 超时后 elapsed > totalMs
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
    // 完成卡显示超时时间（+Xs）或"时间到"（刚到期）；运行中的卡由 rAF 每帧直写
    if (t.state === 'done') {
      const overtime = -t.remainingMs; // remainingMs 为负 = 超时
      ref.time.textContent = overtime > 0 ? `+${formatMs(overtime)}` : '时间到';
      // 超时分级：hard=多煮即老（红色警告）
      if (shouldPulseOvertime(t.food.overtime, overtime)) {
        ref.time.classList.add('overtime-hard');
      } else {
        ref.time.classList.remove('overtime-hard');
      }
    } else {
      ref.time.textContent = formatMs(t.remainingMs);
      ref.time.classList.remove('overtime-hard');
    }
    // 初始熟度状态
    if (t.food.times) {
      const elapsed = t.food.totalMs - t.remainingMs; // 超时后 elapsed > totalMs
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
      ? [...this.store.snapshot.myFoods]
      : [...(foodDatabase[category as Category] ?? [])];
    // 按时长升序排序（短的在前）
    const timeOf = (f: (typeof foods)[number]) => ('time' in f ? f.time : f.timeSec);
    foods.sort((a, b) => timeOf(a) - timeOf(b));

    // 份数角标：从计时列表实时派生（删除后自动回退，不再维护独立计数器）
    const counts = new Map<string, number>();
    for (const t of this.store.snapshot.timers) {
      counts.set(t.food.baseName, (counts.get(t.food.baseName) ?? 0) + 1);
    }

    // 重绘会换掉所有可聚焦元素：先记住焦点落在哪张卡，重建后还回去
    // （键盘连加多份时，不然每加一份都得重新 Tab 回原位）
    const focused = document.activeElement as HTMLElement | null;
    const keepFocus =
      focused && this.el.foodGrid.contains(focused)
        ? (focused.closest<HTMLElement>('.food-card')?.dataset.name ?? null)
        : null;

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
      const ms = timeSec * 1000;
      const card = document.createElement('div');
      card.className = 'food-card' + (isMyFoods ? ' food-card-custom' : '');
      card.dataset.name = food.name;
      card.dataset.time = String(timeSec);
      if (count > 0) card.classList.add('selected');
      // 卡片本身不再是可交互元素：里面只有一个「再加一份」按钮，
      // 删除按钮与它同级（按钮套按钮读屏念不清，aria-pressed 也会把「加一份」说成开关）
      const label =
        `${food.name}，时长 ${formatMs(ms)}` +
        (count > 1 ? `，已有 ${count} 份` : '') +
        '，再加一份';
      card.innerHTML = `
        ${count > 1 ? `<div class="food-count-badge" aria-hidden="true">${count}</div>` : ''}
        <button type="button" class="food-add-btn" aria-label="${escapeHtml(label)}">
          <span class="food-name">${escapeHtml(food.name)}</span>
          <span class="food-time">时长: <span>${formatMs(ms)}</span></span>
        </button>
        ${
          isMyFoods
            ? `<button class="food-remove-btn" title="删除该食材" aria-label="${escapeHtml(`删除 ${food.name}`)}">✕</button>`
            : ''
        }
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

    if (keepFocus) {
      const again = this.el.foodGrid.querySelector<HTMLElement>(
        `.food-card[data-name="${CSS.escape(keepFocus)}"] .food-add-btn`,
      );
      again?.focus();
    }
  }

  /** 由 app 注入：点卡片=开计时（目录食材默认适中档）；✕=从库中移除 */
  onRemoveMyFood: ((name: string) => void) | null = null;
  onPickFood: ((name: string, timeSec: number, desc: string, custom: boolean) => void) | null =
    null;

  /**
   * 食物网格统一事件委托。键盘不用自己接：卡里是真实 <button>，Enter/空格原生触发 click，
   * 再叠一层 keydown 会让一次按键加两份。
   */
  attachFoodGrid(): void {
    this.el.foodGrid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.food-remove-btn')) return;
      const card = target.closest<HTMLElement>('.food-card');
      if (!card) return;
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

  /** 选中标签：样式 + ARIA 状态 + roving tabindex + 面板指向，一次改齐 */
  updateCategoryTabs(active: CategoryTab): void {
    this.el.categoryTabs.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
      const on = btn.dataset.category === active;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
      // 整组只占一个 Tab 停靠点，组内靠左右键走（app.ts 的 keydown）
      btn.tabIndex = on ? 0 : -1;
    });
    this.el.foodTabpanel.setAttribute('aria-labelledby', `tab-${active}`);
  }
}

export { CATEGORIES };
