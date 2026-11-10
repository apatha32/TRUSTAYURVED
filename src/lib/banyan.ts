/**
 * A procedurally drawn banyan (vaṭa) — deterministic, so the SVG rendered at
 * build time and the leaf canvas at runtime agree on where the canopy is.
 *
 * Banyan character: a massive trunk out of frame, long near-horizontal limbs,
 * broad ovate leaves in dense clusters, and aerial prop roots hanging down.
 * Coordinates live in a 1000 × 640 box anchored to the top-right of the viewport.
 */
export const BOX = { w: 1000, h: 640 };

type Pt = { x: number; y: number };
export type Banyan = {
  limbs: { d: string; w: number }[];       // bark, thick → thin
  leaves: { back: string; mid: string; front: string; sun: string };
  roots: { d: string; w: number; group: number }[];
  anchors: Pt[];                            // leaf-drop points (box units)
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Ellipse as a path using the arc's x-axis rotation (one path, many leaves). */
function leaf(c: Pt, rx: number, ry: number, deg: number) {
  const t = (deg * Math.PI) / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t);
  const f = (n: number) => n.toFixed(1);
  return `M${f(c.x - dx)} ${f(c.y - dy)}A${f(rx)} ${f(ry)} ${deg.toFixed(0)} 1 0 ${f(c.x + dx)} ${f(c.y + dy)}A${f(rx)} ${f(ry)} ${deg.toFixed(0)} 1 0 ${f(c.x - dx)} ${f(c.y - dy)}Z`;
}

export function banyan(seed = 7): Banyan {
  const r = rng(seed);
  const limbs: Banyan['limbs'] = [];
  const tips: { p: Pt; depth: number }[] = [];
  const rootSpots: Pt[] = [];

  const grow = (p: Pt, angle: number, len: number, width: number, depth: number) => {
    // gentle droop: banyan limbs run long and sag slightly before lifting
    const sag = (r() - 0.35) * len * 0.22;
    const end: Pt = { x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len };
    const mid: Pt = { x: (p.x + end.x) / 2 - Math.sin(angle) * sag, y: (p.y + end.y) / 2 + Math.cos(angle) * sag };
    limbs.push({ d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${mid.x.toFixed(1)} ${mid.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`, w: width });
    if (depth <= 2 && width > 3) for (let k = 0; k < 2; k++) {
      const t = 0.3 + r() * 0.6;
      rootSpots.push({ x: p.x + (end.x - p.x) * t, y: p.y + (end.y - p.y) * t + sag * 0.4 + width * 0.3 });
    }
    if (depth >= 4 || width < 2) { tips.push({ p: end, depth }); return; }
    const kids = depth === 0 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      // banyan limbs stay near-horizontal: clamp between slightly up-left and slightly down-left
      const spread = (k - (kids - 1) / 2) * (0.34 + r() * 0.16) + (r() - 0.55) * 0.2;
      const a = Math.min(Math.PI + 0.32, Math.max(Math.PI - 0.42, angle + spread));
      grow(end, a, len * (0.6 + r() * 0.14), width * 0.6, depth + 1);
    }
    if (depth >= 2) tips.push({ p: end, depth });
  };

  // Trunk sits off-frame to the right; three great limbs reach into the light.
  const origin: Pt = { x: 1070, y: 170 };
  grow(origin, Math.PI + 0.08, 330, 30, 0);              // the long reaching limb
  grow({ x: 1060, y: 120 }, Math.PI - 0.22, 240, 24, 0); // rising limb
  grow({ x: 1070, y: 250 }, Math.PI + 0.3, 170, 22, 1);  // lower, drooping limb

  // Leaves: dense ovate clusters around tips, split into depth layers.
  const L = { back: [] as string[], mid: [] as string[], front: [] as string[], sun: [] as string[] };
  const anchors: Pt[] = [];
  for (const { p, depth } of tips) {
    // flat, umbrella-like clusters sitting on top of the limbs
    const n = 8 + Math.floor(r() * 6);
    const spread = 30 + (4 - Math.min(depth, 4)) * 8;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
      const c = { x: p.x + Math.cos(a) * d, y: p.y - 10 + Math.sin(a) * d * 0.42 };
      if (c.y < -20 || c.x < -20) continue;
      const size = 7 + r() * 6;
      const path = leaf(c, size, size * 0.58, r() * 180);
      const layer = r();
      // sunlit leaves cluster on the upper-right side, nearest the sun
      if (c.y < 180 && c.x > 560 && layer < 0.32) L.sun.push(path);
      else if (layer < 0.34) L.back.push(path);
      else if (layer < 0.72) L.mid.push(path);
      else L.front.push(path);
    }
    if (r() < 0.8) anchors.push(p);
  }

  // Aerial roots: hanging from the limbs, slightly sinuous, in three sway groups.
  const roots: Banyan['roots'] = rootSpots
    .filter((s) => s.x > 140 && s.x < 990)
    .map((s, i) => {
      const len = 70 + r() * 220, wob = (r() - 0.5) * 16;
      const e = { x: s.x + wob * 0.6, y: Math.min(BOX.h - 4, s.y + len) };
      return {
        d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)}C${(s.x + wob).toFixed(1)} ${(s.y + len * 0.35).toFixed(1)} ${(s.x - wob).toFixed(1)} ${(s.y + len * 0.7).toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,
        w: 0.8 + r() * 1.8,
        group: i % 3,
      };
    });

  return {
    limbs: limbs.sort((a, b) => b.w - a.w),
    leaves: { back: L.back.join(''), mid: L.mid.join(''), front: L.front.join(''), sun: L.sun.join('') },
    roots,
    anchors: anchors.filter((a) => a.x > 0 && a.y > 0 && a.y < BOX.h),
  };
}
