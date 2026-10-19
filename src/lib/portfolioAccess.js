import { isUserAdmin } from './aiKnowledge';
import { INITIAL_COLLABORATORS } from '../data/initialData';

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
 * Extrai e normaliza o ID do atendente responsável (assigned_to) de um chat/contato.
 * Retorna null se o chat estiver na fila geral / triagem / sem responsável atribuído.
 * Retorna o ID em minúsculas (ex: 'u3', 'u4') se estiver atribuído a um atendente.
 */
export function getChatAssignedToId(contact, collaborators = []) {
  if (!contact) return null;

  // 1. Verificação por campo assigned_to ou assignee_id direto
  const rawAssignedTo = contact.assigned_to ?? contact.assignee_id;
  if (rawAssignedTo !== undefined && rawAssignedTo !== null) {
    const val = String(rawAssignedTo).trim().toLowerCase();
    if (!val || val === 'null' || val === 'undefined' || val === 'triagem' || val === 'fila' || val === 'aguardando') {
      return null;
    }
    return val;
  }

  // 2. Verificação por nome textual de assignee
  const rawAssignee = String(contact.assignee || '').trim();
  if (!rawAssignee) return null;

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
    return null;
  }

  // Procura pelo colaborador correspondente para obter o seu ID
  const allCollabs = Array.isArray(collaborators) && collaborators.length > 0 ? collaborators : INITIAL_COLLABORATORS;
  const found = allCollabs.find((c) => {
    if (!c) return false;
    const cName = normalizeName(c.name || '');
    if (cName === norm) return true;
    const cFirst = cName.split(' ')[0];
    const normFirst = norm.split(' ')[0];
    return cFirst && normFirst && cFirst.length >= 3 && cFirst === normFirst;
  });

  if (found?.id) {
    return String(found.id).trim().toLowerCase();
  }

  return norm;
}

/**
 * Retorna true se o contato NÃO possui nenhum responsável ativo atribuído
 * (pertence à fila geral/triagem, URA ou assigned_to === null).
 */
export function isChatUnassigned(contact, collaborators = []) {
  return getChatAssignedToId(contact, collaborators) === null;
}

/**
 * Retorna true se o chat/contato do WhatsApp estiver atribuído diretamente ao usuário logado,
 * ou se o usuário logado for co-responsável (co-atribuição temporária),
 * ou se o usuário logado for gestor/diretor (visão irrestrita de carteira).
 */
export function isChatAssignedToUser(contactOrAssignee, user, collaborators = []) {
  if (!user) return false;
  if (hasFullPortfolioAccess(user)) return true;
  if (!contactOrAssignee) return false;

  const myUserId = String(user.id || '').trim().toLowerCase();
  const myNameNorm = normalizeName(user.name);

  if (typeof contactOrAssignee === 'object') {
    const assignedId = getChatAssignedToId(contactOrAssignee, collaborators);
    if (assignedId && (assignedId === myUserId || (myNameNorm && assignedId === myNameNorm))) {
      return true;
    }

    // Co-atribuídos
    if (Array.isArray(contactOrAssignee.assignees)) {
      const isCoAssigned = contactOrAssignee.assignees.some((a) => {
        if (!a) return false;
        if (typeof a === 'string') {
          const aNorm = normalizeName(a);
          return aNorm === myNameNorm || aNorm === myUserId;
        }
        if (a?.id && String(a.id).trim().toLowerCase() === myUserId) return true;
        if (a?.name && normalizeName(a.name) === myNameNorm) return true;
        return false;
      });
      if (isCoAssigned) return true;
    }
  }

  return false;
}

/**
 * Retorna true se o departamento/fila do colaborador for compatível com o departamento alvo.
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
 * 1. Gestores / Administradores: visibilidade irrestrita (100% da fila geral e carteiras).
 * 2. Colaboradores comuns (Atendentes/Consultores):
 *    - Visualizam EXCLUSIVAMENTE os chats onde assigned_to === currentUser.id.
 *    - Se assigned_to === null (Fila Geral / Triagem), retorna false (oculta completamente da barra lateral).
 *    - Se assigned_to pertencer a outro colega, retorna false.
 */
export function canUserViewChat(contact, user, collaborators = []) {
  if (!contact || !user) return false;

  // 1. Gestores / Administradores / Diretores: sem restrições (100% da fila geral e carteiras)
  if (hasFullPortfolioAccess(user)) return true;

  // 2. Colaborador comum (Atendente / Consultor):
  const assignedToId = getChatAssignedToId(contact, collaborators);

  // FILA GERAL / TRIAGEM: assigned_to === null é EXCLUSIVA DO GESTOR/ADMIN -> Oculta do usuário comum
  if (assignedToId === null) {
    return false;
  }

  const myUserId = String(user.id || '').trim().toLowerCase();
  const myNameNorm = normalizeName(user.name);

  // MINHA CARTEIRA: assigned_to === currentUser.id (Permitido)
  if (assignedToId === myUserId || (myNameNorm && assignedToId === myNameNorm)) {
    return true;
  }

  // Co-atribuição direta explícita ao usuário logado
  if (isChatAssignedToUser(contact, user, collaborators)) {
    return true;
  }

  // Qualquer outro chat (pertencente a outro colega): Bloqueado
  return false;
}

