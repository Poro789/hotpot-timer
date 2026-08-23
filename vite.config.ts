import { defineConfig } from 'vitest/config';

// 固定产物文件名（不带内容 hash）：Service Worker 的预缓存清单才能静态化。
// 版本更新靠 sw.js 内容变化触发浏览器更新流程。
export default defineConfig({
  base: './',
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
