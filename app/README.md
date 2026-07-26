# Mango — home screen, iteration 1

A visual-direction test: the illustrated landscape is the whole screen, the
user writes into the sky, and a translucent bar sits in the grass. Built to be
judged on a real phone.

Vite + React. The screen itself is simple enough for plain HTML, but the
composite backdrop, the fade, and the keyboard handling all need the same
measurements at the same time, and the seams this leaves — the archive, the
session transcript, the safety layer — attach to a component tree rather than
to a script.

## Running it

```bash
npm install
npm run dev
```

The processed assets are committed, so this works from a clean checkout.

## Asset pipeline

Source files live in `assets-source/` and are not served. `npm run assets`
regenerates everything in `public/`:

- `Daywalker.ttf` → `Daywalker.woff2` (12.6 KB). Converted, **not** subsetted —
  the licence permits format conversion and forbids modifying the font.
- `landscape.png` (2.9 MB) → AVIF and WebP at 640 and 1024 wide (15–37 KB).
  2.9 MB is a fatal first paint on hospital wifi.
- `composition.json` — the measured colours and contrast figures the CSS is
  built on. Regenerated with the images so the two can't drift apart.

## Measurements, not assumptions

Three numbers in the brief did not survive contact with the render, so the
layout is bounded by measurement instead. The probes are committed and
re-runnable:

| | brief | measured | where |
|---|---|---|---|
| `--ink` on the sky | 6.67–8.87:1 | 6.04:1 above image-y 48%, 3.2:1 below | `npm run probe:sky` |
| `--paper` on the bar at 0.30 scrim | "≥4.5:1" | 4.02:1 bare, 4.53:1 blurred | `npm run probe:bar` |
| Top edge of the artwork | `#FAAAA4` | `#FCACA5` | `composition.json` |
| Top of the canopy | image-y 20% | image-y 20.6% | `npm run probe:tree` |

The consequences:

- The writing column stops where `--ink` stops clearing 4.5:1 — measured from
  the rendered artwork at runtime in `src/lib/useStageMetrics.js`, because
  where that falls depends on how the image is cropped.
- The bar's scrim is a gradient, 0.58 at the top falling to 0.42 at the bottom,
  rather than a flat 0.30. The backdrop behind the top of the bar is lighter
  than the backdrop behind its bottom, so only the top needs the weight. This
  holds 4.72:1 with no blur at all, and leaves the bottom of the bar
  translucent enough for the grass to read through.
- `--sky-edge` is the measured edge colour, and the sky extension overlaps the
  artwork by 1px rather than meeting it exactly. Meeting it exactly leaves a
  subpixel gap, which renders as a hairline.
- The overflow is split between the two edges instead of all landing on the
  top. Anchoring the artwork to the bottom is what took the crown off the tree
  on a short, wide window. The top now gives up at most 15% — the canopy starts
  at 20.6%, and above that row the sky's darkest pixel is luminance 0.546
  against the canopy's 0.092, so the boundary is unambiguous — and the bottom,
  which is uniform grass, absorbs the rest up to 22%. Together they cover
  viewports to about 2.27:1; past that the crown starts to go.

## Type and the masthead

The spec's type scale is set for a phone held close. At 1440px the same 19px
sits in an open sky and reads as small print, so the writing, the wordmark and
the clock are fluid (`--t-sky`, `--t-sky-open`, `--t-clock`): they start at the
spec's value, so nothing changes on mobile, and grow to 28/40/18px on desktop.

The clock's position is bounded by the canopy, which spans image-x 64.1–93.7%
and is the one region `--ink` cannot be read against:

- **≥700px wide and squarer than 3:4** — centred on the page. Below 3:4 the
  artwork stops being full bleed and shifts right, which brings the canopy's
  left edge across the centre line.
- **otherwise** — in the left band, aligned to the writing measure. §9.3 puts
  the date hard right, which on this screen is the leaves.
- **under 700px and wider than 1.43:1** — the band narrows to 62%. Past 1.43:1
  the artwork overflows the top and the canopy climbs into the masthead's row.

The clock ticks once a second, aligned to the whole second rather than on a
1000ms interval, which drifts visibly. Tabular figures, so the line doesn't
shift as the digits change, and deliberately not a live region.

## Scope

Home screen only. The text lives in local component state. `src/lib/reply.js`
is where the Anthropic call goes; everything else there is a local stand-in so
the screen can be carried around without a key in the bundle.