/**
 * ISOLAMENTO DO ALARME SONORO DE NOTIFICAÇÕES (playMessageSound):
 * Determina se o alerta sonoro (apito) deve ser disparado para uma mensagem.
 * 
 * Regras estritas:
 * 1. Mensagens enviadas pelo próprio usuário logado (senderId === currentUser.id ou fromMe === true) JAMAIS apitam.
 * 2. Mensagens de sistema ('system', 'sys') ou bots ('bot_') JAMAIS apitam.
 * 3. Conversas 1-a-1 (DM): Toca APENAS se o usuário logado for o destinatário direto.
 * 4. WhatsApp Alunos (wa-): Toca APENAS se o chat estiver atribuído ao usuário logado (assigned_to === currentUser.id).
 *    Gestores/Admins e outros consultores NÃO ouvem apitos de chats de terceiros nem da Fila Geral/Triagem pendente.
 */
export function shouldPlayMessageSound(
  chatKey,
  msg,
  user,
  { whatsAppContacts = [], assignmentsCache = {}, collaborators = [] } = {}
) {
  if (!user || !user.id || !chatKey || !msg) return false;

  const myUserId = String(user.id).trim().toLowerCase();
  const myNameNorm = normalizeName(user.name);

  // Regra D: Mensagens enviadas pelo próprio usuário logado JAMAIS disparam o apito
  if (
    msg.fromMe === true ||
    String(msg.fromMe) === 'true' ||
    msg.from_me === true ||
    String(msg.from_me) === 'true'
  ) {
    return false;
  }

  const rawSenderId = String(msg.senderId || msg.sender_id || '').trim().toLowerCase();
  if (
    rawSenderId &&
    (rawSenderId === myUserId ||
      rawSenderId === 'system' ||
      rawSenderId === 'sys' ||
      rawSenderId === 'u_ia_copilot' ||
      rawSenderId.startsWith('bot_'))
  ) {
    return false;
  }

  const rawSenderName = normalizeName(msg.senderName || msg.sender_name || '');
  if (myNameNorm && rawSenderName === myNameNorm) {
    return false;
  }

  // Regra A: Conversas 1-a-1 (DM) -> Tocar APENAS se o usuário logado for o destinatário
  if (chatKey.startsWith('dm-')) {
    const parts = chatKey.replace('dm-', '').split('-');
    if (parts.length >= 2) {
      const id1 = String(parts[0]).trim().toLowerCase();
      const id2 = String(parts[1]).trim().toLowerCase();
      const isParticipant = (myUserId === id1 || myUserId === id2);
      const isSender = (rawSenderId === myUserId);
      return isParticipant && !isSender;
    }
    return false;
  }

  // Regra B e C: Chats do WhatsApp Alunos (wa-)
  // Tocar APENAS se o chat estiver atribuído ao usuário logado (assigned_to === currentUser.id ou equivalente)
  // Gestores/Admins e outros consultores NÃO devem ouvir apitos de chats de terceiros, nem da Fila Geral/Triagem.
  if (chatKey.startsWith('wa-')) {
    // Localiza o contato nos contatos conhecidos
    const existing = (whatsAppContacts || []).find((c) => {
      if (!c) return false;
      if (c.id === chatKey) return true;
      const cPhone = String(c.phone || c.id || '').replace(/\D/g, '');
      const keyPhone = String(chatKey).replace(/\D/g, '');
      if (cPhone && keyPhone && (cPhone === keyPhone || cPhone.endsWith(keyPhone) || keyPhone.endsWith(cPhone))) {
        return true;
      }
      return false;
    });

    const cachedAsgn = assignmentsCache?.[chatKey] || null;

    const contactToCheck = existing || {
      id: chatKey,
      assigned_to: cachedAsgn?.assigned_to,
      assignee: cachedAsgn?.assignee,
      assignees: cachedAsgn?.assignees,
      department: cachedAsgn?.department,
      status: cachedAsgn?.status
    };

    const assignedId = getChatAssignedToId(contactToCheck, collaborators);

    // Fila Geral / Triagem / Pendente de atribuição (assigned_to === null) -> Silêncio absoluto
    if (!assignedId) {
      return false;
    }

    // Chat atribuído ao usuário logado
    if (assignedId === myUserId || (myNameNorm && assignedId === myNameNorm)) {
      return true;
    }

    // Co-atribuição ao usuário logado
    if (Array.isArray(contactToCheck.assignees)) {
      const isCoAssigned = contactToCheck.assignees.some((a) => {
        if (!a) return false;
        if (typeof a === 'string') {
          const aNorm = normalizeName(a);
          return aNorm === myNameNorm || aNorm === myUserId;
        }
        if (a?.id && String(a.id).trim().toLowerCase() === myUserId) return true;
        if (a?.name && normalizeName(a.name) === myNameNorm) return true;
        return false;
      });
      if (isCoAssigned) return true;
    }

    // Chat pertencente a outro colega -> Silêncio (mesmo se for gestor/admin)
    return false;
  }

  return false;
}

