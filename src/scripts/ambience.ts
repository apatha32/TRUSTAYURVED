/**
 * Homepage ambience — one layered scene, lazy-started after first paint.
 *
 *  1. Shirodhara drop: a translucent drop falls from the brass vessel every
 *     ~6s onto still water; 2–3 concentric ripples spread and fade over 2.5s,
 *     displacing the photo beneath (WebGL; SVG ring fallback).
 *     The GL loop only runs while a ripple is alive — idle cost is zero.
 *  (Falling leaves and golden light are site-wide: see leaves.ts and Sky.astro.)
 *  3. Optional ambient sound (generated rain + drips, Web Audio). Off by default.
 *
 * Paused when offscreen or the tab is hidden. Capped at 60fps. Half the
 * particles on small/low-power devices. Never runs under reduced motion.
 */

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const lowPower =
  matchMedia('(max-width: 48rem)').matches ||
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  ((navigator as any).deviceMemory ?? 8) <= 4 ||
  (navigator as any).connection?.saveData === true;

const FRAME = 1000 / 60;
const DROP_EVERY = 6000;
const RIPPLE_LIFE = 2.5;

/** Yield to the main thread between init steps so no single task blocks input. */
const yieldTask = () => new Promise<void>((r) => {
  const sch = (globalThis as any).scheduler;
  if (sch?.yield) sch.yield().then(r); else setTimeout(r, 0);
});

export async function start() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;
  setupSound(hero);
  if (reduce.matches) return; // still frame is pure CSS
  await yieldTask();
  const pool = createPool(hero);

  let visible = true;
  const update = () => {
    const run = visible && !document.hidden && !reduce.matches;
    hero.classList.toggle('is-paused', !run);
    pool?.setRunning(run);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }, { threshold: 0.02 }).observe(hero);
  document.addEventListener('visibilitychange', update);
  reduce.addEventListener('change', update);
  update();
}

/* =========================================================================
   1. The pool
   ========================================================================= */
const VERT = `
attribute vec2 a;
varying vec2 v;
void main(){ v = a * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D u_tex;
uniform vec2 u_scale;     // cover-fit
uniform vec2 u_offset;
uniform float u_aspect;   // canvas w/h
uniform float u_time;
uniform vec3 u_r[3];      // x, y, start
uniform vec3 u_water;
void main(){
  vec2 p = v;
  vec2 disp = vec2(0.0);
  float hl = 0.0;
  for (int i = 0; i < 3; i++) {
    float age = u_time - u_r[i].z;
    if (age < 0.0 || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
    vec2 d = (p - u_r[i].xy) * vec2(u_aspect, 1.0);
    float dist = length(d);
    float radius = age * 0.21;
    float x = dist - radius;
    float life = 1.0 - age / ${RIPPLE_LIFE.toFixed(1)};
    float env = exp(-x * x * 260.0) * life * life;          // wave packet
    float wave = sin(x * 95.0) * env;                        // 2–3 visible crests
    disp += (d / max(dist, 1e-4)) * wave * 0.014 / vec2(u_aspect, 1.0);
    hl += max(wave, 0.0) * 0.8 * smoothstep(0.0, 0.05, dist);
  }
  vec2 uv = (p + disp) * u_scale + u_offset;
  vec3 c = texture2D(u_tex, uv).rgb;
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(g), c, 0.55);                                 // match CSS grade (saturate .55)
  c = (c - 0.5) * 0.94 + 0.5 + 0.015;
  c = mix(c, u_water, hl * 0.6) + hl * 0.12;
  gl_FragColor = vec4(c, 1.0);
}`;

