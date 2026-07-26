import { useCallback, useEffect, useRef, useState } from 'react';
import { auditDaywalkerGlyphs, normaliseForDaywalker } from './lib/daywalker.js';
import {
  MODE_LABEL,
  dayKey,
  daysWithEntries,
  entriesOn,
  makeEntry,
  seedEntries,
} from './lib/entries.js';
import { askDeepeningQuestion } from './lib/reply.js';
import { useArtRect } from './lib/useArtRect.js';
import { useStageMetrics } from './lib/useStageMetrics.js';

/* The opening line. Set in Newsreader, so §6.2's missing-glyph problem doesn't
   reach it. Not a question about the user's interior state (§16). */
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

const formatEntryDate = (date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const formatEntryTime = (date) =>
  date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

let nextId = 1;
const line = (who, text) => ({ id: nextId++, who, text });

export default function App() {
  const [lines, setLines] = useState(() => [line('opening', OPENING)]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [mode, setMode] = useState('journal');
  /* Which sheet the overlay is showing, if any: null | 'help' | 'calendar'. */
  const [sheet, setSheet] = useState(null);
  /* Everything kept, in memory only — see lib/entries.js. */
  const [entries, setEntries] = useState(() => seedEntries());
  /* Entry cards currently on the screen, in the order they were opened. Each
     carries its own position, so several can be out at once. */
  const [cards, setCards] = useState([]);
  /* Which way the composer is offering to take the writing: 'text' | 'voice'. */
  const [input, setInput] = useState('text');

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const columnRef = useRef(null);
  const inputRef = useRef(null);
  const mastheadRef = useRef(null);

  useStageMetrics({ stageRef, artRef, columnRef, mastheadRef });

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

    // The lines are a level down now that the composer shares this scroller,
    // but .sky__column is still their offsetParent, so offsetTop is unchanged.
    const written = column.querySelectorAll('.sky__line');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const el of written) el.removeAttribute('data-faded');
      return;
    }

    for (const el of written) {
      const isAbove = el.offsetTop + el.offsetHeight <= top;
      if (isAbove) el.setAttribute('data-faded', 'true');
      else el.removeAttribute('data-faded');
    }
  }, []);

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    // Keep the newest line in view; older ones displace upward and fade. The
    // draft counts: the composer lives at the foot of this same column now, so
    // a growing draft is what pushes the caret toward the bottom edge.
    column.scrollTop = column.scrollHeight;
    updateFade();
  }, [lines, waiting, draft, updateFade]);

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

  /* Escape closes the sheet. It is the only way out that doesn't need the user
     to find the button again, and the composer keeps the key free. */
  useEffect(() => {
    if (!sheet) return;
    const onKey = (event) => {
      if (event.key === 'Escape') setSheet(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  /* Autogrow the field to the height of the draft. There is no cap: the field
     sits inside the writing column, so the column's own bound is what stops it
     descending past the band where --ink still clears 4.5:1. */
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
    // Kept, so it marks its day in the calendar and can be opened again.
    setEntries((current) => [...current, makeEntry({ text, mode })]);
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

  /* Opening a day puts its first entry on the screen as a card. Cards cascade
     rather than stack exactly, so a second one is visibly a second one; a day
     already open is raised instead of duplicated. */
  const openDay = (day) => {
    const found = entriesOn(entries, day, mode);
    if (found.length === 0) return;
    setCards((current) => {
      if (current.some((card) => card.day === day && card.mode === mode)) return current;
      /* Lands clear of the sheet on the left, which is where it was opened
         from — and pulled back inside the right edge on a narrow screen,
         where 55% of the width would put most of it off the side. */
      const step = current.length * 28;
      const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
      const x =
        Math.min(Math.max(16, window.innerWidth * 0.55), window.innerWidth - width - 16) + step;
      const y = window.innerHeight * 0.22 + step;
      return [...current, { key: `${day}-${mode}`, day, mode, index: 0, x, y }];
    });
  };

  const closeCard = (key) => setCards((current) => current.filter((c) => c.key !== key));

  const moveCard = (key, x, y) =>
    setCards((current) => current.map((c) => (c.key === key ? { ...c, x, y } : c)));

  /* Raises a card to the end of the list, which is the top of the stack. */
  const raiseCard = (key) =>
    setCards((current) => {
      const card = current.find((c) => c.key === key);
      if (!card || current[current.length - 1] === card) return current;
      return [...current.filter((c) => c !== card), card];
    });

  const stepCard = (key, by) =>
    setCards((current) =>
      current.map((c) => {
        if (c.key !== key) return c;
        const total = entriesOn(entries, c.day, c.mode).length;
        return { ...c, index: Math.min(Math.max(c.index + by, 0), total - 1) };
      }),
    );

  return (
    <div className="stage" ref={stageRef} data-sheet={sheet ?? 'none'}>
      <Backdrop artRef={artRef} stageRef={stageRef} />

      {/* Between the artwork and the writing in paint order, so it lifts the
          whole writing zone off the sky without covering anything in it. One
          surface, whichever panel is on it. */}
      <div
        className="sheet"
        data-open={sheet !== null}
        data-panel={sheet ?? 'none'}
        aria-hidden={sheet === null}
      >
        {sheet === 'calendar' && (
          <Calendar
            markedDays={daysWithEntries(entries, mode)}
            mode={mode}
            onOpenDay={openDay}
          />
        )}
        {sheet === 'help' && <HelpPanel />}
      </div>

      <header className="masthead" ref={mastheadRef}>
        <ModeToggle mode={mode} onChange={setMode} />
        <Clock />
        <div className="masthead__tools">
          <SheetButton
            label="Calendar"
            panel="calendar"
            open={sheet}
            onToggle={setSheet}
          >
            <CalendarIcon />
          </SheetButton>
          <SheetButton label="Help" panel="help" open={sheet} onToggle={setSheet}>
            <span aria-hidden="true">?</span>
          </SheetButton>
        </div>
      </header>

      <main className="sky">
        {/* The log and the composer share one scroller so the writing and the
            line being written stay in a single column, with the caret sitting
            directly under the last thing said. */}
        <div className="sky__column" ref={columnRef} onScroll={updateFade}>
          <div
            className="sky__log"
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-label="What you have written, and what Mango has asked"
          >
            {lines.map((entry) => (
              <p
                key={entry.id}
                className={`sky__line sky__line--${entry.who === 'opening' ? 'prompt' : entry.who}`}
                /* Only the user's own writing is set in Daywalker now — the
                   prompt moved to Newsreader with the rest of the render's
                   voice, so the glyph audit shouldn't be policing it. */
                data-face={entry.who === 'mine' ? 'daywalker' : 'newsreader'}
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

          <form className="composer" onSubmit={submit}>
            {/* Where the writing starts. A stroke standing in the sky in text
                mode, a microphone in voice mode — the mark itself is the
                switch between the two (§10.4: text is always available, so
                this changes what is offered, never what is possible). */}
            <button
              type="button"
              className="composer__mark"
              data-input={input}
              aria-pressed={input === 'voice'}
              onClick={() => setInput(input === 'voice' ? 'text' : 'voice')}
            >
              <span className="visually-hidden">Voice input</span>
              {input === 'voice' ? <MicIcon /> : <span className="composer__stroke" />}
            </button>

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
              autoComplete="off"
              spellCheck="true"
              /* The screen is a blank page with a caret on it; landing on it
                 without the caret already placed would be the wrong opening. */
              autoFocus
            />
            {/* Enter commits, so the button is the pointer route rather than
                the only one. Held back until there is something to send: the
                resting screen is the caret and nothing else. */}
            <button className="composer__send" type="submit" disabled={!canSend}>
              <span className="visually-hidden">Send</span>
              <SendIcon />
            </button>
          </form>
        </div>
      </main>

      {/* Above everything, because a card is something you have picked up. */}
      {cards.map((card) => {
        const found = entriesOn(entries, card.day, card.mode);
        const entry = found[Math.min(card.index, found.length - 1)];
        if (!entry) return null;
        return (
          <EntryCard
            key={card.key}
            card={card}
            entry={entry}
            hasPrevious={card.index > 0}
            hasNext={card.index < found.length - 1}
            onStep={(by) => stepCard(card.key, by)}
            onClose={() => closeCard(card.key)}
            onMove={(x, y) => moveCard(card.key, x, y)}
            onRaise={() => raiseCard(card.key)}
            onReflect={() => setMode('reflection')}
          />
        );
      })}
    </div>
  );
}

/**
 * One of the round masthead controls. Each opens its own panel onto the shared
 * sheet, and clicking the one already showing closes it — so the pair behaves
 * as a set rather than as two independent flags.
 */
function SheetButton({ label, panel, open, onToggle, children }) {
  return (
    <button
      type="button"
      className="sheetbutton"
      aria-expanded={open === panel}
      onClick={() => onToggle(open === panel ? null : panel)}
    >
      <span className="visually-hidden">{label}</span>
      {children}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * What Mango is, and what it is built on. The citations are the point of the
 * panel as much as the prose is, so they are set small rather than dropped —
 * small enough to sit under the argument, at full ink so they stay readable.
 */
function HelpPanel() {
  return (
    <div className="help">
      <p className="help__body">
        Healthcare workers face high rates of burnout, yet a study of 10,038 Australian
        doctors found that fear of losing confidentiality or career standing, not lack of
        care, is what stops them seeking help (1). Narrative medicine uses close reading and
        reflective writing to build a deeper understanding of one&rsquo;s own story (2),
        while poetry therapy uses reading, writing, or discussing poems in a therapeutic
        context to support mental health (3). Mango is a platform grounded in both: you read
        a short curated text, respond in your own words, receive AI-generated questions that
        deepen your reflection, and keep an artifact made from your own words.
      </p>

      <p className="help__signoff">
        Love from,
        <br />
        Bran, Shaz, Seb
      </p>

      <h2 className="help__refs-title">References</h2>
      <ol className="help__refs">
        <li>
          Wijeratne C, Johnco C, Draper B, Earl J. Doctors&rsquo; reporting of mental health
          stigma and barriers to help-seeking. Occup Med (Lond). 2021;71(8):366-374.
        </li>
        <li>
          Charon R. Narrative medicine: a model for empathy, reflection, profession, and
          trust. JAMA. 2001;286(15):1897-1902.
        </li>
        <li>
          Kassab A, Jayatunge R, Bou Khalil R. The therapeutic functions of poetry in mental
          health: a systematic review and meta-analysis. Psychiatry Res. 2026;356:116897.
        </li>
      </ol>
    </div>
  );
}

const WEEKDAYS = [
  ['SUN', 'Sunday'],
  ['MON', 'Monday'],
  ['TUE', 'Tuesday'],
  ['WED', 'Wednesday'],
  ['THU', 'Thursday'],
  ['FRI', 'Friday'],
  ['SAT', 'Saturday'],
];

/**
 * The month, with a dot on every day carrying an entry in the mode the toggle
 * is set to — so the toggle filters the record rather than describing it, and
 * one mark means one thing. That is why there is no two-item key beneath it,
 * only a caption naming what the dots are.
 *
 * Days with entries are buttons and open them; empty days are inert text
 * rather than dead controls.
 *
 * A table rather than a grid of divs: the column headers are real headers, and
 * this is the one structure a screen reader already knows how to read across
 * and down.
 */
function Calendar({ markedDays, mode, onOpenDay }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // The Sunday on or before the 1st, then enough whole weeks to cover the
  // month — five for most, six when a long month starts late in the week.
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((leading + days) / 7);

  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(year, month, 1 - leading + i);
    return {
      date,
      key: dayKey(date),
      outside: date.getMonth() !== month,
      isToday: dayKey(date) === dayKey(today),
    };
  });

  const step = (by) => setCursor(new Date(year, month + by, 1));
  const title = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="cal__step" onClick={() => step(-1)}>
          <span className="visually-hidden">Previous month</span>
          <Chevron direction="left" />
        </button>
        {/* Announced on navigation — the grid below it changes wholesale and
            the month name is the only thing that says what it changed to. */}
        <h2 className="cal__title" aria-live="polite">
          {title}
        </h2>
        <button type="button" className="cal__step" onClick={() => step(1)}>
          <span className="visually-hidden">Next month</span>
          <Chevron direction="right" />
        </button>
      </div>

      <table className="cal__grid">
        <caption className="visually-hidden">
          {`${MODE_LABEL[mode]} entries in ${title}`}
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={short} scope="col" abbr={full}>
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, week) => (
            <tr key={week}>
              {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                const marked = markedDays.has(cell.key);
                const number = cell.date.getDate();
                const inner = (
                  <>
                    <span className="cal__day" data-today={cell.isToday || undefined}>
                      {number}
                    </span>
                    <span className="cal__marks">
                      {marked && <span className="cal__dot" aria-hidden="true" />}
                    </span>
                  </>
                );
                return (
                  <td
                    key={cell.key}
                    data-outside={cell.outside || undefined}
                    aria-current={cell.isToday ? 'date' : undefined}
                  >
                    {marked ? (
                      <button
                        type="button"
                        className="cal__open"
                        onClick={() => onOpenDay(cell.key)}
                      >
                        {inner}
                        <span className="visually-hidden">
                          {`Open ${MODE_LABEL[mode].toLowerCase()}`}
                        </span>
                      </button>
                    ) : (
                      inner
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Not a key — there is only one kind of mark on screen at a time. It
          names what the dots are for the mode the toggle is set to. */}
      <p className="cal__caption">
        <span className="cal__dot" aria-hidden="true" /> {MODE_LABEL[mode]}
      </p>
    </div>
  );
}

/* How far an arrow key nudges a card, and how much of one must stay on screen
   so a card can never be dropped somewhere it can't be picked up again.
   CARD_WIDTH mirrors the 26rem in home.css — only used to place a new card
   inside the right edge, so an approximation is enough. */
const NUDGE = 24;
const KEEP_ON_SCREEN = 80;
const CARD_WIDTH = 416;

/**
 * One kept entry, as a card on the screen rather than a modal — several can be
 * out at once, which is the point of it being draggable at all.
 *
 * Dragging is on the header, and pointer events do the work: one code path
 * covers mouse, touch and pen, and setPointerCapture keeps the drag alive when
 * the pointer outruns the header. The header is also focusable and takes arrow
 * keys, because a drag that only works by pointer is a drag half the people
 * using it can't do (§17).
 */
function EntryCard({
  card,
  entry,
  hasPrevious,
  hasNext,
  onStep,
  onClose,
  onMove,
  onRaise,
  onReflect,
}) {
  const grab = useRef(null);

  const clamp = (x, y) => [
    Math.min(Math.max(x, KEEP_ON_SCREEN - CARD_WIDTH), window.innerWidth - KEEP_ON_SCREEN),
    Math.min(Math.max(y, 0), window.innerHeight - KEEP_ON_SCREEN),
  ];

  const onPointerDown = (event) => {
    // Let the buttons in the header be buttons.
    if (event.target.closest('button')) return;
    onRaise();
    grab.current = { dx: event.clientX - card.x, dy: event.clientY - card.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!grab.current) return;
    const [x, y] = clamp(event.clientX - grab.current.dx, event.clientY - grab.current.dy);
    onMove(x, y);
  };

  const onPointerUp = () => {
    grab.current = null;
  };

  const onKeyDown = (event) => {
    const by = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!by) return;
    event.preventDefault();
    const [x, y] = clamp(card.x + by[0] * NUDGE, card.y + by[1] * NUDGE);
    onMove(x, y);
  };

  const heading = `entry-${card.key}-title`;

  return (
    <article
      className="entry"
      style={{ left: card.x, top: card.y }}
      aria-labelledby={heading}
      onPointerDown={onRaise}
    >
      <header
        className="entry__bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="toolbar"
        aria-label="Move this entry with the arrow keys"
      >
        <button
          type="button"
          className="entry__step"
          onClick={() => onStep(-1)}
          disabled={!hasPrevious}
        >
          <span className="visually-hidden">Earlier entry this day</span>
          <Chevron direction="left" />
        </button>

        <p className="entry__meta">
          <span>{MODE_LABEL[entry.mode]}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatEntryDate(entry.at)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{formatEntryTime(entry.at)}</span>
        </p>

        {hasNext && (
          <button type="button" className="entry__step" onClick={() => onStep(1)}>
            <span className="visually-hidden">Later entry this day</span>
            <Chevron direction="right" />
          </button>
        )}

        <button type="button" className="entry__close" onClick={onClose}>
          <span className="visually-hidden">Close this entry</span>
          <CloseIcon />
        </button>
      </header>

      <div className="entry__body">
        {entry.title && (
          <h2 className="entry__title" id={heading}>
            {entry.title}
          </h2>
        )}
        {entry.body.map((paragraph, i) => (
          // Paragraphs are fixed in order and never reordered, so the index is
          // a stable identity here.
          // eslint-disable-next-line react/no-array-index-key
          <p className="entry__text" key={i}>
            {paragraph}
          </p>
        ))}

        {(entry.mood || entry.themes?.length > 0) && (
          <dl className="entry__facets">
            {entry.mood && (
              <div className="entry__facet">
                <dt>Mood</dt>
                <dd>
                  <span className="chip chip--strong">{entry.mood}</span>
                </dd>
              </div>
            )}
            {entry.themes?.length > 0 && (
              <div className="entry__facet">
                <dt>Themes</dt>
                <dd>
                  {entry.themes.map((theme) => (
                    <span className="chip" key={theme}>
                      {theme}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}

        {entry.mode === 'journal' && (
          <button type="button" className="entry__action" onClick={onReflect}>
            <SparkIcon />
            Turn into reflection?
          </button>
        )}
      </div>
    </article>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"
        fill="currentColor"
      />
      <path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" fill="currentColor" />
    </svg>
  );
}

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Journal / Reflection, drawn as one pill with both modes named on either side
 * of the switch so the choice can be read without being operated first.
 *
 * role="switch" rather than a radio pair: there are two states and the control
 * on screen is literally a switch, so the platform semantics match the picture.
 * The painted labels are hidden from the accessibility tree — left in, they
 * make the control announce as "Journal Reflection Reflection mode, switch".
 */
function ModeToggle({ mode, onChange }) {
  const reflecting = mode === 'reflection';

  return (
    <button
      type="button"
      className="mode"
      role="switch"
      aria-checked={reflecting}
      aria-label="Reflection mode"
      data-mode={mode}
      onClick={() => onChange(reflecting ? 'journal' : 'reflection')}
    >
      <span className="mode__label" data-active={!reflecting} aria-hidden="true">
        Journal
      </span>
      <span className="mode__track" aria-hidden="true">
        <span className="mode__knob" />
      </span>
      <span className="mode__label" data-active={reflecting} aria-hidden="true">
        Reflection
      </span>
    </button>
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
