/* ============================================================
   O Thank Heaven 4 711
   ------------------------------------------------------------
   EDIT ME: everything the owner still needs to supply lives in
   CONFIG below. Blank strings simply render nothing, so the page
   is safe to publish before these are filled in.
   ============================================================ */

const CONFIG = {
  // TODO(owner): booking destination. A mailto works until there is a
  // real booking engine or listing URL.
  bookingHref: 'mailto:CHANGE-ME@example.com?subject=Availability%20-%20Unit%20711',

  // TODO(owner): Hawai'i short-term-rental registration / TMK number.
  // Several counties require this to appear on ALL advertising, this
  // site included. Leave blank only if confirmed not required.
  strLine: '',

  // TODO(owner): anything legal/ownership to sit in the footer.
  legalLine: '',
};

document.querySelectorAll('[data-cfg]').forEach((el) => {
  const v = CONFIG[el.dataset.cfg];
  if (!v) { if (el.tagName !== 'A') el.remove(); return; }
  if (el.tagName === 'A') el.href = v; else el.textContent = v;
});

/* ---------- hero video ----------------------------------------
   The poster carries the hero on its own, so the clip is an
   enhancement: no src is set until we know the screen size and the
   connection can afford it. On a metered or slow link the poster is
   all anyone downloads. */
const MEDIA_V = '41';
const conn = navigator.connection || {};
/* 3g is deliberately NOT in here. The mobile encode is 240KB, which 3g
   carries fine, and the video is the thing the owner asked the page to
   open with — skipping it there would lose the point on a lot of real
   phones. Only genuinely slow or metered links fall back to the poster. */
const FRUGAL = conn.saveData === true ||
               /^(slow-2g|2g)$/.test(conn.effectiveType || '');

const heroVideo = document.getElementById('heroVideo');
if (heroVideo && !FRUGAL && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const small = matchMedia('(max-width: 820px)').matches;
  heroVideo.src = `assets/video/hero-loop${small ? '-m' : ''}.mp4?v=${MEDIA_V}`;
  heroVideo.preload = 'auto';
  // Play once there is something to play. Calling play() straight after
  // setting src rejects, because the source has not loaded yet.
  heroVideo.addEventListener('canplay', () => {
    heroVideo.classList.add('is-on');
    const go = heroVideo.play();
    // Autoplay can still be refused by the browser; the poster simply stays.
    if (go && go.catch) go.catch(() => heroVideo.classList.remove('is-on'));
  }, { once: true });

  // Stop decoding while the hero is off screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { const g = heroVideo.play(); if (g && g.catch) g.catch(() => {}); }
      else heroVideo.pause();
    }, { threshold: 0.05 }).observe(heroVideo);
  }
}

/* ---------- navigation ---------- */
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  // close after choosing a destination
  nav.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

/* solid background once you leave the hero */
const setNavState = () => {
  if (nav) nav.classList.toggle('is-stuck', scrollY > innerHeight * 0.6);
};
addEventListener('scroll', setNavState, { passive: true });
setNavState();

/* which section am I in */
const navLinks = [...document.querySelectorAll('.nav__links a')];
const targets = navLinks
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if (targets.length && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) =>
        a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id));
    }),
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  targets.forEach((t) => spy.observe(t));
}

/* ---------- reveal fallback ----------------------------------
   Only runs where scroll-driven CSS animations are unavailable;
   the head script decides which of the two is active. */
if (document.documentElement.classList.contains('js-reveal')) {
  const reveal = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in-view');
      reveal.unobserve(e.target);
    }),
    { threshold: 0, rootMargin: '0px 0px -12% 0px' }
  );
  document.querySelectorAll('.sec').forEach((s) => reveal.observe(s));

  // Nothing may be left hidden behind an animation that did not run.
  setTimeout(() => {
    document.querySelectorAll('.sec:not(.in-view)').forEach((s) => {
      if (s.getBoundingClientRect().top < innerHeight) s.classList.add('in-view');
    });
  }, 2500);
}

/* ---------- sticky conversion bar ----------------------------
   Appears once the hero is behind you, hides again over the booking
   section so it never covers the button it is pointing at. */
