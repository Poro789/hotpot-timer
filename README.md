# 🍲 川渝火锅涮煮计时器

> 点一下食材，到点必响。为围锅吃饭设计的涮煮计时器 —— 手机放桌边，锅里的事不用盯。

**在线地址：<https://poro789.github.io/hotpot-timer/>**（手机浏览器可"添加到主屏幕"，离线可用）

## 功能

- 🥘 112 道常见食材（肉类 / 海鲜 / 蔬菜 / 豆制品 / 丸滑 / 经典火锅菜），内置参考时长与熟成提示，点一下即开计时
- ⏱️ 多食材并行：一锅一屏互不干扰，同名食材按份数角标合并
- ⭐ 自定义食材 + 15s/30s/1min/5min 快捷档（可命名，自动记住）
- 🔔 **到点必响**：声音 + 屏幕提醒（声音开关有即时反馈与试听，音量条紧随其后）；切后台/锁屏回来对漏报条目**立即补报**，不丢任何一口
- 🥇 到点条目**自动置顶**，卡片大字显示"时间到"，最紧急的永远在最上面
- 💾 刷新、关页、换标签，进行中的计时自动续算（双时钟：墙钟持久 + 单调钟抗改时）
- 📱 可安装（PWA）：离线可用、独立窗口、桌面图标；**守锅模式**整页全屏只留计时、列表可滚动、到点提醒照常弹出
- ♿ 键盘全程可达、到点语音播报、尊重"减少动态效果"系统设置

## 本地开发

```bash
npm install
npm run dev        # 开发服务器
```

质量门禁：

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit（strict + noUncheckedIndexedAccess）
npm test           # 单元测试（Vitest：时间/告警/状态/迁移/目录）
npm run test:e2e   # Playwright：冒烟 / PWA 离线 / 无障碍 / 关键路径
npm run data:check # CSV 与生成物一致性校验
```

## 架构

```
src/
├── core/       纯逻辑，零 DOM 依赖，可独立单测
│   ├── types.ts       数据模型（v3 持久化格式）
│   ├── time.ts        双时钟：endAt 墙钟（跨会话）+ 单调钟锚点（会话内抗系统时间变更）
│   ├── alarm.ts       到期队列：合并报警、60s 封顶、确认后静默
│   ├── store.ts       单一状态源：添加/切换/删除/自定义食材
│   └── catalog.ts     食材目录（生成物，见下）
├── platform/   平台适配（浏览器 API 只出现在这一层）
│   ├── storage.ts     v2→v3 迁移链 + 结构校验 + Web Locks 防写冲突 + 跨标签同步
│   ├── scheduler.ts   单调度器：前台 rAF / 后台 Worker 定时器（setTimeout 兜底）
│   └── audio/haptics/notify/wakelock
└── ui/         渲染与交互（单向数据流：store -> view）
```

**数据管线**：食材数据以 `data/food_catalog.csv` 为唯一事实来源，
`scripts/data-gen.mjs` 校验（表头 / 唯一名 / 正整数秒 / 分类枚举）后生成 `src/core/catalog.ts`。
改食材：编辑 CSV → `npm run data:gen`；CI 用 `npm run data:check` 卡住不同步的提交。

## 工程约定

- **确定性构建**：产物文件名固定 + 相对 base，Service Worker 预缓存清单为静态列表，可部署在 Pages 子路径；
  构建时把应用代码哈希注入 `sw.js`（BUILD_ID），代码一变化就触发浏览器"发现新版本"提示，不会把老用户锁在旧缓存里
- **严格 CSP**：`default-src 'self'`，无内联脚本、无远程资源
- **PWA**：手写 Service Worker（导航 network-first / 资源 cache-first），版本更新经用户确认才切换，不打断计时
- **无障碍**：焦点陷阱、Enter/Space 触发、`aria-live` 播报、`prefers-reduced-motion` 降级、允许缩放
- **持久化演进**：同 key 内容带 version（v2→v3 自动迁移），更高版本存档不降级
- 单测锁住行为红线：派生份数角标、同名不同时长共存、离开期间到点补报、改系统时间不漂移

## 平台限制（已知且有意为之）

页面被系统挂起时（如 iOS 锁屏），JS 无法运行，**挂起期间不能响铃**；
回到前台时对漏报条目立即补报（声音 + 面板 + 播报）。纯前端方案的物理上限，
在"围锅社交、手机就在桌上"的定位下可接受。

## 许可

未附 LICENSE 文件 —— 默认保留所有权利，仅供个人使用与展示。
