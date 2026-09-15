import { createRoot } from 'react-dom/client';
import { Mascot, type Mood, type Action } from './components/Mascot';
import './styles/tokens.css';
import './styles/global.css';

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
