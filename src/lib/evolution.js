// Cliente leve da Evolution API (Railway): estado da conexão, religamento do webhook e envio de texto.
const DEFAULT_URL = 'https://evolution-api-production-3fb2.up.railway.app';
const DEFAULT_KEY = 'e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f';
const DEFAULT_INSTANCE = 'EduChat-Matriz-01';
export const EVOLUTION_WEBHOOK_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook';
const WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_SET',
  'SEND_MESSAGE',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED'
];

export function getEvolutionConfig() {
  let url = DEFAULT_URL;
  let key = DEFAULT_KEY;
  let instance = DEFAULT_INSTANCE;
  try {
    const u = localStorage.getItem('educhat_evo_url');
    const k = localStorage.getItem('educhat_evo_key');
    const i = localStorage.getItem('educhat_evo_instance');
    if (u && !u.includes('suaempresa.com')) url = u;
    if (k && k.length >= 10) key = k;
    if (i && i !== 'nome-da-instancia') instance = i;
  } catch {}
  url = (import.meta.env?.VITE_EVOLUTION_API_URL || url).replace(/\/+$/, '');
  key = import.meta.env?.VITE_EVOLUTION_API_KEY || key;
  instance = import.meta.env?.VITE_EVOLUTION_INSTANCE || instance;
  return { url, key, instance };
}

async function evoFetch(path, options = {}, timeoutMs = 12000) {
  const { url, key } = getEvolutionConfig();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${url}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'apiKey': key,
        'Authorization': `Bearer ${key}`,
        ...(options.headers || {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(t);
  }
}

/** Retorna 'open' | 'close' | 'connecting' | 'unreachable'. */
export async function getEvolutionState() {
  const { instance } = getEvolutionConfig();
  try {
    const res = await evoFetch(`/instance/connectionState/${instance}`, { method: 'GET' }, 8000);
    if (!res.ok) return 'unreachable';
    const data = await res.json().catch(() => ({}));
    return data?.instance?.state || data?.state || 'close';
  } catch {
    return 'unreachable';
  }
}

/** Garante (e força, se necessário) o webhook ativo apontando para a Edge Function do Supabase. */
export async function ensureEvolutionWebhook({ force = false } = {}) {
  const { instance } = getEvolutionConfig();
  try {
    if (!force) {
      const res = await evoFetch(`/webhook/find/${instance}`, { method: 'GET' }, 8000);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const w = d?.webhook || d;
        if (w?.enabled && w?.url === EVOLUTION_WEBHOOK_URL && (w?.events || []).includes('MESSAGES_UPSERT')) {
          return true;
        }
      }
    }
    // Suporte universal a Evolution API v1.x e v2.x (Railway)
    const webhookPayload = {
      enabled: true,
      url: EVOLUTION_WEBHOOK_URL,
      webhook_by_events: false,
      byEvents: false,
      base64: false,
      events: WEBHOOK_EVENTS,
      webhook: {
        enabled: true,
        url: EVOLUTION_WEBHOOK_URL,
        byEvents: false,
        base64: false,
        events: WEBHOOK_EVENTS
      }
    };
    const set = await evoFetch(
      `/webhook/set/${instance}`,
      {
        method: 'POST',
        body: JSON.stringify(webhookPayload)
      },
      10000
    );
    return set.ok;
  } catch {
    return false;
  }
}

