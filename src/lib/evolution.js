import { canonicalizeChatId, canonicalizeWhatsAppPhone } from '../data/initialData';

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
  const prodUrl = (import.meta.env?.VITE_EVOLUTION_API_URL || DEFAULT_URL).replace(/\/+$/, '');
  const prodKey = import.meta.env?.VITE_EVOLUTION_API_KEY || DEFAULT_KEY;
  const prodInstance = import.meta.env?.VITE_EVOLUTION_INSTANCE || DEFAULT_INSTANCE;

  let url = prodUrl;
  let key = prodKey;
  let instance = prodInstance;
  try {
    const u = localStorage.getItem('educhat_evo_url');
    const k = localStorage.getItem('educhat_evo_key');
    const i = localStorage.getItem('educhat_evo_instance');
    if (u && !u.includes('suaempresa.com') && u.startsWith('http')) url = u.replace(/\/+$/, '');
    if (k && k.length >= 30) key = k;
    if (i && i !== 'nome-da-instancia' && i.length >= 3) instance = i;
  } catch {}

  if (!key || key.length < 30) key = prodKey;
  if (!instance) instance = prodInstance;
  if (!url) url = prodUrl;

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

/** Helper para formatar número brasileiro */
function formatDisplayPhone(digits) {
  if (!digits) return '';
  const d = String(digits).replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return d ? `+${d}` : '';
}

