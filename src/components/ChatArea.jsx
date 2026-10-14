import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, Hash, Lock, Smile, Mic } from 'lucide-react';

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
    <section className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-chatBg relative transition-colors">
      {/* Header do Chat - Estilo Exato WhatsApp Web */}
      <div className="h-16 px-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          {isDM ? (
            <div className="relative text-3xl">
              <span>{target.avatar}</span>
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
              {isDM ? target.name : target.name}
              {isDM && (
                <span className="text-[10px] bg-slate-200/80 dark:bg-purple-500/20 text-[#54656f] dark:text-purple-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-300 dark:border-purple-500/30">
                  <Lock size={9} /> Privado
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[#667781] dark:text-chatTextMuted">
              {isDM
                ? target.online ? 'online' : 'visto por último hoje às 18:40'
                : 'Carlos, Fernanda, Juliana, Flávio'}
            </p>
          </div>
        </div>

        {/* Botão Resumo IA e Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSummarizeChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 hover:bg-slate-50 dark:hover:bg-purple-600/30 border border-slate-200 dark:border-purple-500/30 text-xs font-medium shadow-xs transition"
          >
            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
            <span>{isDM ? 'Resumir Conversa' : 'Resumo do Canal'}</span>
          </button>
        </div>
      </div>

      {/* Área de Mensagens com Textura Oficial do WhatsApp */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 whatsapp-bg">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#667781]">
            <div className="bg-white/80 dark:bg-chatCard/80 backdrop-blur-xs p-4 rounded-xl border border-slate-200 dark:border-chatBorder max-w-sm shadow-sm">
              <span className="text-4xl block mb-2">{isDM ? target.avatar : '💬'}</span>
              <p className="text-sm font-semibold text-chatTextTitle">
                {isDM ? `Conversa com ${target.name}` : `Canal #${target.name}`}
              </p>
              <p className="text-xs text-[#667781] mt-1">
                As mensagens trocadas neste canal são corporativas e monitoradas pelo copiloto de IA.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === 'u1'; // Flávio
            const isBot = m.senderId === 'bot';

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

                <div className="relative max-w-lg">
                  {/* Balão da Mensagem - Estilo WhatsApp Oficial */}
                  <div
                    className={`px-3 py-1.5 text-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-all ${
                      isMe
                        ? 'bg-[#d9fdd3] dark:bg-chatBubbleUser text-[#111b21] dark:text-chatBubbleUserText rounded-lg rounded-tr-none'
                        : isBot
                        ? 'bg-[#fef9c3] dark:bg-purple-950/40 text-[#111b21] dark:text-purple-200 rounded-lg border border-yellow-300 dark:border-purple-500/40'
                        : 'bg-white dark:bg-chatBubbleOther text-[#111b21] dark:text-chatBubbleOtherText rounded-lg rounded-tl-none'
                    }`}
                  >
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

      {/* Barra de Entrada / Digitação - Fiel ao WhatsApp Web */}
      <div className="p-2.5 bg-[#f0f2f5] dark:bg-chatPanel border-t border-chatBorder">
        {/* Sugestões Rápidas de IA */}
        <div className="mb-1.5 px-1 flex items-center gap-2">
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
            onClick={() => onSendMessage(isDM ? `Oi ${target.name.split(' ')[0]}, preciso que você ` : '@IA listar pendências')}
            className="text-[10px] text-purple-700 dark:text-purple-400 hover:underline bg-white dark:bg-purple-500/10 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent font-medium shadow-2xs"
          >
            {isDM ? `Cobrar ${target.name.split(' ')[0]}` : '@IA listar pendências'}
          </button>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-chatTextTitle transition rounded-full"
            title="Inserir Emoji"
          >
            <Smile size={22} />
          </button>

          <button
            type="button"
            className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-chatTextTitle transition rounded-full"
            title="Anexar arquivo"
          >
            <Paperclip size={22} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Mensagem"
            className="flex-1 bg-white dark:bg-chatInputBg text-chatTextTitle text-[14px] placeholder:text-[#54656f] dark:placeholder:text-chatTextMuted px-4 py-2.5 rounded-lg border-none focus:outline-none shadow-xs transition"
          />

          {inputText.trim() ? (
            <button
              type="submit"
              className="p-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-sm flex items-center justify-center transition"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              type="button"
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
