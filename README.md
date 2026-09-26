# O Thank Heaven 4 711 — Project Handoff

Oceanfront one-bedroom condo at **Maui Sands Seaside, Unit 711**, Kihei, Maui.
35-foot private lanai, open water to Molokai and Lanai, reef snorkelling off the lawn.

---

## Live URLs

| What | URL |
|---|---|
| **Live site** | https://thankheaven4711maui.com |
| **GitHub Pages fallback** | https://zaddywebbuilds.github.io/thankheaven4711 |
| **Cloudflare Chatbot Worker** | https://thankheaven-chat.zaddywebbuilds.workers.dev |

---

## Accounts & Access

| Service | Account | Notes |
|---|---|---|
| GitHub | `zaddywebbuilds` | Push via `gh auth switch -u zaddywebbuilds` first |
| Cloudflare | `zaddywebbuilds` account | Worker: `thankheaven-chat` |
| Domain registrar | vFlyer Inc. | Domain: `thankheaven4711maui.com` |
| OpenAI | client's key | Stored as Cloudflare secret `OPENAI_API_KEY` |

---

## Repository

```
github.com/zaddywebbuilds/thankheaven4711
branch: main  (auto-deploys to GitHub Pages)
local:  C:\Users\Johno\thankheaven4711
```

> **Do NOT move this folder into OneDrive** — git/mmap deadlocks under OneDrive sync.

Push workflow:
```bash
gh auth switch -u zaddywebbuilds
git push origin main
```

GitHub Pages serves from `main` branch root. The `CNAME` file in the repo root
tells Pages to serve on `thankheaven4711maui.com`.

---

## File Structure

```
index.html                  The entire site (one page)
CNAME                       Custom domain for GitHub Pages
checkout.html               Mock Stripe checkout page (demo mode)
assets/
  css/
    site.css                All site styles (v=45)
    chatbot-widget.css      Chatbot panel styles (v=5)
  js/
    site.js                 CONFIG block + hero video + nav + whale video (v=43)
    gallery.js              Gallery rendering + lightbox (v=42)
    chatbot-widget.js       Chatbot widget IIFE (v=5)
  img/
    hero-poster.webp        Video poster 960px/q72 (52 KB)
    chat-header.webp        Chatbot header 720px/q78 (49 KB)
    whale-poster.jpg        Whale video poster frame
    og-cover.jpg            1200x630 Open Graph image
    favicon.svg             Site favicon
  video/
    hero-loop.mp4           Desktop hero loop (1280x720)
    hero-loop-m.mp4         Mobile hero loop (smaller encode)
    whale-lanai.mp4         Humpback whale from lanai, 3.8 MB (1280x720)
  gallery/
    *.webp                  Full-res gallery images (2048px)
    *-400.webp              Grid thumbnails (400px)
    *-t.webp                Lightbox preview (800px)
    *-200.webp              Tiny thumbnails
    *-s.webp                Section display variants (900px) — honu images
    *.mp4                   Gallery video clips
  gallery.json              Generated gallery manifest (127 items)
chatbot/
  src/worker.js             Cloudflare Worker — OpenAI + Calendar + Sheets + Stripe
  property-knowledge.json   Property data injected into AI system prompt
  wrangler.toml             Worker config (SITE_URL, rates, fees, tax)
  package.json              wrangler dev dependency
```

---

## Chatbot System

The chatbot is a **Cloudflare Worker** (`chatbot/src/worker.js`) that:
1. Takes visitor messages via `POST /chat`
2. Runs an OpenAI agentic loop (`gpt-4o-mini`, max 6 iterations, 600 tokens)
3. Calls three tools: `check_availability`, `save_lead`, `create_checkout`
4. Returns the AI reply

### Worker Secrets (set via `wrangler secret put <NAME>`)

| Secret | Status | Notes |
|---|---|---|
| `OPENAI_API_KEY` | ✅ Set | Client's real key — uses `gpt-4o-mini` |
| `STRIPE_SECRET_KEY` | ❌ Not set | Demo mode active — uses `checkout.html` mock |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ❌ Not set | Demo mode — availability always shows available |
| `GOOGLE_PRIVATE_KEY` | ❌ Not set | Demo mode |
| `GOOGLE_CALENDAR_ID` | ❌ Not set | Demo mode |
| `GOOGLE_SHEETS_ID` | ❌ Not set | Leads not saved in demo mode |

**Demo mode is automatic** — the worker detects missing secrets and falls back gracefully.
When client approves, add the real secrets and they activate immediately (no redeploy needed).

### Redeploy worker after any config change:
```bash
cd chatbot
npx wrangler deploy
```

### Worker vars (in `wrangler.toml`, safe to commit):
```
SITE_URL           = https://thankheaven4711maui.com
NIGHTLY_RATE_CENTS = 35000   ($350/night)
CLEANING_FEE_CENTS = 17500   ($175 cleaning)
TAX_RATE           = 0.1496  (14.96% Hawaii tax)
```

---

## DNS (vFlyer Inc.)

Records currently set on `thankheaven4711maui.com`:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | zaddywebbuilds.github.io |