/** Normaliza para o destino internacional (DDI 55 com dígitos ou remoteJid completo como @lid / @s.whatsapp.net). */
export function toWhatsAppTarget(raw = '') {
  let str = String(raw || '').trim();
  if (!str) return '';
  if (str.startsWith('wa-')) str = str.replace(/^wa-/, '');
  if (str.endsWith('_lid')) str = str.replace(/_lid$/, '@lid');
  if (str.endsWith('_s_whatsapp_net')) str = str.replace(/_s_whatsapp_net$/, '@s.whatsapp.net');
  if (str.includes('@')) return str;
  let d = str.replace(/\D/g, '');
  // WhatsApp LIDs (Linked Identity) possuem entre 13 e 16 dígitos e NÃO começam com o DDI brasileiro 55
  if (d.length >= 13 && !d.startsWith('55')) {
    return `${d}@lid`;
  }
  if (d.length < 10) return '';
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function toWhatsAppNumber(raw = '') {
  return toWhatsAppTarget(raw);
}

/** Envia texto via /message/sendText com suporte automático a fallback. Retorna { ok, messageId, error }. */
export async function sendWhatsAppText(target, text, fallbackTarget = null) {
  const { instance } = getEvolutionConfig();
  const to = toWhatsAppTarget(target);
  if (!to) return { ok: false, error: 'Número/Destinatário inválido' };

  const attemptSend = async (dest) => {
    try {
      const payload = {
        number: dest,
        text: text,
        textMessage: {
          text: text
        },
        options: {
          delay: 500,
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
        const errMsg = data?.response?.message?.[0] || data?.response?.message || data?.message || data?.error || `HTTP ${res.status}`;
        return { ok: false, status: res.status, error: String(errMsg) };
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
  };

  const primaryResult = await attemptSend(to);
  if (primaryResult.ok) return primaryResult;

  // Se a primeira tentativa falhou (ex: LID rejeitado ou número antigo), tenta o fallback
  if (fallbackTarget) {
    const altDest = toWhatsAppTarget(fallbackTarget);
    if (altDest && altDest !== to) {
      console.warn(`[Evolution API] Envio para ${to} falhou (${primaryResult.error}). Tentando fallback para ${altDest}...`);
      const fallbackResult = await attemptSend(altDest);
      if (fallbackResult.ok) return fallbackResult;
    }
  }

  return primaryResult;
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
      const rawJidAlt = m.key?.remoteJidAlt;
      if (!rawJid || rawJid === 'status@broadcast') return;
      const preferredTarget = rawJidAlt || rawJid;
      const chatKey = canonicalizeChatId(preferredTarget);

      const unwrapped =
        m.message?.ephemeralMessage?.message ||
        m.message?.viewOnceMessage?.message ||
        m.message?.viewOnceMessageV2?.message ||
        m.message?.documentWithCaptionMessage?.message ||
        m.message ||
        {};

      let text =
        (typeof unwrapped?.conversation === 'string' && unwrapped.conversation.trim()) ||
        (typeof unwrapped?.extendedTextMessage?.text === 'string' && unwrapped.extendedTextMessage.text.trim()) ||
        (typeof unwrapped?.imageMessage?.caption === 'string' && unwrapped.imageMessage.caption.trim()) ||
        (typeof unwrapped?.videoMessage?.caption === 'string' && unwrapped.videoMessage.caption.trim()) ||
        (typeof unwrapped?.documentMessage?.caption === 'string' && unwrapped.documentMessage.caption.trim()) ||
        (typeof unwrapped?.documentMessage?.title === 'string' && unwrapped.documentMessage.title.trim()) ||
        (typeof unwrapped?.documentMessage?.fileName === 'string' && unwrapped.documentMessage.fileName.trim()) ||
        '';

      let attachmentObj = null;

      if (unwrapped?.documentMessage) {
        const doc = unwrapped.documentMessage;
        const fileName = doc.fileName || doc.title || 'documento.pdf';
        const mimetype = doc.mimetype || 'application/pdf';
        const docUrl = doc.mediaUrl || doc.url || (doc.base64 ? (doc.base64.startsWith('data:') ? doc.base64 : `data:${mimetype};base64,${doc.base64}`) : '');
        attachmentObj = {
          name: fileName,
          type: mimetype,
          url: docUrl,
          dataUrl: docUrl
        };
        if (!text) text = `📄 Documento: ${fileName}`;
      } else if (unwrapped?.imageMessage) {
        const img = unwrapped.imageMessage;
        const mimetype = img.mimetype || 'image/jpeg';
        const imgUrl = img.mediaUrl || img.url || (img.base64 ? (img.base64.startsWith('data:') ? img.base64 : `data:${mimetype};base64,${img.base64}`) : '');
        attachmentObj = {
          name: 'imagem.jpg',
          type: mimetype,
          url: imgUrl,
          dataUrl: imgUrl,
          isImage: true
        };
        if (!text) text = '🖼️ Imagem recebida';
      } else if (unwrapped?.audioMessage) {
        const aud = unwrapped.audioMessage;
        const mimetype = aud.mimetype || 'audio/ogg';
        const audUrl = aud.mediaUrl || aud.url || (aud.base64 ? (aud.base64.startsWith('data:') ? aud.base64 : `data:${mimetype};base64,${aud.base64}`) : '');
        attachmentObj = {
          name: 'audio.ogg',
          type: mimetype,
          url: audUrl,
          dataUrl: audUrl,
          isAudio: true
        };
        if (!text) text = '🎵 Áudio recebido';
      } else if (!text) {
        text = unwrapped?.stickerMessage ? '💟 Figurinha recebida' : (unwrapped?.videoMessage ? '🎥 Vídeo recebido' : (m.text || m.body || ''));
      }

      if (attachmentObj) {
        text = `${text ? text + '\n' : ''}[ARQUIVO_ANEXO:${JSON.stringify(attachmentObj)}]`;
      }

      if (!text && !unwrapped?.audioMessage && !unwrapped?.imageMessage && !unwrapped?.documentMessage && !unwrapped?.stickerMessage) return;

      const fromMe = Boolean(m.key?.fromMe);
      const time = m.messageTimestamp
        ? new Date(m.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Agora';

      const phoneDigits = canonicalizeWhatsAppPhone(preferredTarget);
      const displayPhone = phoneDigits ? formatDisplayPhone(phoneDigits) : (rawJidAlt || rawJid).replace(/@.*$/, '');

      const contactName =
        m.pushName && m.pushName !== 'Você'
          ? m.pushName
          : (displayPhone ? `Lead ${displayPhone}` : 'Contato WhatsApp');

      if (!contactsMap.has(chatKey)) {
        contactsMap.set(chatKey, {
          id: chatKey,
          remoteJid: rawJid,
          remoteJidAlt: rawJidAlt || null,
          preferredTarget: preferredTarget,
          name: contactName,
          hasRealName: Boolean(m.pushName && m.pushName !== 'Você'),
          phone: displayPhone,
          avatar: '👤',
          department: 'Atendimento',
          assignee: 'Flávio Motta',
          status: 'carteira_ativa',
          statusLabel: 'WhatsApp Oficial',
          aiActive: false,
          lastInteraction: time,
          lastMessageAt: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toISOString() : (m.created_at || '2026-10-17T08:00:00.000Z'),
          updated_at: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toISOString() : (m.created_at || '2026-10-17T08:00:00.000Z')
        });
      } else {
        const existing = contactsMap.get(chatKey);
        if (!existing.hasRealName && m.pushName && m.pushName !== 'Você') {
          existing.name = m.pushName;
          existing.hasRealName = true;
        }
        if (rawJidAlt && !existing.remoteJidAlt) {
          existing.remoteJidAlt = rawJidAlt;
          if (phoneDigits) existing.phone = formatDisplayPhone(phoneDigits);
          existing.preferredTarget = rawJidAlt;
        }
      }

      if (!messagesByChat[chatKey]) messagesByChat[chatKey] = [];
      messagesByChat[chatKey].push({
        id: m.key?.id || m.id || `wa_${Date.now()}_${Math.random()}`,
        senderId: fromMe ? 'u1' : chatKey,
        senderName: fromMe ? 'Você' : contactName,
        text: text || 'Mensagem',
        timestamp: time,
        isWhatsApp: true,
        fromStudent: !fromMe,
        remoteJid: rawJid,
        remoteJidAlt: rawJidAlt,
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
