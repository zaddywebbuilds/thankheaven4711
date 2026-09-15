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

/* ---------- apply config ---------- */
document.querySelectorAll('[data-cfg]').forEach((el) => {
  const v = CONFIG[el.dataset.cfg];
  if (!v) { if (el.tagName !== 'A') el.remove(); return; }
  if (el.tagName === 'A') el.href = v; else el.textContent = v;
});

/* ---------- clip picker ----------
   The engine takes a single clip path, so choose the light mobile
   encode up front. Narrow screens get 900px/-g 6 instead of 1440px. */
const MOBILE = matchMedia('(max-width: 820px)').matches;
const clip = (n) => `assets/video/${n}${MOBILE ? '-m' : ''}.mp4`;

/* ---------- the cinematic opening ---------- */
mountScrollWorld(document.getElementById('world'), {
  brand: { name: 'O thank Heaven 4 711', href: '#top' },
  hint: 'scroll to explore',
  diveScroll: 1.35,
  nav: true,
  sections: [
    {
      id: 'arrival',
      label: 'Arrival',
      still: 'assets/img/poster-arrival.jpg',
      clip: clip('arrival'),
      accent: '#2FB5AB',
      eyebrow: 'Maui Sands Seaside · Unit 711',
      title: 'A $1 million view from 700 square feet.',
      body: 'Oceanfront on Maui’s west shore. The water starts where the lawn ends, and nothing stands between the lanai and the horizon.',
      tags: ['Oceanfront', 'One bedroom', 'Sleeps in quiet'],
    },
    {
      id: 'lanai',
      label: 'The Lanai',
      still: 'assets/img/poster-lanai.jpg',
      clip: clip('lanai'),
      accent: '#1B7F7A',
      eyebrow: 'Thirty-five feet',
      title: 'The lanai is the whole point.',
      body: 'It runs the full length of the unit — room for morning coffee at one end and sunset at the other, with no neighbour close enough to hear.',
      tags: ['35 ft', '180° views', 'Private'],
    },
    {
      id: 'reef',
      label: 'The Reef',
      still: 'assets/img/reef-palms.jpg',
      clip: clip('reef'),
      accent: '#2FB5AB',
      eyebrow: 'Straight off the lawn',
      title: 'The snorkelling needs no drive.',
      body: 'Reef, turtles and outrigger canoes, close enough that the plan can change on ten minutes’ notice.',
      tags: ['Snorkelling', 'Reef', 'Canoes'],
    },
    {
      id: 'honu',
      label: 'Honu',
      still: 'assets/img/honu-sand.jpg',
      accent: '#F2B544',
      eyebrow: 'Neighbours',
      title: 'The honu haul out below the building.',
      body: 'Hawaiian green sea turtles come ashore to bask. They are wild and protected — watch from ten feet back.',
    },
    {
      id: 'rainbows',
      label: 'Rainbows',
      // Still-only: the one rainbow clip she sent is shot portrait, and
      // centre-cropping it to a landscape stage loses the rainbow.
      still: 'assets/img/rainbow-palms.jpg',
      accent: '#FF7A4D',
      eyebrow: 'West shore weather',
      title: 'Rain here lasts four minutes and leaves a rainbow.',
      body: 'It passes through, the light comes back, and the whole channel turns over in colour.',
    },
    {
      id: 'sunset',
      label: 'Sunset',
      still: 'assets/img/sunset-palm.jpg',
      clip: clip('sunset'),
      accent: '#FF7A4D',
      eyebrow: 'Every evening',
      title: 'The sun goes down across the channel.',
      body: 'No resort tower in the way, no one asking you to move along. Just the lanai, and the part of the day people fly here for.',
    },
    {
      id: 'inside',
      label: 'Inside',
      still: 'assets/img/inside-to-lanai.jpg',
      accent: '#2FB5AB',
      eyebrow: 'Seven hundred square feet',
      title: 'Small, and pointed entirely at the water.',
      body: 'A full kitchen, a real bedroom, and a living room that opens onto the lanai so the two become one room.',
      tags: ['Full kitchen', 'One bedroom', 'Ceiling fans'],
    },
    {
      id: 'door',
      label: 'Unit 711',
      still: 'assets/img/poster-door.jpg',
      clip: clip('door'),
      accent: '#F2B544',
      eyebrow: 'Come and sit',
      title: 'O thank Heaven 4 711.',
      body: 'Dates, rates, and the things that never make it into a listing.',
      cta: { primary: { label: 'Check availability', href: '#book' } },
    },
  ],
});

/* ---------- hide the engine's fixed chrome past the world ----------
   A plain scroll test rather than an observer: the world track is
   thousands of pixels tall, which makes rootMargin percentages
   unreliable here. */
const site = document.getElementById('site');
const syncChrome = () => {
  if (!site) return;
  document.body.classList.toggle('past-world', scrollY > site.offsetTop - innerHeight * 0.6);
};
addEventListener('scroll', syncChrome, { passive: true });
addEventListener('resize', syncChrome, { passive: true });
syncChrome();

/* ---------- reveal on scroll ----------
   A ratio threshold cannot work here: the gallery is ~16000px tall, so
   0.18 of it is ~2900px and can never fit on screen - its heading sat at
   opacity 0 forever, leaving a blank band. Fire on first contact instead,
   pulled in slightly from the bottom edge so the reveal still reads as
   deliberate, and stop observing once shown. */
const reveal = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in-view');
    reveal.unobserve(e.target);
  }),
  { threshold: 0, rootMargin: '0px 0px -12% 0px' }
);
document.querySelectorAll('.sec').forEach((s) => reveal.observe(s));

/* Failsafe: if the observer has not fired for a section after a couple of
   seconds (a stalled renderer, a throttled tab), show it anyway. Content
   must never be left hidden behind an animation that did not run. */
setTimeout(() => {
  document.querySelectorAll('.sec:not(.in-view)').forEach((s) => {
    if (s.getBoundingClientRect().top < innerHeight) s.classList.add('in-view');
  });
}, 2500);

/* ---------- sticky conversion bar ----------
   Appears once the hero is behind you, hides again over the booking
   section so it never covers the button it is pointing at. */
const bar = document.getElementById('ctaBar');
const book = document.getElementById('book');
if (bar && book) {
  bar.hidden = false;
  const syncBar = () => {
    const past = scrollY > innerHeight * 0.85;
    const atBook = book.getBoundingClientRect().top < innerHeight * 0.9;
    bar.classList.toggle('is-on', past && !atBook);
  };
  addEventListener('scroll', syncBar, { passive: true });
  addEventListener('resize', syncBar, { passive: true });
  syncBar();
}
