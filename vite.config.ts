import { defineConfig, type Plugin } from 'vitest/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 开发时移除严格 CSP meta：
 * 生产页面零内联脚本、零远程资源；但 Vite dev 的 HMR 依赖
 * ws:// WebSocket，会被 `connect-src 'self'` 拦截导致热更新失效。
 * 生产构建与 preview 不受影响（apply: 'serve' 只在 dev 生效）。
 */
function stripCspInDev(): Plugin {
  return {
    name: 'strip-csp-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/g, '');
    },
  };
}

/**
 * 构建后在 dist/sw.js 注入 BUILD_ID（应用代码内容哈希）。
 *
 * 背景：资源文件名固定 + SW 对静态资源 cache-first，意味着
 * "只改应用代码、sw.js 本身没变"的部署不会触发浏览器 SW 更新，
 * 已安装用户会被锁在旧版本。把代码哈希写进 sw.js 后，
 * 每次代码变化都会改变 SW 内容 -> updatefound -> "发现新版本"提示；
 * 哈希相同（仅文案/构建元数据变化）则不产生虚假的更新提示。
 */
function stampSwBuildId(): Plugin {
  return {
    name: 'stamp-sw-build-id',
    apply: 'build',
    closeBundle() {
      try {
        const swPath = join('dist', 'sw.js');
        const sw = readFileSync(swPath, 'utf8');
        const js = readFileSync(join('dist', 'assets', 'index.js'), 'utf8');
        const css = readFileSync(join('dist', 'assets', 'index.css'), 'utf8');
        const id = createHash('sha256').update(js).update(css).digest('hex').slice(0, 16);
        if (sw.includes('const BUILD_ID')) {
          writeFileSync(
            swPath,
            sw.replace(/const BUILD_ID = '[^']*';/, `const BUILD_ID = '${id}';`),
            'utf8',
          );
        } else {
          writeFileSync(
            swPath,
            sw.replace(
              'const CACHE',
              `const BUILD_ID = '${id}'; // 应用代码哈希：内容变化即触发 SW 更新\nconst CACHE`,
            ),
            'utf8',
          );
        }
      } catch {
        /* 非标准产物布局时跳过（本项目布局固定，正常不会发生） */
      }
    },
  };
}

// 固定产物文件名（不带内容 hash）：Service Worker 的预缓存清单才能静态化。
// 版本更新靠 sw.js 内容变化触发浏览器更新流程（见 stampSwBuildId）。
export default defineConfig({
  base: './',
  plugins: [stripCspInDev(), stampSwBuildId()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
