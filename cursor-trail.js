const lifetime = 620;
const maxPoints = 70;
const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const strands = [
  { color: 'trail-primary', delay: 0, offset: 0, width: 2 },
  { color: 'trail-secondary', delay: 28, offset: 7, width: 1.45 },
  { color: 'trail-tertiary', delay: 58, offset: -5, width: 1.1 }
];

export function cursorTrail(surface, canvas) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};

  let appearance;
  let bounds;
  let frame = 0;
  const points = [];
  const enabled = () => appearance?.trail && motion.matches;

  function clear() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    points.length = 0;
    if (bounds) context.clearRect(0, 0, bounds.width, bounds.height);
  }

  function resize() {
    clear();
    if (!enabled()) return;
    bounds = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.75, Math.sqrt(2400000 / (bounds.width * bounds.height)));
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.lineCap = context.lineJoin = 'round';
  }

  function draw(now) {
    frame = 0;
    context.clearRect(0, 0, bounds.width, bounds.height);
    while (points.length && now - points[0].time > lifetime) points.shift();
    if (points.length < 2) return;

    const latest = points.at(-1);
    const fade = Math.max(0, 1 - (now - latest.time) / lifetime);
    for (const strand of strands) {
      const end = points.findLastIndex(point => point.time <= now - strand.delay);
      if (end < 1) continue;

      let lastX = points[0].x, lastY = points[0].y;
      let startX = lastX, startY = lastY;
      context.strokeStyle = appearance.colors[strand.color];
      for (let i = 1; i <= end; i++) {
        const previous = points[i - 1];
        const point = points[i];
        const age = now - point.time;
        const fraction = Math.max(0, 1 - age / lifetime);
        const wave = Math.sin(age / 105 + i / 7) * strand.offset * (1 - .5 * fraction);
        const next = points[Math.min(i + 1, end)];
        const tangent = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
        const x = point.x - (next.y - previous.y) / tangent * wave;
        const y = point.y + (next.x - previous.x) / tangent * wave;
        const endX = i === end ? x : (lastX + x) * .5;
        const endY = i === end ? y : (lastY + y) * .5;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(lastX, lastY, endX, endY);
        context.globalAlpha = fade * fraction ** 1.15 * (strand.delay ? .72 : .94);
        context.lineWidth = strand.width * (.34 + .66 * fraction);
        context.stroke();
        startX = endX;
        startY = endY;
        lastX = x;
        lastY = y;
      }
    }
    context.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  }

  function move(event) {
    if (!enabled() || event.pointerType !== 'mouse') return;
    if (!bounds) resize();
    const time = performance.now();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const last = points.at(-1);
    if (last && time - last.time > 160) points.length = 0;
    else if (last && Math.hypot(x - last.x, y - last.y) < 2) return;
    points.push({ x, y, time });
    if (points.length > maxPoints) points.shift();
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function sync() {
    canvas.hidden = !enabled();
    resize();
  }

  surface.addEventListener('pointermove', move, { passive: true });
  surface.addEventListener('pointerenter', resize, { passive: true });
  motion.addEventListener('change', sync);
  window.addEventListener('scroll', () => { clear(); bounds = null; }, { passive: true });
  window.addEventListener('blur', clear);
  new ResizeObserver(resize).observe(surface);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  return next => {
    const wasEnabled = enabled();
    appearance = next;
    if (wasEnabled !== enabled()) sync();
  };
}
