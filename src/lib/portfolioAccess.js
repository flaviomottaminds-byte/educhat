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

/**
 * Retorna true se o departamento/fila do colaborador for compatível com o departamento alvo.
 * Trata variações de nomenclatura (ex: 'Comercial & Vendas' vs 'Comercial', 'Marketing & Comunicação' vs 'Marketing').
 */
export function matchesDepartment(collabDept, targetDept) {
  if (!collabDept || !targetDept) return false;
  if (targetDept === 'Todos' || collabDept === 'Todos') return true;

  const c = normalizeName(collabDept);
  const t = normalizeName(targetDept);

  if (c === t) return true;
  if (c.includes(t) || t.includes(c)) return true;

  const isComercial = (s) => s.includes('comercial') || s.includes('venda') || s.includes('matricula');
  if (isComercial(c) && isComercial(t)) return true;

  const isMarketing = (s) => s.includes('marketing') || s.includes('comunic');
  if (isMarketing(c) && isMarketing(t)) return true;

  const isSecretaria = (s) => s.includes('secretaria') || s.includes('document') || s.includes('diploma');
  if (isSecretaria(c) && isSecretaria(t)) return true;

  const isTutoria = (s) => s.includes('tutoria') || s.includes('academ');
  if (isTutoria(c) && isTutoria(t)) return true;

  const isPedagogico = (s) => s.includes('pedagog') || s.includes('coordenac');
  if (isPedagogico(c) && isPedagogico(t)) return true;

  const isExpansao = (s) => s.includes('expans') || s.includes('polo') || s.includes('parceria');
  if (isExpansao(c) && isExpansao(t)) return true;

  const isDiretoria = (s) => s.includes('diretor') || s.includes('gestao') || s.includes('executiv');
  if (isDiretoria(c) && isDiretoria(t)) return true;

  return false;
}
