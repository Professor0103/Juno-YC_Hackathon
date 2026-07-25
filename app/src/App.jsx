import { useCallback, useEffect, useRef, useState } from 'react';
import { auditDaywalkerGlyphs, normaliseForDaywalker } from './lib/daywalker.js';
import { askDeepeningQuestion } from './lib/reply.js';
import { useArtRect } from './lib/useArtRect.js';
import { useStageMetrics } from './lib/useStageMetrics.js';

/* The opening line. Author-controlled and short, so Daywalker is safe.
   Not a question about the user's interior state (§16). */
const OPENING = 'Start anywhere.';

const formatDate = (date) =>
  date
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(',', '')
    .toUpperCase();

/* Built by hand rather than through toLocaleTimeString, which returns "24:00"
   for midnight under hour12: false in some engines. */
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

let nextId = 1;
const line = (who, text) => ({ id: nextId++, who, text });

export default function App() {
  const [lines, setLines] = useState(() => [line('opening', OPENING)]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const columnRef = useRef(null);
  const dockRef = useRef(null);
  const inputRef = useRef(null);

  useStageMetrics({ stageRef, artRef, columnRef, dockRef, inputRef });

  /* Fade is presentational. The oldest writing dissolves at the top of the
     writing zone and then goes to zero; the text stays in state and in the
     DOM, and scrolling back up brings it whole. Losing sight of your own words
     is acceptable; losing the words is not — this user may be writing
     something they will not write twice. */
  /* Whether the user is reading the newest writing or has scrolled back into
     the session. Resizing shouldn't yank them out of the latter. */
  const atBottomRef = useRef(true);

  const updateFade = useCallback(() => {
    const column = columnRef.current;
    if (!column) return;

    const top = column.scrollTop;
    atBottomRef.current = column.scrollHeight - top - column.clientHeight < 8;
    // Drives the dissolve at the top edge, which is off until there is
    // something above the fold to dissolve.
    column.dataset.scrolled = top > 1 ? 'true' : 'false';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const el of column.children) el.removeAttribute('data-faded');
      return;
    }

    for (const el of column.children) {
      const isAbove = el.offsetTop + el.offsetHeight <= top;
      if (isAbove) el.setAttribute('data-faded', 'true');
      else el.removeAttribute('data-faded');
    }
  }, []);

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    // Keep the newest line in view; older ones displace upward and fade.
    column.scrollTop = column.scrollHeight;
    updateFade();
  }, [lines, waiting, updateFade]);

  /* The writing zone changes height when the viewport does — rotation, the
     keyboard, text zoom. Without this the column keeps its old scroll offset
     and the newest line ends up sliced by the bottom edge. */
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;

    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        const behaviour = column.style.scrollBehavior;
        column.style.scrollBehavior = 'auto';
        column.scrollTop = column.scrollHeight;
        column.style.scrollBehavior = behaviour;
      }
      updateFade();
    });
    observer.observe(column);
    return () => observer.disconnect();
  }, [updateFade]);

  useEffect(() => {
    if (import.meta.env.DEV) auditDaywalkerGlyphs();
  }, [lines]);

  /* Autogrow the bar upward into the grass. --composer-max-h caps it so it
     never lifts out of the band where --paper is legible. */
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, [draft]);

  const handleChange = (event) => {
    // Substitute on the way in, so what they type is what the sky shows.
    setDraft(normaliseForDaywalker(event.target.value));
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || waiting) return;

    const mine = line('mine', text);
    setDraft('');
    setLines((current) => [...current, mine]);
    setWaiting(true);

    try {
      const question = await askDeepeningQuestion([...lines, mine]);
      setLines((current) => [...current, line('mango', question)]);
    } finally {
      setWaiting(false);
    }
  };

  const handleKeyDown = (event) => {
    // Enter commits; Shift+Enter breaks the line. Every path works from the
    // keyboard alone (§17).
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  const canSend = draft.trim().length > 0 && !waiting;

  return (
    <div className="stage" ref={stageRef}>
      <Backdrop artRef={artRef} stageRef={stageRef} />

      <header className="masthead">
        <h1 className="masthead__wordmark" data-face="daywalker">
          mango
        </h1>
        <Clock />
      </header>

      <main className="sky">
        <div
          className="sky__column"
          ref={columnRef}
          onScroll={updateFade}
          tabIndex={0}
          role="log"
          aria-live="polite"
          aria-label="What you have written, and what Mango has asked"
        >
          {lines.map((entry) => (
            <p
              key={entry.id}
              className={`sky__line sky__line--${entry.who === 'opening' ? 'prompt' : entry.who}`}
              data-face={entry.who === 'mango' ? 'newsreader' : 'daywalker'}
            >
              {entry.text}
            </p>
          ))}
          {waiting && (
            <p className="sky__line sky__line--mango" aria-label="Mango is writing">
              <span className="sky__waiting" aria-hidden="true">
                |
              </span>
            </p>
          )}
        </div>
      </main>

      <div className="dock" ref={dockRef}>
        <form className="composer" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="composer">
            Write
          </label>
          <textarea
            id="composer"
            className="composer__input"
            ref={inputRef}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Write"
            autoComplete="off"
            spellCheck="true"
          />
          <button className="composer__send" type="submit" disabled={!canSend}>
            <span className="visually-hidden">Send</span>
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Date and 24-hour time, ticking. Its own component so the second-by-second
 * re-render doesn't touch the writing.
 */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(new Date());
      // Re-aimed at the next whole second each time. A flat 1000ms interval
      // drifts, and the drift shows as a second that visibly skips.
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <p className="masthead__clock">
      <span className="masthead__clock-date">{formatDate(now)}</span>
      {/* Deliberately not a live region: announcing the time every second
          would make the page unusable with a screen reader. */}
      <time className="masthead__clock-time" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>
    </p>
  );
}

