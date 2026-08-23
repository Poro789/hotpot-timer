import type { Store } from '../core/store';
import type { Elements } from './elements';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getBip(): BeforeInstallPromptEvent | undefined {
  return (window as unknown as { __bip?: BeforeInstallPromptEvent }).__bip;
}

/**
 * PWA 装配：Service Worker 注册（含"发现新版本"提示）、安装引导横幅。
 * file:// 或非 http(s) 环境下自动跳过 SW（需要安全上下文），应用降级为普通网页。
 * iOS Safari 无 beforeinstallprompt：不展示横幅，走"分享→添加到主屏幕"。
 */
export function initPwa(store: Store, el: Elements, deps: { toast: (msg: string) => void }): void {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        let announced = false;
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            // 新版本安装完成、且当前仍有旧版本在控制页面 -> 提示用户刷新
            if (nw.state === 'installed' && navigator.serviceWorker.controller && !announced) {
              announced = true;
              el.updateBanner.hidden = false;
              deps.toast('发现新版本，点击底部提示刷新');
            }
          });
        });
      })
      .catch(() => {
        /* 注册失败：功能降级 */
      });
    el.updateBtn.addEventListener('click', () => location.reload());
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as unknown as { __bip?: BeforeInstallPromptEvent }).__bip =
      e as BeforeInstallPromptEvent;
    if (!store.snapshot.settings.installDismissed) {
      el.installBanner.hidden = false;
    }
  });

  el.installBtn.addEventListener('click', async () => {
    const bip = getBip();
    if (!bip) return;
    await bip.prompt();
    const choice = await bip.userChoice;
    if (choice.outcome === 'accepted') {
      store.updateSettings({ installDismissed: true });
    }
    el.installBanner.hidden = true;
  });

  el.installDismiss.addEventListener('click', () => {
    el.installBanner.hidden = true;
    store.updateSettings({ installDismissed: true });
  });
}
