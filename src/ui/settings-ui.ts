import type { Store } from '../core/store';
import type { Elements } from './elements';

/** 提醒设置行：声音/震动/系统通知开关 + 音量 */
export function initSettings(
  store: Store,
  el: Elements,
  deps: { onRequestNotify: () => void },
): void {
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
  };

  el.setSound.addEventListener('click', () => {
    const s = store.snapshot.settings;
    store.updateSettings({ sound: !s.sound });
    sync();
  });
  el.setVibrate.addEventListener('click', () => {
    const s = store.snapshot.settings;
    store.updateSettings({ vibrate: !s.vibrate });
    sync();
  });
  el.setNotify.addEventListener('click', () => {
    const s = store.snapshot.settings;
    const next = !s.systemNotify;
    store.updateSettings({ systemNotify: next });
    if (next) deps.onRequestNotify();
    sync();
  });
  el.setVolume.addEventListener('input', () => {
    const v = Math.min(1, Math.max(0, (parseInt(el.setVolume.value, 10) || 0) / 100));
    store.updateSettings({ volume: v });
  });

  store.subscribe(sync);
  sync();
}
