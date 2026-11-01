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
- 版本号同步处：`package.json` 的 `version`（构建时注入页脚 `import.meta.env.APP_VERSION`，见 `vite.config.ts`）
  与 `README.md` 的「更新记录」。
- tag：`vX.Y.Z`，打在实际发布线上那一次 commit。

## 已知取舍（不是待修的 bug）

- `overtime` 分布：113 项 `hard`（涮烫类，多煮即老 → 超时 10s 起红色脉冲）+ 53 项 `soft`
  （凡标了 `midpoint` 的久煨类，多煮更入味 → 超时不闪红）。要改标前先想清楚视觉反馈：
  `soft` 与未标注食材超时都不报警，只有 `hard` 报警。
- 到点确认面板（`.done-banner`，固定底部）与计时卡片信息重复：功能上是逐条「知道了」，暂不重构。
- 页面被系统挂起时无法响铃，回到前台补报——纯前端的物理上限，见 README「平台限制」。
