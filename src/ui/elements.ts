function req<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element: #${id}`);
  return el as T;
}

/** 一次性收集全部 DOM 引用 */
export function collectElements() {
  return {
    timersContainer: req<HTMLDivElement>('timers-container'),
    emptyState: req<HTMLDivElement>('empty-state'),
    pauseAllBtn: req<HTMLButtonElement>('pause-all-btn'),
    deleteAllBtn: req<HTMLButtonElement>('delete-all-btn'),
    foodGrid: req<HTMLDivElement>('food-grid'),
    categoryTabs: document.querySelector<HTMLElement>('.category-tabs')!,
    toast: req<HTMLDivElement>('toast'),
    flashOverlay: req<HTMLDivElement>('flash-overlay'),
    liveRegion: req<HTMLDivElement>('live-region'),
    myFoodsPanel: req<HTMLDivElement>('my-foods-panel'),
    customFoodNameInput: req<HTMLInputElement>('custom-food-name'),
    customTimeChips: req<HTMLDivElement>('custom-time-chips'),
    addCustomFoodBtn: req<HTMLButtonElement>('add-custom-food-btn'),
    quickNameOverlay: req<HTMLDivElement>('quick-name-overlay'),
    quickNameHint: req<HTMLParagraphElement>('quick-name-hint'),
    quickNameInput: req<HTMLInputElement>('quick-name-input'),
    quickNameCancel: req<HTMLButtonElement>('quick-name-cancel'),
    quickNameConfirm: req<HTMLButtonElement>('quick-name-confirm'),
    doneBanner: req<HTMLDivElement>('done-banner'),
    installBanner: req<HTMLDivElement>('install-banner'),
    installBtn: req<HTMLButtonElement>('install-btn'),
    installDismiss: req<HTMLButtonElement>('install-dismiss'),
    updateBanner: req<HTMLDivElement>('update-banner'),
    updateBtn: req<HTMLButtonElement>('update-btn'),
    setSound: req<HTMLButtonElement>('set-sound'),
    setVolume: req<HTMLInputElement>('set-volume'),
  };
}

export type Elements = ReturnType<typeof collectElements>;
