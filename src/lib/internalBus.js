/**
 * Barramento de Comunicação Interna e Presença em Tempo Real do EduChat
 * Combina EventSource (SSE multi-dispositivo mundial) com BroadcastChannel (multi-aba local).
 */

const MSG_TOPIC = 'educhat_matriz_messages_v1';
const MSG_URL = `https://ntfy.sh/${MSG_TOPIC}`;

const PRESENCE_TOPIC = 'educhat_matriz_presence';
const PRESENCE_URL = `https://ntfy.sh/${PRESENCE_TOPIC}`;

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
    fetch(MSG_URL, {
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
    fetch(PRESENCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

/**
 * Assina o barramento de eventos (recebe mensagens e status de presença da equipe em tempo real).
 */
export function subscribeToInternalRelay({ onMessage, onPresence, onStatusChange }) {
  let esMessages = null;
  let esPresence = null;
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

  // 2. Hidratação inicial de mensagens recentes (recupera histórico recente do tópico ntfy)
  const hydrateRecentMessages = async () => {
    try {
      const res = await fetch(`${MSG_URL}/json?poll=1&since=all`);
      if (!res.ok) return;
      const text = await res.text();
      if (isCancelled || !text) return;
      const lines = text.trim().split('\n');
      lines.forEach((line) => {
        try {
          const raw = JSON.parse(line);
          if (raw.event !== 'message' || !raw.message) return;
          const innerPayload = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;
          if (innerPayload.type === 'INTERNAL_MESSAGE' && typeof onMessage === 'function') {
            onMessage(innerPayload.chatKey, innerPayload.message);
          }
        } catch {}
      });
    } catch {}
  };

  // 3. Hidratação inicial de presenças recentes (últimos 10 min)
  const hydrateRecentPresence = async () => {
    try {
      const res = await fetch(`${PRESENCE_URL}/json?poll=1&since=10m`);
      if (!res.ok) return;
      const text = await res.text();
      if (isCancelled || !text) return;
      const lines = text.trim().split('\n');
      lines.forEach((line) => {
        try {
          const raw = JSON.parse(line);
          if (raw.event !== 'message' || !raw.message) return;
          const innerPayload = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;
          if (innerPayload.type === 'PRESENCE_PING' && typeof onPresence === 'function') {
            onPresence(innerPayload.user);
          }
        } catch {}
      });
    } catch {}
  };

  hydrateRecentMessages();
  hydrateRecentPresence();

  // 4. Escuta eventos em nuvem via EventSource (SSE multi-dispositivo)
  const connectSSE = () => {
    if (isCancelled || typeof window === 'undefined' || !window.EventSource) return;

    try {
      esMessages = new EventSource(`${MSG_URL}/sse`);
      esMessages.onopen = () => {
        if (typeof onStatusChange === 'function') onStatusChange('connected');
      };
      esMessages.onmessage = (event) => {
        if (isCancelled || !event.data) return;
        try {
          const raw = JSON.parse(event.data);
          const innerPayload = typeof raw.message === 'string' ? JSON.parse(raw.message) : (raw.message || raw);
          if (innerPayload.type === 'INTERNAL_MESSAGE' && typeof onMessage === 'function') {
            onMessage(innerPayload.chatKey, innerPayload.message);
          }
        } catch {}
      };
      esMessages.onerror = () => {
        // EventSource nativo do navegador reconecta automaticamente
      };

      esPresence = new EventSource(`${PRESENCE_URL}/sse`);
      esPresence.onmessage = (event) => {
        if (isCancelled || !event.data) return;
        try {
          const raw = JSON.parse(event.data);
          const innerPayload = typeof raw.message === 'string' ? JSON.parse(raw.message) : (raw.message || raw);
          if (innerPayload.type === 'PRESENCE_PING' && typeof onPresence === 'function') {
            onPresence(innerPayload.user);
          }
        } catch {}
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
    if (esMessages) {
      try {
        esMessages.close();
      } catch {}
    }
    if (esPresence) {
      try {
        esPresence.close();
      } catch {}
    }
  };
}