/**
 * The artwork at its native aspect ratio, with the sky extended above it in
 * CSS. See the note in home.css for why this is a composite rather than
 * object-fit: cover, and how the overflow is split between the two edges so a
 * short viewport doesn't crop the canopy away.
 */
function Backdrop({ artRef, stageRef }) {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__sky" />
      <Landscape className="backdrop__art" imgRef={artRef} priority />
      <Bear stageRef={stageRef} artRef={artRef} />
    </div>
  );
}

/* Where the bear sits in the painting, as a fraction of the artwork's own
   box — centre-x, and the ground line where its feet meet the grass, both
   measured off the reference mark at the foot of the trunk. A fraction of
   the image (not the viewport) so the bear stays put at the tree no matter
   how the backdrop crops or scales around it. */
const BEAR_X = 0.7095;
const BEAR_GROUND_Y = 0.7119;
const BEAR_WIDTH_SHARE = 0.12; // of the artwork's rendered width

/**
 * A small tired bear, resting where it's always rested — at the foot of the
 * tree. Placed from the measured art rect (useArtRect) rather than from CSS
 * percentages nested inside the backdrop, so it doesn't care how that
 * markup — or its aspect-ratio handling — is shaped underneath it.
 */
function Bear({ stageRef, artRef }) {
  const rect = useArtRect(stageRef, artRef);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (!rect) return null;

  const width = rect.width * BEAR_WIDTH_SHARE;
  const left = rect.left + rect.width * BEAR_X - width / 2;
  const top = rect.top + rect.height * BEAR_GROUND_Y - width; // sprite is square

  return (
    <img
      className="backdrop__bear"
      style={{ left, top, width, height: width }}
      src={reducedMotion ? '/sprites/bear-resting-static.png' : '/sprites/bear-resting.gif'}
      alt=""
      decoding="async"
    />
  );
}

function Landscape({ className, imgRef, priority = false }) {
  return (
    <picture className={className}>
      <source
        type="image/avif"
        srcSet="/landscape/landscape-640.avif 640w, /landscape/landscape-1024.avif 1024w"
        sizes="100vw"
      />
      <source
        type="image/webp"
        srcSet="/landscape/landscape-640.webp 640w, /landscape/landscape-1024.webp 1024w"
        sizes="100vw"
      />
      <img
        ref={imgRef}
        src="/landscape/landscape-1024.webp"
        alt=""
        width="1024"
        height="717"
        decoding="async"
        fetchPriority={priority ? 'high' : 'low'}
      />
    </picture>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V5M12 5l-6 6M12 5l6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
