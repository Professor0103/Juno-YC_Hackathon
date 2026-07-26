import { useCallback, useEffect, useRef, useState } from 'react';
import { auditDaywalkerGlyphs, normaliseForDaywalker } from './lib/daywalker.js';
import { CRISIS_HEADING, CRISIS_RESOURCES } from './lib/crisis.js';
import {
  MODE_LABEL,
  MODE_NAME,
  dayKey,
  daysWithEntries,
  entriesOn,
  makeEntry,
  seedEntries,
} from './lib/entries.js';
import {
  emotionalBalance,
  layoutGraph,
  moodTrend,
  themeLists,
  themeStats,
} from './lib/insights.js';
import { looksLikeCrisis } from './lib/prefilter.js';
import { privacy } from './lib/privacy.js';
import { deepen, loadOpeningText, prewarm, saveReflection } from './lib/reflection.js';
import { useArtRect } from './lib/useArtRect.js';
import { useStageMetrics } from './lib/useStageMetrics.js';

/**
 * The Reflection session (PSD 3.1).
 *
 * READING   the text is on screen and there is no input field.
 * TALKING   the session, for as many turns as they want.
 * KEPT      saved, on their say-so.
 */
const READING = 'reading';
const TALKING = 'talking';
const KEPT = 'kept';

/* The journal opening line. Set in Newsreader, so §6.2's missing-glyph problem
   doesn't reach it. Not a question about the user's interior state (§16). */
/**
 * The line that stands where the writing will go, in both modes. It is not a
 * heading above the field — it is the field's resting state, which is why the
 * writing starts exactly where it was.
 */
const START = 'Start here';

