import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CALIBRATION,
  calibrateFrom,
  isMicSupported,
  startVoiceMeter,
  type Level,
  type MeterCalibration,
  type VoiceMeterHandle,
} from '../engine/voiceMeter';

export type MeterState =
  | 'idle'
  | 'asking'
  | 'calibrating'
  | 'live'
  | 'denied'
  | 'unavailable'
  | 'unsupported';

/**
 * React wrapper around the voice meter.
 *
 * Owns the microphone for exactly as long as a game is on screen. Unmounting
 * stops the stream, which also clears the browser's recording indicator — a
 * parent should never see that dot lingering after the game closed.
 */
export function useVoiceMeter() {
  const [state, setState] = useState<MeterState>('idle');
  const [level, setLevel] = useState<Level>(0);
  const handle = useRef<VoiceMeterHandle | null>(null);
  const calibration = useRef<MeterCalibration>(DEFAULT_CALIBRATION);
  const frame = useRef(0);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    cancelAnimationFrame(frame.current);
    setLevel(0);
    setState('idle');
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (!isMicSupported()) return setState('unsupported');
    setState('asking');
    try {
      const meter = await startVoiceMeter(DEFAULT_CALIBRATION);
      handle.current = meter;

      // Listen to the empty room first. A child should not have to out-shout a
      // television, and a quiet bedroom needs a lower bar than a kitchen.
      setState('calibrating');
      const ambient: number[] = [];
      const sampleUntil = Date.now() + 900;
      const sample = () => {
        if (!handle.current) return;
        ambient.push(handle.current.level());
        if (Date.now() < sampleUntil) {
          frame.current = requestAnimationFrame(sample);
          return;
        }
        calibration.current = calibrateFrom(ambient);
        setState('live');
        const pump = () => {
          if (!handle.current) return;
          setLevel(handle.current.level());
          frame.current = requestAnimationFrame(pump);
        };
        frame.current = requestAnimationFrame(pump);
      };
      frame.current = requestAnimationFrame(sample);
    } catch (err) {
      // A parent who refused needs different words from a mic that is broken or
      // already in use by another app.
      const refused = err instanceof DOMException && err.name === 'NotAllowedError';
      setState(refused ? 'denied' : 'unavailable');
    }
  }, []);

  const drain = useCallback((): Level[] => handle.current?.drain() ?? [], []);

  return { state, level, start, stop, drain, calibration };
}
