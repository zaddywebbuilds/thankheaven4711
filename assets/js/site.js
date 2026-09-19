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
const MEDIA_V = '21';
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
