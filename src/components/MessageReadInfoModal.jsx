import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CheckCheck,
  Check,
  Clock,
  Users,
  Search,
  Sparkles,
  Shield,
  Eye,
  MessageSquare
} from 'lucide-react';
import { getSaoPauloTime } from '../lib/timezone';

/**
 * Extrai a lista normalizada de IDs de quem leu a mensagem
 */
export function extractReadByList(message, localReadByMap = {}) {
  if (!message) return [];

  // 1. Mapa local em tempo real (atualizado no frame atual)
  const localList = localReadByMap?.[message.id];
  if (Array.isArray(localList) && localList.length > 0) {
    return localList.map(String);
  }

  // 2. Campo direto do objeto de mensagem
  const rawVal = message.read_by ?? message.readBy;
  if (Array.isArray(rawVal) && rawVal.length > 0) {
    return rawVal.map(String);
  }

  // 3. String JSON ou formato Postgres array: {"u1","u2"} ou {u1,u2}
  if (typeof rawVal === 'string' && rawVal.trim()) {
    try {
      const parsed = JSON.parse(rawVal);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
    const cleaned = rawVal
      .replace(/[{}]/g, '')
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }

  // 4. Fallback: anotação oculta em HTML <!-- READ_BY:[...] --> no corpo da mensagem
  if (typeof message.text === 'string' && message.text.includes('<!-- READ_BY:')) {
    const match = message.text.match(/<!-- READ_BY:([\s\S]*?)-->/);
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {}
    }
  }

  return [];
}

