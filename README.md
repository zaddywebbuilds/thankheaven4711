# O Thank Heaven 4 711

Marketing site for an oceanfront one-bedroom at **Maui Sands Seaside, Unit 711**, Maui.

The pitch, in the owner's own words: *a $1 million view from a cozy 700-square-foot
one-bedroom* — with a 35-foot private lanai where most oceanfront condos give you twelve.

## What this is

A static site. No build step, no framework, no dependencies to install.

Second design. The first opened with a scroll-scrubbed cinematic sequence and an
AI-rendered sphere; the owners rejected it - the landing page did not work for
them, navigation was hard, and the body copy read as "grayed out". All three are
addressed here:

- **Opens with video.** A full-bleed autoplay loop, which is what they asked for.
  The poster carries the hero on its own, so the clip is an enhancement.
- **Real navigation.** A fixed nav with six anchors and scroll-spy, instead of
  16,000px of hijacked scrolling before any information.
- **Readable copy.** Body text went from 5.56:1 to 8.34:1 and eyebrows from
  4.04:1 (an actual AA failure at 11.8px) to 6.00:1.

The page follows the owner's own description of a morning there: waking to the
water, tea in the kitchen with Molokai and Lanai on the horizon, out onto the
lanai, the reef, then the evening.

### The gallery

Every usable photo and clip from the owner's album, grouped by room and subject with
its own label - 113 photos and 14 videos across 14 categories. Click anything for the
lightbox; clips play in place.

It is generated, not hand-written. The classification lives in `scratchpad-classify.py`
(index -> category + label); the build resizes everything, encodes the clips and emits
`assets/gallery.json`, which `assets/js/gallery.js` renders. To relabel or recategorise
an item, edit the table and re-run the build.

```
index.html              the page
assets/css/site.css     everything below the cinematic opening
assets/js/site.js       scene config + CONFIG block (edit this)
assets/js/scrub-engine.js   the scroll-scrub engine (vendored, don't edit)
assets/js/gallery.js    renders the classified gallery from gallery.json
assets/js/hero.js       sphere hero: callout pins + procedural vapour
assets/gallery.json     generated manifest: every item, its category and label
assets/gallery/         gallery media, up to 2048px + 800px thumbs (webp), clips (mp4)
assets/img/             stills, posters, hero art, favicon
assets/video/           8s scene clips, desktop (1440px) + `-m` mobile (900px)
```

## Depth / motion

Three reveal paths, and exactly one runs. The head script decides:

| Condition | What happens |
|---|---|
| `animation-timeline: view()` supported, motion allowed | `.css-depth` - scroll-driven CSS animations, no JS, off the main thread |
| No support, motion allowed | `.js-reveal` - the IntersectionObserver fallback |
| No JS, or reduced motion | Neither class; the page renders fully visible |

They can never both run, so nothing fights over `opacity` or `transform`.

Two gotchas if you edit this:

- `.css-depth .sec .wrap > *` matches `.honu-stage` too, so the honu's
  depth rule has to out-specify it (`.sec .wrap > .honu-stage`) or the
  turtle gets the flat rise instead.
- Never animate `transform` on `.gcard` here - that property belongs to
  the pointer tilt. Cards animate `opacity` only.

## Performance

Initial mobile load is ~1.2MB (was 3.5MB). What mattered:

- The scroll engine downloads each clip as a **Blob**, so every clip is paid
  for in full before it can scrub. Mobile encodes are now 640px/20fps/6s -
  the set went from 6.9MB to 1.8MB - and on `saveData` or a 2g/3g connection
  no clip is passed at all, so scenes fall back to their poster stills.
- Gallery images ship at 200 / 400 / 800px with `srcset` + `sizes`. Phones
  were downloading 800px files into 163px slots.
- The eight hero circles use the 200px variant. At 800px they cost 426KB
  for eight 45px circles; now ~32KB.
- **Do not add `content-visibility` to `.gcat`.** It skips layout for
  off-screen categories, which collapses the grid to one column at the
  moment the browser resolves `srcset`, and every card then picks the 800px
  candidate. It was tried and reverted.

Media filenames do not change when re-encoded, so `MEDIA_V` in `site.js`
versions the clip URLs; bump it whenever a clip is replaced. Same reason the
css/js links carry `?v=`.

## Image quality

Nothing is ever upscaled - every size is `min(target, source)`, so a 1024px
original ships at 1024px rather than being stretched. Gallery images go to
2048px at q86 and thumbs to 800px at q80; 56 of the 113 photos have sources
larger than the old 1600px cap and now use it.

Two blur sources were fixed: the scene posters were 1600x900 generated from
1440x810 video (an 11% upscale), and the lightbox used to letterbox small
images up to the viewport. The lightbox now sizes from the manifest's own
dimensions and never renders past an image's natural size.

55 of the photos have sources at or below 1200px - those came in compressed
and cannot be improved without re-shoots.

## SEO

- One `h1`, then `h2` per section and `h3` per gallery category.
- `LodgingBusiness` + `VacationRental` + `FAQPage` JSON-LD in `index.html`. The address
  carries region and country only - **fill in the street address** once confirmed.
- Canonical, Open Graph and Twitter card all point at the Pages URL. Change these
  together the day a custom domain is attached, or they will point at the wrong host.
- `robots.txt` allows everything and names the sitemap. It must stay that way - a
  previous project shipped a robots.txt that silently blocked every crawler.
- `og-cover.jpg` is 1200x630, generated from the lanai shot.
- The hero image is preloaded with `fetchpriority=high`, since it is the LCP element.

Every factual claim on the page is visible in the photos. Nothing about sleeping
capacity, parking, wifi, A/C or rates is asserted, because none of it is confirmed.

## Local preview

The engine loads video as a Blob, so `file://` will not work — it must be served:

```bash
python -m http.server 8099
```

## Before this goes live

Open `assets/js/site.js` and fill in the `CONFIG` block at the top:

| Key | What it needs |
|---|---|
| `bookingHref` | Real booking destination. Currently a placeholder mailto. |
| `strLine` | **Hawai'i short-term-rental registration number.** Several counties require this on all advertising, a website included. Confirm the county's rule before launch. |
| `legalLine` | Anything else for the footer. |

Empty strings render nothing, so the page is safe to publish before these are filled.

## Open items

- **Photo consent.** 20 images are held back: every one with a recognisable face
  (owners, guests, and children on the beach) plus the AI turtle mockup. They are marked
  `x` in the classification, so switching any of them on is a one-line change once
  releases exist.
- **Island naming.** Copy says "across the channel" rather than naming the island in the
  view, because that was inferred from photos, not confirmed. Confirm and make it specific —
  a named island sells better than a vague one.
- **Landscape photography.** The source album is 141 portrait vs 82 landscape. A website
  wants wide. Priority reshoots: the full 35-foot lanai, the view morning and sunset,
  and the living room with daylight — all held sideways.
- **There is no honu footage.** The album's 123 clips reduce to 14 distinct ones
  (checked twice, on a first-second frame and again on a mid-duration frame) and none
  contain a turtle. The honu section uses the two real stills, drifting and cross-fading.
  A real clip would be a straight upgrade if she ever shoots one.
- **The rainbow scene is still-only.** The one rainbow clip is shot portrait and loses the
  rainbow when cropped to a landscape stage. A landscape reshoot would earn it a clip.
- **AI mockup is not used.** The turtle-on-the-wall image the owner generated is a
  visualization, not a photo of the property, and must not appear as one.

## Deployment

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
The whole repo is the artifact — there is nothing to build.
