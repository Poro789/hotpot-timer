import type { Store } from '../core/store';
import type { Elements } from './elements';
import { beep } from '../platform/audio';
import { vibrate, vibrateSupported } from '../platform/haptics';
import { notifySupported } from '../platform/notify';

interface SettingsDeps {
  toast: (msg: string) => void;
  onRequestNotify: () => Promise<'granted' | 'denied'>;
}

/**
 * 提醒设置行：声音/震动/系统通知开关 + 音量。
 * 每个开关都有即时反馈（toast / 试听 / 试震），
 * 并在平台不支持或权限被拒时明确告知并自动回退为关闭——
 * 不允许"看起来开着、实际永远不响"的假状态。
 */
export function initSettings(store: Store, el: Elements, deps: SettingsDeps): void {
  const sync = (): void => {
    const s = store.snapshot.settings;
    el.setSound.setAttribute('aria-pressed', String(s.sound));
    el.setSound.classList.toggle('off', !s.sound);
    el.setSound.textContent = s.sound ? '🔊 声音' : '🔇 声音';
    el.setVibrate.setAttribute('aria-pressed', String(s.vibrate));
    el.setVibrate.classList.toggle('off', !s.vibrate);
    el.setVibrate.textContent = s.vibrate ? '📳 震动' : '📴 震动';
    el.setNotify.setAttribute('aria-pressed', String(s.systemNotify));
    el.setNotify.classList.toggle('off', !s.systemNotify);
    el.setNotify.textContent = s.systemNotify ? '🔔 通知' : '🔕 通知';
    el.setVolume.value = String(Math.round(s.volume * 100));
    el.setVolume.setAttribute('aria-valuetext', `${Math.round(s.volume * 100)}%`);
    el.setVolume.disabled = !s.sound;
  };

  el.setSound.addEventListener('click', () => {
    const s = store.snapshot.settings;
    const next = !s.sound;
    store.updateSettings({ sound: next });
    if (next) beep(s.volume); // 试听当前音量
    deps.toast(next ? '声音提醒已开启' : '声音提醒已关闭');
    sync();
  });

  el.setVibrate.addEventListener('click', () => {
    const s = store.snapshot.settings;
    if (!s.vibrate && !vibrateSupported()) {
      deps.toast('此设备/浏览器不支持震动');
      return;
    }
    const next = !s.vibrate;
    store.updateSettings({ vibrate: next });
    if (next) vibrate(30); // 试震确认
    deps.toast(next ? '震动提醒已开启' : '震动提醒已关闭');
    sync();
  });

  el.setNotify.addEventListener('click', async () => {
    const s = store.snapshot.settings;
    if (!s.systemNotify) {
      if (!notifySupported()) {
        deps.toast('此浏览器不支持系统通知');
        return;
      }
      // 开启前必须先拿到权限，拿不到就保持关闭并说明原因
      const result = await deps.onRequestNotify();
      if (result !== 'granted') {
        store.updateSettings({ systemNotify: false });
        deps.toast('通知权限未授予，无法开启（请在浏览器设置中允许通知）');
        sync();
        return;
      }
      store.updateSettings({ systemNotify: true });
      deps.toast('系统通知已开启');
    } else {
      store.updateSettings({ systemNotify: false });
      deps.toast('系统通知已关闭');
    }
    sync();
  });

  el.setVolume.addEventListener('input', () => {
    const v = Math.min(1, Math.max(0, (parseInt(el.setVolume.value, 10) || 0) / 100));
    store.updateSettings({ volume: v });
  });

  store.subscribe(sync);
  sync();
}
