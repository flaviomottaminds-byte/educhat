import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Sparkles, Hash, CheckSquare, PlusCircle } from 'lucide-react';

export default function ChatArea({
  channel,
  messages,
  onSendMessage,
  onCreateTaskFromMessage,
  onSummarizeChannel
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-chatBg relative">
      {/* Header do Canal */}
      <div className="h-16 px-6 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#111b21] flex items-center justify-center text-brand-500 font-bold border border-chatBorder">
            <Hash size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-base leading-tight flex items-center gap-2">
              #{channel.name}
            </h2>
            <p className="text-xs text-[#8696a0]">{channel.desc}</p>
          </div>
        </div>

        {/* Botão Resumo IA do Canal */}
        <button
          onClick={onSummarizeChannel}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-semibold transition"
        >
          <Sparkles size={15} className="text-purple-400" />
          <span>Resumir com IA</span>
        </button>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#8696a0]">
            <Hash size={40} className="mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem neste canal ainda.</p>
            <p className="text-xs mt-1">Inicie a conversa interna com sua equipe!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === 'u1'; // Flávio
            return (
              <div
                key={m.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[11px] font-semibold text-[#00a884] ml-2 mb-1">
                    {m.senderName}
                  </span>
                )}

                <div className="relative max-w-lg">
                  {/* Balão da Mensagem */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all ${
                      isMe
                        ? 'bg-chatBubbleUser text-white rounded-tr-none'
                        : 'bg-chatBubbleOther text-[#d1d7db] rounded-tl-none border border-chatBorder/50'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-[#8696a0]">
                      <span>{m.timestamp}</span>
                      {isMe && <span className="text-brand-500">✓✓</span>}
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
          <span className="text-[11px] text-[#8696a0] flex items-center gap-1">
            <Sparkles size={12} className="text-brand-500" /> Dica rápida:
          </span>
          <button
            onClick={() => setInputText('/tarefa ')}
            className="text-[11px] text-brand-500 hover:underline bg-brand-500/10 px-2 py-0.5 rounded"
          >
            /tarefa [descrição]
          </button>
          <button
            onClick={() => onSendMessage('🤖 @IA, liste as pendências do financeiro para hoje')}
            className="text-[11px] text-purple-400 hover:underline bg-purple-500/10 px-2 py-0.5 rounded"
          >
            @IA listar pendências
          </button>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-[#8696a0] hover:text-white rounded-lg transition"
            title="Anexar arquivo"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite uma mensagem interna para a equipe..."
            className="flex-1 bg-chatSidebar text-white text-sm placeholder-[#8696a0] px-4 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`p-2.5 rounded-lg flex items-center justify-center transition ${
              inputText.trim()
                ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md'
                : 'text-[#8696a0] cursor-not-allowed opacity-50'
            }`}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}
