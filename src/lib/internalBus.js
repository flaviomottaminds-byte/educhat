/**
 * Barramento de Comunicação Interna e Presença em Tempo Real do EduChat
 * Combina EventSource (SSE multi-dispositivo mundial) com BroadcastChannel (multi-aba local).
 */

const RELAY_TOPIC = 'educhat_matriz_internal_relay';
const RELAY_URL = `https://ntfy.sh/${RELAY_TOPIC}`;

// Barramento local para comunicação instantânea entre abas no mesmo computador
let localBus = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBus = new BroadcastChannel('educhat_internal_bus');
  }
} catch {}

/**
 * Publica uma mensagem interna para todos os colaboradores (canais e DMs).
 * Dispara simultaneamente no barramento local e na nuvem em tempo real.
 */
export async function publishInternalMessage(chatKey, message) {
  const payload = {
    type: 'INTERNAL_MESSAGE',
    chatKey,
    message,
    sentAt: Date.now()
  };

  // 1. Barramento local instantâneo (0ms)
  if (localBus) {
    try {
      localBus.postMessage(payload);
    } catch {}
  }

  // 2. Barramento em nuvem para outros computadores da equipe (HTTP POST ultra-rápido ~50ms)
  try {
    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

/**
 * Publica um ping de presença para que outros computadores vejam o usuário como 'online'.
 */
export async function publishPresencePing(user) {
  if (!user || !user.id) return;
  const payload = {
    type: 'PRESENCE_PING',
    user: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      department: user.department || 'Geral',
      lastSeen: new Date().toISOString()
    },
    sentAt: Date.now()
  };

  if (localBus) {
    try {
      localBus.postMessage(payload);
    } catch {}
  }

  try {
    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

/**
 * Assina o barramento de eventos (recebe mensagens e status de presença da equipe em tempo real).
 */
export function subscribeToInternalRelay({ onMessage, onPresence }) {
  let es = null;
  let isCancelled = false;

  // 1. Escuta eventos locais via BroadcastChannel
  const handleLocalEvent = (event) => {
    if (isCancelled || !event?.data) return;
    const data = event.data;
    if (data.type === 'INTERNAL_MESSAGE' && typeof onMessage === 'function') {
      onMessage(data.chatKey, data.message);
    } else if (data.type === 'PRESENCE_PING' && typeof onPresence === 'function') {
      onPresence(data.user);
    }
  };

  if (localBus) {
    localBus.addEventListener('message', handleLocalEvent);
  }

  // 2. Escuta eventos em nuvem via EventSource (SSE multi-dispositivo)
  const connectSSE = () => {
    if (isCancelled || typeof window === 'undefined' || !window.EventSource) return;

    try {
      es = new EventSource(`${RELAY_URL}/sse`);

      es.onmessage = (event) => {
        if (isCancelled || !event.data) return;
        try {
          const raw = JSON.parse(event.data);
          // O ntfy envelopa o dado enviado no campo 'message'
          const innerPayload = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw;

          if (innerPayload.type === 'INTERNAL_MESSAGE' && typeof onMessage === 'function') {
            onMessage(innerPayload.chatKey, innerPayload.message);
          } else if (innerPayload.type === 'PRESENCE_PING' && typeof onPresence === 'function') {
            onPresence(innerPayload.user);
          }
        } catch {}
      };

      es.onerror = () => {
        // EventSource nativo do navegador já tenta reconectar automaticamente
      };
    } catch (err) {
      console.warn('[InternalBus] Erro ao conectar SSE:', err);
    }
  };

  connectSSE();

  return () => {
    isCancelled = true;
    if (localBus) {
      try {
        localBus.removeEventListener('message', handleLocalEvent);
      } catch {}
    }
    if (es) {
      try {
        es.close();
      } catch {}
    }
  };
}
