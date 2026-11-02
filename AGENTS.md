# AGENTS.md — 在本仓库干活的规矩

## 这个项目是什么

火锅涮煮计时器 PWA：Vite + TypeScript，**无框架、无 UI 库、无运行时依赖**。
线上 <https://poro789.github.io/hotpot-timer/>，源码在 `main`。

## 说「做好了」之前必须跑，全绿才算

```bash
npm run lint && npm run format:check && npm run typecheck && npm run data:check && npm test && npm run test:e2e
```

没有实跑输出，不许声称修好 / 完成 / 通过（先证据，后结论）。

## 食材数据：只改 CSV

- 数据源是 `data/food_catalog.csv`（13 列，规则见 `scripts/data-gen.mjs` 头部注释与其中的校验分支）。
- 改完必须 `npm run data:gen`。`src/core/catalog.ts` 是**生成物**：禁止手改，也已被 `.prettierignore` 排除——
  格式化它会让 `npm run data:check` 判定「与 CSV 不同步」而挂掉 CI。
- `Overtime=soft` 必须同时给 `Midpoint`（`data-gen` 会拦）：`soft` 超时不报警，再缺阶段提示就完全没有任何反馈。
  `hard` 带 `midpoint` 允许——阶段提示与超时分级是两件独立的事。
- 一次性迁移脚本 `scripts/add-cols.mjs` 已删：它内嵌 technique/overtime/midpoint 全量数据并直接写 CSV，
  是 CSV 之外的第二份数据，误跑会覆盖线上数据源而 `data:check` 仍然绿（生成物跟着它一起变，检查不出东西变了）。
  要翻历史：`git log --diff-filter=D --name-only`。以后加列直接在 CSV 上加、改 `data-gen.mjs`。

## 状态只有一个入口：Store

- 任何状态变更走 `src/core/store.ts` 的意图方法（`addTimer` / `pauseTimer` / `applyTick` / `deleteTimer` …），
  它们统一 `commit()` 通知订阅者。**渲染层不得直接改 `store.snapshot` 里的对象**——每帧推进计时也走
  `store.applyTick(ts)`。绕过 commit 的后果：到点不置顶（`structureVersion` 不动）、不存盘、后台不重新武装、亮屏锁不释放。
- `render.ts` 里的 `forceRebuildTimers()` 逃生门已删：需要重绘的状态变化只能由 Store 触发，别加回来。
- 完成告警队列（`src/core/alarm.ts` 的 `AlarmState.queue`）有意留在 Store 之外（它不是持久状态），
  靠 `AlarmController` 订阅 commit 调 `pruneQueue` 与计时列表对账。新增「会删条目」的入口不用改它，
  但别删那个对账订阅——删了会出现「卡片已删、确认面板留一行空名字」，且循环提醒继续响。
- **份数（`xN`）只有一个来源：计时列表本身**。显示名由 `core/store.ts` 的 `timerDisplayName()` 在每次渲染时
  按 `baseName` 实时派生（与食材卡角标同一口径）。别把 `xN` 写回 `timer.food.name` 存起来——旧做法删掉一份后，
  剩下的卡片还挂着「毛肚x2」的过期标签，且与角标读数对不上（`tests/e2e/timer.spec.ts` 那条断言就是守这个）。
- **只有发起方写盘**：`app.ts` 的 `watchExternalChanges` 在把别的标签页的状态水合进来时置 `applyingRemote`，
  订阅里据此跳过 `saveState`。删掉这个标记不会当场坏，但每次远程改动会在每个标签页多出几轮
  「storage 事件 → 水合 → 全量重建 → 写盘」（实测回环 4 次事件才靠「内容相同不触发事件」收敛）。

## 时间语义（别顺手「优化」掉）

- **双时钟**：会话内走 `performance.now()`（`ts.mono`），跨会话/重启走 `Date.now()`（`ts.wall`）。
  运行中条目锚在 mono 上，所以用户改系统时间不会让计时漂移——这是设计，不是 bug。
- `liveRemainingMs` 顶部那段「done 且无 mono 锚点 → 按墙钟续算」不能删：删了重启后超时时长会永久冻结在
  「时间到」，硬超时红色脉冲永不触发（曾经真发生过）。
- 超时阈值 `OVERTIME_HARD_MS`（10s）只在 `src/core/time.ts` 定义一次；渲染层只调
  `shouldPulseOvertime()` / `isMidpointDue()`，别把阈值和判定条件抄回 UI 层。

## 测试

