import { useCallback, useEffect, useRef, useState } from 'react';
import { auditDaywalkerGlyphs, normaliseForDaywalker } from './lib/daywalker.js';
import { CRISIS_HEADING, CRISIS_RESOURCES } from './lib/crisis.js';
import {
  MODE_LABEL,
  dayKey,
  daysWithEntries,
  entriesOn,
  makeEntry,
  seedEntries,
} from './lib/entries.js';
import { prewarm } from './lib/beat.js';
import { converse } from './lib/companion.js';
import { narrate } from './lib/narration.js';
import { looksLikeCrisis } from './lib/prefilter.js';
import { privacy } from './lib/privacy.js';
import { deepen, loadOpeningText, saveReflection } from './lib/reflection.js';
import { useArtRect } from './lib/useArtRect.js';
import { usePrefersReducedMotion } from './lib/usePrefersReducedMotion.js';
import { useStageMetrics } from './lib/useStageMetrics.js';
import { useVoiceRecorder } from './lib/useVoiceRecorder.js';

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
const OPENING = 'Start anywhere.';

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
  const [mode, setMode] = useState('journal');

  /* Journal session — local lines in the sky column. */
  const [lines, setLines] = useState(() => [line('opening', OPENING)]);
  const [waiting, setWaiting] = useState(false);

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

  const stageRef = useRef(null);
  const artRef = useRef(null);
  const columnRef = useRef(null);
  const inputRef = useRef(null);
  const mastheadRef = useRef(null);

  useStageMetrics({ stageRef, artRef, columnRef, mastheadRef });

  useEffect(() => {
    prewarm('chat', 'reflection-deepen');
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
  }, [mode, lines, waiting, draft, text, turns, streaming, readFromTop, updateFade]);

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
      if (!interrupted || interruptedOutcome !== null) inputRef.current?.focus();
    } else if (stage === TALKING && !busy && !interrupted) {
      inputRef.current?.focus();
    }
  }, [mode, stage, busy, interrupted, interruptedOutcome]);

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

  /* A transcript is a draft. It lands in the composer next to whatever was
     already typed and waits there — speaking a message and sending it are two
     decisions, and only the writer makes the second one. */
  const handleTranscript = useCallback((spoken) => {
    setDraft((current) => normaliseForDaywalker(current ? `${current} ${spoken}` : spoken));
    inputRef.current?.focus();
  }, []);

  const handleVoiceError = useCallback((err) => {
    console.error('[mango] voice input failed', err);
  }, []);

  const voice = useVoiceRecorder({
    onTranscript: handleTranscript,
    onError: handleVoiceError,
  });

  const toggleVoice = () => {
    if (voice.status === 'recording') voice.stop();
    else if (voice.status === 'idle') voice.start();
  };

  /**
   * The journal conversation, as the companion sees it. Derived from the drawn
   * lines rather than held separately, so there is one source of truth for what
   * was said and no way for the screen and the transcript to disagree. The
   * opening line is the app talking to itself and is not a turn.
   */
  const journalTurns = lines
    .filter((entry) => entry.who !== 'opening' && entry.text.trim())
    .map((entry) => ({
      role: entry.who === 'mine' ? 'user' : 'assistant',
      content: entry.text,
    }));

  const submitJournal = async (event) => {
    event.preventDefault();
    const written = draft.trim();
    if (!written || waiting) return;

    // The deterministic pre-filter (PSD 3.6) now runs here too. It was not needed
    // while the journal answered itself locally; the companion changed that, and a
    // surface that reaches a model gets both layers of screening, not one.
    if (looksLikeCrisis(written)) {
      setInterruptedOutcome(null);
      setInterrupted(written);
      return;
    }

    setDraft('');

    const mine = line('mine', written);
    const entry = makeEntry({ text: written, mode });
    const reply = line('mango', '');

    // The reply line is placed empty and filled as tokens land, so the answer
    // grows in the place it will finally sit rather than appearing all at once
    // somewhere else. Empty lines are not drawn; the caret stands in until the
    // first token.
    setLines((current) => [...current, mine, reply]);
    setEntries((current) => [...current, entry]);
    setWaiting(true);

    const transcript = [...journalTurns, { role: 'user', content: written }];
    let accumulated = '';

    try {
      for await (const frame of converse({ turns: transcript })) {
        if (frame.type === 'safety') {
          // Everything drawn on this turn goes, and their writing is held out of
          // the log until they say what should happen to it — the same bargain
          // the session makes, for the same reason.
          setLines((current) => current.filter((l) => l.id !== mine.id && l.id !== reply.id));
          setEntries((current) => current.filter((e) => e.id !== entry.id));
          setInterruptedOutcome(null);
          setInterrupted(written);
          return;
        }
        if (frame.type === 'fallback') {
          accumulated = '';
          setLines((current) => current.map((l) => (l.id === reply.id ? { ...l, text: '' } : l)));
          continue;
        }
        accumulated += frame.text;
        setLines((current) =>
          current.map((l) => (l.id === reply.id ? { ...l, text: accumulated } : l)),
        );
      }
    } finally {
      setWaiting(false);
      // A turn that produced nothing leaves no blank line behind.
      if (!accumulated.trim()) {
        setLines((current) => current.filter((l) => l.id !== reply.id));
      }
    }
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
    // In the journal there is nothing on a server to write to: an entry is a line
    // in the log and a row in local memory, so keeping it means putting back what
    // was held out. The companion is not called on it — the turn that would have
    // asked a question is the turn that was interrupted.
    if (mode === 'journal') {
      setLines((current) => [...current, line('mine', interrupted)]);
      setEntries((current) => [...current, makeEntry({ text: interrupted, mode })]);
      setInterruptedOutcome('saved');
      return;
    }

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

  /** Switching modes drops anything the other mode was mid-way through. */
  const changeMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setDraft('');
    setInterrupted(null);
    setInterruptedOutcome(null);
  };

  const canSend =
    draft.trim().length > 0 && (mode === 'journal' ? !waiting : !busy);

  /* The caret stands in for the companion until its first token lands; after that
     the reply line itself is the thing being drawn. */
  const waitingOnCompanion =
    mode === 'journal' && waiting && !lines[lines.length - 1]?.text;

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
        <ModeToggle mode={mode} onChange={changeMode} />
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
        <div className="sky__column" ref={columnRef} onScroll={updateFade}>
          <div
            className="sky__log"
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-label={
              mode === 'journal'
                ? 'What you have written, and what Mango has asked'
                : 'The text, what you have written, and what Mango has asked'
            }
          >
            {mode === 'journal' ? (
              <>
                {lines
                  .filter((entry) => entry.text)
                  .map((entry) => (
                    <p
                      key={entry.id}
                      className={`sky__line sky__line--${entry.who === 'opening' ? 'prompt' : entry.who}`}
                      data-face={entry.who === 'mine' ? 'daywalker' : 'newsreader'}
                    >
                      {entry.text}
                    </p>
                  ))}
                {waitingOnCompanion && (
                  <p className="sky__line sky__line--mango" aria-label="Mango is writing">
                    <span className="sky__waiting" aria-hidden="true">
                      |
                    </span>
                  </p>
                )}
              </>
            ) : (
              <>
                {text && (
                  <div className="served">
                    <p className="served__body">{text.body}</p>
                    <p className="served__credit">
                      {text.author}
                      {text.year_published ? `, ${text.year_published}` : ''}
                    </p>
                    <NarrationButton text={text.body} />
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

          {mode === 'journal' ? (
            <>
              {interrupted && (
                <SupportCard
                  outcome={interruptedOutcome}
                  onKeep={keepInterrupted}
                  onDiscard={discardInterrupted}
                />
              )}

              {/* The journal is not a session that can be interrupted and left
                  there — it is where this person writes. So the composer comes
                  back once they have said what should happen to the held line,
                  with the resources still on screen above it. */}
              {(!interrupted || interruptedOutcome !== null) && (
                <form className="composer" onSubmit={submit}>
                  <VoiceButton status={voice.status} onClick={toggleVoice} />

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
                    autoFocus
                  />
                  <button className="composer__send" type="submit" disabled={!canSend}>
                    <span className="visually-hidden">Send</span>
                    <SendIcon />
                  </button>
                </form>
              )}
            </>
          ) : interrupted ? (
            <SupportCard
              outcome={interruptedOutcome}
              onKeep={keepInterrupted}
              onDiscard={discardInterrupted}
            />
          ) : stage === TALKING ? (
            <>
              <form className="composer" onSubmit={submit}>
                <VoiceButton status={voice.status} onClick={toggleVoice} />

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
                  placeholder={turns.length === 0 ? 'Write' : 'Go on'}
                  autoComplete="off"
                  spellCheck="true"
                />
                <button className="composer__send" type="submit" disabled={!canSend}>
                  <span className="visually-hidden">Send</span>
                  <SendIcon />
                </button>
              </form>

              {canLeave && (
                <button className="leave" type="button" onClick={keep} disabled={busy}>
                  I&rsquo;ll leave it here
                </button>
              )}
            </>
          ) : stage === READING ? (
            <button
              className="offer"
              type="button"
              onClick={() => setStage(TALKING)}
              disabled={!text}
            >
              Respond
            </button>
          ) : stage === KEPT ? (
            <p className="note">{privacy.kept}</p>
          ) : null}
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

      <p className="cal__caption">
        <span className="cal__dot" aria-hidden="true" /> {MODE_LABEL[mode]}
      </p>
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

function Bear({ stageRef, artRef }) {
  const rect = useArtRect(stageRef, artRef);
  const reducedMotion = usePrefersReducedMotion();

  if (!rect) return null;

  const width = rect.width * BEAR_WIDTH_SHARE;
  const left = rect.left + rect.width * BEAR_X - width / 2;
  const top = rect.top + rect.height * BEAR_GROUND_Y - width;

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

/**
 * The mic, in the composer, in both modes. Tap to speak, tap again to stop —
 * the same button, because starting and stopping one recording is one control.
 * While the recording is being read it is disabled rather than hidden: the
 * composer must not move under a thumb that is already there.
 */
function VoiceButton({ status, onClick }) {
  const recording = status === 'recording';
  const label = recording
    ? 'Stop recording'
    : status === 'transcribing'
      ? 'Reading what you said'
      : 'Speak instead of typing';

  return (
    <button
      type="button"
      className="composer__mark"
      data-input={recording ? 'voice' : 'text'}
      data-status={status}
      aria-pressed={recording}
      aria-label={label}
      disabled={status === 'transcribing'}
      onClick={onClick}
    >
      {status === 'idle' ? <span className="composer__stroke" /> : <MicIcon />}
    </button>
  );
}

/* One loop of icons8-play.gif. The bounce is acknowledgement of the tap, and it
   has to be allowed to finish before the icon changes under it. */
const BOUNCE_MS = 1120;

/**
 * The poem, read aloud.
 *
 * Audio is fetched once and kept for the length of the session, so pausing and
 * starting again is instant and costs nothing — the second play is the same
 * bytes, not a second synthesis.
 */
function NarrationButton({ text }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [failed, setFailed] = useState(false);

  const reducedMotion = usePrefersReducedMotion();

  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const bounceTimer = useRef(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.clearTimeout(bounceTimer.current);
    },
    [],
  );

  const play = async () => {
    if (!reducedMotion) {
      setBouncing(true);
      window.clearTimeout(bounceTimer.current);
      bounceTimer.current = window.setTimeout(() => setBouncing(false), BOUNCE_MS);
    }

    try {
      if (!audioRef.current) {
        setLoading(true);
        const blob = await narrate(text);
        urlRef.current = URL.createObjectURL(blob);

        const audio = new Audio(urlRef.current);
        audio.addEventListener('play', () => setPlaying(true));
        audio.addEventListener('pause', () => setPlaying(false));
        audio.addEventListener('ended', () => setPlaying(false));
        audioRef.current = audio;
      }
      await audioRef.current.play();
      setFailed(false);
    } catch (err) {
      // Pausing while play() is still settling rejects it. That is the writer
      // stopping the reading, not the reading failing.
      if (err.name === 'AbortError') return;
      console.error('[mango] could not narrate the text', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const onClick = () => {
    if (playing) audioRef.current?.pause();
    else play();
  };

  const showBounce = bouncing && !reducedMotion;

  return (
    <button
      type="button"
      className="narration"
      data-state={playing ? 'playing' : 'idle'}
      aria-label={playing ? 'Pause the reading' : 'Listen to this'}
      disabled={loading && !audioRef.current}
      onClick={onClick}
    >
      {playing ? (
        <PauseIcon />
      ) : showBounce ? (
        <img className="narration__bounce" src="/sprites/icons8-play.gif" alt="" />
      ) : (
        <PlayIcon />
      )}
      <span className="narration__label">
        {failed ? 'Could not read it' : playing ? 'Pause' : 'Listen'}
      </span>
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}
