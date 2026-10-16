/**
 * Utilitário avançado de processamento e compatibilidade de áudio do WhatsApp.
 * Converte fluxos de áudio (Base64, OGG/Opus, WebM, MP4) em Blobs nativos
 * com tipos MIME corretos, garantindo reprodução nítida sem ruídos ou distorções.
 */

/**
 * Detecta o tipo MIME e o codec de um áudio a partir dos magic bytes do arquivo binário
 */
export function detectAudioMimeType(u8arr) {
  if (!u8arr || u8arr.length < 4) {
    return 'audio/ogg; codecs=opus';
  }

  // OggS (Container Ogg, padrão de áudios PTT do WhatsApp)
  if (u8arr[0] === 0x4f && u8arr[1] === 0x67 && u8arr[2] === 0x67 && u8arr[3] === 0x53) {
    return 'audio/ogg; codecs=opus';
  }

  // EBML / WebM (0x1A 0x45 0xDF 0xA3)
  if (u8arr[0] === 0x1a && u8arr[1] === 0x45 && u8arr[2] === 0xdf && u8arr[3] === 0xa3) {
    return 'audio/webm; codecs=opus';
  }

  // WAV (RIFF....WAVE)
  if (u8arr[0] === 0x52 && u8arr[1] === 0x49 && u8arr[2] === 0x46 && u8arr[3] === 0x46) {
    return 'audio/wav';
  }

  // MP3 (ID3v2 ou frame sync 0xFF 0xFB/0xF3)
  if (
    (u8arr[0] === 0x49 && u8arr[1] === 0x44 && u8arr[2] === 0x33) ||
    (u8arr[0] === 0xff && (u8arr[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }

  // MP4 / M4A / AAC (ftyp no byte 4 a 7)
  if (
    u8arr.length >= 8 &&
    u8arr[4] === 0x66 &&
    u8arr[5] === 0x74 &&
    u8arr[6] === 0x79 &&
    u8arr[7] === 0x70
  ) {
    return 'audio/mp4';
  }

  // Fallback padrão para áudios do WhatsApp
  return 'audio/ogg; codecs=opus';
}

/**
 * Converte uma URL de áudio (dataUrl, Base64 ou HTTP) em um Blob URL de alta compatibilidade
 * com o tipo MIME exato exigido pelo navegador.
 */
export function processAudioSource(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') {
    return { blobUrl: '', mimeType: 'audio/ogg; codecs=opus', arrayBuffer: null };
  }

  const trimmed = audioUrl.trim();

  // Se já for uma URL HTTP/HTTPS ou Blob existente
  if (trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let guessedMime = 'audio/ogg; codecs=opus';
    if (trimmed.includes('.webm')) guessedMime = 'audio/webm; codecs=opus';
    else if (trimmed.includes('.mp4') || trimmed.includes('.m4a')) guessedMime = 'audio/mp4';
    else if (trimmed.includes('.mp3')) guessedMime = 'audio/mpeg';
    else if (trimmed.includes('.wav')) guessedMime = 'audio/wav';

    return { blobUrl: trimmed, mimeType: guessedMime, arrayBuffer: null };
  }

  try {
    let base64Data = '';
    let declaredMime = '';

    if (trimmed.startsWith('data:')) {
      const parts = trimmed.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      declaredMime = mimeMatch ? mimeMatch[1] : '';
      base64Data = parts[1] || '';
    } else {
      // Base64 cru enviado por webhooks do WhatsApp
      base64Data = trimmed.replace(/\s+/g, '');
    }

    // Decodifica a string Base64 em bytes binários
    const cleanBase64 = base64Data.replace(/[\r\n\s]/g, '');
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Detecta o codec real pelos magic bytes do áudio
    const detectedMime = detectAudioMimeType(bytes);
    const finalMime = declaredMime && declaredMime.includes('codecs=') ? declaredMime : detectedMime;

    const blob = new Blob([bytes], { type: finalMime });
    const blobUrl = URL.createObjectURL(blob);

    return {
      blobUrl,
      mimeType: finalMime,
      arrayBuffer: bytes.buffer,
      blob
    };
  } catch (err) {
    console.warn('Erro ao processar fluxo de áudio:', err);
    return {
      blobUrl: trimmed,
      mimeType: 'audio/ogg; codecs=opus',
      arrayBuffer: null
    };
  }
}

/**
 * Toca o ArrayBuffer decodificado via Web Audio API (PCM)
 * Usado como fallback de alta fidelidade caso o elemento HTML5 Audio falhe em decodificar o container.
 */
export async function playDecodedAudioBuffer(arrayBuffer, playbackRate = 1, onEnded = () => {}) {
  if (!arrayBuffer) return null;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Faz cópia do buffer para não invalidar o original
    const bufferCopy = arrayBuffer.slice(0);
    const decoded = await ctx.decodeAudioData(bufferCopy);

    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = playbackRate;

    source.connect(ctx.destination);
    source.onended = () => {
      try {
        ctx.close();
      } catch {}
      onEnded();
    };

    source.start(0);

    return {
      stop: () => {
        try {
          source.stop();
          ctx.close();
        } catch {}
      },
      duration: decoded.duration
    };
  } catch (err) {
    console.warn('Web Audio decodeAudioData falhou:', err);
    return null;
  }
}
