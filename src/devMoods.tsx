import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mascot, type Mood, type Action } from './components/Mascot';
import './styles/tokens.css';
import './styles/global.css';
import './styles/mascot.css';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const MOODS: Mood[] = ['happy','excited','curious','proud','encouraging','oops','awake','soft','sleepy'];
const ACTIONS: Action[] = ['idle','walk','fly','spin'];

/**
 * A stage for capturing motion.
 *
 * The mood sheet shows poses; nothing in a still frame can tell you whether a
 * hop has anticipation or whether a revolve goes all the way round. This drives
 * one large Lumi from buttons so a script can fire a gesture and screenshot the
 * frames that follow.
 */
function Stage() {
  const [hop, setHop] = useState(false);
  const [action, setAction] = useState<Action>('idle');
  return (
    <div className="glass" style={{ padding: 16, borderRadius: 24, textAlign: 'center' }}>
      <div id="stage" style={{ height: 300, display: 'grid', placeItems: 'center' }}>
        <Mascot size={280} mood="happy" hopping={hop} action={action} autoHop={false} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button id="do-hop" onClick={() => { setHop(false); setTimeout(() => setHop(true), 16); }}>hop</button>
        <button id="do-spin" onClick={() => { setAction('idle'); setTimeout(() => setAction('spin'), 16); }}>spin</button>
        <button id="do-fly" onClick={() => setAction(action === 'fly' ? 'idle' : 'fly')}>cheer</button>
      </div>
    </div>
  );
}

function Sheet() {
  return (
    <div style={{ padding: 20, display: 'grid', gap: 22 }}>
      {/* Colour variants, side by side. Colour is a taste call, and showing
          four is faster than guessing once. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {['cocoa', 'rose', 'plum', 'slate'].map((skin) => (
          <div key={skin} className="glass" style={{ padding: 10, textAlign: 'center', borderRadius: 22 }}>
            <div className={''}>
              <Mascot size={150} mood="happy" skin={skin === 'cocoa' ? undefined : (skin as never)} />
            </div>
            <div style={{ color: 'var(--text-lo)', fontSize: 15 }}>{skin}</div>
          </div>
        ))}
      </div>

      <Stage />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {MOODS.map((m) => (
          <div key={m} className="glass" style={{ padding: 10, textAlign: 'center', borderRadius: 22 }}>
            <Mascot size={150} mood={m} />
            <div style={{ color: 'var(--text-lo)', fontSize: 15 }}>{m}</div>
          </div>
        ))}
      </div>
      {/*
        A turn sheet. The idle loop wanders on its own, so a screenshot catches
        whatever moment it happens to be in — these are the same drawing pinned
        at fixed values of --turn so the parallax can actually be checked.
      */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {[0, 0.125, 0.25, 0.5, 0.75].map((turn) => (
          <div
            key={turn}
            className="glass"
            style={{
              padding: 10, textAlign: 'center', borderRadius: 22,
              ['--feat-x' as string]: String(Math.sin(turn * Math.PI * 2) * 26),
              ['--feat-squeeze' as string]: String(Math.max(0.12, Math.abs(Math.cos(turn * Math.PI * 2)))),
              ['--face-op' as string]: String(clamp01((Math.cos(turn * Math.PI * 2) + 0.18) / 0.36)),
              ['--back-op' as string]: String(clamp01((-Math.cos(turn * Math.PI * 2) + 0.18) / 0.36)),
            }}
          >
            <Mascot size={130} mood="happy" alive={false} />
            <div style={{ color: 'var(--text-lo)', fontSize: 15 }}>turn {turn}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {ACTIONS.map((a) => (
          <div key={a} className="glass" style={{ padding: 10, textAlign: 'center', borderRadius: 22 }}>
            <Mascot size={120} mood="happy" action={a} />
            <div style={{ color: 'var(--text-lo)', fontSize: 15 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Sheet />);
