import { useEffect } from 'react';

/**
 * Keeps the stage locked to the visual viewport, and bounds the writing column
 * to the region of the illustration where its text actually clears 4.5:1.
 *
 * The bound is measured from the rendered artwork rather than assumed, so it
 * stays correct when the image is cropped, when the keyboard opens, and when
 * the user zooms text to 200%.
 *
 * The thresholds come from scripts/probe-sky.mjs:
 *
 *   --ink on the sky   >= 6.04:1 above image y 48%, within the left 58%.
 *                      Falls to 3.2:1 over the grey cloud bases below that,
 *                      and over the tree canopy to the right of it.
 *
 * 48% alone is not enough. The artwork is full-bleed, so a wide window scales
 * it up and crops the overflow off the top — which drags image y48% up the
 * screen with it. Past about 2000px the line lands above the column's own top
 * and the writing zone collapses: measured 36px of usable height at 3400px
 * wide, which is a screen with nowhere to write on it.
 *
 * So there are two lines. The strict one holds while the writing is small
 * enough to need 4.5:1. Once the fluid type reaches 24px the writing is large
 * text by WCAG, which needs 3:1 — and the band below 48% measures 3.2:1, so it
 * clears. The deep line is the bear's ground line, which is as far down as the
 * sky goes before the field starts.
 *
 * Wide windows are exactly where the type is at 24px or more, so the case that
 * breaks is the case that is allowed to go deeper.
 *
 * The composer is inside that column, so this one bound now covers the draft
 * as well — there is no separate bar over the grass left to measure.
 */
const SAFE_SKY_Y = 0.48;
const DEEP_SKY_Y = 0.7119; // the bear's ground line — see BEAR_GROUND_Y in App.jsx
const SAFE_SKY_X = 0.58;

/** Where WCAG's large-text allowance starts, for regular weight. */
const LARGE_TEXT_PX = 24;

/**
 * Never less than this much writing zone, whatever the geometry says. A window
 * that leaves nowhere to write is a worse failure than one where the oldest
 * line sits at 3.2:1, and the fade at the top of the column means the line
 * being written is the one furthest from the low-contrast edge anyway.
 */
const MIN_LINES = 4;

export function useStageMetrics({ stageRef, artRef, columnRef, mastheadRef }) {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const stage = stageRef.current;
      if (!stage) return;

      // 1. Track the visual viewport, not the layout viewport. On mobile the
      //    keyboard shrinks the former and leaves the latter alone, so 100vh
      //    puts the bar underneath the keyboard (§8).
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offset = vv ? vv.offsetTop : 0;
      root.style.setProperty('--stage-h', `${height}px`);
      root.style.setProperty('--stage-offset', `${offset}px`);

      // 1b. How tall the masthead actually is. It wraps to two rows on a phone
      //     and one on a desktop, and the sheet's panels start below it — so
      //     this has to be measured rather than assumed from the row count.
      const masthead = mastheadRef?.current;
      if (masthead) {
        const mastheadHeight = masthead.getBoundingClientRect().height;
        root.style.setProperty('--masthead-h', `${mastheadHeight}px`);
      }

      const art = artRef.current;
      const column = columnRef.current;
      if (!art || !column) return;

      const stageBox = stage.getBoundingClientRect();
      const artBox = art.getBoundingClientRect();
      if (artBox.height === 0) return; // image has no box yet

      const artTop = artBox.top - stageBox.top; // negative once the art overflows
      const artLeft = artBox.left - stageBox.left;

      // 2. How far down the column may run. It may descend into the artwork's
      //    sky only if it stays inside the left 58%, where nothing dark sits
      //    behind it; otherwise it stops at the artwork's top edge, above
      //    which the sky is a flat CSS gradient and uniformly safe.
      //
      //    artLeft is zero or negative when the artwork spans the width, and
      //    positive once the tree cap makes it narrower and the mirrored fill
      //    takes up the difference — that fill is the same sky, so the safe
      //    region simply moves right with the artwork.
      const columnBox = column.getBoundingClientRect();
      const safeRightEdge = artLeft + artBox.width * SAFE_SKY_X;
      const columnRight = columnBox.right - stageBox.left;

      // The rendered size of the writing, read off the column rather than
      // recomputed from the clamp in tokens.css — one definition, not two. It
      // has to be the column and not the field: the field only exists once
      // writing has started, and reading a fallback while it was resting was
      // what put wide windows back on the strict line and collapsed them.
      const writingPx = parseFloat(getComputedStyle(column).fontSize);
      const limitY = writingPx >= LARGE_TEXT_PX ? DEEP_SKY_Y : SAFE_SKY_Y;

      const safeBottom =
        columnRight <= safeRightEdge ? artTop + artBox.height * limitY : artTop;

      const columnTop = columnBox.top - stageBox.top;
      const floor = writingPx * 1.9 * MIN_LINES; // 1.9 is .sky__line--mine's leading
      root.style.setProperty(
        '--write-max-h',
        `${Math.max(floor, safeBottom - columnTop)}px`,
      );
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(schedule);
    if (stageRef.current) observer.observe(stageRef.current);
    if (artRef.current) observer.observe(artRef.current);
    // Changes height when its controls wrap, which no window event announces.
    if (mastheadRef?.current) observer.observe(mastheadRef.current);

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    // The art is the only thing whose intrinsic size arrives late.
    const art = artRef.current;
    art?.addEventListener('load', schedule);
    art?.addEventListener('loadedmetadata', schedule);
    document.fonts?.ready.then(schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      art?.removeEventListener('load', schedule);
      art?.removeEventListener('loadedmetadata', schedule);
    };
  }, [stageRef, artRef, columnRef, mastheadRef]);
}
