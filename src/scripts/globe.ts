/*
 * The paper globe, after the app's engine (src/lib/globe/engine.ts in places-weve-been): d3-geo orthographic to SVG,
 * styled from CSS. Here scroll drives it: `view` is tweened by the page, and the globe only listens.
 *
 * Free spin (auto-rotation + drag) and the scripted tour are two rotations; `view.blend` mixes them.
 */
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate, geoCentroid } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import world110 from 'world-atlas/countries-110m.json?url';
import world50 from 'world-atlas/countries-50m.json?url';
import type { Trip } from '../data/trips';

export interface View {
  /** the tour's rotation and zoom */
  lon: number; lat: number; k: number;
  /** globe centre as a fraction of the stage, and radius as a fraction of min(w, h) */
  x: number; y: number; r: number;
  /** 0 = free spin, 1 = the tour holds the globe */
  blend: number;
  /** which trip the tour is on (-1: none) and how far its route is drawn */
  trip: number; route: number;
  /** pins' visibility */
  pins: number;
}

const SPIN = 4; // degrees per second
type Coord = [number, number];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const wrap = (d: number) => ((d + 540) % 360) - 180;

export function createGlobe(stage: HTMLElement, trips: Trip[], photoOf: (t: Trip) => string) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = stage.querySelector('svg')!;
  const pinLayer = stage.querySelector<HTMLElement>('.pins')!;
  const el = (tag: string, cls: string, parent: Element = svg) => {
    const e = document.createElementNS(NS, tag);
    e.setAttribute('class', cls);
    parent.append(e);
    return e;
  };

  const drop = el('circle', 'g-drop');
  const ocean = el('path', 'g-ocean'), grat = el('path', 'g-grat'), land = el('path', 'g-land');
  const visitedG = el('g', 'g-visitedg'), borders = el('path', 'g-border');
  const shade = el('path', 'g-shade'), rim = el('path', 'g-rim');
  const route = el('path', 'g-route'), stopsG = el('g', 'g-stops');
  const plane = el('use', 'g-plane') as SVGUseElement;
  plane.setAttribute('href', '#s-plane');
  plane.setAttribute('width', '48'); plane.setAttribute('height', '48');

  const view: View = { lon: 0, lat: 0, k: 1, x: 0.5, y: 0.5, r: 0.42, blend: 0, trip: -1, route: 0, pins: 1 };
  const free = { lon: 10, lat: -28, v: 0 };
  const projection = geoOrthographic().clipAngle(90).precision(0.7);
  const path = geoPath(projection);
  let w = 0, h = 0, dirty = true, inView = true, dragging = false;

  // Each visited country in the ink of its newest trip
  const inkOf = new Map<string, string>();
  trips.forEach((t) => t.numeric.forEach((id) => inkOf.set(id, t.ink)));

  interface Tier { land: any; borders: any; visited: any[] }
  const tiers: { low?: Tier; high?: Tier } = {};
  let tier: Tier | undefined;
  let visitedEls: SVGPathElement[] = [];
  const load = async (url: string): Promise<Tier> => {
    const world: any = await (await fetch(url)).json();
    return {
      land: feature(world, world.objects.land),
      borders: mesh(world, world.objects.countries, (a: unknown, b: unknown) => a !== b),
      visited: (feature(world, world.objects.countries) as any).features.filter((f: any) => inkOf.has(String(f.id))),
    };
  };
  const useTier = (t: Tier | undefined) => {
    if (!t || t === tier) return;
    tier = t;
    visitedG.replaceChildren();
    visitedEls = t.visited.map((f) => {
      const p = el('path', 'g-visited', visitedG) as SVGPathElement;
      p.setAttribute('fill', inkOf.get(String(f.id))!);
      (p as any).__f = f;
      return p;
    });
    dirty = true;
  };
  const ready = load(world110).then((t) => {
    tiers.low = t;
    useTier(t);
    stage.classList.add('is-ready');
    // the sharper map for close-ups, once the page has settled
    setTimeout(() => load(world50).then((t) => { tiers.high = t; dirty = true; }), 1500);
  });

  // ---- photo pins, one per trip, merged when they'd overlap ----
  const pins = trips.map((trip, i) => {
    const b = document.createElement('span');
    b.className = 'pin';
    b.style.cssText = `--t:${trip.ink};--r:${[-4, 3, -2, 4, -3, 2][i % 6]}deg`;
    b.innerHTML = `<span class="pin-in"><span class="pin-photo"><img src="${photoOf(trip)}" alt="" draggable="false"></span><span class="pin-label">${trip.title}</span></span>`;
    pinLayer.append(b);
    return { el: b, label: b.querySelector('.pin-label')!, trip, c: geoCentroid({ type: 'MultiPoint', coordinates: trip.stops.map((s) => s.coord) }) as Coord };
  });

  // ---- the current trip's stops ----
  let stopTrip = -2;
  const stopEls: { g: SVGGElement; at: number }[] = [];
  const buildStops = () => {
    if (stopTrip === view.trip) return;
    stopTrip = view.trip;
    stopsG.replaceChildren(); stopEls.length = 0;
    const t = trips[view.trip];
    if (!t) return;
    t.stops.forEach((s, i) => {
      const g = el('g', 'g-stop', stopsG) as SVGGElement;
      const dot = el('circle', 'g-dot', g); dot.setAttribute('r', '7'); dot.setAttribute('fill', t.ink);
      const text = el('text', '', g); text.textContent = s.name;
      text.setAttribute('x', i % 2 ? '-14' : '14'); text.setAttribute('y', '5'); text.setAttribute('text-anchor', i % 2 ? 'end' : 'start');
      stopEls.push({ g, at: t.stops.length > 1 ? i / (t.stops.length - 1) : 0 });
    });
    route.setAttribute('stroke', t.ink);
  };

  /** The route drawn up to `p` (0–1), as coordinates, and its head. */
  const partial = (t: Trip, p: number) => {
    const c = t.stops.map((s) => s.coord);
    const n = c.length - 1, at = clamp(p) * n, i = Math.min(Math.floor(at), n - 1);
    const head = geoInterpolate(c[i], c[i + 1])(at - i) as Coord;
    return { line: [...c.slice(0, i + 1), head], head, from: c[i] };
  };

  function render() {
    const R = Math.min(w, h) * view.r;
    // mix free spin into the tour along the short way round
    const b = clamp(view.blend);
    const flon = view.lon + wrap(free.lon - view.lon) * (1 - b);
    const flat = view.lat + (free.lat - view.lat) * (1 - b);
    const k = 1 + (view.k - 1) * b;
    projection.scale(R * k).translate([w * view.x, h * view.y]).rotate([flon, flat]);
    useTier(tiers.high && k > 1.6 ? tiers.high : tiers.low);

    const sphere = { type: 'Sphere' } as any;
    const [cx, cy] = projection.translate(), rr = projection.scale();
    drop.setAttribute('cx', String(cx + rr * 0.04)); drop.setAttribute('cy', String(cy + rr * 0.08)); drop.setAttribute('r', String(rr * 1.06));
    ocean.setAttribute('d', path(sphere) ?? '');
    shade.setAttribute('d', path(sphere) ?? '');
    rim.setAttribute('d', path(sphere) ?? '');
    grat.setAttribute('d', path(geoGraticule10()) ?? '');
    if (tier) {
      land.setAttribute('d', path(tier.land) ?? '');
      borders.setAttribute('d', path(tier.borders) ?? '');
      const on = trips[view.trip]?.numeric;
      for (const p of visitedEls) {
        const id = String((p as any).__f.id), mine = !!on && b > 0.5 && on.includes(id);
        p.setAttribute('d', path((p as any).__f) ?? '');
        p.setAttribute('fill', mine ? trips[view.trip].ink : inkOf.get(id)!);
        p.classList.toggle('dim', !!on && b > 0.5 && !mine);
      }
    }

    // pins
    const c: Coord = [-flon, -flat], shown: { x: number; y: number; n: number; pin: (typeof pins)[number] }[] = [];
    stage.style.setProperty('--pins', String(view.pins));
    for (const pin of pins) {
      const d = geoDistance(pin.c, c), back = d > 1.36 || view.pins < 0.02;
      pin.el.classList.toggle('is-back', back);
      if (back) continue;
      const [x, y] = projection(pin.c)!;
      pin.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(0.72 + 0.28 * Math.cos(d)).toFixed(3)})`;
      const near = shown.find((s) => Math.hypot(s.x - x, s.y - y) < 62);
      pin.el.classList.toggle('is-merged', !!near);
      if (near) near.n++;
      else shown.push({ x, y, n: 1, pin });
    }
    for (const s of shown) {
      s.pin.el.classList.toggle('is-cluster', s.n > 1);
      const text = s.n > 1 ? `${s.n} trips` : s.pin.trip.title;
      if (s.pin.label.textContent !== text) s.pin.label.textContent = text;
    }

    // the tour's route, stops and plane
    buildStops();
    const t = trips[view.trip];
    if (t && b > 0.01) {
      const { line, head, from } = partial(t, view.route);
      route.setAttribute('d', path({ type: 'LineString', coordinates: line } as any) ?? '');
      stopEls.forEach(({ g, at }, i) => {
        const p = projection(t.stops[i].coord)!;
        g.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
        g.classList.toggle('on', view.route >= at - 0.001);
      });
      const hp = projection(head)!, fp = projection(geoInterpolate(from, head)(0.9) as Coord)!;
      const angle = (Math.atan2(hp[1] - fp[1], hp[0] - fp[0]) * 180) / Math.PI;
      const flying = view.route > 0.002 && view.route < 0.998;
      plane.setAttribute('transform', `translate(${hp[0].toFixed(1)},${hp[1].toFixed(1)}) rotate(${angle.toFixed(1)}) translate(-17,-17) scale(.72)`);
      plane.style.opacity = flying ? '1' : '0';
      stopsG.style.opacity = route.style.opacity = String(b);
    } else {
      route.setAttribute('d', '');
      plane.style.opacity = '0';
      stopsG.style.opacity = '0';
    }
  }

  let last = performance.now();
  function tick() {
    const now = performance.now(), dt = Math.min(64, now - last) / 1000;
    last = now;
    if (!inView || !w) return;
    if (!dragging && view.blend < 1) {
      if (Math.abs(free.v) > 0.5) { free.lon += free.v * dt; free.v *= 0.95; }
      else if (!calm) free.lon += SPIN * dt;
      dirty = true;
    }
    if (dirty) { dirty = false; render(); }
  }

  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    dirty = true;
  }

  // Drag to spin. On touch only sideways turns the globe, so a vertical swipe still scrolls the page.
  let px = 0, py = 0, pt = 0, id = -1, type = '';
  const hit = stage.querySelector<HTMLElement>('.globe-hit')!;
  hit.addEventListener('pointerdown', (e) => { if (view.blend > 0.5) return; dragging = true; id = e.pointerId; type = e.pointerType; px = e.clientX; py = e.clientY; pt = e.timeStamp; free.v = 0; stage.classList.add('is-drag'); });
  addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== id) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    free.lon += dx * 0.3;
    if (type === 'mouse') free.lat = clamp(free.lat - dy * 0.3, -70, 70);
    free.v = (dx * 0.3) / Math.max(0.008, (e.timeStamp - pt) / 1000);
    px = e.clientX; py = e.clientY; pt = e.timeStamp;
    dirty = true;
    stage.dispatchEvent(new CustomEvent('spin'));
  });
  const up = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== id) return;
    dragging = false; stage.classList.remove('is-drag');
    if (e.timeStamp - pt > 90) free.v = 0;
    free.v = clamp(free.v, -140, 140);
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('resize', resize);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(stage);

  resize();
  return { view, tick, resize, ready, invalidate: () => { dirty = true; }, kick: (v: number) => { free.v = v; } };
}
