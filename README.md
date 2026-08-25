# Pasindu & Nihara — wedding invitation

A single-page, scroll-driven invitation. 16 January 2027 (St. Joseph's Church, Wennappuwa)
and 17 January 2027 (The Glasshouse). No framework, no build step — plain HTML, CSS and JS.

Live: https://pasindu0707.github.io/PasinduAndNihara/

```
site/                 everything that gets published
  index.html
  assets/css/style.css
  assets/js/main.js   config lives at the top of this file
  assets/js/vendor/   lenis.min.js — vendored, no CDN at runtime
  assets/img/*.webp   built from img/ — do not edit by hand
  assets/video/       hero-sm.mp4 (phones), hero-lg.mp4 (desktop), poster
  assets/cal/*.ics    add-to-calendar files
  data/guests.json    generated — names only, never phone numbers
tools/
  apps-script.gs      the Google Apps Script — paste into the sheet
  build-assets.sh     originals in img/  →  site/assets
  build-guests.mjs    Google Sheet       →  guests.json + links.html
  shot.mjs            screenshots via Chrome DevTools Protocol
img/                  original photos and video (not published)
```

## Everyday tasks

**Preview locally**

```bash
python -m http.server 5173 --directory site
```

Then open `http://localhost:5173/?to=<guest-id>`.
Add `&skip=1` to bypass the envelope while working.

**Rebuild images and video after changing anything in `img/`**

```bash
bash tools/build-assets.sh
```

**Rebuild the guest list after editing the Google Sheet**

```bash
node tools/build-guests.mjs
```

That writes `site/data/guests.json` (published), `tools/links.html` (local only —
open it in a browser for one WhatsApp send button per guest) and `GUEST_LINKS.md`
(local only — a plain name-and-link table to paste anywhere). It also prints a list
of anything odd in the sheet.

**Deploy**

Push to `main`. The workflow in `.github/workflows/deploy.yml` publishes `site/`.
In the repo settings, Pages → Source must be set to **GitHub Actions**.

## How the personalisation works

Each guest gets `…/?to=<id>`, where `<id>` is a slug of their name from the sheet.
`main.js` looks the id up in `guests.json` and fills in the envelope, the invitation
line, the RSVP form, and their table number. Anyone opening the bare URL gets
"you and your family" instead — nothing breaks.

`guests.json` is public, so it deliberately carries **no phone numbers**. Those stay
in the sheet and in `tools/links.html`, neither of which is deployed.

## Knowing who has opened their invitation

The first time a guest opens their own link on a given day, the page sends one
line to the sheet's `OPENS` tab: timestamp, guest id, name. Nothing else — no
page views, no scroll depth, no device details. It is sent with `sendBeacon`
and failures are swallowed, so it can never delay or break the page.

In the spreadsheet, **Wedding → Who hasn't opened it** builds a `NOT OPENED`
tab listing every guest with no open on record. That menu comes from
`tools/apps-script.gs`, which also handles RSVP posts — paste it over the
script in the sheet and redeploy.

## Known limitation — the sheet itself is world-readable

`build-guests.mjs` pulls the sheet over the anonymous CSV endpoint, so the sheet has
to be "anyone with the link can view" — and its id sits in this public repo. Anyone
who reads the repo can read the whole GUESTS tab, **including the phone column**.
That column is empty today. Before filling it in, either keep phone numbers in a
separate sheet that is not shared, or take the sheet private and feed the script a
CSV you export by hand:

```bash
node tools/build-guests.mjs guests.csv
```

## Known limitation — the RSVP endpoint

The Apps Script `/exec` URL sits in `main.js`, which anyone can read. That is unavoidable
for a static site: it means someone could post junk rows to the sheet. If that ever
happens, have the script reject any POST whose `guestId` isn't in the GUESTS tab.
