import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { primeAudio } from './engine/audioUnlock';
import App from './App';
import './styles/global.css';

// Arms the first touch to unlock Web Audio. Without it, iOS hands the voice
// games a suspended context and they read silence with the permission granted.
primeAudio();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
