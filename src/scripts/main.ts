/*
 * Every scene on the page. Lenis smooths the scroll; GSAP ScrollTrigger pins the big scenes and scrubs their timelines.
 * With prefers-reduced-motion there's no smoothing, no intro, no idle drifting; scroll-driven scenes still step through.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { SplitText } from 'gsap/SplitText';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';
import { geoCentroid, geoDistance } from 'd3-geo';
import { createGlobe } from './globe';
import { trips, photo } from '../data/trips';

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, SplitText, MotionPathPlugin, DrawSVGPlugin);

const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll(s)] as T[];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = gsap.parseEase('power2.inOut');
const wrap = (d: number) => ((d + 540) % 360) - 180;

export function start() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('calm', calm);

  const lenis = calm ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const world = world$(calm);
  journal(calm);
  app();
  privacy();
  passport(calm);
  host(calm);
  end();
  headings(calm);

  // In-page links: the tour lives inside the pinned world, so it has its own spot
  for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      const y = id === '#top' ? 0 : id === '#tour' ? world.tourY() : id === '#main' ? null : $(id) ? ScrollTrigger.getAll().find((s) => s.trigger === $(id))?.start ?? $(id).getBoundingClientRect().top + scrollY : null;
      if (y == null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(y, { duration: 1.8 });
      else scrollTo({ top: y });
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------- 1 + 2: hero and globe tour ---------- */
function world$(calm: boolean) {
  const section = $('.world'), pin = $('.world-pin'), stage = $('.globe-stage');
  const globe = createGlobe(stage, trips, (t) => photo(t.id, t.stops[0].photos[0]));
  gsap.ticker.add(globe.tick);
  const v = globe.view, N = trips.length, hero = $('.hero');
  const mobile = () => innerWidth <= 760;

  // Where each trip sits: its middle, and a zoom that makes its route a comfortable size on screen
  const centres = trips.map((t) => geoCentroid({ type: 'MultiPoint', coordinates: t.stops.map((s) => s.coord) }));
  const spans = trips.map((t) => Math.max(0.01, ...t.stops.flatMap((a) => t.stops.map((b) => geoDistance(a.coord, b.coord)))));
  const layout = {
    // on phones the globe rises from below, its top just under the words
    hero: () => {
      if (!mobile()) return { x: 0.7, y: 0.53, r: 0.44 };
      const w = stage.clientWidth, h = stage.clientHeight, r = 0.6, words = hero.offsetTop + hero.offsetHeight;
      return { x: 0.5, y: Math.max(0.82, (words + 24 + Math.min(w, h) * r) / h), r };
    },
    tour: () => (mobile() ? { x: 0.5, y: 0.31, r: 0.46 } : { x: 0.33, y: 0.5, r: 0.4 }),
  };
  const zoomFor = (i: number) => {
    const w = stage.clientWidth, h = stage.clientHeight, R = Math.min(w, h) * layout.tour().r;
    return clamp((mobile() ? 0.5 : 0.24) * w / (spans[i] * R), 2.4, mobile() ? 16 : 8);
  };

  // tour.p runs 0 → N: the whole number is the trip, the fraction is how far through it we are
  const tour = { p: 0 };
  const rail = $$('.rail li');
  const applyTour = () => {
    const i = Math.min(N - 1, Math.floor(tour.p)), f = tour.p - i;
    v.trip = i;
    v.route = ease(clamp((f - 0.22) / 0.5));
    // fly in from the previous trip during the first 30%
    const a = Math.max(0, i - 1), e = i === 0 ? 1 : ease(clamp(f / 0.3));
    const [la, pa] = centres[a], [lb, pb] = centres[i];
    const ka = zoomFor(a), kb = zoomFor(i), dip = Math.min(0.88, geoDistance(centres[a], centres[i]) / 1.8);
    v.lon = -(la + wrap(lb - la) * e);
    v.lat = -(pa + (pb - pa) * e);
    v.k = Math.exp(Math.log(ka) + (Math.log(kb) - Math.log(ka)) * e) * (1 - dip * Math.sin(Math.PI * e));
    rail.forEach((li, j) => li.classList.toggle('on', j === i));
    globe.invalidate();
  };
  applyTour();

  const cards = $$('.card'), years = $$('.years span');
  const heroBits = [...hero.children];

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => `+=${innerHeight * (N + 1.4)}`, pin, scrub: calm ? true : 0.8,
      invalidateOnRefresh: true, anticipatePin: 1,
    },
    onUpdate: () => globe.invalidate(),
  });

  // hero → tour (time 0 → 1)
  const at = (which: 'hero' | 'tour') => ({ x: () => layout[which]().x, y: () => layout[which]().y, r: () => layout[which]().r });
  tl.fromTo(v, { ...at('hero'), blend: 0, pins: 1 }, { ...at('tour'), blend: 1, pins: 0, duration: 1, ease: 'power2.inOut', immediateRender: true }, 0);
  tl.to(heroBits, { y: -90, autoAlpha: 0, stagger: 0.05, duration: 0.5, ease: 'power2.in' }, 0);
  tl.to('.float-st', { y: () => gsap.utils.random(-260, -160), rotation: () => gsap.utils.random(-90, 90), autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, 0);
  tl.to('.hero-plane', { x: 500, y: -300, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, 0);
  tl.set('.tour', { visibility: 'visible' }, 0.5);
  tl.from('.rail', { y: 60, autoAlpha: 0, duration: 0.3 }, 0.6);
  tl.from('.tour-kicker', { x: -40, autoAlpha: 0, duration: 0.3 }, 0.7);
  tl.to(tour, { p: N - 0.0001, duration: N, onUpdate: applyTour }, 1);

  // each trip's card and year swap in as the globe arrives
  trips.forEach((t, i) => {
    const at = i === 0 ? 0.6 : 1 + i;
    tl.fromTo(cards[i], { autoAlpha: 0, y: 70, rotation: 5, scale: 0.94 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }, at);
    tl.from($$('.print', cards[i]), { y: 40, rotation: (j) => [-14, 12, -6][j], autoAlpha: 0, stagger: 0.04, duration: 0.25, ease: 'back.out(2)' }, at + 0.05);
    tl.from($('.stamp-wrap', cards[i]), { scale: 2.2, rotation: 30, autoAlpha: 0, duration: 0.15, ease: 'power4.in' }, at + 0.22);
    tl.fromTo(years[i], { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.3, ease: 'power3.out' }, at);
    tl.to(pin, { '--tint': t.tint, '--t': t.ink, duration: 0.3 }, at);
    if (i < N - 1) {
      tl.to(cards[i], { autoAlpha: 0, x: mobile() ? -60 : 80, y: -40, rotation: -8, duration: 0.25, ease: 'power2.in' }, 1 + i + 0.8);
      tl.to(years[i], { yPercent: -60, autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, 1 + i + 0.8);
    }
  });
  tl.to({}, { duration: 0.4 });

  // ---- the intro, once, on load ----
  const split = new SplitText('.hero-title .line:first-child', { type: 'chars', mask: 'chars' });
  if (!calm) {
    const intro = gsap.timeline({ delay: 0.15, defaults: { ease: 'power3.out' } });
    intro.from(stage, { scale: 0.75, rotation: -8, duration: 1.6, ease: 'elastic.out(1, 0.75)', transformOrigin: '70% 50%' }, 0);
    intro.from('.kicker span', { y: 20, autoAlpha: 0, duration: 0.6 }, 0.2);
    intro.from(split.chars, { yPercent: 110, duration: 0.9, stagger: 0.03 }, 0.25);
    intro.fromTo('.been', { clipPath: 'inset(-10% 100% -20% 0)' }, { clipPath: 'inset(-10% -5% -20% 0)', duration: 1.1, ease: 'power2.inOut' }, 0.7);
    intro.from('.been-line .spark path', { drawSVG: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }, 1.6);
    intro.from(['.lede', '.hero-cta', '.stats'], { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.9);
    intro.from('.stats dd', { textContent: 0, snap: { textContent: 1 }, duration: 1.4, ease: 'power2.out' }, 1);
    intro.from('.float-st', { scale: 0, rotation: -40, duration: 0.9, stagger: 0.12, ease: 'back.out(2.2)' }, 1.1);
    intro.from('.spin-hint', { autoAlpha: 0, y: 10, duration: 0.6 }, 2);
    // dashed lines can't use DrawSVG (it owns the dashes), so they're unveiled with a clip instead
    intro.fromTo('.hero-plane .trail', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.8, ease: 'power1.inOut' }, 0.8);
    intro.fromTo('.hero-plane .plane', { autoAlpha: 0 }, {
      autoAlpha: 1, duration: 1.8, ease: 'power1.inOut',
      motionPath: { path: '.hero-plane .trail path', align: '.hero-plane .trail path', alignOrigin: [0.5, 0.5], autoRotate: true },
    }, 0.8);
    globe.ready.then(() => globe.kick(160));

    // stickers drift, and lean away from the pointer
    $$('.float-st').forEach((s, i) => gsap.to(s, { yPercent: 25, rotation: i % 2 ? 8 : -8, duration: 2.4 + i * 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 }));
    const px = $$('.float-st').map((s) => ({ x: gsap.quickTo(s, 'x', { duration: 1.2 }), d: 20 + Math.random() * 30 }));
    addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      px.forEach((p) => p.x(nx * p.d * -1));
    });
  } else {
    gsap.set('.hero-plane .plane', { motionPath: { path: '.hero-plane .trail path', align: '.hero-plane .trail path', alignOrigin: [0.5, 0.5], autoRotate: true, end: 1 } });
  }

  stage.addEventListener('spin', () => gsap.to('.spin-hint', { autoAlpha: 0, duration: 0.4 }), { once: true });

  return { tourY: () => (tl.scrollTrigger!.start + (tl.scrollTrigger!.end - tl.scrollTrigger!.start) * (1.15 / (N + 1.4))) };
}

