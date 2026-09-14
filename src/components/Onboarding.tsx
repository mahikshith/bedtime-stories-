import { useMemo, useState } from 'react';
import { Mascot } from './Mascot';
import { COMPANIONS, INTERESTS } from '../content/companions';
import { sanitizeName } from '../engine/safety';
import type { AgeBand, ChildProfile, PronounSet } from '../engine/types';
import { Paywall } from './Paywall';
import { addProfile, completeOnboarding, setParentPin, startTrial } from '../state/store';

type Step = 'welcome' | 'gate' | 'paywall' | 'child' | 'pin';

const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: '3-5', label: '3 to 5' },
  { id: '6-8', label: '6 to 8' },
  { id: '9-11', label: '9 to 11' },
];

const PRONOUNS: { id: PronounSet; label: string }[] = [
  { id: 'she', label: 'she / her' },
  { id: 'he', label: 'he / him' },
  { id: 'they', label: 'they / them' },
];

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');

  return (
    <div className="page">
      {step === 'welcome' && <Welcome onNext={() => setStep('gate')} />}
      {step === 'gate' && <ParentGate onPass={() => setStep('paywall')} />}
      {step === 'paywall' && (
        <Paywall
          variant="offer"
          onStartTrial={() => { startTrial(); setStep('child'); }}
          onBought={() => setStep('child')}
        />
      )}
      {step === 'child' && <ChildSetup onDone={() => setStep('pin')} />}
      {step === 'pin' && <PinSetup />}
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="stack" style={{ textAlign: 'center', alignItems: 'center', gap: 'var(--sp-4)' }}>
      <div style={{ marginTop: 'var(--sp-4)' }}>
        <Mascot size={228} mood="happy" autoHop />
      </div>
      <p className="eyebrow">Lumi &amp; the Sleepy Worlds</p>
      <h1 className="h1">Eighteen worlds.<br />One very sleepy Lumi.</h1>
      <p className="muted" style={{ maxWidth: '38ch' }}>
        Bedtime stories that know your child&rsquo;s name, work on a plane with no signal, and are
        built to <em>end</em> the evening rather than extend it.
      </p>
      <button className="btn btn--primary btn--block" onClick={onNext}>
        Begin
      </button>
      <p className="tiny">Parents only from here. We&rsquo;ll check you&rsquo;re a grown-up next.</p>
    </div>
  );
}

/**
 * Neutral parental gate. Google Play Families requires that a purchase flow is
 * not reachable by a child; a small arithmetic challenge is the standard,
 * accessible pattern and is deliberately not a "are you 18?" tick box.
 */
function ParentGate({ onPass }: { onPass: () => void }) {
  const problem = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 8);
    const b = 5 + Math.floor(Math.random() * 9);
    return { a, b, answer: a * b };
  }, []);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(value) === problem.answer) return onPass();
    setError('Not quite. Have another go.');
    setValue('');
  }

  return (
    <form className="glass stack" style={{ padding: 'var(--sp-4)' }} onSubmit={submit}>
      <p className="eyebrow">Grown-ups only</p>
      <h2 className="h1">What is {problem.a} &times; {problem.b}?</h2>
      <p className="muted">This keeps the next screen out of small hands.</p>
      <div className="field">
        <label className="sr-only" htmlFor="gate">Answer</label>
        <input
          id="gate"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
        />
        {error && <p className="error">{error}</p>}
      </div>
      <button className="btn btn--primary btn--block" type="submit">Continue</button>
    </form>
  );
}

/**
 * The hard paywall. Everything is bought once; nothing is rented, and there is
 * no ad tier. The only metered thing is the one thing with a real marginal cost.
 */
function ChildSetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-8');
  const [pronouns, setPronouns] = useState<PronounSet>('they');
  const [companionId, setCompanionId] = useState(COMPANIONS[2].id);
  const [interests, setInterests] = useState<string[]>(['space']);
  const [error, setError] = useState('');

  function toggleInterest(id: string) {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = sanitizeName(name);
    if (!clean.ok) return setError(clean.reason ?? 'Please check the name.');
    const profile: ChildProfile = {
      id: `c_${Date.now().toString(36)}`,
      name: clean.name,
      ageBand,
      pronouns,
      companionId,
      interests: interests.length ? interests : ['space'],
      createdAt: Date.now(),
    };
    if (!addProfile(profile)) return setError('No seats left on this purchase.');
    onDone();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Who are we telling stories to?</p>
        <div className="field">
          <label htmlFor="childname" className="h3">Their name</label>
          <input
            id="childname"
            value={name}
            autoComplete="off"
            placeholder="Ada"
            onChange={(e) => { setName(e.target.value); setError(''); }}
          />
          {error && <p className="error">{error}</p>}
          <p className="tiny">
            Stored on this device only. It is never sent anywhere, including to the story service.
          </p>
        </div>

        <div className="stack" style={{ gap: 'var(--sp-1)' }}>
          <p className="h3">Age</p>
          <div className="row">
            {AGE_BANDS.map((b) => (
              <button
                type="button"
                key={b.id}
                className="chip"
                aria-pressed={ageBand === b.id}
                onClick={() => setAgeBand(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 'var(--sp-1)' }}>
          <p className="h3">In stories, call them</p>
          <div className="row">
            {PRONOUNS.map((p) => (
              <button
                type="button"
                key={p.id}
                className="chip"
                aria-pressed={pronouns === p.id}
                onClick={() => setPronouns(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Pick a companion</p>
        <p className="tiny">They come along to every world, and they remember.</p>
        <div className="row">
          {COMPANIONS.map((c) => (
            <button
              type="button"
              key={c.id}
              className="chip"
              aria-pressed={companionId === c.id}
              onClick={() => setCompanionId(c.id)}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Things they love (up to four)</p>
        <div className="row">
          {INTERESTS.map((i) => (
            <button
              type="button"
              key={i.id}
              className="chip"
              aria-pressed={interests.includes(i.id)}
              onClick={() => toggleInterest(i.id)}
            >
              <span aria-hidden="true">{i.emoji}</span> {i.label}
            </button>
          ))}
        </div>
        <p className="tiny">
          A fixed list on purpose. Children never type anything into a story, which is what keeps
          this safe rather than merely supervised.
        </p>
      </div>

      <button className="btn btn--primary btn--block" type="submit">That&rsquo;s them</button>
    </form>
  );
}

function PinSetup() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return setError('Four digits, please.');
    setParentPin(pin);
    completeOnboarding();
  }

  return (
    <form className="glass stack" style={{ padding: 'var(--sp-4)' }} onSubmit={submit}>
      <p className="eyebrow">Last thing</p>
      <h2 className="h1">Pick a parent PIN</h2>
      <p className="muted">
        Four digits. It guards settings and Wish Sparks &mdash; not the stories themselves, which
        your child should always be able to reach on their own.
      </p>
      <div className="field">
        <label className="sr-only" htmlFor="pin">Parent PIN</label>
        <input
          id="pin"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
        />
        {error && <p className="error">{error}</p>}
      </div>
      <button className="btn btn--primary btn--block" type="submit">Done &mdash; take me to the map</button>
    </form>
  );
}