- `tests/unit`（vitest）：必须用 `FakeClock`，禁止靠真实时间流逝或 `sleep` 通过。
- `tests/e2e`（Playwright）：用 `page.addInitScript()` 写 localStorage `hotpot-timer-state-v2`（`version: 3`）
  播种状态，别用 UI 点几十下。种子数据必须完全内联（`addInitScript` 会被序列化到浏览器执行）。
- 新行为先写**会红**的测试再实现；红-green 验证时临时改坏的源码要**全部**还原——
  `false &&` 这类改动会被 eslint `no-constant-condition` 抓到，正好用来查漏还原。
- `playwright.config.ts` 里 `retries: 1` 会掩盖 flake：一条测试偶发红，按真失败处理，别当噪声。
- `tests/unit/sw-precache.test.ts` 卡住离线清单：`public/` 下每个文件（`sw.js` 本身除外）必须在 `PRECACHE` 里，
  manifest 图标与 `index.html` 引用的本地资源也一样。少一项不是报错，是「在线好用、离线缺件」
  （`timer-worker.js` 缺了后台到点提醒会静默失效）。别为了让测试过而从清单里删文件。

## 设计规矩（深夜炭火 · 市井火锅风）

- **颜色只有一个来源**：`src/styles.css` 顶部 `:root` 的 `*-rgb` 三元组；命名色与透明色都由它派生。
  新写 `rgba(224, 74, 51, .4)` 这种硬编码就是破坏单一来源。改背景/主色时同步
  `index.html` 的 `theme-color` 与 `public/manifest.webmanifest` 的 `background_color` / `theme_color`
  （当前都取 `--bg-deep` = `#14100d`）。
- **字号只有 7 档**：`--fs-xs` 12 / `--fs-sm` 13 / `--fs-base` 15 / `--fs-lg` 17 / `--fs-xl` 22 /
  `--fs-2xl` 26 / `--fs-3xl` 30。小屏（≤481px）只允许降到阶梯里的下一档，不要出现新数值。
- **语义专用色**：`--doneness-rare-rgb`（偏生绿）只服务熟度药丸，`--overlay-rgb` 只服务弹层遮罩，别当主色用。
- **对比度下限**：正文 ≥ 7:1、次级 ≥ 4.5:1（当前实测 14.34:1 / 6.62:1）。
  纯 `--chili-red` 只能用于描边、大字、发光，不能当小字文字色（仅 3.99:1）。
- **动效与焦点**：任何新动效必须有 `prefers-reduced-motion` 降级；可交互元素必须有 `:focus-visible`。
- **强调克制**：一屏只留一处主强调；不要「倾情呈现」这类口号式装饰文案（页脚已删）。
- **emoji 当图标是有意取舍**（跨平台形状不一致，但零依赖、离线可用、与「市井」调性一致）——
  别顺手换成 icon font 或 SVG 图标集。
- **字体用系统栈是有意取舍**：CSP `style-src 'self'` + 离线 PWA，中文全量字体几 MB，得不偿失。
  要提升观感只能对数字/标题做 subset 自托管，先量体积再决定。

## 发布

- 会发布的改动：先本地 commit，**经用户确认再 push**（tag 同理）。
- 版本号同步处（三处，缺一处就是隐性 drift）：`package.json` 的 `version`（构建时注入页脚
  `import.meta.env.APP_VERSION`，见 `vite.config.ts`）、`public/manifest.webmanifest` 的 `version`（装机元信息）、
  `README.md` 的「更新记录」。
- tag：`vX.Y.Z`，打在实际发布线上那一次 commit。

## 已知取舍（不是待修的 bug）

- `overtime` 分布：113 项 `hard`（涮烫类，多煮即老 → 超时 10s 起红色脉冲）+ 53 项 `soft`
  （凡标了 `midpoint` 的久煨类，多煮更入味 → 超时不闪红）。要改标前先想清楚视觉反馈：
  `soft` 与未标注食材超时都不报警，只有 `hard` 报警。
- 到点确认面板（`.done-banner`，固定底部）与计时卡片信息重复：功能上是逐条「知道了」，暂不重构。
- `prefers-reduced-motion` 下，hard 超时的红色脉冲只剩**静态红字 + 发光**（不闪）。有意取舍：光敏优先，
  但报警不能整个降没——`tests/e2e/reminders.spec.ts` 里那条断言就是守这个（animation 关掉、红色仍在）。
  别再往降级块里加「连颜色一起砍」的规则。
- 页面被系统挂起时无法响铃，回到前台补报——纯前端的物理上限，见 README「平台限制」。
