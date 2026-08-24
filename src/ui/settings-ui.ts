import type { Store } from '../core/store';
import type { Elements } from './elements';
import { beep } from '../platform/audio';

interface SettingsDeps {
  toast: (msg: string) => void;
}

/**
 * 提醒设置行：声音开关 + 音量。
 * 开关有即时反馈（toast + 试听）；声音关闭时音量条禁用。
 */
export function initSettings(store: Store, el: Elements, deps: SettingsDeps): void {
  const sync = (): void => {
    const s = store.snapshot.settings;
    el.setSound.setAttribute('aria-pressed', String(s.sound));
    el.setSound.classList.toggle('off', !s.sound);
    el.setSound.textContent = s.sound ? '🔊 声音' : '🔇 声音';
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

  el.setVolume.addEventListener('input', () => {
    const v = Math.min(1, Math.max(0, (parseInt(el.setVolume.value, 10) || 0) / 100));
    store.updateSettings({ volume: v });
  });

  store.subscribe(sync);
  sync();
}
