import { useEffect, useRef, useState } from 'react';
import { WORLDS } from '../content/worlds';
import { COMPANIONS, getCompanion } from '../content/companions';
import { sanitizeName } from '../engine/safety';
import { THEMES } from '../content/themes';
import { SPARK_COST, SPARK_COST_TOTAL } from '../engine/providers';
import {
  SEATS,
  activeProfile,
  addProfile,
  addSparks,
  checkParentPin,
  pricePaid,
  progressFor,
  removeProfile,
  seatsLeft,
  setActiveProfile,
  totalNightsSettled,
  updateProfile,
  updateSettings,
  useAppState,
} from '../state/store';
import type { AgeBand, ChildProfile, PronounSet } from '../engine/types';
import {
  Narrator,
  PACES,
  PERSONAS,
  isNarrationSupported,
  pickVoice,
  rateFor,
} from '../engine/narration';

const AGE_BANDS: AgeBand[] = ['3-5', '6-8', '9-11'];

export function ParentZone({ onExit, onOpenPrivacy }: { onExit: () => void; onOpenPrivacy: () => void }) {
  const state = useAppState();
  const [unlocked, setUnlocked] = useState(state.parentPinHash === null);

  if (!unlocked) return <PinGate onPass={() => setUnlocked(true)} onExit={onExit} />;

  const profile = activeProfile(state);
  const heard = Object.values(state.progress)
    .flatMap((p) => Object.values(p.stories))
    .reduce((n, l) => n + l.length, 0);
  const totalEpisodes = WORLDS.reduce((n, w) => n + w.episodeCount, 0);
  const nights = totalNightsSettled(state);

  return (
    <div className="page">
      <header className="row row--between">
        <h1 className="h1">Parents</h1>
        <button className="btn btn--sm btn--ghost" onClick={onExit}>Done</button>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">The only number we care about</p>
        <h2 className="h1">{nights} {nights === 1 ? 'night' : 'nights'} settled</h2>
        <p className="muted">
          We do not count streaks, screen time or daily actives. A good night here is one where the
          app closed early and nobody asked for another.
        </p>
        <p className="tiny">
          {heard} of {totalEpisodes} library episodes heard.
        </p>
      </section>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Wish Sparks</p>
        <h2 className="h2">{state.sparks} remaining</h2>
        <p className="muted">
          A Spark makes a brand-new story to order. The 216 library stories do not use Sparks and
          never will &mdash; they cost us nothing to tell, so they cost you nothing to hear.
        </p>
        <table className="ledger">
          <tbody>
            <tr><td>Writing</td><td>${SPARK_COST.text.toFixed(3)}</td></tr>
            <tr><td>Four illustrations</td><td>${SPARK_COST.images.toFixed(3)}</td></tr>
            <tr><td>Narration</td><td>${SPARK_COST.narration.toFixed(3)}</td></tr>
            <tr><td>Delivery</td><td>${SPARK_COST.infra.toFixed(3)}</td></tr>
            <tr><td>What one Spark costs us</td><td>${SPARK_COST_TOTAL.toFixed(3)}</td></tr>
          </tbody>
        </table>
        <p className="tiny">
          Published because you deserve to know why this one thing is metered when the rest of a
          {' '}{pricePaid(state)} app is not.
        </p>
        <button className="btn btn--block" onClick={() => addSparks(20)}>
          Add 20 Sparks &mdash; $2.99
        </button>
        <p className="tiny">Demo build: no payment is taken and no card is requested.</p>
      </section>

      <ThemePicker />

      <Household />

      <VoiceSettings />

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Bedtime settings</p>
        <Toggle
          label="Read stories aloud"
          hint="Uses your device's own voice. No audio is sent anywhere."
          on={state.settings.narration}
          onToggle={() => updateSettings({ narration: !state.settings.narration })}
        />
        <Toggle
          label="Dim the screen as the story settles"
          hint="The page warms and darkens across the last third."
          on={state.settings.dimming}
          onToggle={() => updateSettings({ dimming: !state.settings.dimming })}
        />
        <Toggle
          label="Default to two-minute stories"
          hint="For the nights that got away from you."
          on={state.settings.twoMinute}
          onToggle={() => updateSettings({ twoMinute: !state.settings.twoMinute })}
        />
      </section>

      {profile && (
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <p className="eyebrow">{profile.name}</p>
          <div className="row" role="group" aria-label={`Age band for ${profile.name}`}>
            {AGE_BANDS.map((band) => (
              <button
                key={band}
                className="chip"
                aria-pressed={profile.ageBand === band}
                aria-label={`${profile.name}, ages ${band}`}
                onClick={() => updateProfile(profile.id, { ageBand: band })}
              >
                Ages {band}
              </button>
            ))}
          </div>
          <p className="tiny">
            Changing the age band changes sentence length and story length immediately.
          </p>
        </section>
      )}

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Safety &amp; privacy</p>
        <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem', gap: 'var(--sp-2)' }}>
          <li className="muted">
            <strong>Your child&rsquo;s name never leaves this device.</strong> Stories are written with a
            placeholder and the name is filled in here, on your phone.
          </li>
          <li className="muted">
            <strong>Children never type into a story.</strong> Every choice comes from a fixed list
            we wrote, so there is no open-ended conversation with a machine.
          </li>
          <li className="muted">
            <strong>Every story is checked before it is shown.</strong> Anything that fails is thrown
            away and replaced, never edited.
          </li>
          <li className="muted">
            <strong>No adverts, no tracking, no account, no analytics.</strong>
          </li>
        </ul>
        <button className="btn btn--block" onClick={onOpenPrivacy}>
          Read the privacy policy
        </button>
        <hr className="divider" />
        <p className="tiny">
          <strong>AI disclosure:</strong> the 216 library stories were written by people and are
          assembled and personalised on your device. Wish Sparks are generated by an AI model at the
          moment you request one, and are labelled &ldquo;Made just now&rdquo; when you read them.
        </p>
      </section>

      {state.history.length > 0 && (
        <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <p className="eyebrow">Recently read</p>
          {state.history.slice(0, 10).map((h) => (
            <div key={`${h.id}-${h.at}`} className="row row--between">
              <span className="muted">{h.title}</span>
              <span className="tiny">{new Date(h.at).toLocaleDateString()}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * Palette chooser.
 *
 * Lives in the parent zone rather than on the child's screens: a four-year-old
 * given a colour switcher will use it instead of the app. A parent sets it once
 * and it sticks.
 */
function ThemePicker() {
  const state = useAppState();
  const current = state.settings.theme;
  const night = THEMES.filter((t) => t.mode === 'night');
  const day = THEMES.filter((t) => t.mode === 'day');

  return (
    <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
      <p className="eyebrow">Colours</p>
      <p className="tiny">
        Whichever you pick, the screen still warms and dims as the story winds down.
      </p>

      <p className="h3">Darker</p>
      <div className="swatches" role="group" aria-label="Dark palettes">
        {night.map((t) => (
          <ThemeSwatch key={t.id} theme={t} active={t.id === current} />
        ))}
      </div>

      <p className="h3">Brighter</p>
      <div className="swatches" role="group" aria-label="Light palettes">
        {day.map((t) => (
          <ThemeSwatch key={t.id} theme={t} active={t.id === current} />
        ))}
      </div>

      <p className="tiny">
        {THEMES.find((t) => t.id === current)?.blurb}
        {' '}Bright palettes are lovely during the day; Midnight is the kindest at bedtime.
      </p>
    </section>
  );
}

function ThemeSwatch({ theme, active }: { theme: (typeof THEMES)[number]; active: boolean }) {
  const t = theme.tokens;
  return (
    <button
      className="swatch"
      aria-pressed={active}
      aria-label={`${theme.name} palette`}
      onClick={() => updateSettings({ theme: theme.id })}
    >
      <span
        className="swatch__chip"
        aria-hidden="true"
        style={{ background: `linear-gradient(140deg, ${t.ink700} 0 52%, ${t.accent} 52%)` }}
      >
        <span className="swatch__dot" style={{ background: t.pop1 }} />
        <span className="swatch__dot" style={{ background: t.pop3 }} />
      </span>
      <span className="swatch__name">{theme.emoji} {theme.name}</span>
    </button>
  );
}

const PRONOUN_OPTIONS: { id: PronounSet; label: string }[] = [
  { id: 'she', label: 'she / her' },
  { id: 'he', label: 'he / him' },
  { id: 'they', label: 'they / them' },
];

/**
 * The household: who is in it, who is active, and adding or removing a child.
 *
 * Seats come from the purchase, so the limit is enforced in `addProfile` rather
 * than here; this screen only has to explain it.
 */
function Household() {
  const state = useAppState();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-8');
  const [pronouns, setPronouns] = useState<PronounSet>('they');
  const [companionId, setCompanionId] = useState(COMPANIONS[0].id);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const left = seatsLeft(state);

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
      interests: ['space'],
      createdAt: Date.now(),
    };
    if (!addProfile(profile)) return setError('No seats left on this purchase.');
    setName('');
    setAdding(false);
    setError('');
  }

  return (
    <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
      <p className="eyebrow">The household</p>

      {state.profiles.map((p) => {
        const mine = progressFor(state, p.id);
        const heard = Object.values(mine.stories).reduce((n, l) => n + l.length, 0);
        return (
          <div key={p.id} className="row row--between" style={{ gap: 'var(--sp-2)' }}>
            <span className="grow" style={{ minWidth: '50%' }}>
              <span className="h3" style={{ display: 'block', color: 'var(--text-hi)' }}>
                <span aria-hidden="true">{getCompanion(p.companionId).emoji}</span> {p.name}
              </span>
              <span className="tiny">
                Ages {p.ageBand} &middot; {heard} {heard === 1 ? 'story' : 'stories'} &middot;{' '}
                {mine.rhymes.length} {mine.rhymes.length === 1 ? 'rhyme' : 'rhymes'}
              </span>
            </span>
            {p.id !== state.activeProfileId && (
              <button className="chip chip--sm" onClick={() => setActiveProfile(p.id)}>
                Switch
              </button>
            )}
            {state.profiles.length > 1 && (
              confirming === p.id ? (
                <button
                  className="chip chip--sm"
                  onClick={() => { removeProfile(p.id); setConfirming(null); }}
                >
                  Sure?
                </button>
              ) : (
                <button
                  className="chip chip--sm"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setConfirming(p.id)}
                >
                  Remove
                </button>
              )
            )}
          </div>
        );
      })}

      <hr className="divider" />

      {left === 0 ? (
        <p className="tiny">
          All {SEATS[state.entitlement]} {SEATS[state.entitlement] === 1 ? 'seat' : 'seats'} on this
          purchase are used. Remove a child to free one up.
        </p>
      ) : !adding ? (
        <>
          <button className="btn btn--block" onClick={() => setAdding(true)}>
            Add a child &mdash; {left} {left === 1 ? 'seat' : 'seats'} left
          </button>
          <p className="tiny">
            Each child gets their own name, companion, age and progress. No extra charge &mdash;
            the seats came with the purchase.
          </p>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label className="h3" htmlFor="newchild">Their name</label>
            <input
              id="newchild"
              value={name}
              autoComplete="off"
              placeholder="Kwame"
              onChange={(e) => { setName(e.target.value); setError(''); }}
            />
            {error && <p className="error">{error}</p>}
          </div>

          <div className="row" role="group" aria-label="Age of the new child">
            {AGE_BANDS.map((b) => (
              <button
                type="button"
                key={b}
                className="chip"
                aria-pressed={ageBand === b}
                aria-label={`New child, ages ${b}`}
                onClick={() => setAgeBand(b)}
              >
                Ages {b}
              </button>
            ))}
          </div>

          <div className="row">
            {PRONOUN_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.id}
                className="chip"
                aria-pressed={pronouns === o.id}
                onClick={() => setPronouns(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>

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

          <button className="btn btn--primary btn--block" type="submit">Add them</button>
          <button
            className="btn btn--ghost btn--block"
            type="button"
            onClick={() => { setAdding(false); setError(''); }}
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}

const PREVIEW_LINE =
  'The lamp was off, but the day was not quite finished with itself. Somewhere, a small bell rang.';

/**
 * Read-aloud controls.
 *
 * Personas are a voice-selection heuristic plus a pitch and rate treatment over
 * whatever voices the device actually has — which is the only approach that
 * still works on a plane with no signal.
 */
function VoiceSettings() {
  const state = useAppState();
  const narrator = useRef(new Narrator());
  const [speaking, setSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);

  const settings = {
    persona: state.settings.voicePersona,
    pace: state.settings.voicePace,
  };

  useEffect(() => {
    const n = narrator.current;
    return () => n.stop();
  }, []);

  // Voice lists populate asynchronously on most browsers, so re-read on the event.
  useEffect(() => {
    if (!isNarrationSupported()) return;
    const update = () => {
      const chosen = pickVoice(narrator.current.voices, settings.persona);
      setVoiceName(chosen ? `${chosen.name}${chosen.localService ? ' (offline)' : ''}` : null);
    };
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, [settings.persona]);

  function preview() {
    const n = narrator.current;
    if (speaking) {
      n.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    n.speak(PREVIEW_LINE, { ...settings, calm: 0, onEnd: () => setSpeaking(false) });
  }

  const supported = isNarrationSupported();

  return (
    <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
      <p className="eyebrow">The reading voice</p>

      <div className="stack" style={{ gap: 'var(--sp-1)' }}>
        <p className="h3">Who is reading?</p>
        <div className="row">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={settings.persona === p.id}
              onClick={() => updateSettings({ voicePersona: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="tiny">
          {PERSONAS.find((p) => p.id === settings.persona)?.hint}
        </p>
      </div>

      <div className="stack" style={{ gap: 'var(--sp-1)' }}>
        <p className="h3">How fast?</p>
        <div className="row">
          {PACES.map((p) => (
            <button
              key={p.id}
              className="chip"
              aria-pressed={settings.pace === p.id}
              onClick={() => updateSettings({ voicePace: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="tiny">
          Whatever you pick, the voice still slows by about a sixth across the story. A story that
          starts lively always ends calmer than it began.
        </p>
      </div>

      {supported ? (
        <>
          <button className="btn btn--block" onClick={preview}>
            {speaking ? '\u23F9\uFE0F Stop' : '\u25B6\uFE0F Hear it'}
          </button>
          <table className="ledger">
            <tbody>
              <tr><td>Opening page</td><td>{rateFor(settings, 0).toFixed(2)}&times;</td></tr>
              <tr><td>Final page</td><td>{rateFor(settings, 1).toFixed(2)}&times;</td></tr>
              {voiceName && <tr><td>Device voice</td><td>{voiceName}</td></tr>}
            </tbody>
          </table>
        </>
      ) : (
        <p className="tiny">
          This device has no speech voices installed, so stories will be shown as text only.
        </p>
      )}
    </section>
  );
}

function Toggle({
  label, hint, on, onToggle,
}: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="row row--between" style={{ gap: 'var(--sp-3)' }}>
      <span className="grow" style={{ minWidth: '55%' }}>
        <span className="h3" style={{ display: 'block', color: 'var(--text-hi)' }}>{label}</span>
        <span className="tiny">{hint}</span>
      </span>
      <button className="chip" aria-pressed={on} onClick={onToggle}>
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function PinGate({ onPass, onExit }: { onPass: () => void; onExit: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checkParentPin(pin)) return onPass();
    setError('That is not the PIN.');
    setPin('');
  }

  return (
    <div className="page">
      <form className="glass stack" style={{ padding: 'var(--sp-4)' }} onSubmit={submit}>
        <p className="eyebrow">Parent PIN</p>
        <div className="field">
          <label className="sr-only" htmlFor="parentpin">PIN</label>
          <input
            id="parentpin"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          />
          {error && <p className="error">{error}</p>}
        </div>
        <button className="btn btn--primary btn--block" type="submit">Unlock</button>
        <button className="btn btn--ghost btn--block" type="button" onClick={onExit}>
          Back to the map
        </button>
      </form>
    </div>
  );
}
