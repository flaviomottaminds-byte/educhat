/**
 * Gerenciador de Presença em Tempo Real e Heartbeat do EduChat
 */

export function formatLastSeen(dateOrIso) {
  if (!dateOrIso) return 'recentemente';
  try {
    const d = new Date(dateOrIso);
    if (isNaN(d.getTime())) return 'recentemente';
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return 'há poucos segundos';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'recentemente';
  }
}

export const PRESENCE_TTL_MS = 3 * 60 * 1000; // sem sinal por 3 min => offline

export function normalizePresenceKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function toMs(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return isNaN(t) ? 0 : t;
}

/** Última atividade conhecida: o mais recente entre last_seen do banco e heartbeats. */
export function getLatestSeen(user, heartbeats = {}) {
  if (!user) return null;
  const ms = Math.max(
    toMs(user.lastSeen),
    toMs(heartbeats[user.id]),
    toMs(user.email && heartbeats[user.email])
  );
  return ms ? new Date(ms).toISOString() : null;
}

/**
 * Online se:
 * 1. Assistente IA (24h);
 * 2. Usuário logado nesta janela;
 * 3. Presente no Supabase Realtime Presence (casando por id, e-mail ou nome);
 * 4. Atividade (last_seen em profiles / heartbeat) dentro do TTL.
 */
export function isCollaboratorOnline(user, onlineUserIds, heartbeats = {}, currentUserId = null) {
  if (!user) return false;
  if (user.isBot || user.id === 'u_ia_copilot') return true;
  if (currentUserId && user.id === currentUserId) return true;

  if (onlineUserIds) {
    const has = (k) =>
      k && (onlineUserIds instanceof Set ? onlineUserIds.has(k) : Array.isArray(onlineUserIds) && onlineUserIds.includes(k));
    const nameKey = normalizePresenceKey(user.name);
    const emailKey = normalizePresenceKey(user.email);
    if (has(user.id) || has(user.email) || has(emailKey) || (nameKey && has('name:' + nameKey))) {
      return true;
    }
  }

  const last = toMs(getLatestSeen(user, heartbeats));
  if (last) {
    const diffMs = Date.now() - last;
    if (diffMs < PRESENCE_TTL_MS) return true;
  }
  return false;
}

export function getPresenceStatusLabel(user, isOnline) {
  if (!user) return 'offline';
  if (user.isBot || user.id === 'u_ia_copilot') return 'online 24h';
  if (isOnline) return 'online';
  if (!user.lastSeen) return 'offline';
  return `visto por último ${formatLastSeen(user.lastSeen)}`;
}

export function loadLocalHeartbeats() {
  try {
    const data = localStorage.getItem('educhat_presence_heartbeats');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveLocalHeartbeat(userId, timestamp = new Date().toISOString()) {
  if (!userId) return {};
  try {
    const current = loadLocalHeartbeats();
    current[userId] = timestamp;
    localStorage.setItem('educhat_presence_heartbeats', JSON.stringify(current));
    return current;
  } catch {
    return {};
  }
}
