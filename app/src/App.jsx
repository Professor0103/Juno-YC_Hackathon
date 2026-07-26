import { useCallback, useEffect, useRef, useState } from 'react';
import { auditDaywalkerGlyphs, normaliseForDaywalker } from './lib/daywalker.js';
import { CRISIS_HEADING, CRISIS_RESOURCES } from './lib/crisis.js';
import { looksLikeCrisis } from './lib/prefilter.js';
import { privacy } from './lib/privacy.js';
import { deepen, loadOpeningText, prewarm, saveReflection } from './lib/reflection.js';
import { useArtRect } from './lib/useArtRect.js';
import { useStageMetrics } from './lib/useStageMetrics.js';

/**
 * The Reflection session (PSD 3.1).
 *
 * READING   the text is on screen and there is no input field. PSD success
 *           criterion 2 and Risk 1: in silhouette this is a journaling app, and the
 *           mitigation is a layout rule — something to read arrives before anywhere
 *           to write does. "Respond" is what reveals the composer, and it is the
 *           only reason this stage exists.
 * TALKING   the session, for as many turns as they want. They write, Mango reads
 *           back across everything said so far and asks one thing. While a turn is
 *           being generated the writing stays put and the waiting is held on the
 *           page rather than on a spinner (PSD 4.1).
 * KEPT      saved, on their say-so.
 *
 * There were once five stages here and the session ended on the fifth whether or
 * not anything had been reached — two messages, one question, then a composed piece
 * and no way back to the composer. Ending is now the writer's decision and only
 * theirs: Mango may offer to stop, and the offer is a sentence, not a state change.
 *
 * No mode picker, no progress bar, no completion ring, no streak, and no turn
 * counter (PSD Risk 2, 3.8). Nothing reaches the database until KEPT.
 */
const READING = 'reading';
const TALKING = 'talking';
const KEPT = 'kept';

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

