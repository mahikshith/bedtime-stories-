import { PRIVACY_POLICY, PRIVACY_UPDATED } from '../content/privacy';

/**
 * Both stores require the policy to be reachable from inside the app, not only
 * from a store listing, so this sits behind a plain link in the parent zone.
 */
export function PrivacyPolicy({ onExit }: { onExit: () => void }) {
  return (
    <div className="page">
      <header className="row row--between">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>&larr; Parents</button>
        <span className="badge">Updated {PRIVACY_UPDATED}</span>
      </header>

      <section className="glass stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="eyebrow">Privacy</p>
        <h1 className="h1">What Lumi knows about your child.</h1>
        <p className="muted">Nothing. Here is the long version anyway.</p>
      </section>

      {PRIVACY_POLICY.map((section) => (
        <section key={section.heading} className="glass stack" style={{ padding: 'var(--sp-4)' }}>
          <h2 className="h2">{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i} className="muted">{paragraph}</p>
          ))}
        </section>
      ))}

      <button className="btn btn--primary btn--block" onClick={onExit}>Done</button>
    </div>
  );
}
