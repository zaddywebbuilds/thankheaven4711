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
          <img src="${BASE}${it.id}-t.webp" alt="${it.label}" loading="lazy" decoding="async">
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
    lbMedia.innerHTML =
      it.type === 'video'
        ? `<video src="${BASE}${it.id}.mp4" poster="${BASE}${it.id}-t.webp"
                  controls autoplay loop muted playsinline></video>`
        : `<img src="${BASE}${it.id}.webp" alt="${it.label}">`;
    lbCap.textContent = `${it.label}  ·  ${at + 1} / ${list.length}`;
  };

  const open = (cat, n) => {
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
    if (card) open(card.dataset.cat, +card.dataset.n);
  });
  gal.addEventListener('keydown', (e) => {
    const card = e.target.closest('.gcard');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); open(card.dataset.cat, +card.dataset.n);
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