/* ---------- 3: the journal ---------- */
function journal(calm: boolean) {
  const pin = $('.journal-pin'), photos = $$('.polaroid');
  const mobile = () => innerWidth <= 760;
  // Where each polaroid lands, as a share of the screen from the middle, leaving the middle clear for the words
  const desk = [[-0.31, -0.27], [-0.13, -0.36], [0.13, -0.35], [0.31, -0.26], [-0.39, -0.02], [0.39, -0.03], [-0.34, 0.2], [0.34, 0.19], [-0.25, 0.32], [-0.08, 0.31], [0.09, 0.32], [0.26, 0.31]];
  // phones only have room for eight (the rest are hidden in CSS): a row above the words, a row below
  const phone = [[-0.36, -0.36], [-0.12, -0.35], [0.12, -0.36], [0.36, -0.35], [-0.36, 0.38], [-0.12, 0.39], [0.12, 0.38], [0.36, 0.39], [0, 0], [0, 0], [0, 0], [0, 0]];
  const spot = (i: number) => (mobile() ? phone : desk)[i];
  const tilt = [-8, 5, -3, 7, -6, 4, 9, -5, 3, -7, 6, -4];

  gsap.set(photos, { xPercent: -50, yPercent: -50 });
  const head = $('.journal-head'), title = $('h2', head), copy = $('.journal-copy');
  const headY = () => {
    const copyTop = innerHeight * 0.56 - copy.offsetHeight / 2;
    return copyTop - (mobile() ? 34 : 46) - (head.offsetTop + title.offsetTop + title.offsetHeight / 2);
  };
  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: { trigger: '.journal', start: 'top top', end: () => `+=${innerHeight * 2.6}`, pin, scrub: calm ? true : 0.8, invalidateOnRefresh: true },
  });
  // the envelope opens: photos rise, the tag swings, the stamp lands
  tl.to('.env-photos .e0', { yPercent: -48, rotation: -10, duration: 0.6 }, 0)
    .to('.env-photos .e1', { yPercent: -66, rotation: 10, duration: 0.6 }, 0.08)
    .to('.env-photos .e2', { yPercent: -34, rotation: 4, duration: 0.6 }, 0.16)
    .fromTo('.env-tag', { rotation: -6 }, { rotation: 6, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.1)
    .from('.env-stamp', { scale: 2.6, rotation: 40, autoAlpha: 0, duration: 0.18, ease: 'power4.in' }, 0.5)
    .to('.envelope', { keyframes: { x: [0, -6, 5, -3, 0] }, duration: 0.15 }, 0.68)
  // then everything spills out onto the table
    .to('.envelope', { yPercent: -30, scale: 0.7, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, 1.1)
    // the heading settles just above the words
    .to('.journal-head', { y: () => headY(), scale: () => (mobile() ? 0.85 : 0.7), duration: 0.6, ease: 'power2.inOut' }, 1.1)
    .fromTo(photos,
      { x: 0, y: () => 0, rotation: (i) => tilt[i] * 3, scale: 0.35, autoAlpha: 0 },
      { x: (i) => spot(i)[0] * innerWidth, y: (i) => spot(i)[1] * innerHeight, rotation: (i) => tilt[i], scale: 1, autoAlpha: 1, duration: 0.7, stagger: 0.04, ease: 'back.out(1.2)' }, 1.15)
    .to('.journal-head .kicker', { autoAlpha: 0, duration: 0.3 }, 1.1)
    .fromTo('.journal-copy', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 1.75)
    .to({}, { duration: 0.3 });

  // and then they're yours to push around
  let z = 10;
  Draggable.create(photos, {
    type: 'x,y', inertia: true, bounds: pin, edgeResistance: 0.7,
    onPress() { gsap.set(this.target, { zIndex: ++z }); gsap.to(this.target, { scale: 1.08, rotation: 0, duration: 0.25 }); },
    onRelease() { gsap.to(this.target, { scale: 1, rotation: gsap.utils.random(-8, 8), duration: 0.5, ease: 'back.out(2)' }); },
  });
}

/* ---------- 4: the real app ---------- */
function app() {
  const st = { trigger: '.devices', start: 'top bottom', end: 'bottom 40%', scrub: 0.6 };
  gsap.fromTo('.browser', { rotationX: 26, y: 80, scale: 0.9 }, { rotationX: 0, y: 0, scale: 1, ease: 'power2.out', scrollTrigger: st });
  gsap.fromTo('.ph1', { y: 200, rotation: -14 }, { y: -30, rotation: -6, ease: 'none', scrollTrigger: { ...st, end: 'bottom top' } });
  gsap.fromTo('.ph2', { y: 300, rotation: 14 }, { y: -60, rotation: 5, ease: 'none', scrollTrigger: { ...st, end: 'bottom top' } });
  gsap.from('.note', { autoAlpha: 0, y: 14, stagger: 0.2, duration: 0.6, scrollTrigger: { trigger: '.devices', start: 'center 70%' } });
}

/* ---------- 5: privacy ---------- */
function privacy() {
  const steps = $$('.step'), metas = $$('.meta'), photo = $('.scan-photo');
  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: { trigger: '.privacy', start: 'top top', end: () => `+=${innerHeight * 2.4}`, pin: '.privacy-pin', scrub: 0.6, invalidateOnRefresh: true },
    onUpdate() { const s = Math.min(2, Math.floor(this.time())); steps.forEach((el, i) => el.classList.toggle('on', i === s)); },
  });
  steps[0].classList.add('on');
  // 1: the hidden details show themselves
  tl.from(metas, { scale: 0, autoAlpha: 0, duration: 0.4, stagger: 0.08, ease: 'back.out(2.4)' }, 0)
    .to('.m0', { scale: 1.12, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.5)
  // 2: the redraw scans them off, and they fall away
    .fromTo('.scan-bar', { y: -70 }, { y: () => photo.offsetHeight + 10, duration: 0.8, ease: 'none' }, 1.05)
    .to(metas, { y: () => innerHeight * 0.7, rotation: () => gsap.utils.random(-70, 70), autoAlpha: 0, duration: 0.5, stagger: 0.09, ease: 'power2.in' }, 1.15)
    .fromTo('.scan-photo img', { filter: 'saturate(1)' }, { filter: 'saturate(1.25) contrast(1.05)', duration: 0.3 }, 1.6)
  // 3: only family gets in
    .to(photo, { scale: 0.62, y: -40, autoAlpha: 0.25, duration: 0.5, ease: 'power2.inOut' }, 2.05)
    .fromTo('.gate', { autoAlpha: 0, scale: 0.85, y: 40 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.6)' }, 2.25)
    .from('.pin-code span', { y: 16, autoAlpha: 0, duration: 0.2, stagger: 0.05 }, 2.4)
    .to('.lock', { keyframes: { rotation: [0, -12, 10, -6, 0] }, duration: 0.2 }, 2.75)
    .to('.lock', { backgroundColor: '#5CC27A', duration: 0.1 }, 2.9)
    .to({}, { duration: 0.15 });
}

/* ---------- 6: passport ---------- */
function passport(calm: boolean) {
  const stamps = $$('.pstamp');
  if (!calm) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.passport', start: 'top 72%' } });
    stamps.forEach((s, i) => {
      tl.from(s, { scale: 2.6, autoAlpha: 0, rotation: `+=${i % 2 ? 30 : -30}`, duration: 0.32, ease: 'power4.in' }, i * 0.22)
        .to('.passport', { keyframes: { x: [0, -4, 3, 0], y: [0, 2, -1, 0] }, duration: 0.14 }, i * 0.22 + 0.32);
    });
  }
  gsap.from('.tag-card', { y: 50, autoAlpha: 0, rotation: (i) => (i % 2 ? 4 : -4), duration: 0.8, stagger: 0.08, ease: 'back.out(1.4)', scrollTrigger: { trigger: '.little-grid', start: 'top 80%' } });
}

