import { isUserAdmin } from './aiKnowledge';

/**
 * Retorna true se o usuário tiver perfil administrativo, de diretoria ou gestão geral,
 * mantendo a visibilidade completa de todos os atendimentos, filas e chats.
 */
export function hasFullPortfolioAccess(user) {
  if (!user) return false;
  return (
    user.id === 'u1' ||
    user.roleType === 'diretor' ||
    user.roleType === 'admin' ||
    isUserAdmin(user)
  );
}

/**
 * Normaliza uma string de texto (remove acentos, espaços extras e converte para minúsculas).
 */
export function normalizeName(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Retorna true se o chat/contato do WhatsApp estiver atribuído diretamente ao usuário logado,
 * ou se o usuário logado for gestor/diretor (visão irrestrita de carteira).
 */
export function isChatAssignedToUser(contactOrAssignee, user) {
  if (!user) return false;
  if (hasFullPortfolioAccess(user)) return true;

  const assignee = typeof contactOrAssignee === 'string'
    ? contactOrAssignee
    : (contactOrAssignee?.assignee || '');

  if (!assignee) return false;

  const aNorm = normalizeName(assignee);
  const uNameNorm = normalizeName(user.name);
  const uIdNorm = normalizeName(user.id);

  // 1. Correspondência exata por ID ou Nome Completo
  if (aNorm === uNameNorm || aNorm === uIdNorm) return true;

  // 2. Correspondência por primeiro nome (ex: "Tatiane" para "Tatiane Salatinos", "Gabriel" para "Gabriel Carvalho", "Luiz" para "Luiz Augusto")
  const userFirstName = uNameNorm.split(' ')[0];
  const assigneeFirstName = aNorm.split(' ')[0];
  if (userFirstName && (userFirstName === assigneeFirstName || aNorm.includes(userFirstName))) {
    return true;
  }

  // 3. Correspondência de inclusão recíproca
  if (uNameNorm.includes(aNorm) || aNorm.includes(uNameNorm)) return true;

  return false;
}
