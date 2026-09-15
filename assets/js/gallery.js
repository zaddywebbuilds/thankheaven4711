/* ============================================================
   Classified gallery
   ------------------------------------------------------------
   Loads assets/gallery.json and renders every photo and clip,
   grouped by room / subject, each with its own label.

   Nothing here is hand-maintained: to add or relabel an item,
   edit the classification and re-run the gallery build.
   ============================================================ */

(async () => {
  const gal = document.getElementById('gal');
  const tabs = document.getElementById('galTabs');
  if (!gal) return;

  let data;
  try {
    data = await (await fetch('assets/gallery.json')).json();
  } catch (e) {
    gal.remove(); tabs?.remove();
    return;                                  // served from file:// or missing
  }

  const BASE = 'assets/gallery/';
  const byCat = (id) => data.items.filter((i) => i.cat === id);
  const live = data.categories.filter((c) => c.count > 0);

  // keep any hard-coded totals in the copy honest
  document.querySelectorAll('[data-gallery-count]').forEach((el) => {
    el.textContent = String(data.items.length);
  });

  /* ---- section nav ---- */
  tabs.innerHTML = live
    .map((c) => `<a class="gal__tab" href="#cat-${c.id}">${c.title}<b>${c.count}</b></a>`)
    .join('');

  /* ---- grouped grids ---- */
  gal.innerHTML = live
    .map((c) => {
      const cards = byCat(c.id)
        .map(
          (it, n) => `
        <figure class="gcard${it.type === 'video' ? ' is-video' : ''}"
                data-cat="${c.id}" data-n="${n}" tabindex="0" role="button"
                aria-label="${it.label}">
          <img src="${BASE}${it.id}-400.webp"
               srcset="${BASE}${it.id}-200.webp 200w, ${BASE}${it.id}-400.webp 400w, ${BASE}${it.id}-t.webp 800w"
               sizes="(max-width:640px) 45vw, (max-width:1100px) 31vw, 250px"
               alt="${it.label}" loading="lazy" decoding="async">
          <figcaption>${it.label}</figcaption>
        </figure>`
        )
        .join('');
      return `
      <section class="gcat" id="cat-${c.id}">
        <header class="gcat__head">
          <h3>${c.title}</h3>
          <p>${c.blurb}</p>
          <span class="gcat__count">${c.count} ${c.count === 1 ? 'item' : 'items'}</span>
        </header>
        <div class="gcat__grid">${cards}</div>
      </section>`;
    })
    .join('');

  /* ---- lightbox ---- */
  const lb = document.getElementById('lb');
  const lbMedia = document.getElementById('lbMedia');
  const lbCap = document.getElementById('lbCap');
  let list = [], at = 0, lastFocus = null;

  const show = () => {
    const it = list[at];
    // Reserve the box from the manifest's own dimensions so nothing jumps,
    // and paint the already-cached thumb underneath so there is never a
    // blank frame while the full-size file arrives.
    const ratio = it.w && it.h ? `${it.w}/${it.h}` : '3/2';
    lbMedia.innerHTML =
      it.type === 'video'
        ? `<div class="lb__media" style="aspect-ratio:${ratio}">
             <video src="${BASE}${it.id}.mp4" poster="${BASE}${it.id}-t.webp"
                    controls autoplay loop muted playsinline></video>
           </div>`
        : `<div class="lb__media" style="aspect-ratio:${ratio}">
             <img class="lb__pre" src="${BASE}${it.id}-400.webp" alt="" aria-hidden="true">
             <img class="lb__full" src="${BASE}${it.id}.webp" alt="${it.label}" decoding="async">
           </div>`;
    const full = lbMedia.querySelector('.lb__full');
    const pre = lbMedia.querySelector('.lb__pre');
    if (full && pre) {
      const done = () => pre.classList.add('is-off');
      full.complete ? done() : full.addEventListener('load', done, { once: true });
    }
    lbCap.innerHTML =
      `<b>${it.label}</b><span>${at + 1} / ${list.length}</span>`;
  };

  const openAt = (cat, n) => {
    list = byCat(cat); at = n; lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show();
    document.getElementById('lbX').focus();
  };

  const close = () => {
    lb.hidden = true;
    lbMedia.innerHTML = '';                  // stop any playing clip
    document.body.style.overflow = '';
    lastFocus?.focus();
  };

  const step = (d) => { at = (at + d + list.length) % list.length; show(); };

  gal.addEventListener('click', (e) => {
    const card = e.target.closest('.gcard');
    if (card) openAt(card.dataset.cat, +card.dataset.n);
  });
  gal.addEventListener('keydown', (e) => {
    const card = e.target.closest('.gcard');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); openAt(card.dataset.cat, +card.dataset.n);
    }
  });

  document.getElementById('lbX').onclick = close;
  document.getElementById('lbPrev').onclick = () => step(-1);
  document.getElementById('lbNext').onclick = () => step(1);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* ---- card tilt ----------------------------------------
     Pointer-driven perspective on the grid. Delegated (one listener for
     all 127 cards), written to CSS custom properties inside a rAF, and
     only on devices with a real pointer. */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const MAX = 6;                       // degrees; past this it reads as a gimmick
    let pending = null;

    const apply = () => {
      const { card, x, y, w, h } = pending;
      pending = null;
      const px = x / w, py = y / h;
      card.style.setProperty('--ry', ((px - 0.5) * MAX * 2).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * MAX * 2).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    };

    gal.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.gcard');
      if (!card) return;
      card.classList.add('is-tilting');
      const r = card.getBoundingClientRect();
      const queued = pending;
      pending = { card, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
      if (!queued) requestAnimationFrame(apply);
    }, { passive: true });

    gal.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.gcard');
      if (!card || card.contains(e.relatedTarget)) return;
      card.classList.remove('is-tilting');
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    }, { passive: true });
  }

  /* ---- swipe on touch ---- */
  let sx = 0, sy = 0, tracking = false;
  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.6) close();
  }, { passive: true });

  /* ---- highlight the section you are in ---- */
  const links = [...tabs.querySelectorAll('.gal__tab')];
  const spy = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) =>
          l.classList.toggle('is-on', l.getAttribute('href') === '#' + en.target.id)
        );
      }),
    { rootMargin: '-45% 0px -50% 0px' }
  );
  document.querySelectorAll('.gcat').forEach((s) => spy.observe(s));
})();