/* ---------- 7: self-host ---------- */
function host(calm: boolean) {
  gsap.from('.pass', { x: -60, autoAlpha: 0, rotation: -3, duration: 0.8, stagger: 0.14, ease: 'back.out(1.4)', scrollTrigger: { trigger: '.passes', start: 'top 78%' } });
  gsap.from('.badges li', { y: 20, autoAlpha: 0, scale: 0.9, duration: 0.5, stagger: 0.06, ease: 'back.out(2)', scrollTrigger: { trigger: '.badges', start: 'top 90%' } });

  const lines = $$('.ln'), caret = document.createElement('span');
  caret.className = 'caret';
  const show = (ln: HTMLElement, n: number) => {
    ln.innerHTML = `<span class="ps">$</span> ${ln.dataset.cmd!.slice(0, n)}`;
  };
  const outputs = (ln: HTMLElement) => {
    for (const o of ln.dataset.out?.split('|') ?? []) {
      const s = document.createElement('span'); s.className = 'out'; s.textContent = o; ln.append(s);
    }
  };
  if (calm) { lines.forEach((ln) => { show(ln, Infinity); outputs(ln); }); return; }
  ScrollTrigger.create({
    trigger: '.term', start: 'top 75%', once: true,
    onEnter: async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (const ln of lines) {
        const cmd = ln.dataset.cmd!;
        for (let n = 0; n <= cmd.length; n++) { show(ln, n); ln.append(caret); await wait(n ? 18 + Math.random() * 30 : 250); }
        await wait(220);
        outputs(ln);
      }
      lines.at(-1)!.append(caret);
    },
  });

  const copy = $<HTMLButtonElement>('.copy');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(lines.map((l) => l.dataset.cmd).join('\n'));
    copy.querySelector('use')!.setAttribute('href', '#i-check');
    setTimeout(() => copy.querySelector('use')!.setAttribute('href', '#i-copy'), 1600);
  });
}

/* ---------- the end ---------- */
function end() {
  const st = { trigger: '.end', start: 'top 85%', end: 'bottom bottom', scrub: 0.8 };
  gsap.fromTo('.end-path', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'none', scrollTrigger: st });
  gsap.to('.end-plane', { ease: 'none', scrollTrigger: st, motionPath: { path: '#endRoute', align: '#endRoute', alignOrigin: [0.5, 0.5], autoRotate: true } });
}

/* ---------- section headings rise out of their lines ---------- */
function headings(calm: boolean) {
  if (calm) return;
  for (const h of $$('main h2:not(.journal-head h2), .end h2')) {
    const split = new SplitText(h, { type: 'words,lines', mask: 'lines' });
    gsap.from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
  }
  for (const k of $$('main .kicker:not(.hero .kicker, .journal-head .kicker)')) {
    gsap.from(k, { y: 16, autoAlpha: 0, rotation: -3, duration: 0.7, scrollTrigger: { trigger: k, start: 'top 88%' } });
  }
}
