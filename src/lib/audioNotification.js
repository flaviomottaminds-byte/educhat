// Notificação Sonora do EduChat (Estilo WhatsApp) via Web Audio API nativo com Fallback
let audioCtx = null;

// Garante desbloqueio do AudioContext no primeiro gesto do usuário
function initAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    initAudioContext();
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

// Gera um beep de fallback sintético caso o AudioContext esteja inacessível
function playFallbackBeep() {
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Silently continue
  }
}

/**
 * Toca o som característico de nova mensagem do WhatsApp
 */
export function playMessageSound() {
  try {
    const ctx = initAudioContext();
    if (!ctx) {
      playFallbackBeep();
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => executeTone(ctx)).catch(() => playFallbackBeep());
    } else {
      executeTone(ctx);
    }
  } catch {
    playFallbackBeep();
  }
}

function executeTone(ctx) {
  try {
    const now = ctx.currentTime;

    // Tom 1: A5 (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Tom 2: E6 (1318.5Hz) - Harmônico de notificação clássico
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08);
    gain2.gain.setValueAtTime(0.28, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.36);
  } catch {
    playFallbackBeep();
  }
}
