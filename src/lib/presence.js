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

/**
 * Retorna true se o colaborador estiver estritamente ativo na sessão atual:
 * 1. O assistente IA institucional é 24h online por definição.
 * 2. O usuário logado nesta janela/dispositivo está ativo.
 * 3. Outros usuários estão online APENAS se estiverem conectados via Supabase Realtime Presence
 *    ou com heartbeat registrado há menos de 90 segundos.
 */
export function isCollaboratorOnline(user, onlineUserIds, heartbeats = {}, currentUserId = null) {
  if (!user) return false;

  // 1. Assistente IA institucional (24/7)
  if (user.isBot || user.id === 'u_ia_copilot') {
    return true;
  }

  // 2. Usuário com sessão ativa no navegador atual
  if (currentUserId && user.id === currentUserId) {
    return true;
  }

  // 3. Usuários conectados via Supabase Realtime Presence
  if (onlineUserIds) {
    if (onlineUserIds instanceof Set) {
      if (onlineUserIds.has(user.id) || (user.email && onlineUserIds.has(user.email))) {
        return true;
      }
    } else if (Array.isArray(onlineUserIds)) {
      if (onlineUserIds.includes(user.id) || (user.email && onlineUserIds.includes(user.email))) {
        return true;
      }
    }
  }

  // 4. Verificação de Heartbeat recente (últimos 90 segundos)
  const lastHeartbeat = heartbeats[user.id] || user.lastSeen;
  if (lastHeartbeat) {
    const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
    if (diffMs >= 0 && diffMs < 90 * 1000) {
      return true;
    }
  }

  return false;
}

export function getPresenceStatusLabel(user, isOnline) {
  if (!user) return 'offline';
  if (user.isBot || user.id === 'u_ia_copilot') return 'online 24h';
  if (isOnline) return 'online';
  if (!user.lastSeen) return 'offline (nunca acessou)';
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
