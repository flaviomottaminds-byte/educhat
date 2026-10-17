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
  if (!contactOrAssignee) return false;

  const uId = String(user.id || '').trim().toLowerCase();
  const uNameNorm = normalizeName(user.name);

  // 1. Verificação por ID direto (assigned_to ou assignee_id)
  if (typeof contactOrAssignee === 'object') {
    const rawAssignedTo = contactOrAssignee.assigned_to ?? contactOrAssignee.assignee_id;
    if (rawAssignedTo !== undefined && rawAssignedTo !== null) {
      const assignedTo = String(rawAssignedTo).trim().toLowerCase();
      if (assignedTo && assignedTo === uId) {
        return true;
      }
    }
  }

  // 2. Extrai todos os responsáveis possíveis (responsável primário + co-atribuídos)
  const assigneeCandidates = [];

  if (typeof contactOrAssignee === 'string') {
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
        else if (a?.id && String(a.id).trim().toLowerCase() === uId) assigneeCandidates.push(user.name);
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

  const userFirstName = uNameNorm.split(' ')[0];

  return assigneeCandidates.some((cand) => {
    if (!cand) return false;
    const aNorm = normalizeName(cand);

    // 1. Correspondência exata por ID ou Nome Completo
    if (aNorm === uNameNorm || aNorm === uId) return true;

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
 * Retorna true se o contato NÃO possui nenhum responsável ativo atribuído
 * (pertence à fila geral/triagem, URA ou assigned_to === null).
 */
export function isChatUnassigned(contact) {
  if (!contact) return true;

  // 1. Se possuir assigned_to explícito
  const rawAssignedTo = contact.assigned_to ?? contact.assignee_id;
  if (rawAssignedTo !== undefined && rawAssignedTo !== null) {
    const aId = String(rawAssignedTo).trim().toLowerCase();
    if (!aId || aId === 'null' || aId === 'undefined' || aId === 'triagem' || aId === 'aguardando' || aId === 'fila') {
      return true;
    }
    // Possui um ID de atendente humano real atribuído
    return false;
  }

  // 2. Se possuir assignee textual
  const rawAssignee = String(contact.assignee || '').trim();
  if (!rawAssignee) return true;

  const norm = normalizeName(rawAssignee);
  const unassignedValues = [
    '',
    'null',
    'undefined',
    'aguardando',
    'aguardando atendimento',
    'aguardando atribuicao',
    'aguardando atribuição',
    'triagem',
    'triagem ura',
    'fila',
    'fila geral',
    'fila de triagem',
    'sem responsavel',
    'sem responsável',
    'nao atribuido',
    'não atribuído',
    'assistente ia',
    'bot de triagem ura',
    'robo',
    'bot',
    'ura',
    'ura inedito'
  ];

  if (unassignedValues.includes(norm)) {
    return true;
  }

  if (contact.status === 'ura_inedito' || contact.status === 'aguardando_atendimento') {
    return true;
  }

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

  const isFinanceiro = (s) => s.includes('financ') || s.includes('boleto') || s.includes('cobranca');
  if (isFinanceiro(c) && isFinanceiro(t)) return true;

  const isDiretoria = (s) => s.includes('diretor') || s.includes('gestao') || s.includes('executiv');
  if (isDiretoria(c) && isDiretoria(t)) return true;

  return false;
}

/**
 * FILTRO RIGOROSO DE VISIBILIDADE DE CHATS DO WHATSAPP (BARRA LATERAL E LISTAGENS):
 * 1. Gestores / Administradores: visibilidade irrestrita (100% da fila e histórico geral).
 * 2. Colaboradores comuns (Atendentes):
 *    A) Exibir apenas os chats onde assigned_to === currentUser.id (Minha Carteira).
 *    B) Exibir os chats onde assigned_to === null (Fila Geral/Triagem do seu departamento).
 *    REGRA ESTRITA: Chats onde o assigned_to pertence a OUTRO colaborador (ex: atribuído ao Gabriel,
 *    mas visto pela Michele) DEVEM ser removidos/filtrados da query e NÃO podem aparecer na lista lateral.
 */
export function canUserViewChat(contact, user) {
  if (!contact || !user) return false;

  // 1. Gestores / Administradores / Diretores: sem restrições (100% da fila geral)
  if (hasFullPortfolioAccess(user)) return true;

  // 2. A) MINHA CARTEIRA: Atribuído diretamente ao colaborador logado
  if (isChatAssignedToUser(contact, user)) {
    return true;
  }

  // 3. ISOLAMENTO ESTRITO: Se possui um responsável e NÃO é o usuário logado,
  // BLOQUEIA DEFINITIVAMENTE! Nunca vaza contatos de terceiros.
  if (!isChatUnassigned(contact)) {
    return false;
  }

  // 2. B) FILA GERAL / TRIAGEM (assigned_to === null / sem responsável atribuído):
  // Exibir apenas se pertencer explicitamente ao departamento de atuação do colaborador
  if (isChatUnassigned(contact)) {
    return matchesDepartment(user.department, contact.department);
  }

  return false;
}
