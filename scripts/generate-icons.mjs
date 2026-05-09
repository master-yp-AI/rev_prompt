import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

const sizes = [16, 48, 128];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 128; // scale factor

  // Background — rounded rect with subtle blue gradient
  const r = 28 * s;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(128 * s - r, 0);
  ctx.arcTo(128 * s, 0, 128 * s, r, r);
  ctx.lineTo(128 * s, 128 * s - r);
  ctx.arcTo(128 * s, 128 * s, 128 * s - r, 128 * s, r);
  ctx.lineTo(r, 128 * s);
  ctx.arcTo(0, 128 * s, 0, 128 * s - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#f5f5f7');
  grad.addColorStop(1, '#e8e8ed');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle inner border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // ── Image frame (representing the photo being analyzed) ──
  const fx = 24 * s, fy = 28 * s, fw = 56 * s, fh = 48 * s;
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 4 * s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // outer frame
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, 6 * s);
  ctx.stroke();
  // inner mountain shape
  ctx.beginPath();
  ctx.moveTo(fx + 6 * s, fy + fh - 8 * s);
  ctx.lineTo(fx + fw * 0.35, fy + fh * 0.4);
  ctx.lineTo(fx + fw * 0.55, fy + fh * 0.65);
  ctx.lineTo(fx + fw - 6 * s, fy + fh * 0.3);
  ctx.lineTo(fx + fw - 6 * s, fy + fh - 8 * s);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 122, 255, 0.12)';
  ctx.fill();
  // sun
  ctx.beginPath();
  ctx.arc(fx + fw * 0.72, fy + fh * 0.28, 4 * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 122, 255, 0.2)';
  ctx.fill();

  // ── Reverse arrow (circular arrow, top-right of frame) ──
  const ax = 72 * s, ay = 32 * s, ar = 22 * s;
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, -Math.PI * 0.1, Math.PI * 1.5);
  ctx.stroke();
  // arrowhead
  const aex = ax + ar * Math.cos(Math.PI * 1.5);
  const aey = ay + ar * Math.sin(Math.PI * 1.5);
  ctx.beginPath();
  ctx.moveTo(aex - 6 * s, aey - 3 * s);
  ctx.lineTo(aex, aey + 5 * s);
  ctx.lineTo(aex + 6 * s, aey - 3 * s);
  ctx.fillStyle = '#007AFF';
  ctx.fill();

  // ── Prompt text lines (bottom, representing the output) ──
  const lx = 24 * s, ly = 90 * s;
  ctx.strokeStyle = 'rgba(0, 122, 255, 0.35)';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  // line 1
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + 52 * s, ly);
  ctx.stroke();
  // line 2
  ctx.beginPath();
  ctx.moveTo(lx, ly + 10 * s);
  ctx.lineTo(lx + 38 * s, ly + 10 * s);
  ctx.stroke();
  // line 3
  ctx.beginPath();
  ctx.moveTo(lx, ly + 20 * s);
  ctx.lineTo(lx + 46 * s, ly + 20 * s);
  ctx.stroke();

  return canvas;
}

for (const size of sizes) {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const outPath = join(iconsDir, `icon${size}.png`);
  writeFileSync(outPath, buffer);
  console.log(`✅ icon${size}.png (${buffer.length} bytes)`);
}