const formatDate = (date) =>
  date
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(',', '')
    .toUpperCase();

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
  const [mode, setMode] = useState('reflection');

  /* Journal session — local lines in the sky column. */
  const [lines, setLines] = useState([]);

  /* Reflection session — served text and turns until kept. */
  const [stage, setStage] = useState(READING);
  const [text, setText] = useState(null);
  const [turns, setTurns] = useState([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [interrupted, setInterrupted] = useState(null);
  const [interruptedOutcome, setInterruptedOutcome] = useState(null);

  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState(null);
  const [entries, setEntries] = useState(() => seedEntries());
  const [cards, setCards] = useState([]);
  const [input, setInput] = useState('text');
  /* Whether the journal's opening line has been handed over to the field yet,
     and whether it is in the middle of doing so. */
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const columnRef = useRef(null);
  const inputRef = useRef(null);
  const mastheadRef = useRef(null);

  useStageMetrics({ stageRef, artRef, columnRef, mastheadRef });

  useEffect(() => {
    prewarm();
    loadOpeningText()
      .then(setText)
      .catch((err) => console.error('[mango] could not load the opening text', err));
  }, []);

  const atBottomRef = useRef(true);

  const updateFade = useCallback(() => {
    const column = columnRef.current;
    if (!column) return;

    const top = column.scrollTop;
    atBottomRef.current = column.scrollHeight - top - column.clientHeight < 8;
    column.dataset.scrolled = top > 1 ? 'true' : 'false';

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

  const readFromTop =
    mode === 'reflection' && (stage === READING || (turns.length === 1 && streaming === ''));

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    if (mode === 'journal') {
      column.scrollTop = column.scrollHeight;
    } else {
      column.scrollTop = readFromTop ? 0 : column.scrollHeight;
    }
    updateFade();
  }, [mode, lines, draft, text, turns, streaming, readFromTop, updateFade]);

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
  }, [lines, turns]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event) => {
      if (event.key === 'Escape') setSheet(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);


  useEffect(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = `${inputEl.scrollHeight}px`;
  }, [draft, stage, mode]);

  useEffect(() => {
    if (mode === 'journal') {
      inputRef.current?.focus();
    } else if (stage === TALKING && !busy && !interrupted) {
      inputRef.current?.focus();
    }
  }, [mode, stage, busy, interrupted]);

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

  const handleChange = (event) => {
    setDraft(normaliseForDaywalker(event.target.value));
  };

  /**
   * Journal is journalling and nothing else — nothing answers, nothing asks.
   * What is written is kept as an entry, the field is cleared, and the writing
   * stays on screen above it so the day collates as it goes. Reflection is the
   * mode where something writes back.
   */
  const submitJournal = (event) => {
    event.preventDefault();
    const written = draft.trim();
    if (!written) return;

    setDraft('');
    setLines((current) => [...current, line('mine', written)]);
    setEntries((current) => [...current, makeEntry({ text: written, mode })]);
  };

  const submitReflection = async (event) => {
    event.preventDefault();
    const written = draft.trim();
    if (!written || busy) return;

    if (looksLikeCrisis(written)) {
      setInterrupted(written);
      return;
    }

    setDraft('');
    setStage(TALKING);

    const next = [...turns, { role: 'user', content: written }];
    setTurns(next);

    await drain(deepen({ text, turns: next }), written);
  };

  const submit = (event) => {
    if (mode === 'journal') return submitJournal(event);
    return submitReflection(event);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

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

  const keepInterrupted = async () => {
    try {
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

  /* Whether the field is out, in whichever mode. Journal has one switch of its
     own; reflection's is the session stage it was already keeping. */
  const writing = mode === 'journal' ? started : stage === TALKING;

  /* The resting line hands its place over to the field. The two are separated
     by a beat so the line can fade rather than cut, and the field takes focus
     on arrival — pressing the line is the user saying they are ready to write,
     so it would be wrong to make them click a second time. */
  const begin = () => {
    if (starting || writing) return;
    setStarting(true);
    window.setTimeout(() => {
      if (mode === 'journal') setStarted(true);
      else setStage(TALKING);
      setStarting(false);
      // Once the field has mounted in the place the line just left.
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }, 260);
  };

  /**
   * Puts the pen down: the field goes back to being the resting line.
   *
   * Only with an empty draft. Escape and a stray click elsewhere are both easy
   * to do by accident, and this screen's one unbreakable rule is that writing
   * is never lost — so a draft with anything in it keeps the field, and the
   * user closes it by clearing it or sending it.
   */
  const rest = useCallback(() => {
    if (draft.trim()) return;
    if (mode === 'journal') setStarted(false);
    else if (stage === TALKING) setStage(READING);
  }, [draft, mode, stage]);

  /* Escape, or a press anywhere that isn't the field itself, puts the pen
     down. The press is caught on pointerdown rather than click so it fires
     before focus moves — and anything that is its own control (the toggle, the
     masthead buttons, an open sheet, an entry card) is left to do its own job.
     Declared here rather than up with the other effects: its dependencies are
     defined just above it. */
  useEffect(() => {
    if (!writing) return;

    const onKey = (event) => {
      if (event.key === 'Escape' && !sheet) rest();
    };
    const onPointerDown = (event) => {
      if (event.target.closest('.composer, .masthead, .sheet, .entry')) return;
      rest();
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [writing, sheet, rest]);

  const canSend = draft.trim().length > 0 && (mode === 'journal' || !busy);

  const waitingOnText =
    mode === 'reflection' &&
    busy &&
    streaming === '' &&
    turns[turns.length - 1]?.role === 'user';

  const canLeave =
    mode === 'reflection' &&
    stage === TALKING &&
    turns.some((turn) => turn.role === 'assistant');

  const openDay = (day) => {
    const found = entriesOn(entries, day, mode);
    if (found.length === 0) return;
    setCards((current) => {
      if (current.some((card) => card.day === day && card.mode === mode)) return current;
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

  const startReflection = () => {
    setMode('reflection');
    setStage(READING);
    setTurns([]);
    setStreaming('');
    setDraft('');
    setInterrupted(null);
    setInterruptedOutcome(null);
  };

  return (
    <div className="stage" ref={stageRef} data-sheet={sheet ?? 'none'}>
      <Backdrop artRef={artRef} stageRef={stageRef} />

      <div
        className="sheet"
        data-panel={sheet ?? 'none'}
        /* Insights is not on the sheet — it has its own layer below. */
        data-open={sheet === 'calendar' || sheet === 'help'}
        aria-hidden={sheet !== 'calendar' && sheet !== 'help'}
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

      {/* Its own layer, not the sheet: the map of themes is drawn on the sky
          with nothing behind it. */}
      {sheet === 'insights' && <Analytics entries={entries} />}

      <header className="masthead" ref={mastheadRef}>
        {/* The wordmark holds the far left, as it always did; the toggle sits
            beside it, which is still the position the render puts it in. */}
        <div className="masthead__lead">
          <h1 className="masthead__wordmark" data-face="daywalker">
            mango
          </h1>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        <Clock />
        <div className="masthead__tools">
          <SheetButton label="Analytics" panel="insights" open={sheet} onToggle={setSheet}>
            <ChartIcon />
          </SheetButton>
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
        <div className="sky__column" ref={columnRef} onScroll={updateFade}>
          <div
            className="sky__log"
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-label={
              mode === 'journal'
                ? 'What you have written today'
                : 'The text, what you have written, and what Mango has asked'
            }
          >
            {mode === 'journal' ? (
              /* Nothing answers here — the day's entries collate above the
                 field and that is the whole of it. */
              lines.map((entry) => (
                <p key={entry.id} className="sky__line sky__line--mine" data-face="daywalker">
                  {entry.text}
                </p>
              ))
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* One slot, whichever mode. The field and the line that rests in
              its place are the same piece of the layout, which is what makes
              the writing start exactly where the line was. */}
          {mode === 'reflection' && interrupted ? (
            <SupportCard
              outcome={interruptedOutcome}
              onKeep={keepInterrupted}
              onDiscard={discardInterrupted}
            />
          ) : mode === 'reflection' && stage === KEPT ? (
            <p className="note">{privacy.kept}</p>
          ) : writing ? (
            <>
              <Composer
                draft={draft}
                inputRef={inputRef}
                input={input}
                onInputChange={setInput}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSubmit={submit}
                canSend={canSend}
              />

              {mode === 'reflection' && canLeave && (
                <button className="leave" type="button" onClick={keep} disabled={busy}>
                  I&rsquo;ll leave it here
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="sky__line sky__line--prompt sky__start"
              data-leaving={starting || undefined}
              onClick={begin}
              disabled={mode === 'reflection' && !text}
            >
              {START}
            </button>
          )}
        </div>
      </main>

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
            onReflect={startReflection}
          />
        );
      })}
    </div>
  );
}

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

function HelpPanel() {
  return (
    <div className="help">
      <h2 className="help__title">About us</h2>
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

const WEEKDAYS = [
  ['SUN', 'Sunday'],
  ['MON', 'Monday'],
  ['TUE', 'Tuesday'],
  ['WED', 'Wednesday'],
  ['THU', 'Thursday'],
  ['FRI', 'Friday'],
  ['SAT', 'Saturday'],
];

function Calendar({ markedDays, mode, onOpenDay }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

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

    </div>
  );
}

const NUDGE = 24;
const KEEP_ON_SCREEN = 80;
const CARD_WIDTH = 416;

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
        {MODE_NAME.journal}
      </span>
      <span className="mode__track" aria-hidden="true">
        <span className="mode__knob" />
      </span>
      <span className="mode__label" data-active={reflecting} aria-hidden="true">
        {MODE_NAME.reflection}
      </span>
    </button>
  );
}

/**
 * The writing field, shared by both modes. It used to be written out twice and
 * the two had drifted — only the journal one carried the start mark, and only
 * the reflection one had a placeholder. One component, so a change to how
 * writing is taken can only be made in one place.
 */
function Composer({
  draft,
  inputRef,
  input,
  onInputChange,
  onChange,
  onKeyDown,
  onSubmit,
  canSend,
  autoFocus = false,
}) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      {/* Where the writing starts. A stroke standing in the sky in text mode, a
          microphone in voice mode — the mark itself is the switch between the
          two (§10.4: text is always available, so this changes what is
          offered, never what is possible). */}
      <button
        type="button"
        className="composer__mark"
        data-input={input}
        aria-pressed={input === 'voice'}
        onClick={() => onInputChange(input === 'voice' ? 'text' : 'voice')}
      >
        <span className="visually-hidden">Voice input</span>
        {input === 'voice' ? (
          <MicIcon />
        ) : (
          <span className="composer__caret" aria-hidden="true">
            &gt;
          </span>
        )}
      </button>

      <label className="visually-hidden" htmlFor="composer">
        Write
      </label>
      <textarea
        id="composer"
        className="composer__input"
        ref={inputRef}
        value={draft}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={1}
        autoComplete="off"
        spellCheck="true"
        autoFocus={autoFocus}
      />
      <button className="composer__send" type="submit" disabled={!canSend}>
        <span className="visually-hidden">Send</span>
        <SendIcon />
      </button>
    </form>
  );
}

/** Width of the most-written theme's circle, as a share of the plot. */
const BIGGEST_NODE = 15;

/**
 * The analytics page. Not a sheet: the map of themes is drawn straight onto
 * the sky with nothing behind it, which is the whole point of it — so this is
 * its own layer, and only the smaller readings sit on panels.
 */
function Analytics({ entries }) {
  const themes = themeStats(entries);
  const { nodes, links } = layoutGraph(themes);
  const lists = themeLists(themes);
  const balance = emotionalBalance(entries);
  const trend = moodTrend(entries);

  const busiest = Math.max(1, ...themes.map((theme) => theme.count));

  return (
    <div className="analytics">
      <section className="graph" aria-label="Themes across your writing">
        <div className="graph__plot">
          {/* Drawn under the nodes and ignored by the pointer, so a link can
              never take a hover that belongs to the theme on top of it. */}
          <svg className="graph__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {links.map((link) => (
              <line
                key={`${link.from.name}-${link.to.name}`}
                x1={link.from.x * 100}
                y1={link.from.y * 100}
                x2={link.to.x * 100}
                y2={link.to.y * 100}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {nodes.map((node) => (
            <span
              key={node.name}
              className="graph__node"
              data-faded={node.faded || undefined}
              style={{
                left: `${node.x * 100}%`,
                top: `${node.y * 100}%`,
                /* Area, not diameter, tracks the count — a theme written twice
                   as often should look twice as big, and a circle scaled on
                   its diameter looks four times. BIGGEST_NODE is the share of
                   the plot the most-written theme takes. */
                '--node-size': `${Math.sqrt(node.count / busiest) * BIGGEST_NODE}%`,
                '--node-tone': node.valence === null ? 0.5 : node.valence,
              }}
            >
              <span className="graph__name">{node.name}</span>
              <span className="visually-hidden">
                {` — written ${node.count} ${node.count === 1 ? 'time' : 'times'}${
                  node.faded ? ', not in the last week' : ''
                }`}
              </span>
            </span>
          ))}
        </div>

        {/* Bare, like the graph — the design keeps both off any panel. */}
        <dl className="graph__key">
          <div>
            <dt className="graph__swatch" data-faded aria-hidden="true" />
            <dd>Faded = no longer in use</dd>
          </div>
          <div>
            <dt className="graph__swatch" aria-hidden="true" />
            <dd>Size = how often a word appears</dd>
          </div>
        </dl>
      </section>

      {/* Under the map, as drawn: the two readings that are about the whole
          corpus rather than about any one theme. */}
      <div className="gauges">
        <section className="reading">
          <h2 className="reading__title">Emotional balance</h2>
          {balance === null ? (
            <p className="reading__empty">Nothing scored yet.</p>
          ) : (
            <>
              <div
                className="balance"
                role="img"
                aria-label={`Emotional balance sits at ${Math.round(balance * 100)} out of 100`}
              >
                <span className="balance__marker" style={{ left: `${balance * 100}%` }} />
              </div>
              <p className="balance__scale" aria-hidden="true">
                <span>Low</span>
                <span>Neutral</span>
                <span>High</span>
              </p>
            </>
          )}
        </section>

        <section className="reading">
          <h2 className="reading__title">Mood trend</h2>
          <div className="trend">
            {trend.columns.map((column, i) => (
              <div className="trend__day" key={`${column.day}-${i}`}>
                <span className="trend__label" aria-hidden="true">
                  {column.label}
                </span>
                <span className="trend__dots">
                  {column.dots.map((dot) => (
                    <span
                      key={dot.id}
                      className="trend__dot"
                      style={{ '--node-tone': dot.valence === null ? 0.5 : dot.valence }}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="readings">
        <ThemeList title="Recurring" themes={lists.recurring} />
        <ThemeList title="Concerns" themes={lists.concerns} />
        <ThemeList title="Expectations" themes={lists.expectations} />
      </div>
    </div>
  );
}

function ThemeList({ title, themes }) {
  if (themes.length === 0) return null;
  return (
    <section className="reading">
      <h2 className="reading__title">{title}</h2>
      <ul className="reading__list">
        {themes.map((theme) => (
          <li key={theme.name}>
            <span>{theme.name}</span>
            <span className="reading__count">{theme.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19V5M4 19h16M7.5 15.5l3.5-4 3 2.5 4.5-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <p className="masthead__clock">
      <span className="masthead__clock-date">{formatDate(now)}</span>
      <time className="masthead__clock-time" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>
    </p>
  );
}

function Backdrop({ artRef, stageRef }) {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__sky" />
      <Landscape className="backdrop__art" imgRef={artRef} priority />
      <Bear stageRef={stageRef} artRef={artRef} />
    </div>
  );
}

const BEAR_X = 0.7095;
const BEAR_GROUND_Y = 0.7119;
const BEAR_WIDTH_SHARE = 0.12;

/* The sprite sheet's shape. build-assets.mjs writes the authoritative values
   to public/sprites/bear-resting.json when it cuts the sheet; these are that
   file, inlined so the bear doesn't need a fetch to start moving. */
const BEAR_FRAMES = 11;
const BEAR_FRAME_MS = 200;

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
  const top = rect.top + rect.height * BEAR_GROUND_Y - width;

  /* A sprite rather than a GIF, because the walk goes forward and then back
     again rather than cutting from the last frame to the first, and that is
     what animation-direction: alternate is. See home.css. */
  return (
    <span
      className="backdrop__bear"
      aria-hidden="true"
      data-still={reducedMotion || undefined}
      style={{
        left,
        top,
        width,
        height: width,
        '--bear-frames': BEAR_FRAMES,
        '--bear-duration': `${BEAR_FRAMES * BEAR_FRAME_MS}ms`,
      }}
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
