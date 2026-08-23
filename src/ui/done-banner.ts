import { escapeHtml } from './html';

export interface DoneItem {
  id: number;
  name: string;
  missed: boolean;
}

/**
 * "时间到"确认面板：合并展示所有未确认的到期条目（含离开期间到期的）。
 * 点「知道了」逐项确认，点「全部知道了」一键清空。
 */
export class DoneBanner {
  constructor(
    private el: HTMLElement,
    private onConfirm: (id: number) => void,
    private onConfirmAll: () => void,
  ) {
    this.el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'done-confirm-all') {
        this.onConfirmAll();
        return;
      }
      const btn = target.closest<HTMLButtonElement>('.done-item-btn');
      if (btn?.dataset.id) this.onConfirm(parseInt(btn.dataset.id, 10));
    });
  }

  render(items: readonly DoneItem[]): void {
    if (items.length === 0) {
      this.el.hidden = true;
      this.el.innerHTML = '';
      return;
    }
    const hasMissed = items.some((i) => i.missed);
    const itemsHtml = items
      .map(
        (i) => `
        <li class="done-item">
            <span class="done-item-name">${i.missed ? '🕒 ' : '🍲 '}${escapeHtml(i.name)}</span>
            <button class="btn-small done-item-btn" data-id="${i.id}">知道了</button>
        </li>`,
      )
      .join('');
    this.el.innerHTML = `
        <div class="done-banner-head">
            <h3>${hasMissed ? '这些在你离开时已到点' : '时间到！'}</h3>
            <button class="btn-small" id="done-confirm-all">全部知道了</button>
        </div>
        <ul class="done-list">${itemsHtml}</ul>
    `;
    this.el.hidden = false;
  }
}
