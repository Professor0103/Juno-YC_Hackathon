import { useEffect } from 'react';

/**
 * Keeps the stage locked to the visual viewport, and bounds the writing column
 * and the input bar to the regions of the illustration where their text
 * actually clears 4.5:1.
 *
 * Both bounds are measured from the rendered artwork rather than assumed, so
 * they stay correct when the image is cropped, when the keyboard opens, and
 * when the user zooms text to 200%.
 *
 * The thresholds come from scripts/probe-sky.mjs and scripts/probe-bar.mjs:
 *
 *   --ink on the sky   >= 6.04:1 above image y 48%, within the left 58%.
 *                      Falls to 3.2:1 over the grey cloud bases below that,
 *                      and over the tree canopy to the right of it.
 *   --paper on the bar >= 4.72:1 with the bar's top edge at image y 62% or
 *                      below, given the gradient scrim in tokens.css. Above
 *                      that the horizon haze is too light to scrim without
 *                      making the bar effectively opaque.
 */
const SAFE_SKY_Y = 0.48;
const SAFE_SKY_X = 0.58;
const BAR_TOP_LIMIT_Y = 0.62;

export function useStageMetrics({ stageRef, artRef, columnRef, dockRef, inputRef }) {
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

      // 3. Cap the composer so a long draft grows the bar upward only as far
      //    as its scrim can still carry --paper.
      const dock = dockRef.current;
      const input = inputRef.current;
      if (dock && input) {
        const limit = artTop + artBox.height * BAR_TOP_LIMIT_Y;
        // Everything in the dock that isn't the text itself: padding, border,
        // safe-area inset. Invariant as the textarea grows.
        const chrome = dock.getBoundingClientRect().height - input.getBoundingClientRect().height;
        const available = height - limit - chrome;
        root.style.setProperty('--composer-max-h', `${Math.max(28, available)}px`);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(schedule);
    if (stageRef.current) observer.observe(stageRef.current);
    if (artRef.current) observer.observe(artRef.current);
    // The dock changes height as the draft grows. Recomputing from it is safe
    // because the quantity taken from it — the chrome around the text — does
    // not itself depend on the cap being set.
    if (dockRef.current) observer.observe(dockRef.current);

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
  }, [stageRef, artRef, columnRef, dockRef, inputRef]);
}
