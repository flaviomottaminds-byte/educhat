import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Sparkles,
  Hash,
  Lock,
  Smile,
  Mic,
  FileText,
  X,
  Download,
  Image as ImageIcon,
  HelpCircle,
  Bot
} from 'lucide-react';

export default function ChatArea({
  chatMeta, // { type: 'channel' | 'dm', data: Channel | Collaborator }
  messages,
  onSendMessage,
  onCreateTaskFromMessage,
  onSummarizeChat,
  onOpenWhatsAppDossier,
  currentUser,
  realtimeStatus = 'connected',
  collaborators = []
}) {
  const [inputText, setInputText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const isDM = chatMeta.type === 'dm';
  const target = chatMeta.data || {};
  const isBotChat = isDM && (target.isBot || target.id === 'u_ia_copilot');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMeta]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !pendingAttachment) return;

    onSendMessage(inputText, pendingAttachment);
    setInputText('');
    setPendingAttachment(null);
  };

  // Upload de arquivos (Item 8)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  // Helper para formatar nomes nos grupos
  const getShortName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts[0] === 'Ana' && parts.length > 1) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0];
  };

  // Membros reais vinculados a este canal específico
  const channelMembersText = !isDM && collaborators.length > 0
    ? target.department === 'Todos'
      ? `Toda a equipe (${collaborators.length} membros)`
      : collaborators
          .filter((c) => !c.isBot && (c.department === target.department || c.roleType === 'diretor'))
          .map((c) => getShortName(c.name))
          .join(', ')
    : '';

  return (
    <section className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-chatBg relative transition-colors">
      {/* Header do Chat - Estilo Exato WhatsApp Web */}
      <div className="h-16 px-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          {isDM ? (
            <div className="relative text-3xl">
              <span>{target.avatar || '👤'}</span>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatPanel ${
                  target.online ? 'bg-brand-600' : 'bg-gray-300'
                }`}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white dark:bg-chatCard flex items-center justify-center text-brand-600 dark:text-brand-500 font-bold border border-slate-200 dark:border-chatBorder shadow-xs">
              <Hash size={18} />
            </div>
          )}

          <div>
            <h2 className="text-chatTextTitle font-semibold text-sm leading-tight flex items-center gap-2">
              {target.name}
              {isBotChat ? (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-300 dark:border-purple-500/30">
                  <Bot size={11} /> IA 24h
                </span>
              ) : isDM ? (
                <span className="text-[10px] bg-slate-200/80 dark:bg-purple-500/20 text-[#54656f] dark:text-purple-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-300 dark:border-purple-500/30">
                  <Lock size={9} /> Privado
                </span>
              ) : null}
            </h2>
            <p className="text-[11px] text-[#667781] dark:text-chatTextMuted flex items-center gap-2">
              <span className="truncate max-w-[280px] md:max-w-md">
                {isBotChat
                  ? 'Base normativa MEC, Asaas, POPs e fluxos operacionais'
                  : isDM
                  ? target.online ? 'online' : 'visto por último recentemente'
                  : channelMembersText || target.desc || 'Canal de comunicação'}
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              {realtimeStatus === 'connected' ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Tempo Real Ativo
                </span>
              ) : realtimeStatus === 'connecting' ? (
                <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  Conectando Nuvem...
                </span>
              ) : (
                <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Reconectando
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Botões de Inteligência e Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenWhatsAppDossier}
            title="Importar e analisar histórico longo do WhatsApp com IA para gerar Dossiê e Cards"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-500/30 text-xs font-semibold shadow-xs transition"
          >
            <FileText size={14} className="text-brand-600 dark:text-brand-400" />
            <span className="hidden sm:inline">Analisar Histórico WhatsApp</span>
            <span className="sm:hidden">Dossiê</span>
          </button>

          <button
            onClick={onSummarizeChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 hover:bg-slate-50 dark:hover:bg-purple-600/30 border border-slate-200 dark:border-purple-500/30 text-xs font-medium shadow-xs transition"
          >
            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">{isDM ? 'Resumir' : 'Resumo Canal'}</span>
            <span className="sm:hidden">Resumo</span>
          </button>
        </div>
      </div>

      {/* Sugestões de Perguntas Rápidas ao conversar com a IA (Item 6) */}
      {isBotChat && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/30 border-b border-purple-200 dark:border-purple-500/30 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1 shrink-0">
            <HelpCircle size={13} /> Dúvidas frequentes:
          </span>
          <button
            onClick={() => onSendMessage('Qual o prazo do MEC para emissão de diplomas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            📜 Prazo MEC para Diplomas
          </button>
          <button
            onClick={() => onSendMessage('Como funciona o split de faturamento e retificação no Asaas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            💳 Split no Asaas
          </button>
          <button
            onClick={() => onSendMessage('Qual o procedimento POP para reposição de aulas e notas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            📝 POP Reposição de Aulas
          </button>
          <button
            onClick={() => onSendMessage('Quem são os parceiros VIP e quais suas regras?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            👑 Polos VIP
          </button>
        </div>
      )}

      {/* Área de Mensagens com Textura Oficial do WhatsApp */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2.5 whatsapp-bg">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#667781]">
            <div className="bg-white/85 dark:bg-chatCard/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-sm shadow-sm space-y-2">
              <span className="text-4xl block">{target.avatar || '💬'}</span>
              <p className="text-sm font-bold text-chatTextTitle">
                {isBotChat
                  ? 'Assistente IA Institucional'
                  : isDM
                  ? `Conversa com ${target.name}`
                  : `Canal #${target.name}`}
              </p>
              <p className="text-xs text-[#667781] leading-relaxed">
                {isBotChat
                  ? 'Pergunte qualquer dúvida sobre regulação MEC, prazos, emissão de certificados, Asaas e procedimentos operacionais da faculdade.'
                  : 'As mensagens trocadas neste canal são corporativas e monitoradas pelo copiloto de IA.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUser?.id;
            const isBot = m.senderId === 'bot' || m.senderId === 'u_ia_copilot';

            return (
              <div
                key={m.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && !isDM && (
                  <span className="text-[11px] font-semibold text-[#008069] dark:text-[#00a884] ml-2 mb-0.5">
                    {m.senderName}
                  </span>
                )}

                <div className="relative max-w-lg md:max-w-xl">
                  {/* Balão da Mensagem - Estilo WhatsApp Oficial */}
                  <div
                    className={`px-3.5 py-2 text-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-all ${
                      isMe
                        ? 'bg-[#d9fdd3] dark:bg-chatBubbleUser text-[#111b21] dark:text-chatBubbleUserText rounded-lg rounded-tr-none'
                        : isBot
                        ? 'bg-[#fef9c3] dark:bg-purple-950/40 text-[#111b21] dark:text-purple-200 rounded-lg border border-yellow-300 dark:border-purple-500/40'
                        : 'bg-white dark:bg-chatBubbleOther text-[#111b21] dark:text-chatBubbleOtherText rounded-lg rounded-tl-none'
                    }`}
                  >
                    {/* Renderização de Anexo no Balão de Chat (Item 8) */}
                    {m.attachment && (
                      <div className="mb-2">
                        {m.attachment.type?.startsWith('image/') ? (
                          <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10 max-w-sm">
                            <img
                              src={m.attachment.dataUrl}
                              alt={m.attachment.name}
                              className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
                              onClick={() => window.open(m.attachment.dataUrl, '_blank')}
                            />
                            <div className="p-1.5 bg-black/5 dark:bg-white/5 flex items-center justify-between text-[11px]">
                              <span className="truncate">{m.attachment.name}</span>
                              <a
                                href={m.attachment.dataUrl}
                                download={m.attachment.name}
                                className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2"
                              >
                                <Download size={12} /> Baixar
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-between gap-3 max-w-sm">
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={24} className="text-rose-500 shrink-0" />
                              <div className="truncate">
                                <p className="text-xs font-semibold truncate leading-tight">
                                  {m.attachment.name}
                                </p>
                                <span className="text-[10px] opacity-70">
                                  {m.attachment.size}
                                </span>
                              </div>
                            </div>
                            <a
                              href={m.attachment.dataUrl}
                              download={m.attachment.name}
                              className="p-1.5 rounded-full bg-brand-600 text-white hover:bg-brand-500 transition shrink-0"
                              title="Baixar arquivo"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="leading-relaxed whitespace-pre-wrap text-[13.5px]">{m.text}</p>

                    <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781] dark:text-chatTextMuted select-none">
                      <span>{m.timestamp}</span>
                      {isMe && (
                        <span className="text-[#53bdeb] font-bold text-xs leading-none">
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botão Hover da IA para Gerar Card no Kanban */}
                  {!isBot && (
                    <div
                      className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 flex gap-1 ${
                        isMe ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                      }`}
                    >
                      <button
                        onClick={() => onCreateTaskFromMessage(m)}
                        title="Transformar esta mensagem em Tarefa no Kanban com IA"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-semibold shadow-md border border-purple-400/40 whitespace-nowrap hover:scale-105 transition"
                      >
                        <Sparkles size={11} className="text-yellow-300 animate-pulse" />
                        <span>Gerar Card</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada / Digitação com Anexo e Ações Rápidas */}
      <div className="p-2.5 bg-[#f0f2f5] dark:bg-chatPanel border-t border-chatBorder">
        {/* Preview do arquivo pronto para envio (Item 8) */}
        {pendingAttachment && (
          <div className="mb-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-500/30 rounded-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 truncate">
              {pendingAttachment.type?.startsWith('image/') ? (
                <ImageIcon size={16} className="text-blue-500 shrink-0" />
              ) : (
                <FileText size={16} className="text-rose-500 shrink-0" />
              )}
              <span className="font-semibold text-brand-900 dark:text-brand-200 truncate">
                {pendingAttachment.name}
              </span>
              <span className="text-[10px] text-brand-700 dark:text-brand-400">
                ({pendingAttachment.size})
              </span>
            </div>
            <button
              onClick={() => setPendingAttachment(null)}
              className="p-1 text-slate-500 hover:text-red-500 transition rounded-full"
              title="Remover anexo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Sugestões Rápidas de IA */}
        <div className="mb-1.5 px-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#667781] dark:text-chatTextMuted flex items-center gap-1">
            <Sparkles size={11} className="text-brand-600 dark:text-brand-500" /> Ações rápidas:
          </span>
          <button
            onClick={() => setInputText('/tarefa ')}
            className="text-[10px] text-brand-600 dark:text-brand-500 hover:underline bg-white dark:bg-brand-500/10 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent font-medium shadow-2xs"
          >
            /tarefa [descrição]
          </button>
          <button
            onClick={() => onSendMessage(isDM ? `Oi ${target.name?.split(' ')[0]}, preciso que você verifique essa demanda` : '@IA listar pendências')}
            className="text-[10px] text-purple-700 dark:text-purple-400 hover:underline bg-white dark:bg-purple-500/10 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent font-medium shadow-2xs"
          >
            {isDM ? `Cobrar ${target.name?.split(' ')[0]}` : '@IA listar pendências'}
          </button>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Input de arquivo invisível (Item 8) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
          />

          <button
            type="button"
            onClick={() => setInputText((prev) => prev + ' 😊')}
            className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-chatTextTitle transition rounded-full"
            title="Inserir Emoji"
          >
            <Smile size={22} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-brand-600 transition rounded-full"
            title="Anexar documento ou imagem"
          >
            <Paperclip size={22} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={pendingAttachment ? "Adicione uma legenda ou envie..." : "Digite uma mensagem"}
            className="flex-1 bg-white dark:bg-chatInputBg text-chatTextTitle text-[14px] placeholder:text-[#54656f] dark:placeholder:text-chatTextMuted px-4 py-2.5 rounded-lg border-none focus:outline-none shadow-xs transition"
          />

          {inputText.trim() || pendingAttachment ? (
            <button
              type="submit"
              className="p-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-sm flex items-center justify-center transition"
              title="Enviar mensagem"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSendMessage('🎙️ [Mensagem de áudio recebida via WhatsApp]')}
              className="p-2 text-[#54656f] dark:text-chatTextMuted hover:text-chatTextTitle transition rounded-full"
              title="Gravar mensagem de voz"
            >
              <Mic size={22} />
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
