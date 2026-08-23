/**
 * 生成 PWA 图标（零依赖：手写最小 PNG 编码器 + zlib）。
 * 设计：炭黑夜底 + 俯视铜锅（红油/牛油双圈），maskable 版内容缩进安全区。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ---------- 最小 PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 绘制（2x 超采样抗锯齿） ----------
const BG = [0x14, 0x10, 0x0d];
const POT_OUTER = [0xe0, 0x4a, 0x33]; // 红油
const POT_INNER = [0xf2, 0xa9, 0x3b]; // 牛油金

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size, scaleContent) {
  const superSize = size * 2;
  const out = Buffer.alloc(size * size * 4);
  // 内容坐标按 scaleContent 收缩到安全区（maskable 传 0.75）
  const s = scaleContent;
  const map = (v) => 0.5 + (v - 0.5) * s;
  const cx = 0.5;
  const cy = 0.52;
  const rOuter = 0.3;
  const rInner = 0.195;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const fx = (x * 2 + dx) / superSize;
          const fy = (y * 2 + dy) / superSize;
          let c;
          if (inCircle(map(fx), map(fy), map(cx), map(cy), rOuter * s)) {
            c = POT_OUTER;
            if (inCircle(map(fx), map(fy), map(cx), map(cy), rInner * s)) c = POT_INNER;
          } else {
            c = BG;
          }
          rr += c[0];
          gg += c[1];
          bb += c[2];
        }
      }
      const i = (y * size + x) * 4;
      out[i] = Math.round(rr / 4);
      out[i + 1] = Math.round(gg / 4);
      out[i + 2] = Math.round(bb / 4);
      out[i + 3] = 255;
    }
  }
  return out;
}

const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.75],
  ['apple-touch-icon.png', 180, 0.95],
];

for (const [name, size, scale] of targets) {
  const png = encodePng(size, render(size, scale));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`✓ public/${name} (${size}x${size})`);
}
