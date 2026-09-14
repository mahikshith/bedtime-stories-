import {
  FAMILY_PRICE,
  FAMILY_SPARKS,
  STARLIGHT_PRICE,
  STARLIGHT_SPARKS,
  TRIAL_SESSIONS,
  purchase,
  trialNightsLeft,
  useAppState,
} from '../state/store';
import { Mascot } from './Mascot';

interface PaywallProps {
  /** 'offer' runs during onboarding; 'expired' blocks once the trial is spent. */
  variant: 'offer' | 'expired';
  onStartTrial?: () => void;
  onBought?: () => void;
}

/**
 * One paywall, two moments.
 *
 * Free to install with a trial, because a price on the store listing suppresses
 * install velocity, ranking and review volume at once. The paywall lands after
 * the ritual has had a week to form, which is the only point at which a parent
 * can see what they are being asked to buy.
 */
export function Paywall({ variant, onStartTrial, onBought }: PaywallProps) {
  const state = useAppState();
  const left = trialNightsLeft(state);

  return (
    <div className="page">
      <div style={{ textAlign: 'center' }}>
        <Mascot size={variant === 'expired' ? 148 : 172} mood={variant === 'expired' ? 'soft' : 'happy'} autoHop={variant === 'offer'} />
      </div>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">{variant === 'expired' ? 'Your free nights are up' : 'Try it first'}</p>
        <h1 className="h1">
          {variant === 'expired'
            ? 'Keep Lumi for good?'
            : `${TRIAL_SESSIONS} nights, free.`}
        </h1>
        <p className="muted">
          {variant === 'expired'
            ? 'Everything you have heard, played and printed stays exactly where it is. Buying once unlocks it for good.'
            : 'The whole app, nothing locked, no card needed. If it has not become part of bedtime by the end of the week, it never will.'}
        </p>
        <hr className="divider" />
        <ul className="stack" style={{ margin: 0, paddingLeft: '1.1rem', gap: 'var(--sp-2)' }}>
          <li className="muted"><strong>22 rhymes</strong>, half of them written for Lumi.</li>
          <li className="muted"><strong>216 stories</strong> across 18 worlds, personalised.</li>
          <li className="muted"><strong>Games</strong>, including the quiet one for bedtime.</li>
          <li className="muted"><strong>Colouring pages</strong> built to be printed.</li>
          <li className="muted"><strong>Letters and sounds</strong>, in the order the research says.</li>
          <li className="muted">All of it read aloud, and <strong>all of it works offline</strong>.</li>
        </ul>
      </section>

      {variant === 'offer' && (
        <button className="btn btn--primary btn--block" onClick={onStartTrial}>
          Start {TRIAL_SESSIONS} free nights
        </button>
      )}

      <div className="glass glass--strong stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Recommended</p>
        <h2 className="h2">Family &mdash; {FAMILY_PRICE} once</h2>
        <p className="muted">
          Up to <strong>four children</strong>, each with their own name, companion and progress.
          One price for the household, not one per child.
        </p>
        <p className="tiny">Includes {FAMILY_SPARKS} Wish Sparks, shared.</p>
        <button
          className={`btn btn--block${variant === 'expired' ? ' btn--primary' : ''}`}
          onClick={() => { purchase('family'); onBought?.(); }}
        >
          Buy Family &mdash; {FAMILY_PRICE}
        </button>
      </div>

      <div className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <h2 className="h2">One child &mdash; {STARLIGHT_PRICE} once</h2>
        <p className="tiny">Everything above, one profile, {STARLIGHT_SPARKS} Wish Sparks.</p>
        <button className="btn btn--block" onClick={() => { purchase('solo'); onBought?.(); }}>
          Buy for one &mdash; {STARLIGHT_PRICE}
        </button>
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>
        {variant === 'offer' && left > 0 && `${left} nights remaining. `}
        No subscription. Wish Sparks are the only thing that ever costs more, because each one
        genuinely costs us money to make.
        <br />Demo build &mdash; no payment is taken and no card is requested.
      </p>
    </div>
  );
}
