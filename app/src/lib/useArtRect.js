import { useEffect, useState } from 'react';

/**
 * The rendered box of the artwork image, in pixels relative to the stage.
 *
 * Exists so decorations that belong to a fixed point in the painting (the
 * bear at the foot of the tree) can be placed as a fraction of the image's
 * own box rather than of the viewport. The backdrop is free to resize the
 * artwork or crop it by a different amount at each edge — as long as artRef
 * still points at the real <img>, a decoration anchored through this hook
 * tracks it exactly.
 */
export function useArtRect(stageRef, artRef) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const stage = stageRef.current;
      const art = artRef.current;
      if (!stage || !art) return;

      const stageBox = stage.getBoundingClientRect();
      const artBox = art.getBoundingClientRect();
      if (artBox.width === 0 || artBox.height === 0) return; // no box yet

      setRect((prev) => {
        const next = {
          left: artBox.left - stageBox.left,
          top: artBox.top - stageBox.top,
          width: artBox.width,
          height: artBox.height,
        };
        if (
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(schedule);
    if (stageRef.current) observer.observe(stageRef.current);
    if (artRef.current) observer.observe(artRef.current);

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    const art = artRef.current;
    art?.addEventListener('load', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      art?.removeEventListener('load', schedule);
    };
  }, [stageRef, artRef]);

  return rect;
}