function createPool(hero: HTMLElement) {
  const pool = hero.querySelector<HTMLElement>('[data-pool]');
  const basin = hero.querySelector<HTMLElement>('[data-basin]');
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-ripple-canvas]');
  const img = basin?.querySelector('img');
  const drop = hero.querySelector<SVGElement>('[data-drop]');
  const vessel = hero.querySelector<HTMLElement>('.pool__vessel');
  if (!pool || !basin || !canvas || !img || !drop || !vessel) return null;

  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
  const ripples: [number, number, number][] = [[0, 0, -99], [0, 0, -99], [0, 0, -99]];
  let next = 0;
  let running = false;
  let dropTimer: number | undefined;
  let raf = 0, last = 0;
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  let draw: (() => void) | null = null;

  if (gl) {
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n: string) => gl.getUniformLocation(prog, n);
      const uScale = U('u_scale'), uOffset = U('u_offset'), uAspect = U('u_aspect'), uTime = U('u_time'), uR = U('u_r'), uWater = U('u_water');
      const tex = gl.createTexture();
      let ready = false;

      const water = getComputedStyle(document.documentElement).getPropertyValue('--water').trim() || '#6E9E9B';
      const hex = water.replace('#', '');
      gl.uniform3f(uWater, parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);

      const resize = () => {
        const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 1.75);
        const w = Math.round(basin.clientWidth * dpr), h = Math.round(basin.clientHeight * dpr);
        if (!w || !h) return;
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
        const ca = w / h, ia = img.naturalWidth / img.naturalHeight;
        // object-fit: cover with object-position 62% 50% (matches the <img>)
        let sx = 1, sy = 1;
        if (ia > ca) sx = ca / ia; else sy = ia / ca;
        gl.uniform2f(uScale, sx, sy);
        gl.uniform2f(uOffset, (1 - sx) * 0.62, (1 - sy) * 0.5);
        gl.uniform1f(uAspect, ca);
        if (ready) draw!();
      };
      const upload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        ready = true;
        resize();
        draw!();
        pool.classList.add('is-live');
      };
      draw = () => {
        gl.uniform1f(uTime, now());
        gl.uniform3fv(uR, ripples.flat());
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      (img.complete && img.naturalWidth ? Promise.resolve() : img.decode()).then(yieldTask).then(upload).catch(() => { draw = null; });
      new ResizeObserver(resize).observe(basin);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); draw = null; pool.classList.remove('is-live'); });
    }
  }

  /* Animate GL only while a ripple is alive. */
  const alive = () => ripples.some((r) => now() - r[2] < RIPPLE_LIFE);
  const loop = (ts: number) => {
    raf = 0;
    if (!running || !draw) return;
    if (ts - last >= FRAME - 1) { last = ts; draw(); }
    if (alive()) raf = requestAnimationFrame(loop);
    else draw(); // settle to perfectly still water
  };

  /* SVG ring fallback when WebGL is unavailable. */
  const rings = hero.querySelector<HTMLElement>('[data-rings]');
  const svgRipple = (x: number, y: number) => {
    if (!rings) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;inset:0;overflow:visible';
    for (let i = 0; i < 3; i++) {
      const e = document.createElementNS(NS, 'ellipse');
      e.setAttribute('cx', String(x * 100)); e.setAttribute('cy', String(y * 100));
      e.setAttribute('rx', '2'); e.setAttribute('ry', '1.2');
      e.setAttribute('fill', 'none'); e.setAttribute('stroke', 'white'); e.setAttribute('stroke-width', '0.35');
      e.style.transformOrigin = `${x * 100}px ${y * 100}px`;
      e.style.transformBox = 'view-box';
      svg.append(e);
      e.animate([{ transform: 'scale(1)', opacity: 0.8 }, { transform: 'scale(14)', opacity: 0 }], { duration: RIPPLE_LIFE * 1000, delay: i * 260, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' });
    }
    rings.append(svg);
    setTimeout(() => svg.remove(), RIPPLE_LIFE * 1000 + 800);
  };

  /* The drop: falls from the vessel spout to the water's centre. */
  const fall = () => {
    if (!running) return;
    const pr = pool.getBoundingClientRect();
    const vr = vessel.getBoundingClientRect();
    const br = basin.getBoundingClientRect();
    const startY = vr.bottom - pr.top - 6;
    const landX = 0.5, landY = 0.5;
    const endY = br.top - pr.top + br.height * landY - 10;
    drop.style.top = '0px';
    const anim = drop.animate(
      [
        { transform: `translateY(${startY - 10}px) scale(0.3, 0.2)`, opacity: 0 },
        { transform: `translateY(${startY}px) scale(0.75, 0.85)`, opacity: 0.95, offset: 0.28 }, // gathering at the spout
        { transform: `translateY(${startY + 4}px) scale(0.85, 1.05)`, opacity: 1, offset: 0.42 },
        { transform: `translateY(${endY}px) scale(0.8, 1.25)`, opacity: 0.9, easing: 'ease-out', offset: 0.97 },
        { transform: `translateY(${endY + 6}px) scale(1.4, 0.3)`, opacity: 0 },
      ],
      { duration: 2100, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
    );
    anim.onfinish = () => {
      const t = now();
      ripples[next] = [landX, landY, t];
      next = (next + 1) % 3;
      if (draw) { if (!raf) raf = requestAnimationFrame(loop); }
      else svgRipple(landX, landY);
      sound?.drip();
    };
  };

  const setRunning = (on: boolean) => {
    if (on === running) return;
    running = on;
    clearInterval(dropTimer);
    if (on) {
      fall();
      dropTimer = window.setInterval(fall, DROP_EVERY);
      if (draw && alive() && !raf) raf = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(raf); raf = 0;
      drop.getAnimations().forEach((a) => a.cancel());
    }
  };
  return { setRunning };
}

/* =========================================================================
   3. Optional ambient sound — generated, never autoplays
   ========================================================================= */
let sound: { drip: () => void } | null = null;

function setupSound(hero: HTMLElement) {
  const btn = hero.querySelector<HTMLButtonElement>('[data-sound]');
  if (!btn || !('AudioContext' in window)) return;
  btn.style.visibility = '';
  btn.removeAttribute('tabindex');
  btn.removeAttribute('aria-hidden');
  let ac: AudioContext | null = null, master: GainNode | null = null;

  const build = () => {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    // Soft rain: brown noise → band-limited
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; lastOut = (lastOut + 0.02 * white) / 1.02; d[i] = lastOut * 3.2; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const g = ac.createGain(); g.gain.value = 0.5;
    src.connect(hp).connect(lp).connect(g).connect(master);
    src.start();
  };

  sound = {
    drip() {
      if (!ac || !master || btn.getAttribute('aria-pressed') !== 'true') return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1150, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.5);
    },
  };

  btn.addEventListener('click', async () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    if (on && !ac) build();
    if (!ac || !master) return;
    if (on) await ac.resume();
    master.gain.setTargetAtTime(on ? 0.22 : 0, ac.currentTime, 0.6);
    if (!on) setTimeout(() => btn.getAttribute('aria-pressed') !== 'true' && ac?.suspend(), 2500);
  });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else if (btn.getAttribute('aria-pressed') === 'true') ac.resume();
  });
}
