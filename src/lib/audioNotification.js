// Sintetizador Nativo de Notificação Sonora (Web Audio API - 880Hz / 1046Hz)
let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

// Mantém o AudioContext desbloqueado a qualquer interação do usuário
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

function synthesizeDualBeep(ctx) {
  try {
    const now = ctx.currentTime;

    // 1º Bip curto: 880Hz (Lá 5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.125);

    // 2º Bip curto: 1046Hz (Dó 6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046, now + 0.13);
    gain2.gain.setValueAtTime(0.001, now + 0.13);
    gain2.gain.linearRampToValueAtTime(0.32, now + 0.145);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.13);
    osc2.stop(now + 0.285);
  } catch (err) {
    console.warn('Falha ao sintetizar alerta sonoro:', err);
  }
}

/**
 * Toca o som de notificação (dois bips curtos em 880Hz / 1046Hz) via Web Audio API nativa
 */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => synthesizeDualBeep(ctx))
        .catch(() => {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const freshCtx = new AudioCtx();
              synthesizeDualBeep(freshCtx);
            }
          } catch {}
        });
    } else {
      synthesizeDualBeep(ctx);
    }
  } catch (e) {
    console.warn('Erro no alerta sonoro:', e);
  }
}
