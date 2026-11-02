/**
 * 离线清单守卫：public/ 下的每个文件（sw.js 本身除外）都必须进 PRECACHE，
 * manifest 与 index.html 引用的本地资源也必须能被离线命中。
 *
 * 背景：PRECACHE 是手写的。少一项的后果不是报错，而是「在线好用、离线缺件」——
 * 图标缺了只是难看，timer-worker.js 缺了后台到点提醒会静默失效。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const swSrc = readFileSync(join(root, 'public', 'sw.js'), 'utf8');
const htmlSrc = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'));

const listDecl = swSrc.match(/const PRECACHE = \[([\s\S]*?)\];/);
const precache: string[] = ((listDecl?.[1] ?? '').match(/'[^']*'/g) ?? []).map((s) =>
  s.slice(1, -1),
);

/** 清单条目对应的源文件：public/ 下的原样拷进 dist，index.html 在仓库根部，assets/ 是构建产物。 */
function sourceExists(entry: string): boolean {
  if (entry === './') return true;
  if (entry === './index.html') return existsSync(join(root, 'index.html'));
  if (entry.startsWith('./assets/')) return true;
  return existsSync(join(root, 'public', entry.slice(2)));
}

describe('Service Worker 离线清单', () => {
  it('PRECACHE 能被解析出来（改了写法就同步改这个测试）', () => {
    expect(listDecl, '找不到 const PRECACHE = [...]; 声明').not.toBeNull();
    expect(precache.length).toBeGreaterThan(5);
  });

  it('public/ 下除 sw.js 外的每个文件都已预缓存', () => {
    const missing = readdirSync(join(root, 'public'))
      .filter((f) => f !== 'sw.js')
      .filter((f) => !precache.includes(`./${f}`));
    expect(missing, `未预缓存：${missing.join(', ')}`).toEqual([]);
  });

  it('manifest 声明的每个图标都已预缓存', () => {
    const missing = manifest.icons
      .map((icon: { src: string }) => `./${icon.src}`)
      .filter((src: string) => !precache.includes(src));
    expect(missing, `manifest 图标未预缓存：${missing.join(', ')}`).toEqual([]);
  });

  it('index.html 引用的本地资源（构建产物除外）都已预缓存', () => {
    const refs = [...htmlSrc.matchAll(/(?:href|src)="\.\/([^"]+\.(?:png|webmanifest|js|css))"/g)]
      .map((m) => m[1] ?? '')
      // 入口 js/css 是构建产物，由下面那条固定文件名的断言覆盖
      .filter((ref) => ref !== '' && !ref.startsWith('assets/'));
    expect(refs.length, 'index.html 里没解析到任何本地资源引用').toBeGreaterThan(0);
    const missing = refs.filter((ref) => !precache.includes(`./${ref}`));
    expect(missing, `index.html 资源未预缓存：${missing.join(', ')}`).toEqual([]);
  });

  it('构建产物入口（固定文件名）在清单里，且清单里的条目都有对应源文件', () => {
    for (const entry of ['./index.html', './assets/index.js', './assets/index.css']) {
      expect(precache, `清单缺少 ${entry}`).toContain(entry);
    }
    const ghost = precache.filter((entry) => !sourceExists(entry));
    expect(ghost, `清单里有对不上的条目：${ghost.join(', ')}`).toEqual([]);
  });
});
