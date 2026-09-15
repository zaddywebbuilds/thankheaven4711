# O Thank Heaven 4 711

Marketing site for an oceanfront one-bedroom at **Maui Sands Seaside, Unit 711**, Maui.

The pitch, in the owner's own words: *a $1 million view from a cozy 700-square-foot
one-bedroom* — with a 35-foot private lanai where most oceanfront condos give you twelve.

## What this is

A static site. No build step, no framework, no dependencies to install.

- A **scroll-scrubbed cinematic opening** — eight scenes where video scrubs frame-by-frame
  against scroll position, cross-dissolving between them.
- Conventional content sections below it: the lanai comparison, the honu, the interior,
  a gallery reel, and the booking CTA.

```
index.html              the page
assets/css/site.css     everything below the cinematic opening
assets/js/site.js       scene config + CONFIG block (edit this)
assets/js/scrub-engine.js   the scroll-scrub engine (vendored, don't edit)
assets/img/             stills, posters, favicon
assets/video/           8s clips, desktop (1440px) + `-m` mobile (900px)
```

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

- **Photo consent.** Every recognisable face was deliberately excluded from the build.
  The source album contains the owners, guests, and children on the beach; none of them
  go on a public site without releases.
- **Island naming.** Copy says "across the channel" rather than naming the island in the
  view, because that was inferred from photos, not confirmed. Confirm and make it specific —
  a named island sells better than a vague one.
- **Landscape photography.** The source album is 141 portrait vs 82 landscape. A website
  wants wide. Priority reshoots: the full 35-foot lanai, the view morning and sunset,
  and the living room with daylight — all held sideways.
- **The rainbow scene is still-only.** The one rainbow clip is shot portrait and loses the
  rainbow when cropped to a landscape stage. A landscape reshoot would earn it a clip.
- **AI mockup is not used.** The turtle-on-the-wall image the owner generated is a
  visualization, not a photo of the property, and must not appear as one.

## Deployment

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
The whole repo is the artifact — there is nothing to build.
