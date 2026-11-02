import type { BrowserContext, Page } from '@playwright/test';
import type { Food, MyFood, TimerState } from '../../src/core/types';

/**
 * e2e 种子状态的唯一实现。
 *
 * 约束不变：传给 addInitScript 的回调会被序列化到浏览器执行，回调体内只能引用
 * 参数与浏览器全局（Date / JSON / localStorage），所以这里没有外部引用——
 * spec 只需要 import 这个函数，别再往测试文件里复制一份状态形状。
 */
export const STATE_KEY = 'hotpot-timer-state-v2';

/** 种子里的 endAt 是**相对页面启动那一刻**的毫秒偏移：+15000 = 15 秒后到点，-11000 = 已超时 11 秒。 */
export type SeedTimer = {
  id: number;
  /** `name` 省略时按 `baseName` 填。份数（xN）由计时列表实时派生，别在种子里烘进 name。 */
  food: Omit<Food, 'name'> & { name?: string };
  remainingMs: number;
  state: TimerState;
  /** null = 已完成且无墙钟锚点（重启后条目的形态） */
  endAt: number | null;
  missed?: boolean;
};

export type SeedOptions = {
  myFoods?: MyFood[];
  settings?: Partial<{ sound: boolean; vibrate: boolean; systemNotify: boolean }>;
};

/**
 * 播种到 Page 或整个 BrowserContext（双标签测试用后者，两个页面同一初始状态）。
 * `timers` 省略时只播种空列表 + 默认设置。
 */
export async function seedState(
  target: Page | BrowserContext,
  timers: SeedTimer[] = [],
  options: SeedOptions = {},
): Promise<void> {
  await target.addInitScript(
    (data: {
      key: string;
      timers: SeedTimer[];
      myFoods: MyFood[];
      settings: { sound: boolean; vibrate: boolean; systemNotify: boolean };
      nextTimerId: number;
    }) => {
      const now = Date.now();
      localStorage.setItem(
        data.key,
        JSON.stringify({
          version: 3,
          timers: data.timers.map((t) => ({
            ...t,
            missed: t.missed ?? false,
            food: { ...t.food, name: t.food.name ?? t.food.baseName },
            endAt: t.endAt === null ? null : now + t.endAt,
          })),
          myFoods: data.myFoods,
          settings: data.settings,
          nextTimerId: data.nextTimerId,
        }),
      );
    },
    {
      key: STATE_KEY,
      timers,
      myFoods: options.myFoods ?? [],
      settings: { sound: false, vibrate: false, systemNotify: false, ...options.settings },
      nextTimerId: timers.reduce((max, t) => Math.max(max, t.id), 0) + 1,
    },
  );
}
