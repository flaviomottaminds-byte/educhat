import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, Hash, Lock, Circle } from 'lucide-react';

export default function ChatArea({
  chatMeta, // { type: 'channel' | 'dm', data: Channel | Collaborator }
  messages,
  onSendMessage,
  onCreateTaskFromMessage,
  onSummarizeChat
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const isDM = chatMeta.type === 'dm';
  const target = chatMeta.data;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMeta]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-chatBg relative transition-colors">
      {/* Header do Chat (Canal ou 1 a 1) */}
      <div className="h-16 px-6 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isDM ? (
            <div className="relative text-2xl">
              <span>{target.avatar}</span>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-chatPanel ${
                  target.online ? 'bg-brand-500' : 'bg-gray-400'
                }`}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-chatCard flex items-center justify-center text-brand-600 dark:text-brand-500 font-bold border border-chatBorder shadow-sm">
              <Hash size={20} />
            </div>
          )}

          <div>
            <h2 className="text-chatTextTitle font-bold text-base leading-tight flex items-center gap-2">
              {isDM ? target.name : `#${target.name}`}
              {isDM && (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-500/30">
                  <Lock size={10} /> Privada (1 a 1)
                </span>
              )}
            </h2>
            <p className="text-xs text-chatTextMuted">
              {isDM ? `${target.role} · ${target.online ? 'Online agora' : 'Offline'}` : target.desc}
            </p>
          </div>
        </div>

        {/* Botão Resumo IA e Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSummarizeChat}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-600/30 border border-purple-200 dark:border-purple-500/30 text-xs font-semibold transition"
          >
            <Sparkles size={15} className="text-purple-600 dark:text-purple-400" />
            <span>{isDM ? 'Resumir Conversa' : 'Resumir Canal'}</span>
          </button>
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-chatTextMuted">
            {isDM ? (
              <>
                <span className="text-4xl mb-2">{target.avatar}</span>
                <p className="text-sm font-semibold text-chatTextTitle">Início da conversa com {target.name}</p>
                <p className="text-xs mt-1">
                  Esta é uma conversa direta e privada entre você e {target.name.split(' ')[0]}.
                </p>
              </>
            ) : (
              <>
                <Hash size={40} className="mb-2 opacity-40 text-brand-500" />
                <p className="text-sm font-semibold text-chatTextTitle">Nenhuma mensagem neste canal ainda.</p>
                <p className="text-xs mt-1">Inicie a conversa interna com sua equipe!</p>
              </>
            )}
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === 'u1'; // Flávio
            return (
              <div
                key={m.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && !isDM && (
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-[#00a884] ml-2 mb-1">
                    {m.senderName}
                  </span>
                )}

                <div className="relative max-w-lg">
                  {/* Balão da Mensagem */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all ${
                      isMe
                        ? 'bg-chatBubbleUser text-chatBubbleUserText rounded-tr-none border border-emerald-200/40 dark:border-transparent'
                        : 'bg-chatBubbleOther text-chatBubbleOtherText rounded-tl-none border border-chatBorder'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-chatTextMuted">
                      <span>{m.timestamp}</span>
                      {isMe && <span className="text-brand-600 dark:text-brand-500 font-bold">✓✓</span>}
                    </div>
                  </div>

                  {/* Botão de Ação Rápida de IA que aparece no Hover */}
                  <div
                    className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 flex gap-1 ${
                      isMe ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                    }`}
                  >
                    <button
                      onClick={() => onCreateTaskFromMessage(m)}
                      title="Transformar esta mensagem em Tarefa no Kanban com IA"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-semibold shadow-lg border border-purple-400/40 whitespace-nowrap hover:scale-105 transition"
                    >
                      <Sparkles size={12} className="text-yellow-300 animate-pulse" />
                      <span>Gerar Card Kanban</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada / Digitação */}
      <div className="p-3 bg-chatPanel border-t border-chatBorder">
        {/* Sugestão Rápida da IA */}
        <div className="mb-2 px-2 flex items-center gap-2">
          <span className="text-[11px] text-chatTextMuted flex items-center gap-1">
            <Sparkles size={12} className="text-brand-600 dark:text-brand-500" /> Dica rápida:
          </span>
          <button
            onClick={() => setInputText('/tarefa ')}
            className="text-[11px] text-brand-600 dark:text-brand-500 hover:underline bg-brand-500/10 px-2 py-0.5 rounded font-medium"
          >
            /tarefa [descrição]
          </button>
          <button
            onClick={() => onSendMessage(isDM ? `Oi ${target.name.split(' ')[0]}, preciso que você ` : '@IA listar pendências')}
            className="text-[11px] text-purple-700 dark:text-purple-400 hover:underline bg-purple-500/10 px-2 py-0.5 rounded font-medium"
          >
            {isDM ? `Cobrar ${target.name.split(' ')[0]}` : '@IA listar pendências'}
          </button>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-chatTextMuted hover:text-chatTextTitle rounded-lg transition"
            title="Anexar arquivo"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isDM
                ? `Mensagem privada para ${target.name.split(' ')[0]}...`
                : `Mensagem no canal #${target.name}...`
            }
            className="flex-1 bg-chatInputBg text-chatTextTitle text-sm placeholder:text-chatTextMuted px-4 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 shadow-sm transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`p-2.5 rounded-lg flex items-center justify-center transition ${
              inputText.trim()
                ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md'
                : 'text-chatTextMuted cursor-not-allowed opacity-50'
            }`}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}