const bar = document.getElementById('ctaBar');
const book = document.getElementById('book');
if (bar && book) {
  bar.hidden = false;
  const syncBar = () => {
    const past = scrollY > innerHeight * 0.9;
    const atBook = book.getBoundingClientRect().top < innerHeight * 0.9;
    bar.classList.toggle('is-on', past && !atBook);
  };
  addEventListener('scroll', syncBar, { passive: true });
  addEventListener('resize', syncBar, { passive: true });
  syncBar();
}

/* ============================================================
   Live hero cards
   ============================================================ */

/* ---- counting numerals ---- */
(() => {
  const nums = [...document.querySelectorAll('.count')];
  if (!nums.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = (el) => {
    const to = +el.dataset.to || 0;
    if (reduce) { el.textContent = to; return; }
    const dur = 1100, t0 = performance.now();
    // if the frame loop never runs (backgrounded tab, stalled compositor)
    // the true figure must still be what the visitor sees
    setTimeout(() => { el.textContent = to; }, dur + 300);
    el.textContent = '0';
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      // ease-out so it settles rather than stopping dead
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    run(e.target); io.unobserve(e.target);
  }), { threshold: 0.4 });
  nums.forEach((n) => io.observe(n));
})();

/* ---- gauge draws itself ---- */
(() => {
  const ring = document.getElementById('gaugeRing');
  if (!ring) return;
  const target = 74;                                  // 35ft vs a 12ft norm
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ring.style.setProperty('--p', target + '%'); return;
  }
  const draw = () => {
    const t0 = performance.now(), dur = 1200;
    setTimeout(() => ring.style.setProperty('--p', target + '%'), dur + 300);
    ring.style.setProperty('--p', '0%');
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      ring.style.setProperty('--p', (target * (1 - Math.pow(1 - k, 3))).toFixed(1) + '%');
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { draw(); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    draw(); io.disconnect();
  }, { threshold: 0.4 });
  io.observe(ring);
})();

/* ---- the clock actually runs on Hawaii time ----
   Hawaii does not observe DST, so the zone is a constant UTC-10 and the
   sunrise/sunset figures below are computed, not hard-coded. */
(() => {
  const elT = document.getElementById('nowTime');
  if (!elT) return;
  const elM = document.getElementById('nowMeridiem');
  const elMeta = document.getElementById('nowMeta');
  const sky = document.getElementById('nowSky');

  const LAT = 20.92, LON = -156.69, TZ = -10;         // Kaanapali / Honokowai

  // NOAA sunrise/sunset, returned as hours after local midnight
  const solar = (date, rise) => {
    const rad = Math.PI / 180;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const day = Math.floor((date - start) / 864e5);
    const lngHour = LON / 15;
    const t = day + ((rise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
    L = (L + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = (RA + 360) % 360;
    RA += (Math.floor(L / 90) * 90) - (Math.floor(RA / 90) * 90);
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(LAT * rad)) /
                 (cosDec * Math.cos(LAT * rad));
    if (cosH > 1 || cosH < -1) return null;            // no rise/set that day
    let H = rise ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    return ((T - lngHour + TZ) % 24 + 24) % 24;
  };

  const fmt = (h) => {
    const hr = Math.floor(h), mn = Math.round((h - hr) * 60);
    const hh = ((hr + (mn === 60 ? 1 : 0)) % 24), mm = mn === 60 ? 0 : mn;
    const ap = hh >= 12 ? 'pm' : 'am';
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}${ap}`;
  };

  const paint = () => {
    const now = new Date();
    // local Hawaii wall-clock, derived from UTC rather than the visitor's zone
    const hi = new Date(now.getTime() + (TZ * 60 + now.getTimezoneOffset()) * 60000);
    const h = hi.getHours(), m = hi.getMinutes();
    elT.textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
    elM.textContent = h >= 12 ? 'pm' : 'am';

    const rise = solar(now, true), set = solar(now, false);
    const cur = h + m / 60;
    if (rise != null && set != null) {
      elMeta.textContent = cur < rise ? `Sunrise ${fmt(rise)}`
        : cur < set ? `Sunset ${fmt(set)}`
        : `Sunrise tomorrow ${fmt(rise)}`;
      const day = cur > rise && cur < set;
      const dusk = Math.abs(cur - set) < 1 || Math.abs(cur - rise) < 1;
      if (sky) sky.dataset.phase = dusk ? 'dusk' : day ? 'day' : 'night';
    }
  };
  paint();
  setInterval(paint, 20000);
})();