/** Normaliza para o destino internacional (DDI 55 com dígitos ou remoteJid completo como @lid / @s.whatsapp.net). */
export function toWhatsAppTarget(raw = '') {
  const str = String(raw || '').trim();
  if (!str) return '';
  if (str.includes('@')) return str;
  let d = str.replace(/\D/g, '');
  if (d.length < 10) return '';
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function toWhatsAppNumber(raw = '') {
  return toWhatsAppTarget(raw);
}

/** Envia texto via /message/sendText. Retorna { ok, messageId, error }. */
export async function sendWhatsAppText(target, text) {
  const { instance } = getEvolutionConfig();
  const to = toWhatsAppTarget(target);
  if (!to) return { ok: false, error: 'Número/Destinatário inválido' };
  try {
    const payload = {
      number: to,
      text: text,
      textMessage: {
        text: text
      },
      options: {
        delay: 1000,
        presence: 'composing',
        linkPreview: false
      }
    };

    const res = await evoFetch(
      `/message/sendText/${instance}`,
      { method: 'POST', body: JSON.stringify(payload) },
      15000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data?.response?.message?.[0] || data?.message || `HTTP ${res.status}`
      };
    }
    const messageId =
      data?.key?.id ||
      data?.id ||
      data?.messageId ||
      data?.[0]?.key?.id ||
      `wa_${Date.now()}`;
    return { ok: true, messageId, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Consulta as mensagens mais recentes diretamente do banco da Evolution API.
 * Retorna { contacts: Array, messagesByChat: Record<string, Array> }.
 */
export async function fetchEvolutionRecentMessages({ limit = 50 } = {}) {
  const { instance } = getEvolutionConfig();
  try {
    const res = await evoFetch(
      `/chat/findMessages/${instance}`,
      {
        method: 'POST',
        body: JSON.stringify({ where: {}, limit })
      },
      10000
    );
    if (!res.ok) return { contacts: [], messagesByChat: {} };
    const d = await res.json().catch(() => ({}));
    const records = d?.messages?.records || (Array.isArray(d) ? d : []);

    const contactsMap = new Map();
    const messagesByChat = {};

    records.forEach((m) => {
      const rawJid = m.key?.remoteJid;
      if (!rawJid || rawJid === 'status@broadcast') return;
      const chatKey = 'wa-' + rawJid.replace(/[@.]/g, '_');
      const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.documentMessage?.title ||
        (m.message?.audioMessage ? '🎙️ [Áudio recebido]' : (m.message?.imageMessage ? '📷 [Imagem]' : (m.message?.documentMessage ? '📄 [Documento]' : '')));

      if (!text && !m.message?.audioMessage && !m.message?.imageMessage) return;

      const fromMe = Boolean(m.key?.fromMe);
      const time = m.messageTimestamp
        ? new Date(m.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Agora';

      const contactName =
        m.pushName && m.pushName !== 'Você'
          ? m.pushName
          : (rawJid.includes('@') ? rawJid.split('@')[0] : 'Contato WhatsApp');

      if (!contactsMap.has(chatKey)) {
        contactsMap.set(chatKey, {
          id: chatKey,
          remoteJid: rawJid,
          name: contactName,
          phone: rawJid.replace(/@.*$/, ''),
          avatar: '👤',
          department: 'Atendimento',
          assignee: 'Flávio Motta',
          status: 'carteira_ativa',
          statusLabel: 'WhatsApp Oficial',
          aiActive: false,
          lastInteraction: time,
          lastMessageAt: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toISOString() : new Date().toISOString()
        });
      }

      if (!messagesByChat[chatKey]) messagesByChat[chatKey] = [];
      messagesByChat[chatKey].push({
        id: m.key?.id || m.id || `wa_${Date.now()}_${Math.random()}`,
        senderId: fromMe ? 'u1' : chatKey,
        senderName: fromMe ? 'Você' : contactName,
        text: text || '🎙️ [Áudio recebido]',
        timestamp: time,
        isWhatsApp: true,
        fromStudent: !fromMe,
        remoteJid: rawJid,
        status: fromMe ? 'delivered' : 'read'
      });
    });

    // Inverte para que as mensagens fiquem em ordem cronológica (antiga -> nova)
    Object.keys(messagesByChat).forEach((k) => {
      messagesByChat[k] = messagesByChat[k].reverse();
    });

    return {
      contacts: Array.from(contactsMap.values()),
      messagesByChat
    };
  } catch (err) {
    console.warn('[Evolution API] Falha ao sincronizar mensagens:', err);
    return { contacts: [], messagesByChat: {} };
  }
}
