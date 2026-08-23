import { escapeHtml } from './html';
import { formatMs } from '../core/time';

export interface DialogElements {
  overlay: HTMLDivElement;
  hint: HTMLElement;
  input: HTMLInputElement;
  cancel: HTMLButtonElement;
  confirm: HTMLButtonElement;
}

/**
 * 快速计时名称输入弹层。
 * 无障碍：焦点陷阱（Tab 在弹层内循环）、Esc 关闭、关闭后焦点归还触发元素。
 */
export class QuickNameDialog {
  private onConfirmCb: (name: string) => void = () => {};
  private onCancelCb: () => void = () => {};
  private lastFocus: HTMLElement | null = null;
  private defaultName = '';

  constructor(private el: DialogElements) {
    this.el.confirm.addEventListener('click', () => {
      const name = this.el.input.value.trim() || this.defaultName;
      this.close();
      this.onConfirmCb(name);
    });
    this.el.cancel.addEventListener('click', () => {
      this.close();
      this.onCancelCb();
    });
    this.el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.el.confirm.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.el.cancel.click();
      }
    });
    this.el.overlay.addEventListener('click', (e) => {
      if (e.target === this.el.overlay) this.el.cancel.click();
    });
    // 焦点陷阱
    this.el.overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables: HTMLElement[] = [this.el.input, this.el.cancel, this.el.confirm];
      const idx = focusables.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      e.preventDefault();
      const next = e.shiftKey
        ? (idx - 1 + focusables.length) % focusables.length
        : (idx + 1) % focusables.length;
      focusables[next]?.focus();
    });
  }

  isOpen(): boolean {
    return !this.el.overlay.hidden;
  }

  open(
    defaultName: string,
    seconds: number,
    onConfirm: (name: string) => void,
    onCancel: () => void,
  ): void {
    this.defaultName = defaultName;
    this.onConfirmCb = onConfirm;
    this.onCancelCb = onCancel;
    this.lastFocus = (document.activeElement as HTMLElement | null) ?? null;
    this.el.hint.innerHTML = `时长 <span>${formatMs(seconds * 1000)}</span> · 留空将使用「${escapeHtml(defaultName)}」`;
    this.el.input.value = defaultName;
    this.el.overlay.hidden = false;
    // 下一帧再加 open 类，保证过渡动画播放
    requestAnimationFrame(() => {
      this.el.overlay.classList.add('open');
      this.el.input.focus();
      this.el.input.select();
    });
  }

  close(): void {
    if (this.el.overlay.hidden) return;
    this.el.overlay.classList.remove('open');
    if (this.lastFocus) this.lastFocus.focus();
    // 等淡出动画结束后再隐藏
    window.setTimeout(() => {
      if (!this.el.overlay.classList.contains('open')) {
        this.el.overlay.hidden = true;
      }
    }, 220);
  }
}
