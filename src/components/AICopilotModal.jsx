import React, { useState, useMemo } from 'react';
import { X, Sparkles, Check, Clock, User, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { analyzeTaskPriorityAI } from '../lib/aiKnowledge';

export default function AICopilotModal({
  isOpen,
  onClose,
  mode, // 'extract_task' | 'summary' | 'bottlenecks'
  sourceMessage,
  channel,
  activeChat,
  onConfirmTaskCreation,
  collaborators = [],
  vipClients = []
}) {
  if (!isOpen) return null;

  // Filtrar apenas colaboradores reais (excluir o próprio bot)
  const realCollaborators = useMemo(() => {
    return collaborators.filter((c) => !c.isBot);
  }, [collaborators]);

  // Inicializar o formulário inteligente (Se for conversa unilateral DM, responsável é o interlocutor)
  const initialAssignee = useMemo(() => {
    if (activeChat?.type === 'dm') {
      const dmCollab = realCollaborators.find((c) => c.id === activeChat.id);
      if (dmCollab) return dmCollab.name;
    }
    if (sourceMessage?.senderName) {
      const match = realCollaborators.find((c) => c.name === sourceMessage.senderName);
      if (match) return match.name;
    }
    return realCollaborators[1]?.name || realCollaborators[0]?.name || 'Tatiane Salatinos';
  }, [sourceMessage, realCollaborators, activeChat]);

  const initialChannelTag = useMemo(() => {
    if (activeChat?.type === 'dm') {
      const dmCollab = collaborators.find((c) => c.id === activeChat.id);
      return `🔒 Privado (${dmCollab?.name?.split(' ')[0] || '1 a 1'})`;
    }
    return channel ? `#${channel.name}` : '#geral';
  }, [activeChat, channel, collaborators]);

  const [taskForm, setTaskForm] = useState({
    title: sourceMessage ? `Tratar: ${sourceMessage.text.slice(0, 50)}...` : 'Nova Demanda',
    desc: sourceMessage ? sourceMessage.text : '',
    assignee: initialAssignee,
    channel: initialChannelTag
  });

  // Cálculo de Prioridade 100% Automático via IA (Item 5 da solicitação)
  const aiAnalysis = useMemo(() => {
    return analyzeTaskPriorityAI(taskForm.title, taskForm.desc, vipClients);
  }, [taskForm.title, taskForm.desc, vipClients]);

  const handleCreate = () => {
    const assigneeObj = realCollaborators.find((c) => c.name === taskForm.assignee);
    onConfirmTaskCreation({
      ...taskForm,
      id: 't_' + Date.now(),
      status: 'backlog',
      priority: aiAnalysis.priority,
      isVip: aiAnalysis.isVip,
      aiReason: aiAnalysis.reason,
      dueDate: aiAnalysis.dueDate,
      assigneeAvatar: assigneeObj?.avatar || '👤',
      department: assigneeObj?.department || 'Geral',
      sourceMessage: sourceMessage ? `${sourceMessage.senderName}: "${sourceMessage.text}"` : 'Criado via IA'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-chatCard border border-chatBorder rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header do Modal */}
        <div className="p-4 bg-gradient-to-r from-purple-100 via-chatCard to-emerald-100 dark:from-purple-900/40 dark:via-chatPanel dark:to-brand-600/20 border-b border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
              <Sparkles size={20} className="text-yellow-600 dark:text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-chatTextTitle text-base">Copiloto Inteligente EduChat</h3>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                {mode === 'extract_task' && 'Criação de Demanda no Kanban'}
                {mode === 'summary' && `Resumo do Canal #${channel?.name}`}
                {mode === 'bottlenecks' && 'Diagnóstico de Processos da Equipe'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-chatTextMuted hover:text-chatTextTitle rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo dinâmico por modo */}
        <div className="p-6 space-y-4">
          {mode === 'extract_task' && (
            <>
              {sourceMessage && (
                <div className="bg-slate-100 dark:bg-[#111b21] p-3 rounded-lg border border-chatBorder text-xs text-chatTextBody">
                  <span className="text-purple-600 dark:text-purple-400 font-bold block mb-1">MENSAGEM ANALISADA:</span>
                  "{sourceMessage.text}"
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                    Título da Demanda (Sugerido pela IA):
                  </label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                    Detalhes / Contexto:
                  </label>
                  <textarea
                    rows={2}
                    value={taskForm.desc}
                    onChange={(e) => setTaskForm({ ...taskForm, desc: e.target.value })}
                    placeholder="Descrição da demanda..."
                    className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-xs resize-none"
                  />
                </div>

                {/* Seleção do Responsável com Barra de Rolagem (Item 4) */}
                <div>
                  <label className="block text-xs font-semibold text-chatTextMuted mb-1 flex items-center justify-between">
                    <span>Responsável Designado:</span>
                    <span className="text-[11px] text-brand-600 dark:text-brand-400">
                      {realCollaborators.length} colaboradores
                    </span>
                  </label>
                  <select
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-500 shadow-xs max-h-48 overflow-y-auto cursor-pointer"
                    size={Math.min(5, realCollaborators.length)}
                  >
                    {realCollaborators.map((c) => (
                      <option key={c.id} value={c.name} className="py-1 px-2 hover:bg-brand-50">
                        {c.avatar} {c.name} — {c.department} ({c.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Avaliação de Prioridade 100% Automática pela IA (Item 5) */}
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                      Prioridade Definida pela IA:
                    </span>
                    {aiAnalysis.isVip || aiAnalysis.priority === 'vip' ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-300">
                        👑 VIP (PLANO FIXO)
                      </span>
                    ) : (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase border ${
                        aiAnalysis.priority === 'alta'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300'
                          : aiAnalysis.priority === 'media'
                          ? 'bg-amber-100 text-amber-800 dark:bg-yellow-950/40 dark:text-yellow-300 border-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300'
                      }`}>
                        Prioridade {aiAnalysis.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                    💡 <strong>Critério da IA:</strong> {aiAnalysis.reason}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-purple-200/60 dark:border-purple-500/20 text-[10px] text-purple-700 dark:text-purple-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Prazo Regulatório: <strong>{aiAnalysis.dueDate}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={11} /> Travado contra priorização manual
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-chatTextMuted hover:text-chatTextTitle transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Check size={16} />
                  <span>Criar Card no Kanban</span>
                </button>
              </div>
            </>
          )}

          {mode === 'summary' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-xl space-y-2">
                <p className="font-semibold text-purple-900 dark:text-purple-200">
                  Resumo das últimas conversas no canal #{channel?.name}:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-chatTextBody">
                  <li>
                    <strong>Alinhamento de Faturamento:</strong> Tatiane identificou demanda urgente de regularização no Asaas.
                  </li>
                  <li>
                    <strong>Decisão Tomada:</strong> Flávio solicitou emissão de 2ª via e alinhamento com a secretaria.
                  </li>
                  <li>
                    <strong>Status:</strong> Demanda em andamento com acompanhamento intersetorial.
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#111b21] rounded-lg border border-chatBorder flex items-center justify-between">
                <div>
                  <p className="font-medium text-chatTextTitle">1 Ação Crítica Identificada</p>
                  <p className="text-chatTextMuted">Processo acadêmico pendente de validação</p>
                </div>
                <button
                  onClick={handleCreate}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded text-[11px] shadow-xs transition"
                >
                  Criar Tarefa
                </button>
              </div>
            </div>
          )}

          {mode === 'bottlenecks' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/30 rounded-lg flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-yellow-300">Diagnóstico de Fluxo Acadêmico</p>
                  <p className="text-amber-800/80 dark:text-[#d1d7db] mt-0.5">
                    Processos de certificação e validação de documentos da Secretaria Acadêmica seguem dentro do SLA de 48h estipulado pelas diretrizes MEC.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                <p className="font-bold text-blue-900 dark:text-blue-300">Carga da Equipe:</p>
                <p className="text-blue-800/80 dark:text-[#d1d7db] mt-1">
                  Distribuição de demandas equilibrada entre Comercial, Secretaria e Tutoria.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
