/** 队列化 Toast：多条提示依次展示，后一条不会覆盖前一条 */
export class Toast {
  private queue: string[] = [];
  private showing = false;

  constructor(private el: HTMLElement) {}

  show(message: string): void {
    this.queue.push(message);
    if (!this.showing) this.process();
  }

  private process(): void {
    const message = this.queue.shift();
    if (message === undefined) {
      this.showing = false;
      return;
    }
    this.showing = true;
    this.el.textContent = message;
    this.el.classList.add('show');
    window.setTimeout(() => {
      this.el.classList.remove('show');
      // 稍等淡出动画后再显示下一条
      window.setTimeout(() => this.process(), 350);
    }, 2000);
  }
}
