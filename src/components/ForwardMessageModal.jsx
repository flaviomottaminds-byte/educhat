import React, { useState, useMemo } from 'react';
import {
  Forward,
  Search,
  X,
  Users,
  Hash,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  Mic,
  MessageSquare
} from 'lucide-react';
import { hasFullPortfolioAccess } from '../lib/portfolioAccess';

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
  currentUser,
  channels = [],
  collaborators = [],
  onConfirmForward
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null); // { type: 'channel' | 'dm', id: string, name: string }
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'channels' | 'dms'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtragem de Canais conforme permissão de visibilidade de grupos
  const isManager = hasFullPortfolioAccess(currentUser);
  const userDept = (currentUser?.department || '').trim().toLowerCase();

  const accessibleChannels = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    return list.filter((c) => {
      if (!c) return false;
      if (isManager) return true;

      const chName = (c.name || '').trim().toLowerCase();
      const chDept = (c.department || '').trim().toLowerCase();

      const isGeral = chName === 'geral' || c.id === 'c-geral' || chDept === 'todos';
      const isMyDepartment = userDept && (chDept === userDept || chName === userDept);

      return isGeral || isMyDepartment;
    });
  }, [channels, isManager, userDept]);

  // Filtragem de Colaboradores (exclui o próprio usuário e bots)
  const accessibleCollaborators = useMemo(() => {
    const list = Array.isArray(collaborators) ? collaborators : [];
    return list.filter((collab) => {
      if (!collab || !collab.id) return false;
      if (collab.id === currentUser?.id) return false;
      if (collab.isBot || collab.id === 'u_ia_copilot') return false;
      return true;
    });
  }, [collaborators, currentUser]);

  // Busca e filtro por aba
  const cleanSearch = searchQuery.trim().toLowerCase();

  const filteredChannels = useMemo(() => {
    if (activeTab === 'dms') return [];
    return accessibleChannels.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const desc = (c.desc || '').toLowerCase();
      const dept = (c.department || '').toLowerCase();
      return name.includes(cleanSearch) || desc.includes(cleanSearch) || dept.includes(cleanSearch);
    });
  }, [accessibleChannels, cleanSearch, activeTab]);

  const filteredCollaborators = useMemo(() => {
    if (activeTab === 'channels') return [];
    return accessibleCollaborators.filter((collab) => {
      const name = (collab.name || '').toLowerCase();
      const role = (collab.role || '').toLowerCase();
      const dept = (collab.department || '').toLowerCase();
      return name.includes(cleanSearch) || role.includes(cleanSearch) || dept.includes(cleanSearch);
    });
  }, [accessibleCollaborators, cleanSearch, activeTab]);

  // Resumo da mensagem original para prévia
  const messagePreview = useMemo(() => {
    if (!message) return null;
    const rawText = message.text || '';
    const clean = rawText
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
      .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
      .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
      .trim();

    const isImage = Boolean(
      message.isImage ||
      message.attachment?.isImage ||
      message.attachment?.type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(message.attachment?.name || '')
    );

    const isAudio = !isImage && Boolean(
      message.isAudio ||
      message.attachment?.isAudio ||
      message.attachment?.type?.startsWith('audio/') ||
      /\.(ogg|opus|mp3|wav|webm|m4a)$/i.test(message.attachment?.name || '') ||
      rawText.includes('<!-- AUDIO_URL:')
    );

    let typeLabel = 'Texto';
    let icon = <MessageSquare size={14} className="text-blue-500" />;

    if (isAudio) {
      typeLabel = `Áudio (${message.duration || '0:14'})`;
      icon = <Mic size={14} className="text-emerald-500" />;
    } else if (isImage) {
      typeLabel = message.attachment?.name || 'Imagem';
      icon = <ImageIcon size={14} className="text-purple-500" />;
    } else if (message.attachment) {
      typeLabel = message.attachment.name || 'Arquivo';
      icon = <FileText size={14} className="text-amber-500" />;
    }

    return {
      sender: message.senderName || 'Colega',
      typeLabel,
      icon,
      textSnippet: clean || (isAudio ? 'Mensagem de voz gravada' : isImage ? 'Imagem anexada' : 'Arquivo anexado')
    };
  }, [message]);

  if (!isOpen || !message) return null;

  const handleSelect = (target) => {
    setSelectedTarget(target);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTarget || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirmForward(selectedTarget);
      onClose();
    } catch (err) {
      console.error('[ForwardMessageModal] Erro ao encaminhar:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-chatPanel w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Forward size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Encaminhar mensagem</h3>
              <p className="text-xs text-emerald-100">Selecione um grupo ou colega de trabalho</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Prévia da Mensagem Original */}
        {messagePreview && (
          <div className="mx-4 mt-3 p-2.5 bg-slate-50 dark:bg-white/5 border-l-4 border-emerald-500 rounded-r-xl flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg shrink-0 mt-0.5">
              {messagePreview.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 block text-[11px]">
                {messagePreview.sender}:
              </span>
              <p className="truncate text-slate-600 dark:text-slate-300 text-[12px] mt-0.5">
                {messagePreview.textSnippet}
              </p>
            </div>
          </div>
        )}

        {/* Campo de Busca e Abas */}
        <div className="px-4 pt-3 pb-2 space-y-2 border-b border-slate-100 dark:border-chatBorder">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar grupo ou colega..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-chatCard text-slate-800 dark:text-slate-200 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-chatPanel outline-none transition"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                activeTab === 'all'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Todos ({filteredChannels.length + filteredCollaborators.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('channels')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                activeTab === 'channels'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Grupos ({accessibleChannels.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dms')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                activeTab === 'dms'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Contatos ({accessibleCollaborators.length})
            </button>
          </div>
        </div>

        {/* Lista de Destinatários Selecionáveis */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 divide-y divide-slate-100 dark:divide-white/5">
          {/* Seção de Grupos / Canais */}
          {filteredChannels.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-chatTextMuted flex items-center gap-1.5">
                <Hash size={12} />
                <span>Grupos / Canais ({filteredChannels.length})</span>
              </div>
              <div className="space-y-1">
                {filteredChannels.map((channel) => {
                  const isSelected = selectedTarget?.type === 'channel' && selectedTarget?.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => handleSelect({
                        type: 'channel',
                        id: channel.id,
                        name: `#${channel.name}`
                      })}
                      className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 shadow-xs'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}>
                          <Hash size={16} />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            #{channel.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-chatTextMuted truncate">
                            {channel.desc || `Canal ${channel.department || 'Operacional'}`}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 shrink-0">
                          {channel.department || 'Geral'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção de Contatos / Colaboradores */}
          {filteredCollaborators.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-chatTextMuted flex items-center gap-1.5">
                <Users size={12} />
                <span>Contatos da Equipe ({filteredCollaborators.length})</span>
              </div>
              <div className="space-y-1">
                {filteredCollaborators.map((collab) => {
                  const isSelected = selectedTarget?.type === 'dm' && selectedTarget?.id === collab.id;
                  return (
                    <button
                      key={collab.id}
                      type="button"
                      onClick={() => handleSelect({
                        type: 'dm',
                        id: collab.id,
                        name: collab.name
                      })}
                      className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 shadow-xs'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-sm font-semibold shrink-0">
                          {collab.avatar || collab.name?.charAt(0) || '👤'}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {collab.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-chatTextMuted truncate">
                            {collab.role || collab.department || 'Equipe'}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 shrink-0">
                          {collab.department || 'Equipe'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredChannels.length === 0 && filteredCollaborators.length === 0 && (
            <div className="py-8 text-center text-slate-400 dark:text-chatTextMuted text-xs">
              Nenhum destinatário encontrado para "{searchQuery}".
            </div>
          )}
        </div>

        {/* Rodapé com Confirmação */}
        <div className="p-3 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-chatBorder flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {selectedTarget ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                Destino: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedTarget.name}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Clique em um canal ou contato acima
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedTarget || isSubmitting}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer ${
                !selectedTarget || isSubmitting
                  ? 'bg-slate-300 dark:bg-white/10 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Encaminhando...</span>
                </>
              ) : (
                <>
                  <Forward size={13} />
                  <span>Encaminhar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
