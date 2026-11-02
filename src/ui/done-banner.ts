/**
 * 到点确认面板：只报「几项到点」，不逐行重复卡片上已有的名字与读数。
 * 到点条目由 Store 置顶，名字就在面板上方；面板的职责只有两件——
 * 告诉你有几项、以及一键停掉循环提醒。
 */
export interface DoneSummary {
  total: number;
  /** 其中在页面被挂起/关闭期间到点的项数（补报） */
  missed: number;
}

export class DoneBanner {
  constructor(
    private el: HTMLDivElement,
    private onConfirmAll: () => void,
  ) {
    this.el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'done-confirm-all') this.onConfirmAll();
    });
  }

  render(s: DoneSummary): void {
    if (s.total === 0) {
      this.el.hidden = true;
      this.el.innerHTML = '';
      return;
    }
    const text =
      s.missed >= s.total
        ? `🕒 ${s.missed} 项在你离开时到点`
        : s.missed > 0
          ? `🍲 ${s.total} 项时间到<span class="done-banner-missed">（${s.missed} 项在你离开时到点）</span>`
          : `🍲 ${s.total} 项时间到`;
    this.el.innerHTML = `
        <div class="done-banner-head">
            <p class="done-banner-text">${text}</p>
            <button class="btn-small" id="done-confirm-all">全部知道了</button>
        </div>
    `;
    this.el.hidden = false;
  }
}