export default function MessageReadInfoModal({
  isOpen,
  onClose,
  message,
  collaborators = [],
  channelName = 'Geral',
  localReadByMap = {},
  currentUser
}) {
  const [activeTab, setActiveTab] = useState('read'); // 'read' | 'unread' | 'all'
  const [searchTerm, setSearchTerm] = useState('');

  // Fechar com tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de IDs confirmados
  const readByList = useMemo(() => {
    return extractReadByList(message, localReadByMap);
  }, [message, localReadByMap]);

  // Processamento e cruzamento de colaboradores
  const { readCollaborators, unreadCollaborators, senderCollab, totalTarget, readPercentage } = useMemo(() => {
    const safeCollabs = Array.isArray(collaborators) ? collaborators : [];
    // Filtra colaboradores humanos reais (exclui bots)
    const humanCollabs = safeCollabs.filter(
      (c) => c && !c.isBot && c.id !== 'u_ia_copilot' && !c.roleType?.includes('bot')
    );

    const senderIdClean = message?.senderId ? String(message.senderId) : (message?.sender_id ? String(message.sender_id) : '');
    const senderCollab = humanCollabs.find(
      (c) => String(c.id) === senderIdClean || String(c.user_id) === senderIdClean || (c.email && c.email.toLowerCase() === senderIdClean.toLowerCase())
    );

    const readIdSet = new Set(readByList.map((id) => String(id).trim().toLowerCase()));

    const readList = [];
    const matchedCollabIds = new Set();

    // 1. Colaboradores cadastrados que leram
    humanCollabs.forEach((c) => {
      const cId = String(c.id).toLowerCase();
      const cUserId = c.user_id ? String(c.user_id).toLowerCase() : null;
      const cEmail = c.email ? String(c.email).toLowerCase() : null;

      const isSender = cId === senderIdClean.toLowerCase() || (cUserId && cUserId === senderIdClean.toLowerCase());
      if (isSender) return; // O autor não conta como "destinatário que leu"

      if (readIdSet.has(cId) || (cUserId && readIdSet.has(cUserId)) || (cEmail && readIdSet.has(cEmail))) {
        readList.push({
          id: c.id,
          name: c.name,
          email: c.email,
          role: c.role || 'Colaborador',
          department: c.department || 'Geral',
          avatar: c.avatar || '👤',
          online: Boolean(c.online),
          roleType: c.roleType || 'colaborador',
          isRead: true
        });
        matchedCollabIds.add(cId);
        if (cUserId) matchedCollabIds.add(cUserId);
        if (cEmail) matchedCollabIds.add(cEmail);
      }
    });

    // 2. Fallback para IDs no read_by que não possuem objeto correspondente em collaborators
    readByList.forEach((rawId) => {
      const idClean = String(rawId).trim().toLowerCase();
      if (!idClean || idClean === senderIdClean.toLowerCase() || matchedCollabIds.has(idClean)) return;
      readList.push({
        id: rawId,
        name: `Usuário (${rawId})`,
        email: '',
        role: 'Colaborador',
        department: 'Equipe',
        avatar: '👤',
        online: false,
        roleType: 'colaborador',
        isRead: true
      });
      matchedCollabIds.add(idClean);
    });

    // 3. Colaboradores que ainda NÃO leram
    const unreadList = humanCollabs
      .filter((c) => {
        const cId = String(c.id).toLowerCase();
        const cUserId = c.user_id ? String(c.user_id).toLowerCase() : null;
        const isSender = cId === senderIdClean.toLowerCase() || (cUserId && cUserId === senderIdClean.toLowerCase());
        if (isSender) return false;
        return !matchedCollabIds.has(cId) && (!cUserId || !matchedCollabIds.has(cUserId));
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role || 'Colaborador',
        department: c.department || 'Geral',
        avatar: c.avatar || '👤',
        online: Boolean(c.online),
        roleType: c.roleType || 'colaborador',
        isRead: false
      }));

    const totalTarget = readList.length + unreadList.length;
    const readPercentage = totalTarget > 0 ? Math.round((readList.length / totalTarget) * 100) : 0;

    return {
      readCollaborators: readList,
      unreadCollaborators: unreadList,
      senderCollab,
      totalTarget,
      readPercentage
    };
  }, [collaborators, message, readByList]);

  // Lista filtrada por busca e tab
  const displayedCollaborators = useMemo(() => {
    let baseList = [];
    if (activeTab === 'read') baseList = readCollaborators;
    else if (activeTab === 'unread') baseList = unreadCollaborators;
    else baseList = [...readCollaborators, ...unreadCollaborators];

    if (!searchTerm.trim()) return baseList;

    const term = searchTerm.toLowerCase().trim();
    return baseList.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.role && c.role.toLowerCase().includes(term)) ||
        (c.department && c.department.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term))
    );
  }, [activeTab, readCollaborators, unreadCollaborators, searchTerm]);

  if (!isOpen || !message) return null;

  // Sanitização do texto da mensagem para o preview
  const rawText = message.text || '';
  const cleanMessageText = rawText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
    .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
    .trim();

  const formattedTime = getSaoPauloTime(message.timestamp || message.created_at);
  const senderDisplayName = message.senderName || senderCollab?.name || 'Você';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111b21] text-slate-800 dark:text-[#e9edef] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-[#222e35] flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho estilo WhatsApp Web */}
        <div className="bg-[#008069] dark:bg-[#202c33] text-white p-4 sm:px-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <CheckCheck size={22} className="text-[#53bdeb]" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight flex items-center gap-2">
                Dados da Mensagem
              </h3>
              <p className="text-xs text-white/80 font-medium">
                Canal #{channelName || 'geral'} • Enviada às {formattedTime}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview do Balão da Mensagem */}
        <div className="p-4 bg-slate-50 dark:bg-[#0b141a] border-b border-slate-200 dark:border-[#222e35]">
          <div className="bg-white dark:bg-[#202c33] p-3 rounded-xl border border-slate-200/80 dark:border-[#2a3942] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#54656f] dark:text-[#8696a0]">
              <span className="font-semibold text-[#008069] dark:text-[#00a884] flex items-center gap-1">
                <MessageSquare size={12} /> {senderDisplayName}
              </span>
              <span>{formattedTime}</span>
            </div>
            {cleanMessageText ? (
              <p className="text-[13px] text-slate-800 dark:text-[#d1d7db] line-clamp-3 whitespace-pre-wrap leading-relaxed">
                {cleanMessageText}
              </p>
            ) : (
              <span className="text-xs text-slate-400 italic">
                {message.attachment ? '📎 Arquivo / Anexo compartilhado' : 'Mensagem sem conteúdo textual'}
              </span>
            )}
          </div>
        </div>

        {/* Cartão de Resumo e Barra de Progresso */}
        <div className="p-4 sm:px-5 space-y-3 bg-white dark:bg-[#111b21] border-b border-slate-200 dark:border-[#222e35]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-blue-500" />
              <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                Lida por <strong className="text-blue-600 dark:text-blue-400 font-bold">{readCollaborators.length}</strong> de <strong className="text-slate-800 dark:text-white font-bold">{totalTarget}</strong> colaboradores
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
              {readPercentage}%
            </span>
          </div>

          {/* Barra de Progresso Visual */}
          <div className="w-full bg-slate-100 dark:bg-[#202c33] h-2.5 rounded-full overflow-hidden border border-slate-200/60 dark:border-[#2a3942]">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, readPercentage))}%` }}
            />
          </div>

          {/* Abas Segmentadas: Lida por / Não Lida / Todos */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('read')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                activeTab === 'read'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 shadow-2xs'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-[#202c33]'
              }`}
            >
              <CheckCheck size={14} className="text-[#53bdeb]" />
              <span>Lida por</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                {readCollaborators.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                activeTab === 'unread'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 shadow-2xs'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-[#202c33]'
              }`}
            >
              <Clock size={13} className="text-amber-500" />
              <span>Não lida</span>
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                {unreadCollaborators.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer border ${
                activeTab === 'all'
                  ? 'bg-slate-200 dark:bg-[#2a3942] text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-[#202c33]'
              }`}
            >
              <Users size={13} />
              <span>Todos ({totalTarget})</span>
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador ou departamento..."
              className="w-full bg-slate-50 dark:bg-[#202c33] text-slate-800 dark:text-slate-100 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-[220px] max-h-[340px] scrollbar-thin">
          {displayedCollaborators.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#202c33] mx-auto flex items-center justify-center text-slate-400">
                <Users size={20} />
              </div>
              <p className="text-xs font-medium">
                {searchTerm
                  ? 'Nenhum colaborador encontrado com esse termo.'
                  : activeTab === 'read'
                  ? 'Nenhum colega visualizou esta mensagem ainda.'
                  : activeTab === 'unread'
                  ? '🎉 Todos os colaboradores já leram este comunicado!'
                  : 'Nenhum colaborador na lista.'}
              </p>
            </div>
          ) : (
            displayedCollaborators.map((collab) => {
              const isCurrentUser = currentUser?.id && String(currentUser.id) === String(collab.id);
              return (
                <div
                  key={collab.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                    collab.isRead
                      ? 'bg-blue-50/40 dark:bg-blue-950/15 border-blue-100 dark:border-blue-900/30'
                      : 'bg-slate-50/70 dark:bg-[#202c33]/40 border-slate-200/70 dark:border-[#2a3942]/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar com status de presença */}
                    <div className="relative text-2xl shrink-0 w-9 h-9 rounded-lg bg-white dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] flex items-center justify-center shadow-2xs">
                      <span>{collab.avatar}</span>
                      {collab.online && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#202c33]"
                          title="Online no sistema"
                        />
                      )}
                    </div>

                    {/* Dados do Colaborador */}
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                          {collab.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80">
                            Você
                          </span>
                        )}
                        {collab.roleType === 'diretor' && (
                          <span className="text-[9px] text-amber-700 dark:text-amber-300 font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 flex items-center gap-0.5">
                            <Shield size={9} /> Gestão
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {collab.department} • {collab.role}
                      </p>
                    </div>
                  </div>

                  {/* Badge de Status de Leitura */}
                  <div className="shrink-0 pl-2">
                    {collab.isRead ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shadow-2xs">
                        <CheckCheck size={14} className="text-[#53bdeb]" />
                        <span>Lida</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-[#202c33] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#2a3942]">
                        <Clock size={12} className="text-amber-500/80" />
                        <span>Pendente</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3 sm:px-5 bg-slate-50 dark:bg-[#0b141a] border-t border-slate-200 dark:border-[#222e35] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px]">Sincronização em tempo real via Supabase</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
