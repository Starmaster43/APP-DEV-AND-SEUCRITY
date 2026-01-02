/**
 * THESIS MODULE: AUDIO HAPTICS ENGINE
 * 
 * Uses the Web Audio API to synthesize UI sounds locally.
 * This ensures "Apple-like" feedback without needing external assets.
 */

let audioCtx: AudioContext | null = null;

// Call this on the first user interaction (click/keydown)
export const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn("Audio resume failed", e));
    }
};

type SoundType = 'click' | 'success' | 'error' | 'delete' | 'lock' | 'toggle';

export const playSystemSound = (type: SoundType) => {
  if (!audioCtx) return; // Silent fail if not initialized

  try {
      if (audioCtx.state === 'suspended') {
         audioCtx.resume();
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      switch (type) {
        case 'click':
          // Crisp, high-pitched tick (Like iOS Keyboard)
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(800, now);
          oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          oscillator.start(now);
          oscillator.stop(now + 0.05);
          break;

        case 'toggle':
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(400, now);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;

        case 'success':
          playTone(audioCtx, 660, 'sine', 0.1, 0);       // E5
          playTone(audioCtx, 880, 'sine', 0.1, 0.1);     // A5
          break;

        case 'error':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(150, now);
          oscillator.frequency.linearRampToValueAtTime(100, now + 0.15);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          oscillator.start(now);
          oscillator.stop(now + 0.2);
          break;

        case 'delete':
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.linearRampToValueAtTime(0.001, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;
          
        case 'lock':
          playTone(audioCtx, 1200, 'square', 0.05, 0);
          playTone(audioCtx, 1200, 'square', 0.05, 0.08);
          break;
      }
  } catch (e) {
      // Fail silently
  }
};

const playTone = (ctx: AudioContext, freq: number, type: OscillatorType, duration: number, delay: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.start(now);
    osc.stop(now + duration);
};