export default function App() {
  const [stage, setStage] = useState(READING);
  const [text, setText] = useState(null);

  /* The session, oldest first, in the shape the model is sent. Held here and
     nowhere else until they choose to keep it. */
  const [turns, setTurns] = useState([]);

  /* The turn currently being drawn. Separate from `turns` so a turn that is
     interrupted mid-stream never lands in the transcript. */
  const [streaming, setStreaming] = useState('');

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  /* Set when either screening layer interrupts. Holds what they had written, so
     the card can offer to save or discard it — and holds it in memory only. */
  const [interrupted, setInterrupted] = useState(null);
  const [interruptedOutcome, setInterruptedOutcome] = useState(null);

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const columnRef = useRef(null);
  const dockRef = useRef(null);
  const inputRef = useRef(null);

  useStageMetrics({ stageRef, artRef, columnRef, dockRef, inputRef });

  useEffect(() => {
    prewarm();
    loadOpeningText()
      .then(setText)
      .catch((err) => console.error('[mango] could not load the opening text', err));
  }, []);

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

  /* Two moments read from the top instead of following the newest writing:
     READING, where the served text is the only thing on screen and its first
     line is the whole point — following the bottom scrolls the opening lines out
     of the writing zone on a short viewport, which is the one stage that cannot
     afford it — and the wait on the very first turn, where the text is what stays
     on screen (PSD 4.1) rather than a spinner. As soon as the first token lands,
     the column follows the writing again. Later turns don't do this: by then there
     is a session above the fold and yanking back to the poem would lose their
     place. */
  const readFromTop = stage === READING || (turns.length === 1 && streaming === '');

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    column.scrollTop = readFromTop ? 0 : column.scrollHeight;
    updateFade();
  }, [text, turns, streaming, readFromTop, updateFade]);

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
  }, [turns]);

  /* Autogrow the bar upward into the grass. --composer-max-h caps it so it
     never lifts out of the band where --paper is legible. */
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }, [draft, stage]);

  /* The composer is on screen for the whole session, so focus follows the end of
     each turn rather than a change of stage. */
  useEffect(() => {
    if (stage === TALKING && !busy && !interrupted) inputRef.current?.focus();
  }, [stage, busy, interrupted]);

  /**
   * Drains one turn into state, and commits it to the transcript only once it has
   * finished. A safety frame is the only thing that erases text already drawn on
   * screen, and erasing it is the requirement, not a side effect.
   *
   * @returns {boolean} whether the turn completed rather than being interrupted
   */
  const drain = useCallback(async (events, writing) => {
    setBusy(true);
    setStreaming('');
    let accumulated = '';

    try {
      for await (const event of events) {
        if (event.type === 'safety') {
          setStreaming('');
          setInterrupted(writing);
          return false;
        }
        if (event.type === 'fallback') {
          // The local fallback restarts the turn from nothing, so whatever was
          // drawn from the dead stream goes with it.
          accumulated = '';
          setStreaming('');
          continue;
        }
        accumulated += event.text;
        setStreaming(accumulated);
      }
    } finally {
      setBusy(false);
    }

    const said = accumulated.trim();
    if (said) setTurns((current) => [...current, { role: 'assistant', content: said }]);
    setStreaming('');
    return true;
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const written = draft.trim();
    if (!written || busy) return;

    // Deterministic, local, no network (PSD 3.6). Nothing has been saved and
    // nothing is about to be sent.
    if (looksLikeCrisis(written)) {
      setInterrupted(written);
      return;
    }

    setDraft('');
    setStage(TALKING);

    // Built here rather than read back from state, because the request needs the
    // transcript including this message and setTurns has not landed yet.
    const next = [...turns, { role: 'user', content: written }];
    setTurns(next);

    await drain(deepen({ text, turns: next }), written);
  };

  const handleKeyDown = (event) => {
    // Enter commits; Shift+Enter breaks the line. Every path works from the
    // keyboard alone (§17).
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  /* The only way a session ends. Mango can say it thinks there is a stopping place;
     it cannot take one. */
  const keep = async () => {
    setBusy(true);
    try {
      await saveReflection({ textId: text?.id, turns });
      setStage(KEPT);
    } catch (err) {
      console.error('[mango] could not keep this reflection', err);
    } finally {
      setBusy(false);
    }
  };

  /* The card's two offers. Saving writes an ordinary entry — no flag, no column,
     no note that the card was ever shown. Discarding writes nothing at all. */
  const keepInterrupted = async () => {
    try {
      /* Two paths reach the card and they leave the transcript in different
         states. The local prefilter fires before the message is committed, so it
         still has to be added here; the server's screen fires after, so it is
         already the last turn and adding it again would save it twice. */
      const last = turns[turns.length - 1];
      const already = last?.role === 'user' && last.content === interrupted;

      await saveReflection({
        textId: text?.id,
        turns: already ? turns : [...turns, { role: 'user', content: interrupted }],
      });
      setInterruptedOutcome('saved');
    } catch (err) {
      console.error('[mango] could not save that', err);
    }
  };

  const discardInterrupted = () => {
    setDraft('');
    setInterruptedOutcome('discarded');
  };

  const canSend = draft.trim().length > 0 && !busy;

  /* Waiting on Mango, specifically — not merely busy. `keep` is also busy, and a
     blinking caret while the session is being saved reads as another turn coming. */
  const waitingOnText =
    busy && streaming === '' && turns[turns.length - 1]?.role === 'user';

  /* Shown from the moment there is a session to keep, and never before: ending is
     meaningless on turn one, and a second control in the dock while they are still
     reading the poem is a second thing to decide about. Once shown it stays shown,
     disabled rather than unmounted while a turn streams — the dock must not move
     under a thumb that is already reaching for it. */
  const canLeave = stage === TALKING && turns.some((turn) => turn.role === 'assistant');

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
          aria-label="The text, what you have written, and what Mango has asked"
        >
          {text && (
            <div className="served">
              <p className="served__body">{text.body}</p>
              <p className="served__credit">
                {text.author}
                {text.year_published ? `, ${text.year_published}` : ''}
              </p>
            </div>
          )}

          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <p
                key={index}
                className="sky__line sky__line--mine"
                data-face="daywalker"
              >
                {turn.content}
              </p>
            ) : (
              <p key={index} className="sky__line sky__line--mango">
                {turn.content}
              </p>
            ),
          )}

          {streaming && <p className="sky__line sky__line--mango">{streaming}</p>}

          {waitingOnText && (
            <p className="sky__line sky__line--mango" aria-label="Mango is writing">
              <span className="sky__waiting" aria-hidden="true">
                |
              </span>
            </p>
          )}
        </div>
      </main>

      <div className="dock" ref={dockRef}>
        {interrupted ? (
          <SupportCard
            outcome={interruptedOutcome}
            onKeep={keepInterrupted}
            onDiscard={discardInterrupted}
          />
        ) : stage === TALKING ? (
          <>
            <form className="composer" onSubmit={submit}>
              <label className="visually-hidden" htmlFor="composer">
                Write
              </label>
              <textarea
                id="composer"
                className="composer__input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(normaliseForDaywalker(event.target.value))}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={turns.length === 0 ? 'Write' : 'Go on'}
                autoComplete="off"
                spellCheck="true"
              />
              <button className="composer__send" type="submit" disabled={!canSend}>
                <span className="visually-hidden">Send</span>
                <SendIcon />
              </button>
            </form>

            {/* Quieter than the composer on purpose. Stopping is always available
                and never the suggested move — the session has no natural length
                and nothing here should imply one. */}
            {canLeave && (
              <button className="leave" type="button" onClick={keep} disabled={busy}>
                I&rsquo;ll leave it here
              </button>
            )}
          </>
        ) : stage === READING ? (
          <button className="offer" type="button" onClick={() => setStage(TALKING)} disabled={!text}>
            Respond
          </button>
        ) : stage === KEPT ? (
          <p className="note">{privacy.kept}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The safety interruption (PSD 3.6). It points, and then it stops talking.
 *
 * No assessment, no counselling, no follow-up question, and no third option that
 * quietly continues the session. Nothing about reaching this card is recorded
 * anywhere — which is the part said out loud in the demo, so the copy says it too.
 */
function SupportCard({ outcome, onKeep, onDiscard }) {
  return (
    <section className="support" aria-live="assertive">
      <p className="support__heading">{CRISIS_HEADING}</p>

      <ul className="support__list">
        {CRISIS_RESOURCES.map((resource) => (
          <li key={resource.name} className="support__item">
            <a className="support__action" href={resource.href}>
              {resource.action}
            </a>
            <span className="support__name">{resource.name}</span>
            <span className="support__detail">{resource.detail}</span>
          </li>
        ))}
      </ul>

      <p className="support__note">{privacy.unreported}</p>

      {outcome === null ? (
        <div className="support__choices">
          <button className="support__choice" type="button" onClick={onKeep}>
            Keep what I wrote
          </button>
          <button className="support__choice" type="button" onClick={onDiscard}>
            Discard it
          </button>
        </div>
      ) : (
        <p className="support__note">{outcome === 'saved' ? 'Kept.' : 'Gone.'}</p>
      )}
    </section>
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
