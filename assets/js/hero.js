/* ============================================================
   Sphere hero — callout pins + procedural vapour
   ------------------------------------------------------------
   The art is a single raster with its original (AI-garbled)
   labels blurred out. Everything on top is real DOM: pins are
   <img> on SVG connector lines, and the vapour is a canvas
   particle system that rises off the plate and is drawn up into
   the sphere intake.

   All coordinates below are in the art's own pixel space
   (736 x 1308). .hero__frame is locked to that aspect ratio, so
   they stay correct at every screen size.

   If assets/img/hero-sphere.jpg is missing the hero removes
   itself and the page falls back to the cinematic opening.
   ============================================================ */

(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const AW = 736, AH = 1308;                 // art dimensions
  const SPHERE = [370, 527];                 // sphere centre
  const INTAKE = [368, 676];                 // nozzle under the sphere
  const SOURCE = [368, 845];                 // the glowing plate ring

  const frame = hero.querySelector('.hero__frame');
  const plate = hero.querySelector('.hero__plate');
  const svg = hero.querySelector('.hero__lines');
  const pinLayer = hero.querySelector('.hero__pins');
  const canvas = hero.querySelector('.hero__vapour');

  /* Pins sit in the defocused band where the original labels were, so they
     cover what is left of them. `to` lands on the sphere.

     One image per category, so the eight circles preview eight different
     things rather than eight variations on open water. They read straight
     from the gallery thumbs, so nothing is duplicated on disk and they stay
     in step with the gallery. Positions 4 and 8 are the pair hidden on short
     screens, so the least essential subjects sit there. */
  const PINS = [
    { x: 124, y: 405, to: [243, 452], img: 'lanai-013',   alt: 'The 35-foot lanai' },
    { x: 82,  y: 536, to: [212, 520], img: 'living-072',  alt: 'The living room' },
    { x: 104, y: 680, to: [232, 604], img: 'bedroom-005', alt: 'The bedroom' },
    { x: 196, y: 786, to: [300, 668], img: 'kitchen-118', alt: 'The kitchen' },
    { x: 612, y: 405, to: [497, 452], img: 'view-018',    alt: 'The view across the channel' },
    { x: 654, y: 536, to: [528, 520], img: 'sunset-067',  alt: 'Sunset through the palms' },
    { x: 632, y: 680, to: [508, 604], img: 'honu-039',    alt: 'A honu on the sand' },
    { x: 540, y: 786, to: [440, 668], img: 'beach-024',   alt: 'The reef off the lawn' },
  ];


  const NS = 'http://www.w3.org/2000/svg';

  PINS.forEach((p, i) => {
    const fig = document.createElement('figure');
    fig.className = 'hero__pin';
    fig.style.cssText = `left:${(p.x / AW) * 100}%;top:${(p.y / AH) * 100}%;--i:${i}`;
    // the lowest pair collides with the headline on short screens
    if (p.y > 700) fig.dataset.low = '1';
    fig.innerHTML =
      // 200px variant: these render at 45-71px, so the 800px thumb was
      // ~50KB of waste per circle
      `<img src="assets/gallery/${p.img}-200.webp" alt="${p.alt}" decoding="async">`;
    pinLayer.appendChild(fig);

    // connector, curved toward the sphere
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'hero__line');
    const mx = (p.x + p.to[0]) / 2;
    path.setAttribute('d', `M${p.x} ${p.y} C ${mx} ${p.y}, ${mx} ${p.to[1]}, ${p.to[0]} ${p.to[1]}`);
    path.style.setProperty('--i', i);
    svg.appendChild(path);
  });

  /* ---- vapour ---- */
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0, S = 1, parts = [], visible = true, raf = 0;

  const resize = () => {
    const r = frame.getBoundingClientRect();
    if (!r.width) return;
    const DPR = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    S = W / AW;                                  // art px -> css px
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };

  const spawn = () => ({
    x: (SOURCE[0] + (Math.random() - 0.5) * 200) * S,
    y: (SOURCE[1] + (Math.random() - 0.5) * 26) * S,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.45 + Math.random() * 0.75),
    r: (16 + Math.random() * 40) * S,
    life: 0,
    max: 110 + Math.random() * 90,
    seed: Math.random() * 6.28,
  });

  const step = (t) => {
    raf = requestAnimationFrame(step);
    if (!visible || !W) return;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const ix = INTAKE[0] * S, iy = INTAKE[1] * S;
    const want = W < 420 ? 30 : W < 700 ? 46 : 68;
    while (parts.length < want) parts.push(spawn());
    if (parts.length > want) parts.length = want;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life++;
      const k = Math.min(1, p.life / p.max);

      // rise first, then get pulled into the intake
      const dx = ix - p.x, dy = iy - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = 0.06 * k * k;

      p.vx += (dx / d) * pull + Math.sin(t * 0.0009 + p.seed) * 0.04;
      p.vy += (dy / d) * pull * 1.3;
      p.vx *= 0.974; p.vy *= 0.974;
      p.x += p.vx; p.y += p.vy;
      p.r *= 1.0055;

      // dim with canvas size, and fall off sharply near the intake
      const near = Math.min(1, d / (H * 0.22));
      const a = Math.sin(Math.PI * k) * 0.15 * Math.min(1, S * 1.7) * (0.2 + 0.8 * near);
      if (a > 0.002) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.55, `rgba(228,242,248,${a * 0.4})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      if (k >= 1 || d < W * 0.1) parts[i] = spawn();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const parallax = (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 })
    .observe(hero);

  const start = () => {
    hero.classList.add('is-ready');
    resize();
    addEventListener('resize', resize, { passive: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (matchMedia('(hover: hover)').matches) {
        hero.addEventListener('pointermove', parallax, { passive: true });
      }
      raf = requestAnimationFrame(step);
    }
  };

  if (plate.complete) {
    plate.naturalWidth ? start() : hero.remove();
  } else {
    plate.addEventListener('load', start, { once: true });
    plate.addEventListener('error', () => hero.remove(), { once: true });
  }
})();
