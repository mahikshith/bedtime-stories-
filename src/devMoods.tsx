import { createRoot } from 'react-dom/client';
import { Mascot, type Mood, type Action } from './components/Mascot';
import './styles/tokens.css';
import './styles/global.css';
import './styles/mascot.css';

const MOODS: Mood[] = ['happy','excited','curious','proud','encouraging','oops','awake','soft','sleepy'];
const ACTIONS: Action[] = ['idle','walk','fly','spin'];

function Sheet() {
  return (
    <div style={{ padding: 20, display: 'grid', gap: 22 }}>
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
        {[-1, -0.5, 0, 0.5, 1].map((turn) => (
          <div
            key={turn}
            className="glass"
            style={{
              padding: 10, textAlign: 'center', borderRadius: 22,
              ['--turn' as string]: String(turn),
              ['--eye-l' as string]: String(1 - Math.max(0, -turn) * 0.34),
              ['--eye-r' as string]: String(1 - Math.max(0, turn) * 0.34),
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
