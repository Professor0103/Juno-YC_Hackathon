import { useEffect } from 'react';

/**
 * Keeps the stage locked to the visual viewport, and bounds the writing column
 * to the region of the illustration where its text actually clears 4.5:1.
 *
 * The bound is measured from the rendered artwork rather than assumed, so it
 * stays correct when the image is cropped, when the keyboard opens, and when
 * the user zooms text to 200%.
 *
 * The threshold comes from scripts/probe-sky.mjs:
 *
 *   --ink on the sky   >= 6.04:1 above image y 48%, within the left 58%.
 *                      Falls to 3.2:1 over the grey cloud bases below that,
 *                      and over the tree canopy to the right of it.
 *
 * The composer is inside that column, so this one bound now covers the draft
 * as well — there is no separate bar over the grass left to measure.
 */
const SAFE_SKY_Y = 0.48;
const SAFE_SKY_X = 0.58;

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
      const safeBottom =
        columnRight <= safeRightEdge ? artTop + artBox.height * SAFE_SKY_Y : artTop;

      const columnTop = columnBox.top - stageBox.top;
      root.style.setProperty('--write-max-h', `${Math.max(0, safeBottom - columnTop)}px`);
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
    document.fonts?.ready.then(schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      art?.removeEventListener('load', schedule);
    };
  }, [stageRef, artRef, columnRef, mastheadRef]);
}
