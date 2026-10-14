import React, { useState } from 'react';
import { X, Sparkles, Check, Clock, User, AlertTriangle, ArrowRight } from 'lucide-react';

export default function AICopilotModal({
  isOpen,
  onClose,
  mode, // 'extract_task' | 'summary' | 'bottlenecks'
  sourceMessage,
  channel,
  onConfirmTaskCreation
}) {
  if (!isOpen) return null;

  // Mock AI generated task details from message
  const [taskForm, setTaskForm] = useState({
    title: sourceMessage ? `Tratar: ${sourceMessage.text.slice(0, 50)}...` : 'Nova Demanda',
    desc: sourceMessage ? sourceMessage.text : '',
    assignee: sourceMessage?.senderName || 'Fernanda Silva',
    priority: 'alta',
    dueDate: 'Em 48 horas',
    channel: channel ? `#${channel.name}` : '#geral'
  });

  const handleCreate = () => {
    onConfirmTaskCreation({
      ...taskForm,
      id: 't_' + Date.now(),
      status: 'backlog',
      assigneeAvatar: '👤',
      sourceMessage: sourceMessage ? `${sourceMessage.senderName}: "${sourceMessage.text}"` : 'Criado via IA'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                {mode === 'extract_task' && 'Transformar Conversa em Demanda'}
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

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                    Título da Demanda (Sugerido pela IA):
                  </label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                      Responsável:
                    </label>
                    <input
                      type="text"
                      value={taskForm.assignee}
                      onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                      className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                      Prazo Sugerido:
                    </label>
                    <input
                      type="text"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-chatTextMuted mb-1">
                    Prioridade Detectada:
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-chatInputBg text-chatTextTitle text-xs border border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 shadow-sm"
                  >
                    <option value="alta">Alta (Urgente / Financeiro)</option>
                    <option value="media">Média (Rotina Operacional)</option>
                    <option value="baixa">Baixa (Backlog)</option>
                  </select>
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
                    <strong>Alinhamento de Faturamento:</strong> Fernanda identificou divergência de R$ 350 na fatura do Polo Campinas.
                  </li>
                  <li>
                    <strong>Decisão Tomada:</strong> Flávio solicitou retificação no Asaas com envio da 2ª via até amanhã às 12h.
                  </li>
                  <li>
                    <strong>Status:</strong> Demanda em andamento pela equipe financeira.
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#111b21] rounded-lg border border-chatBorder flex items-center justify-between">
                <div>
                  <p className="font-medium text-chatTextTitle">1 Ação Crítica Identificada</p>
                  <p className="text-chatTextMuted">Fatura nº 408 precisa de retificação</p>
                </div>
                <button
                  onClick={() => {
                    handleCreate();
                  }}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded text-[11px] shadow-sm transition"
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
                  <p className="font-bold text-amber-900 dark:text-yellow-300">Atenção ao Setor de Secretaria</p>
                  <p className="text-amber-800/80 dark:text-[#d1d7db] mt-0.5">
                    Há 8 alunos com certificados pendentes de emissão há mais de 48h.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                <p className="font-bold text-blue-900 dark:text-blue-300">Carga da Equipe:</p>
                <p className="text-blue-800/80 dark:text-[#d1d7db] mt-1">
                  Fernanda Silva possui 2 tarefas críticas em andamento. Todas dentro do prazo esperado.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
