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
 * ou se o usuário logado for co-responsável (co-atribuição temporária),
 * ou se o usuário logado for gestor/diretor (visão irrestrita de carteira).
 */
export function isChatAssignedToUser(contactOrAssignee, user) {
  if (!user) return false;
  if (hasFullPortfolioAccess(user)) return true;

  // Extrai todos os responsáveis possíveis (responsável primário + co-atribuídos)
  const assigneeCandidates = [];

  if (typeof contactOrAssignee === 'string') {
    // Pode conter separadores como vírgula ou '+'
    contactOrAssignee.split(/[,+]/).forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) assigneeCandidates.push(trimmed);
    });
  } else if (contactOrAssignee && typeof contactOrAssignee === 'object') {
    if (contactOrAssignee.assignee) {
      contactOrAssignee.assignee.split(/[,+]/).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) assigneeCandidates.push(trimmed);
      });
    }
    if (Array.isArray(contactOrAssignee.assignees)) {
      contactOrAssignee.assignees.forEach((a) => {
        if (typeof a === 'string') assigneeCandidates.push(a);
        else if (a?.name) assigneeCandidates.push(a.name);
      });
    }
    if (Array.isArray(contactOrAssignee.coAssignees)) {
      contactOrAssignee.coAssignees.forEach((a) => {
        if (typeof a === 'string') assigneeCandidates.push(a);
        else if (a?.name) assigneeCandidates.push(a.name);
      });
    }
    if (contactOrAssignee.coAssignee) {
      assigneeCandidates.push(contactOrAssignee.coAssignee);
    }
  }

  if (assigneeCandidates.length === 0) return false;

  const uNameNorm = normalizeName(user.name);
  const uIdNorm = normalizeName(user.id);
  const userFirstName = uNameNorm.split(' ')[0];

  return assigneeCandidates.some((cand) => {
    if (!cand) return false;
    const aNorm = normalizeName(cand);

    // 1. Correspondência exata por ID ou Nome Completo
    if (aNorm === uNameNorm || aNorm === uIdNorm) return true;

    // 2. Correspondência por primeiro nome
    const assigneeFirstName = aNorm.split(' ')[0];
    if (userFirstName && userFirstName.length >= 3 && (userFirstName === assigneeFirstName || aNorm.includes(userFirstName))) {
      return true;
    }

    // 3. Correspondência de inclusão recíproca
    if (uNameNorm.includes(aNorm) || aNorm.includes(uNameNorm)) return true;

    return false;
  });
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

  const isFinanceiro = (s) => s.includes('financ') || s.includes('boleto') || s.includes('cobranca');
  if (isFinanceiro(c) && isFinanceiro(t)) return true;

  const isDiretoria = (s) => s.includes('diretor') || s.includes('gestao') || s.includes('executiv');
  if (isDiretoria(c) && isDiretoria(t)) return true;

  return false;
}

/**
 * Determina se o usuário pode visualizar uma conversa do WhatsApp (Alunos/Leads).
 * Regras estritas:
 * 1. Gestores / Administradores: visibilidade irrestrita (100% da fila e histórico geral).
 * 2. Colaboradores comuns (Atendentes):
 *    a) Atribuído diretamente ao colaborador (responsável ativo ou co-atribuído).
 *    b) Fila de triagem (sem responsável atribuído) e pertencente explicitamente ao departamento de atuação do colaborador.
 */
export function canUserViewChat(contact, user) {
  if (!contact || !user) return false;

  // 1. Gestores / Administradores / Diretores: sem restrições
  if (hasFullPortfolioAccess(user)) return true;

  // 2.a) Atribuído diretamente ao colaborador logado
  if (isChatAssignedToUser(contact, user)) return true;

  // 2.b) Fila de triagem (sem responsável) E pertence ao mesmo departamento
  const primaryAssignee = normalizeName(contact.assignee || '');
  const isUnassigned =
    !primaryAssignee ||
    primaryAssignee === 'aguardando' ||
    primaryAssignee === 'triagem' ||
    primaryAssignee === 'fila' ||
    primaryAssignee === 'fila de triagem' ||
    primaryAssignee === 'sem responsavel' ||
    primaryAssignee === 'nao atribuido' ||
    primaryAssignee === 'assistente ia' ||
    primaryAssignee === 'bot de triagem ura' ||
    primaryAssignee === 'robo' ||
    primaryAssignee === 'bot' ||
    contact.status === 'ura_inedito' ||
    contact.status === 'aguardando_atendimento' ||
    !Array.isArray(contact.assignees) ||
    contact.assignees.length === 0 ||
    contact.assignees.every((a) => {
      const aNorm = normalizeName(typeof a === 'string' ? a : a?.name || '');
      return (
        !aNorm ||
        aNorm === 'aguardando' ||
        aNorm === 'triagem' ||
        aNorm === 'fila' ||
        aNorm === 'sem responsavel' ||
        aNorm === 'assistente ia' ||
        aNorm === 'bot de triagem ura'
      );
    });

  if (isUnassigned && matchesDepartment(user.department, contact.department)) {
    return true;
  }

  return false;
}