GitHub Pages → Settings → Pages → Custom domain should show `thankheaven4711maui.com`.
Once DNS propagates, tick **Enforce HTTPS** there.

---

## CONFIG Block (owner must fill in)

Open `assets/js/site.js`, top of file:

```js
const CONFIG = {
  bookingHref: 'mailto:CHANGE-ME@example.com?...',  // ← real booking URL or mailto
  strLine:     '',   // ← Hawai'i STR registration number (legally required on all ads)
  legalLine:   '',   // ← footer legal/ownership text
};
```

Empty strings render nothing — safe to publish before these are filled.

---

## Performance (as of last deploy)

| Asset | Before | After |
|---|---|---|
| hero-poster | 174 KB | 52 KB WebP |
| chat-header | 263 KB | 49 KB WebP |
| honu-039 (section) | 576 KB | 117 KB WebP (900px) |
| honu-040 (section) | 229 KB | 54 KB WebP (900px) |
| Google Fonts | render-blocking | preload+onload (non-blocking) |
| Whale video | autoplay always | JS-gated: only on good connection + in viewport |
| Scripts | inline end-of-body | `defer` |

---

## What's Done

- [x] Full static marketing site — hero video bento, 6 narrative sections, gallery, FAQ, booking CTA
- [x] Gallery: 127 items (photos + clips), classified by room/subject, lightbox with swipe
- [x] Live Hawaii clock card in hero
- [x] Sticky nav with scroll-spy, mobile hamburger menu
- [x] Sticky "Check availability" conversion bar (appears after hero, hides near book section)
- [x] AI chatbot widget — name-first, personalized, guides visitor to booking
- [x] Chatbot: availability check (demo mode), email capture, mock checkout flow
- [x] Mock checkout page (`checkout.html`) — looks like Stripe, accepts any card, generates fake ref
- [x] Humpback whale video from lanai — 3.8 MB, 1280×720, lazy-autoplays on scroll
- [x] Performance pass — WebP images, non-blocking fonts, lazy whale video, defer scripts
- [x] Mobile: responsive at all breakpoints, chatbot lifts above sticky CTA bar
- [x] Custom domain `thankheaven4711maui.com` — DNS set, CNAME committed, worker updated
- [x] SEO: LodgingBusiness + VacationRental + FAQPage JSON-LD, canonical, OG, Twitter card

---

## What's Pending (owner actions)

| Item | Who | Notes |
|---|---|---|
| **Enable HTTPS** on GitHub Pages | Owner | Settings → Pages → Enforce HTTPS (after DNS propagates) |
| **Booking URL** | Owner | Replace `mailto:CHANGE-ME` in CONFIG.bookingHref |
| **STR registration number** | Owner | Required by Hawaii for short-term rental advertising |
| **Google service account** | Owner/dev | For real calendar availability checks |
| **Google Sheets ID** | Owner/dev | For lead capture to spreadsheet |
| **Stripe secret key** | Owner/dev | `sk_live_...` when ready to take real payments |
| **Switch SITE_URL back to www** | Dev | Update wrangler.toml if they use `www.` as canonical |
| **Photo consent/releases** | Owner | 20 images held back (faces). One-line change per image in gallery classification. |
| **Street address** | Owner | JSON-LD has region only — add street address when confirmed |
| **Landscape photography** | Owner | Source album is portrait-heavy; reshoots wanted for lanai wide, view, and living room |

---

## Local Preview

No build step. Serve locally:
```bash
python -m http.server 8099
# then open http://localhost:8099
```

The hero video loads as a src attribute (not a Blob), so `file://` works for most things,
but serving via HTTP is more accurate.

---

## To Add Real Stripe

```bash
cd chatbot
npx wrangler secret put STRIPE_SECRET_KEY
# paste sk_live_... when prompted
```

No code change needed — the worker auto-detects the key and switches from demo to real Stripe.

## To Add Google Calendar / Sheets

```bash
cd chatbot
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
npx wrangler secret put GOOGLE_CALENDAR_ID
npx wrangler secret put GOOGLE_SHEETS_ID
```

The service account needs:
- Calendar: "See free/busy information" on the property's calendar
- Sheets: "Editor" on the leads spreadsheet

---

## Version Bumping

When editing CSS or JS, bump the `?v=` query string in `index.html` to bust browser cache:

```html
<link rel="stylesheet" href="assets/css/site.css?v=45" />          <!-- bump if site.css changes -->
<link rel="stylesheet" href="assets/css/chatbot-widget.css?v=5" />  <!-- bump if chatbot CSS changes -->
<script src="assets/js/site.js?v=43" defer></script>               <!-- bump if site.js changes -->
<script src="assets/js/gallery.js?v=42" defer></script>            <!-- bump if gallery.js changes -->
<script src="assets/js/chatbot-widget.js?v=5" defer></script>      <!-- bump if chatbot JS changes -->
```

Also bump `MEDIA_V` in `site.js` whenever a hero video clip is re-encoded.

---

## Chatbot System Prompt / Property Data

Edit `chatbot/property-knowledge.json` to update property details.
The worker reads it at deploy time — redeploy (`npx wrangler deploy`) after any change.

---

*Last updated: 2026-09-26. Site version: main branch, commit c0c19a0.*
