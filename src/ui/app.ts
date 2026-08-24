import { Store, type NewFood } from '../core/store';
import {
  liveRemainingMs,
  reanchorRunning,
  settleOnLoad,
  systemTime,
  tickTimers,
  type TimeSource,
} from '../core/time';
import { foodDatabase } from '../core/catalog';
import { loadState, saveState, watchExternalChanges } from '../platform/storage';
import { Scheduler } from '../platform/scheduler';
import { unlockAudio } from '../platform/audio';
import { setWakeLock } from '../platform/wakelock';
import { collectElements } from './elements';
import { Render, type CategoryTab } from './render';
import { Toast } from './toast';
import { QuickNameDialog } from './dialog';
import { DoneBanner } from './done-banner';
import { AlarmController, type AlarmOptions } from './alarm-controller';
import { initSettings } from './settings-ui';
import { initPwa } from './pwa';
import { announce } from './live';

/** 组合根：装配 core × platform × ui，并接线全部事件 */
export function boot(): void {
  const el = collectElements();
  const ts: TimeSource = systemTime;

  // ---------- 状态 ----------
  const initial = loadState();
  reanchorRunning(initial.timers, ts);
  const store = new Store(initial);
  const toast = new Toast(el.toast);
  const render = new Render(store, el);
  const dialog = new QuickNameDialog({
    overlay: el.quickNameOverlay,
    hint: el.quickNameHint,
    input: el.quickNameInput,
    cancel: el.quickNameCancel,
    confirm: el.quickNameConfirm,
  });
  const alarm = new AlarmController({
    store,
    flash: () => flash(),
    announce: (msg) => announce(el.liveRegion, msg),
    onQueueChange: () => renderDoneBanner(),
  });
  const doneBanner = new DoneBanner(
    el.doneBanner,
    (id) => alarm.confirm(id),
    () => alarm.confirmAll(),
  );

  let currentCategory: CategoryTab = 'meat';
  let selectedCustomTime = 60;

  // ---------- 到期处理（前台帧 / 后台唤醒 共用） ----------
  function handleDue(ids: readonly number[], opts: AlarmOptions): void {
    if (ids.length === 0) return;
    store.markDone(ids);
    // 到点流程显式重建：卡片转"时间到" + 到点条目置顶
    // （tick 已直接置位 state，markDone 在此路径上通常不产生结构变更）
    render.forceRebuildTimers();
    alarm.handleDue(ids, opts);
    void saveState(store.snapshot);
  }

  // ---------- 调度 ----------
  const scheduler = new Scheduler(store, {
    onFrame: () => {
      const due = tickTimers(store.snapshot.timers, ts);
      for (const t of store.snapshot.timers) {
        if (t.state === 'running') render.updateTime(t.id, liveRemainingMs(t, ts));
      }
      handleDue(due, { sound: true, flash: true, announce: true });
    },
    onWake: () => {
      const due = tickTimers(store.snapshot.timers, ts);
      handleDue(due, { sound: true, flash: true, announce: true });
      scheduler.onStateChange(); // 若还有运行中条目，重新武装
    },
  });

  // ---------- 渲染 ----------
  function renderDoneBanner(): void {
    const items = alarm.queue.map((id) => {
      const t = store.getTimer(id);
      return { id, name: t?.food.name ?? '', missed: t?.missed ?? false };
    });
    doneBanner.render(items);
  }

  function refreshViews(structural: boolean): void {
    if (structural) {
      render.renderTimers();
      render.renderFoods(currentCategory);
      renderDoneBanner();
    }
    render.updateGlobalButtons();
  }

  function flash(): void {
    el.flashOverlay.classList.remove('flashing');
    // 强制重排，确保连续触发时动画能重新播放
    void el.flashOverlay.offsetWidth;
    el.flashOverlay.classList.add('flashing');
    // 动画为 1.1s × 3 = 3.3s，留足余量再撤类（此前 1800ms 会砍掉后半段）
    window.setTimeout(() => el.flashOverlay.classList.remove('flashing'), 3400);
  }

  // ---------- 意图接线 ----------
  function pickFood(name: string, timeSec: number, desc: string, custom: boolean): void {
    const food: NewFood = { name, timeSec, desc, custom };
    store.addFoodTimer(food, ts);
    // 时长卡片上已经看得见，toast 只报菜名，保持一行
    toast.show(`已添加 ${name}`);
  }

  render.onPickFood = (name, timeSec, _desc, custom) => {
    if (custom) {
      pickFood(name, timeSec, '', true);
      return;
    }
    // 目录食材：从库里找回完整 desc（卡片只带 name/time）
    let found = '';
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      const hit = foodDatabase[cat].find((f) => f.name === name);
      if (hit) {
        found = hit.desc;
        break;
      }
    }
    pickFood(name, timeSec, found, false);
  };
  render.onRemoveMyFood = (name) => {
    store.removeMyFood(name);
    toast.show(`已移除: ${name}`);
  };
  render.attachFoodGrid();

  // 分类标签
  el.categoryTabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab-btn');
    if (!btn?.dataset.category) return;
    currentCategory = btn.dataset.category as CategoryTab;
    el.myFoodsPanel.style.display = currentCategory === 'myfoods' ? 'flex' : 'none';
    render.updateCategoryTabs(currentCategory);
    render.renderFoods(currentCategory);
  });

  // "我的食材"面板
  el.customTimeChips.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.time-chip');
    if (!chip) return;
    selectedCustomTime = parseInt(chip.dataset.time ?? '60', 10);
    el.customTimeChips
      .querySelectorAll<HTMLButtonElement>('.time-chip')
      .forEach((c) => c.classList.toggle('active', c === chip));
  });
  el.addCustomFoodBtn.addEventListener('click', () => {
    const name = el.customFoodNameInput.value;
    if (store.addMyFood(name, selectedCustomTime)) {
      el.customFoodNameInput.value = '';
      toast.show(`已添加食材 ${name.trim()}`);
    } else {
      toast.show('请输入食材名称');
    }
  });
  el.customFoodNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.addCustomFoodBtn.click();
    }
  });

  // 计时器卡片（事件委托）
  el.timersContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const toggle = target.closest<HTMLButtonElement>('.btn-toggle');
    if (toggle?.dataset.id) {
      store.toggleTimer(parseInt(toggle.dataset.id, 10), ts);
      return;
    }
    const del = target.closest<HTMLButtonElement>('.btn-delete');
    if (del?.dataset.id) {
      const t = store.getTimer(parseInt(del.dataset.id, 10));
      store.removeTimer(parseInt(del.dataset.id, 10));
      toast.show(t ? `已删除 ${t.food.name}` : '已删除');
    }
  });

  // 全局控制
  el.pauseAllBtn.addEventListener('click', () => {
    const { timers } = store.snapshot;
    const anyRunning = timers.some((t) => t.state === 'running');
    for (const t of timers) {
      if (anyRunning ? t.state === 'running' : t.state === 'paused') store.toggleTimer(t.id, ts);
    }
    toast.show(anyRunning ? '已全部暂停' : '已全部恢复');
  });
  el.deleteAllBtn.addEventListener('click', () => {
    if (store.snapshot.timers.length === 0) return;
    if (!window.confirm('确定要删除所有计时器吗？此操作不可撤销。')) return;
    store.deleteAllTimers();
    alarm.confirmAll();
    toast.show('已删除所有计时器');
  });

  // 守锅模式（整页全屏 + 保持亮屏）。
  // 必须全屏 body 而不是 timer-section：完成面板/脉冲层/弹层都在
  // section 之外，section 全屏时这些提醒全部不可见。
  el.watchModeBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.body.requestFullscreen();
      }
    } catch {
      toast.show('当前浏览器不支持全屏');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const fs = !!document.fullscreenElement;
    el.watchModeBtn.textContent = fs ? '✕ 退出守锅' : '⛶ 守锅';
    void setWakeLock(fs);
  });

  // 快捷计时
  document.querySelectorAll<HTMLButtonElement>('.quick-time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seconds = parseInt(btn.dataset.time ?? '60', 10);
      const defaultName = store.nextQuickDefaultName();
      dialog.open(
        defaultName,
        seconds,
        (name) => {
          store.addQuickTimer(name, seconds, ts);
          toast.show(`已添加 ${name}`);
        },
        () => toast.show('已取消'),
      );
    });
  });

  // 设置 / PWA
  initSettings(store, el, { toast: (m) => toast.show(m) });
  initPwa(store, el, { toast: (m) => toast.show(m) });

  // ---------- 订阅：持久化 + 视图 + 调度 + 亮屏 ----------
  let lastStructural = -1;
  store.subscribe(() => {
    const structural = store.structureVersion !== lastStructural;
    lastStructural = store.structureVersion;
    void saveState(store.snapshot);
    scheduler.onStateChange();
    void setWakeLock(store.snapshot.timers.some((t) => t.state === 'running'));
    refreshViews(structural);
  });

  // 其他标签页写入 -> 本标签页水合（last write wins）
  watchExternalChanges((state) => {
    settleOnLoad(state.timers, Date.now());
    reanchorRunning(state.timers, ts);
    store.hydrate(state);
  });

  // ---------- 生命周期 ----------
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      unlockAudio();
      scheduler.onVisibilityChange();
      void setWakeLock(store.snapshot.timers.some((t) => t.state === 'running'));
    } else {
      void saveState(store.snapshot);
      scheduler.onVisibilityChange();
    }
  });

  document.addEventListener('pointerdown', () => {
    unlockAudio();
    alarm.onUserGesture();
  });

  window.addEventListener('pagehide', () => void saveState(store.snapshot));
  window.addEventListener('beforeunload', () => void saveState(store.snapshot));

  // ---------- 启动 ----------
  el.myFoodsPanel.style.display = 'none';
  el.customTimeChips
    .querySelectorAll<HTMLButtonElement>('.time-chip')
    .forEach((c) =>
      c.classList.toggle('active', parseInt(c.dataset.time ?? '0', 10) === selectedCustomTime),
    );
  render.updateCategoryTabs('meat');
  render.renderTimers();
  render.renderFoods('meat');
  render.updateGlobalButtons();

  // 离开期间到期的条目：静默补报（不发声，首次交互后循环音接管）
  const missed = store.snapshot.timers.filter((t) => t.missed);
  if (missed.length > 0) {
    alarm.handleDue(
      missed.map((t) => t.id),
      { sound: false, flash: true, announce: true },
    );
    toast.show(`${missed.length} 项在你离开时已到点`);
  }

  scheduler.start();
  void setWakeLock(store.snapshot.timers.some((t) => t.state === 'running'));
}
