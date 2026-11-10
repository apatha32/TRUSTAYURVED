/**
 * Site-wide falling leaves — one fixed canvas behind all content.
 *
 *  - Neem + tulsi sprites, pre-rendered once (3 depths, far ones blurred).
 *  - Leaves fall from the banyan's branch tips (anchors baked into the SVG)
 *    and a light breeze carries them leftwards. They dim while crossing the
 *    text column so they never compete with reading.
 *  - A light parallax with scroll (near leaves move more than far ones).
 *  - Continuity: leaf positions are handed across page navigations via
 *    sessionStorage, so the breeze doesn't restart on every page.
 *  - Paused in hidden tabs, capped at 60fps, never runs under reduced motion.
 */
import { NEEM, TULSI, NEEM_VEIN, TULSI_VEIN } from '../lib/motifs';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const FRAME = 1000 / 60;
const KEY = 'sac-leaves';

type Leaf = { s: number; d: number; x: number; y: number; vx: number; sway: number; phase: number; speed: number; rot: number; spin: number; size: number };

const yieldTask = () => new Promise<void>((r) => {
  const sch = (globalThis as any).scheduler;
  if (sch?.yield) sch.yield().then(r); else setTimeout(r, 0);
});

export async function startLeaves() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-leaves]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || reduce.matches) return;

  const narrow = matchMedia('(max-width: 48rem)');
  const lowPower = narrow.matches || (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as any).deviceMemory ?? 8) <= 4 || (navigator as any).connection?.saveData === true;
  const count = lowPower ? 4 : 7;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue('--accent').trim(), css.getPropertyValue('--brass').trim()];
  const veinColor = css.getPropertyValue('--surface').trim();

  /* sprites[depth][shape*2 + colour] */
  const sprites: HTMLCanvasElement[][] = [[], [], []];
  const shapes = [[NEEM, NEEM_VEIN], [TULSI, TULSI_VEIN]] as const;
  const alpha = [0.38, 0.52, 0.66];
  for (let depth = 0; depth < 3; depth++) {
    await yieldTask();
    for (const [path, vein] of shapes) for (const color of colors) {
      const size = 64, c = document.createElement('canvas');
      c.width = c.height = size * dpr;
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      g.translate(size / 2, size / 2);
      g.scale(0.5, 0.5);
      if (depth === 0) g.filter = 'blur(2.5px)'; else if (depth === 1) g.filter = 'blur(0.8px)';
      g.globalAlpha = alpha[depth];
      g.fillStyle = color;
      g.fill(new Path2D(path));
      g.globalAlpha *= 0.5;
      g.strokeStyle = veinColor;
      g.lineWidth = 1.6;
      g.stroke(new Path2D(vein));
      sprites[depth].push(c);
    }
  }

  let W = 0, H = 0;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  /* Where the leaves come from: the banyan's branch tips, mapped to the viewport. */
  const tree = document.querySelector<SVGSVGElement>('.banyan');
  const anchorsBox: [number, number][] = JSON.parse(tree?.dataset.anchors || '[]');
  const source = () => {
    if (!tree || !anchorsBox.length) return { x: rand(0.6, 1.02), y: rand(-0.2, -0.05) };
    const r = tree.getBoundingClientRect(), k = r.width / 1000;
    const [ax, ay] = anchorsBox[(Math.random() * anchorsBox.length) | 0];
    return { x: (r.left + ax * k + rand(-14, 14)) / W, y: (r.top + ay * k + rand(-6, 10)) / H };
  };
  const spawn = (initial: boolean): Leaf => {
    const d = Math.random() < 0.35 ? 0 : Math.random() < 0.6 ? 1 : 2;
    const z = [0.55, 0.8, 1][d];
    const from = source();
    const speed = 1 / (rand(16, 26) / z);
    const vx = -rand(0.004, 0.022) * z;                          // breeze, fraction of width per second
    const t = initial ? rand(0, 1 / speed) : 0;                  // first load: leaves already mid-fall
    return {
      s: (Math.random() * 4) | 0, d,
      x: from.x + vx * t, y: from.y + speed * t, vx,
      sway: rand(16, 40) * z, phase: rand(0, Math.PI * 2),
      speed, rot: rand(0, Math.PI * 2), spin: rand(-0.35, 0.35),
      size: rand(52, 84) * z * (narrow.matches ? 0.8 : 1),
    };
  };
  /** Dim leaves over the text column (max 1200px, centred) so reading always wins. */
  const columnFade = (px: number) => {
    if (narrow.matches) return 0.55;
    const half = Math.min(600, W / 2 - 24), c = W / 2;
    const dist = Math.abs(px - c) - half;            // < 0 inside the column
    return dist > 60 ? 1 : dist < -60 ? 0.45 : 0.45 + (0.55 * (dist + 60)) / 120;
  };

  // Pick up the breeze where the previous page left it.
  let leaves: Leaf[] = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && Date.now() - saved.t < 8000 && Array.isArray(saved.l)) leaves = saved.l.filter((l: Leaf) => typeof l.vx === 'number').slice(0, count);
  } catch { /* storage unavailable */ }
  while (leaves.length < count) leaves.push(spawn(true));
  addEventListener('pagehide', () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), l: leaves })); } catch { /* ignore */ }
  });

  // Scroll parallax: leaves are nudged against the scroll, scaled by depth.
  let lastScroll = scrollY, scrollDelta = 0;
  addEventListener('scroll', () => { scrollDelta += scrollY - lastScroll; lastScroll = scrollY; }, { passive: true });

  let running = false, raf = 0, last = 0, prev = 0;
  const frame = (ts: number) => {
    raf = requestAnimationFrame(frame);
    if (ts - last < FRAME - 1) return;
    const dt = Math.min(0.05, prev ? (ts - prev) / 1000 : 0.016);
    prev = ts; last = ts;
    const push = Math.max(-40, Math.min(40, scrollDelta)); scrollDelta = 0;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      const z = [0.55, 0.8, 1][l.d];
      l.y += l.speed * dt * (1 + 0.15 * Math.sin(ts / 1700 + l.phase)) - (push * 0.12 * z) / H;
      l.x += l.vx * dt * (1 + 0.4 * Math.sin(ts / 2300 + l.phase)); // gusts
      l.phase += dt * 0.55;
      l.rot += l.spin * dt + Math.cos(l.phase) * 0.004;
      if (l.y > 1.12 || l.y < -0.4 || l.x < -0.1) { leaves[i] = spawn(false); continue; }
      const px = l.x * W + Math.sin(l.phase) * l.sway;
      ctx.globalAlpha = columnFade(px) * Math.min(1, (l.y + 0.05) * 6); // also fade in as it leaves the branch
      ctx.save();
      ctx.translate(px, l.y * H);
      ctx.rotate(l.rot);
      ctx.scale(1, 0.75 + 0.25 * Math.cos(l.phase * 1.3));
      ctx.drawImage(sprites[l.d][l.s], -l.size / 2, -l.size / 2, l.size, l.size);
      ctx.restore();
    }
  };
  const set = (on: boolean) => {
    if (on === running) return;
    running = on;
    if (on) { prev = 0; raf = requestAnimationFrame(frame); canvas.classList.add('is-live'); }
    else cancelAnimationFrame(raf);
  };
  const update = () => set(!document.hidden && !reduce.matches);
  document.addEventListener('visibilitychange', update);
  reduce.addEventListener('change', () => { update(); if (reduce.matches) ctx.clearRect(0, 0, W, H); });
  update();
}
