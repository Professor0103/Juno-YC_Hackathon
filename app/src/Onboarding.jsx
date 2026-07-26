import { useEffect, useRef, useState } from 'react';
import { consentCopy } from './lib/privacy.js';

/**
 * The onboarding pipeline: Welcome -> Name -> Age -> Gender -> Consent ->
 * Done, ported from onboarding.html. `onComplete(session)` fires once, when
 * the Done screen's own Continue button is pressed — the same moment the
 * standalone prototype would have shown its (fake) Home mockup. The caller
 * is responsible for mounting the real thing at that point.
 */
const ORDER = ['welcome', 'name', 'age', 'gender', 'consent', 'done'];
const GATED = ['name', 'age', 'gender', 'consent'];

const AGE_OPTIONS = [
  { val: '18-24', label: '18–24' },
  { val: '25-34', label: '25–34' },
  { val: '35-44', label: '35–44' },
  { val: '45-54', label: '45–54' },
  { val: '55+', label: '55+' },
  { val: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const GENDER_OPTIONS = [
  { val: 'woman', label: 'Woman' },
  { val: 'man', label: 'Man' },
  { val: 'non-binary', label: 'Non-binary' },
  { val: 'self-describe', label: 'Prefer to self-describe' },
  { val: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const DURATION_SLOW = 700; // ms, mirrors --d-slow in tokens.css
const DURATION_QUICK = 200; // ms, mirrors --d-quick — long enough to see a chip pick land

export default function Onboarding({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [session, setSession] = useState({ name: '', age: null, gender: null });

  const [nameInput, setNameInput] = useState('');
  const [ageChip, setAgeChip] = useState(null);
  const [genderChip, setGenderChip] = useState(null);
  const [genderSelfValue, setGenderSelfValue] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const transitioningRef = useRef(false);
  const isFirstRender = useRef(true);
  const stepRefs = useRef({});
  const headingRefs = useRef({});
  const genderSelfInputRef = useRef(null);

  const currentId = ORDER[stepIndex];
  const isGated = GATED.includes(currentId);

  const go = (newIndex) => {
    if (transitioningRef.current || newIndex === stepIndex || newIndex < 0 || newIndex >= ORDER.length) {
      return;
    }
    transitioningRef.current = true;
    setStepIndex(newIndex);
  };

  const next = (patch = {}) => {
    if (Object.keys(patch).length) setSession((s) => ({ ...s, ...patch }));
    go(stepIndex + 1);
  };

  // Reveal-stagger on activation, plus the re-entrancy release + focus that
  // follows a completed transition. CSS alone can't index "the nth .reveal
  // element" when those elements don't share a tag, so the delay is set here.
  useEffect(() => {
    const container = stepRefs.current[currentId];
    if (container) {
      container.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.transitionDelay = `${40 + i * 80}ms`;
      });
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      transitioningRef.current = false;
      headingRefs.current[currentId]?.focus();
    }, DURATION_SLOW);
    return () => window.clearTimeout(timer);
  }, [currentId]);

  const pickAge = (val) => {
    setAgeChip(val);
    window.setTimeout(() => next({ age: val }), DURATION_QUICK);
  };

  const pickGender = (val) => {
    setGenderChip(val);
    if (val === 'self-describe') {
      window.setTimeout(() => genderSelfInputRef.current?.focus(), 50);
      return;
    }
    window.setTimeout(() => next({ gender: val }), DURATION_QUICK);
  };

  const confirmGenderSelfDescribe = () => {
    next({ gender: genderSelfValue.trim() || 'self-describe' });
  };

  const consentReady = consent1 && consent2;

  const acceptAllConsent = () => {
    setConsent1(true);
    setConsent2(true);
  };

  const acceptConsent = () => {
    localStorage.setItem('mango_consent', JSON.stringify({ given: true, ts: Date.now() }));
    next();
  };

  const registerStep = (id) => (el) => {
    stepRefs.current[id] = el;
  };
  const registerHeading = (id) => (el) => {
    headingRefs.current[id] = el;
  };

  const stepClass = (id, solo) =>
    `step${solo ? ' step-solo' : ''}${id === currentId ? ' active' : ''}`;

  return (
    <div className="onboarding-root">
      <div className="onboarding-screen">
        <div className={`chrome${isGated ? ' show' : ''}`}>
          <button className="back" type="button" aria-label="Back" onClick={() => go(stepIndex - 1)}>
            <BackIcon />
          </button>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: isGated ? `${(GATED.indexOf(currentId) / (GATED.length - 1)) * 100}%` : '0%',
              }}
            />
          </div>
          <button
            className="skip"
            type="button"
            hidden={currentId === 'consent'}
            onClick={() => next()}
          >
            Skip
          </button>
        </div>

        <div className="stepwrap">
          <section
            className={stepClass('welcome', true)}
            ref={registerStep('welcome')}
            aria-hidden={currentId !== 'welcome'}
          >
            <div className="centered">
              <p className="wordmark reveal">mango</p>
              <h1 className="reveal" ref={registerHeading('welcome')}>
                Before we begin
              </h1>
              <p className="onboarding-note reveal">A few optional questions, then a short session.</p>
            </div>
            <div className="cta reveal">
              <button className="btn btn-primary" type="button" onClick={() => next()}>
                Continue
              </button>
            </div>
          </section>

          <section
            className={stepClass('name')}
            ref={registerStep('name')}
            aria-labelledby="h-name"
            aria-hidden={currentId !== 'name'}
          >
            <h1 id="h-name" className="reveal" tabIndex={-1} ref={registerHeading('name')}>
              What should we call you?
            </h1>
            <p className="onboarding-note reveal">First name or nickname — optional.</p>
            <label htmlFor="nameInput" className="visually-hidden">
              Your name
            </label>
            <input
              className="field reveal"
              id="nameInput"
              type="text"
              placeholder="Your name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              maxLength={40}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') next({ name: nameInput.trim() });
              }}
            />
            <div className="cta reveal">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => next({ name: nameInput.trim() })}
              >
                Continue
              </button>
            </div>
          </section>

          <section
            className={stepClass('age')}
            ref={registerStep('age')}
            aria-labelledby="h-age"
            aria-hidden={currentId !== 'age'}
          >
            <h1 id="h-age" className="reveal" tabIndex={-1} ref={registerHeading('age')}>
              What&rsquo;s your age band?
            </h1>
            <div className="chips reveal" role="radiogroup" aria-labelledby="h-age">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.val}
                  className="chip"
                  role="radio"
                  aria-checked={ageChip === opt.val}
                  onClick={() => pickAge(opt.val)}
                >
                  {opt.label}
                  <span className="dot" />
                </button>
              ))}
            </div>
          </section>

          <section
            className={stepClass('gender')}
            ref={registerStep('gender')}
            aria-labelledby="h-gender"
            aria-hidden={currentId !== 'gender'}
          >
            <h1 id="h-gender" className="reveal" tabIndex={-1} ref={registerHeading('gender')}>
              How would you describe your gender?
            </h1>
            <div className="chips reveal" role="radiogroup" aria-labelledby="h-gender">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.val}
                  className="chip"
                  role="radio"
                  aria-checked={genderChip === opt.val}
                  onClick={() => pickGender(opt.val)}
                >
                  {opt.label}
                  <span className="dot" />
                </button>
              ))}
            </div>
            {genderChip === 'self-describe' && (
              <>
                <label htmlFor="genderSelfInput" className="visually-hidden">
                  Describe your gender identity
                </label>
                <input
                  className="field"
                  id="genderSelfInput"
                  type="text"
                  placeholder="Describe your gender identity"
                  maxLength={40}
                  ref={genderSelfInputRef}
                  value={genderSelfValue}
                  onChange={(e) => setGenderSelfValue(e.target.value)}
                />
                <div className="cta">
                  <button className="btn btn-primary" type="button" onClick={confirmGenderSelfDescribe}>
                    Continue
                  </button>
                </div>
              </>
            )}
          </section>

          <section
            className={stepClass('consent')}
            ref={registerStep('consent')}
            aria-labelledby="h-consent"
            aria-hidden={currentId !== 'consent'}
          >
            {/* Prose is one reveal block, not a per-line cascade: decorative
                motion doesn't belong around text the user needs to read. */}
            <div className="reveal">
              <h1 id="h-consent" tabIndex={-1} ref={registerHeading('consent')}>
                Before your first session
              </h1>
              <p className="consent-copy">{consentCopy.intro}</p>
            </div>

            <div className="consent-cards reveal">
              <label className="consent-card">
                <input
                  className="consent-check"
                  type="checkbox"
                  checked={consent1}
                  onChange={(e) => setConsent1(e.target.checked)}
                />
                <span className="consent-text">
                  {consentCopy.policyAgreement}
                  <button
                    className="policy-link"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetOpen(true);
                    }}
                  >
                    {consentCopy.policyLinkLabel}
                  </button>
                </span>
              </label>
              <label className="consent-card">
                <input
                  className="consent-check"
                  type="checkbox"
                  checked={consent2}
                  onChange={(e) => setConsent2(e.target.checked)}
                />
                <span className="consent-text">{consentCopy.notStored}</span>
              </label>
            </div>
            <div className="accept-all reveal">
              <button className="quiet-link" type="button" onClick={acceptAllConsent}>
                Accept all
              </button>
            </div>

            <div className="cta reveal">
              <button
                className="btn btn-primary"
                type="button"
                disabled={!consentReady}
                onClick={acceptConsent}
              >
                Continue
              </button>
              <button className="btn btn-quiet" type="button" onClick={() => setDeclineOpen(true)}>
                I&rsquo;d rather not
              </button>
              <div className={`decline-note${declineOpen ? ' open' : ''}`}>
                {consentCopy.declineNote}
                <button type="button" onClick={() => setDeclineOpen(false)}>
                  Reconsider
                </button>
              </div>
            </div>
          </section>

          <section
            className={stepClass('done', true)}
            ref={registerStep('done')}
            aria-live="polite"
            aria-hidden={currentId !== 'done'}
          >
            <div className="centered">
              <h1 className="reveal" ref={registerHeading('done')}>
                That&rsquo;s everything.
              </h1>
              <p className="onboarding-note reveal">Your session starts now.</p>
            </div>
            <div className="cta reveal">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => onComplete({ ...session })}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      </div>

      <div
        className={`sheet-scrim${sheetOpen ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSheetOpen(false);
        }}
      >
        <div className="sheet">
          <div className="sheet-head">
            <h2>{consentCopy.sheet.title}</h2>
            <button className="skip" type="button" onClick={() => setSheetOpen(false)}>
              Done
            </button>
          </div>
          <div className="sheet-body">
            {consentCopy.sheet.sections.map((section) => (
              <div key={section.heading}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 3L5 9l6 6" />
    </svg>
  );
}
