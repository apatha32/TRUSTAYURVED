/* UI behaviour. Everything degrades to working HTML without JS. */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel as any) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel as any)) as T[];

/* ---- Header: frosted once scrolled ------------------------------------- */
const header = $('[data-header]');
if (header) {
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:8px;width:1px;pointer-events:none';
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
}

/* ---- Desktop dropdowns -------------------------------------------------- */
const dropdowns = $$('[data-dropdown]');
function closeAll(except?: Element) {
  for (const d of dropdowns) {
    if (d === except) continue;
    $('button', d)?.setAttribute('aria-expanded', 'false');
    $('.nav__menu', d)?.classList.remove('is-open');
  }
}
for (const d of dropdowns) {
  const btn = $<HTMLButtonElement>('button', d)!;
  const menu = $('.nav__menu', d)!;
  const set = (open: boolean) => { btn.setAttribute('aria-expanded', String(open)); menu.classList.toggle('is-open', open); };
  btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') !== 'true'; closeAll(d); set(open); });
  d.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
    if ((e as KeyboardEvent).key === 'ArrowDown' && document.activeElement === btn) { e.preventDefault(); set(true); $<HTMLAnchorElement>('a', menu)?.focus(); }
  });
  d.addEventListener('focusout', (e) => { if (!d.contains((e as FocusEvent).relatedTarget as Node)) set(false); });
  // Pointer users: open on hover with a small intent delay.
  let t: number | undefined;
  d.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType === 'mouse') { clearTimeout(t); t = window.setTimeout(() => { closeAll(d); set(true); }, 90); } });
  d.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType === 'mouse') { clearTimeout(t); t = window.setTimeout(() => set(false), 220); } });
}
document.addEventListener('click', (e) => { if (!(e.target as Element).closest('[data-dropdown]')) closeAll(); });

/* ---- Full-screen mobile menu ------------------------------------------- */
const menu = $('[data-menu]');
const openBtn = $<HTMLButtonElement>('[data-menu-open]');
if (menu && openBtn) {
  const closeBtn = $<HTMLButtonElement>('[data-menu-close]', menu)!;
  const open = () => {
    menu.hidden = false; openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const close = () => {
    menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    openBtn.focus();
  };
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $$<HTMLElement>('a, button, summary', menu).filter((el) => el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  matchMedia('(min-width: 64rem)').addEventListener('change', (m) => { if (m.matches && !menu.hidden) close(); });
}

/* ---- Scroll reveals ------------------------------------------------------ */
const reveals = $$('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
} else reveals.forEach((el) => el.classList.add('is-in'));

/* ---- Tap ripple on buttons (an echo of the drop) ------------------------ */
document.addEventListener('pointerdown', (e) => {
  if (reduceMotion.matches) return;
  const btn = (e.target as Element).closest<HTMLElement>('[data-ripple]');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.left = `${e.clientX - r.left}px`;
  s.style.top = `${e.clientY - r.top}px`;
  btn.append(s);
  s.addEventListener('animationend', () => s.remove());
});

/* ---- Pause CSS ambience offscreen --------------------------------------- */
const ambientSections = $$('[data-ambient-section]');
if (ambientSections.length) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-paused', !e.isIntersecting)));
  ambientSections.forEach((s) => { s.classList.add('is-paused'); io.observe(s); });
  document.addEventListener('visibilitychange', () => ambientSections.forEach((s) => document.hidden && s.classList.add('is-paused')));
}

/* ---- Testimonial carousel ----------------------------------------------- */
for (const root of $$('[data-carousel]')) {
  const track = $('[data-track]', root)!;
  const slides = Array.from(track.children) as HTMLElement[];
  const dots = $$<HTMLButtonElement>('[data-dot]', root);
  const interval = Number(root.dataset.interval) || 9000;
  let index = 0, timer: number | undefined, hovering = false, focused = false, visible = false;

  const go = (i: number, smooth = true) => {
    index = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  };
  const sync = () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    index = Math.max(0, Math.min(slides.length - 1, i));
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === index)));
    slides.forEach((s, k) => s.toggleAttribute('inert', k !== index));
  };
  let raf = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  $('[data-prev]', root)!.addEventListener('click', () => go(index - 1));
  $('[data-next]', root)!.addEventListener('click', () => go(index + 1));
  dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.dot))));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });

  // Never faster than every 8s; paused on hover/focus/offscreen/hidden tab; off for reduced motion.
  const schedule = () => {
    clearInterval(timer);
    track.setAttribute('aria-live', 'polite');
    if (reduceMotion.matches || hovering || focused || !visible || document.hidden) return;
    timer = window.setInterval(() => go(index + 1), Math.max(8000, interval));
    track.setAttribute('aria-live', 'off'); // don't announce auto-rotation
  };
  root.addEventListener('pointerenter', () => { hovering = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  root.addEventListener('focusin', () => { focused = true; schedule(); });
  root.addEventListener('focusout', (e) => { if (!root.contains((e as FocusEvent).relatedTarget as Node)) { focused = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }).observe(root);
  sync();
}

/* ---- Gallery lightbox --------------------------------------------------- */
const lightbox = $<HTMLDialogElement>('[data-lightbox]');
if (lightbox) {
  const items = $$<HTMLButtonElement>('[data-full]');
  const img = $<HTMLImageElement>('img', lightbox)!;
  const count = $('[data-count]', lightbox)!;
  let i = 0, opener: HTMLElement | null = null;
  const show = (k: number) => {
    i = (k + items.length) % items.length;
    img.src = items[i].dataset.full!;
    img.alt = items[i].querySelector('img')?.alt ?? '';
    count.textContent = `${i + 1} / ${items.length}`;
  };
  items.forEach((b, k) => b.addEventListener('click', () => { opener = b; show(k); lightbox.showModal(); }));
  $('[data-lb-prev]', lightbox)!.addEventListener('click', () => show(i - 1));
  $('[data-lb-next]', lightbox)!.addEventListener('click', () => show(i + 1));
  $('[data-lb-close]', lightbox)!.addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || (e.target as Element).classList.contains('lightbox__stage')) lightbox.close(); });
  lightbox.addEventListener('close', () => opener?.focus());
}

/* ---- Contact form: POST to PUBLIC_FORM_ENDPOINT if configured, else compose an email */
const form = $<HTMLFormElement>('[data-contact-form]');
if (form) {
  const status = $('[data-status]', form)!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      status.textContent = 'Sending…';
      try {
        const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = 'Thank you — your message has been sent.';
      } catch {
        status.textContent = 'Sorry, the message could not be sent. Please email or WhatsApp us instead.';
      }
      return;
    }
    const lines = [...data.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
    location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('Website enquiry')}&body=${encodeURIComponent(lines)}`;
    status.textContent = 'Opening your email app…';
  });
}

/* ---- Card spotlight: a soft golden light follows the pointer ------------ */
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const card = (e.target as Element).closest<HTMLElement>('.card--link, .card.float');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
  card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
}, { passive: true });

/* ---- Ambient scene: leaves on every page, the Shirodhara pool on the homepage */
{
  const hasHero = !!$('[data-hero]');
  const start = () => {
    import('./leaves').then((m) => m.startLeaves());
    if (hasHero) import('./ambience').then((m) => m.start());
  };
  const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  if (document.readyState === 'complete') idle(start);
  else addEventListener('load', () => idle(start), { once: true });
}
