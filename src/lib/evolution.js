// Cliente leve da Evolution API (Railway): estado da conexão, religamento do webhook e envio de texto.
const DEFAULT_URL = 'https://evolution-api-production-3fb2.up.railway.app';
const DEFAULT_KEY = 'e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f';
const DEFAULT_INSTANCE = 'EduChat-Matriz-01';
export const EVOLUTION_WEBHOOK_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook';
const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE'];

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

async function evoFetch(path, options = {}, timeoutMs = 10000) {
  const { url, key } = getEvolutionConfig();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', apikey: key, ...(options.headers || {}) },
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
    const data = await res.json();
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
        const d = await res.json();
        const w = d?.webhook || d;
        if (w?.enabled && w?.url === EVOLUTION_WEBHOOK_URL && (w?.events || []).includes('MESSAGES_UPSERT')) {
          return true;
        }
      }
    }
    const set = await evoFetch(
      `/webhook/set/${instance}`,
      {
        method: 'POST',
        body: JSON.stringify({
          webhook: { enabled: true, url: EVOLUTION_WEBHOOK_URL, byEvents: false, base64: false, events: WEBHOOK_EVENTS }
        })
      },
      10000
    );
    return set.ok;
  } catch {
    return false;
  }
}

/** Normaliza para o formato internacional (DDI 55) apenas com dígitos. Retorna '' se inválido. */
export function toWhatsAppNumber(raw = '') {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

/** Envia texto via /message/sendText. Retorna { ok, messageId, error }. */
export async function sendWhatsAppText(number, text) {
  const { instance } = getEvolutionConfig();
  const to = toWhatsAppNumber(number);
  if (!to) return { ok: false, error: 'Número inválido' };
  try {
    const res = await evoFetch(
      `/message/sendText/${instance}`,
      { method: 'POST', body: JSON.stringify({ number: to, text }) },
      15000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.response?.message?.[0] || data?.message || `HTTP ${res.status}` };
    return { ok: true, messageId: data?.key?.id || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
