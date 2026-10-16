import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Loader2,
  UserCheck,
  Building2,
  Calendar,
  AlertCircle,
  Mail,
  Trash2,
  PlusCircle
} from 'lucide-react';
import {
  extractTasksFromMeetNotes,
  matchCollaboratorToTask,
  fetchActiveCollaboratorsFromDB
} from '../lib/gemini';

const DEPARTMENTS_LIST = [
  'Marketing',
  'Comercial',
  'Expansão',
  'Secretaria',
  'Pedagógico',
  'Tutoria',
  'Financeiro',
  'Diretoria'
];

export default function MeetNotesImportModal({
  isOpen,
  onClose,
  collaborators = [],
  onCreateTasksBatch,
  onOpenAIMemory
}) {
  if (!isOpen) return null;

  const [meetingTitle, setMeetingTitle] = useState('Anotações: Reunião de Alinhamento (Google Meet)');
  const [notesText, setNotesText] = useState('');
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbCollaborators, setDbCollaborators] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchActiveCollaboratorsFromDB(collaborators)
      .then((liveUsers) => {
        if (mounted && Array.isArray(liveUsers) && liveUsers.length > 0) {
          setDbCollaborators(liveUsers);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [collaborators]);

  const activeCollaborators = useMemo(() => {
    const source = dbCollaborators.length > 0 ? dbCollaborators : collaborators;
    return (source || []).filter((c) => !c.isBot && c.roleType !== 'bot');
  }, [dbCollaborators, collaborators]);

  const handleLoadSample = () => {
    setMeetingTitle('Anotações: Alinhamento Executivo & Operacional Semanal');
    const sampleLines = activeCollaborators.slice(0, 6).map((u) => {
      return `- ${u.name} (${u.department || 'Geral'}) ficará responsável por conduzir as próximas entregas prioritárias de ${u.role || u.department || 'seu setor'} até o próximo alinhamento.`;
    });
    const dynamicSample = `De: gemini-notes@google.com\nAssunto: Anotações: Alinhamento Executivo & Operacional Semanal\n\nResumo da reunião:\nAlinhamento geral sobre metas dos setores, prazos regulatórios e acompanhamento de indicadores no Kanban.\n\nPróximas etapas:\n${sampleLines.join('\n')}`;
    setNotesText(dynamicSample);
    setErrorMsg('');
  };

  const handleAnalyzeWithGemini = async () => {
    if (!notesText.trim()) {
      setErrorMsg('Cole o conteúdo da ata do Google Meet (gemini-notes@google.com) antes de analisar.');
      return;
    }
    setErrorMsg('');
    setIsAnalyzing(true);
    try {
      const results = await extractTasksFromMeetNotes({
        notesText,
        meetingTitle,
        collaborators: activeCollaborators
      });
      setExtractedTasks(results);
      if (results.length === 0) {
        setErrorMsg('Nenhuma tarefa foi encontrada na seção "Próximas etapas". Verifique o texto colado.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao processar a ata com a API do Gemini.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateTaskField = (index, field, value) => {
    setExtractedTasks((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === 'responsavel_nome') {
          const matchedCollab = activeCollaborators.find((c) => c.name === value);
          return {
            ...item,
            responsavel_nome: value,
            assigneeId: matchedCollab?.id || null,
            assigneeEmail: matchedCollab?.email || '',
            assigneeAvatar: matchedCollab?.avatar || '👤',
            departamento: matchedCollab?.department || item.departamento
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleRemoveExtracted = (index) => {
    setExtractedTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmImport = async () => {
    if (extractedTasks.length === 0) return;
    setIsSaving(true);
    try {
      const formattedCards = extractedTasks.map((item, idx) => {
        const matched = matchCollaboratorToTask(
          item.responsavel_nome,
          item.departamento,
          activeCollaborators
        );
        return {
          id: `t_meet_${Date.now()}_${idx}`,
          title: item.titulo_curto || item.descricao_tarefa.slice(0, 65),
          desc: item.descricao_tarefa,
          status: 'backlog', // "Pendente / A Fazer"
          priority: item.prioridade || 'alta',
          isVip: item.prioridade === 'vip',
          assignee: item.responsavel_nome || matched.assignee,
          assigneeId: item.assigneeId || matched.assigneeId,
          assigneeEmail: item.assigneeEmail || matched.assigneeEmail,
          assigneeAvatar: item.assigneeAvatar || matched.assigneeAvatar || '👤',
          department: item.departamento || matched.department || 'Geral',
          dueDate: item.prazo_sugerido || 'Próxima Reunião',
          channel: '📅 Ata Google Meet',
          sourceMessage: `Google Meet (gemini-notes@google.com) • ${meetingTitle}`
        };
      });

      await onCreateTasksBatch(formattedCards);
      onClose();
    } catch (err) {
      setErrorMsg('Erro ao salvar tarefas no Kanban: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 text-white border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300">
              <Sparkles size={22} className="text-yellow-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  Importar Ata do Google Meet → Kanban Automático
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Lê e-mails de <code className="text-yellow-300">gemini-notes@google.com</code> ("Anotações: [Nome da Reunião]"), extrai as "Próximas etapas" e vincula dinamicamente aos usuários reais do banco.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Informativo de Sincronização Dinâmica com a Tabela de Perfis do Supabase */}
          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Mail size={18} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-purple-950 dark:text-purple-200">
                  Sincronização Dinâmica com Perfis do Banco ({activeCollaborators.length} colaboradores ativos)
                </p>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                  Compara dinamicamente o nome ou e-mail citado na ata com a tabela de usuários do Supabase (por correspondência exata ou proximidade de nome) ou atribui ao Administrador padrão.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-chatPanel border border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 font-semibold text-[11px] hover:bg-purple-100/50 transition shrink-0 cursor-pointer"
            >
              📋 Preencher com Ata de Teste
            </button>
          </div>

          {/* Campos de Entrada da Ata */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-chatTextTitle mb-1">
                Assunto do E-mail / Nome da Reunião:
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Ex: Anotações: Reunião de Alinhamento Semanal"
                className="w-full bg-slate-50 dark:bg-chatInputBg text-slate-800 dark:text-chatTextTitle px-3.5 py-2 rounded-xl border border-slate-200 dark:border-chatBorder focus:outline-none focus:border-purple-500 text-xs font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-chatTextTitle">
                  Conteúdo da Ata do Google Meet (cole o texto ou a seção "Próximas etapas"):
                </label>
                <span className="text-[11px] text-chatTextMuted">
                  Foco automático em "Próximas etapas"
                </span>
              </div>
              <textarea
                rows={7}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder={`Cole aqui o texto recebido de gemini-notes@google.com...\n\nExemplo:\nPróximas etapas:\n- Ana Lívia vai disparar a campanha de matrículas até amanhã.\n- Luiz Augusto vai validar o novo polo de Terapia Educacional.\n- Lindomar e Paulo vão revisar as ementas pedagógicas.`}
                className="w-full bg-slate-50 dark:bg-chatInputBg text-slate-800 dark:text-chatTextTitle p-3.5 rounded-xl border border-slate-200 dark:border-chatBorder focus:outline-none focus:border-purple-500 text-xs leading-relaxed font-mono resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyzeWithGemini}
                disabled={isAnalyzing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Extraindo "Próximas etapas" via Gemini 2.5...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-yellow-300" />
                    <span>Extrair Tarefas e Vincular Responsáveis (Gemini)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Exibição de Erro */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {errorMsg.toLowerCase().includes('chave') && onOpenAIMemory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAIMemory();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Configurar Chave Gemini
                </button>
              )}
            </div>
          )}

          {/* Lista de Cartões Extraídos para Revisão / Confirmação */}
          {extractedTasks.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-chatBorder">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-chatTextTitle flex items-center gap-2">
                  <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {extractedTasks.length} Tarefa(s) Identificada(s) para a Coluna "Pendente / A Fazer"
                  </span>
                </h4>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Você pode ajustar o setor ou responsável antes de confirmar
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {extractedTasks.map((task, idx) => (
                  <div
                    key={task.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder flex flex-col gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={task.titulo_curto}
                        onChange={(e) => handleUpdateTaskField(idx, 'titulo_curto', e.target.value)}
                        className="flex-1 font-bold text-slate-900 dark:text-chatTextTitle bg-white dark:bg-chatInputBg px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExtracted(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                        title="Remover este item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={task.descricao_tarefa}
                      onChange={(e) => handleUpdateTaskField(idx, 'descricao_tarefa', e.target.value)}
                      className="w-full text-slate-700 dark:text-chatTextBody bg-white dark:bg-chatInputBg px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs resize-none"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                      {/* Responsável Vinculado */}
                      <div>
                        <label className="block text-[10px] font-bold text-chatTextMuted uppercase mb-1 flex items-center gap-1">
                          <UserCheck size={11} className="text-emerald-500" />
                          Responsável Vinculado
                        </label>
                        <select
                          value={task.responsavel_nome}
                          onChange={(e) => handleUpdateTaskField(idx, 'responsavel_nome', e.target.value)}
                          className="w-full bg-white dark:bg-chatInputBg border border-slate-200 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-chatTextTitle"
                        >
                          {!activeCollaborators.some((c) => c.name === task.responsavel_nome) && (
                            <option value={task.responsavel_nome}>{task.responsavel_nome}</option>
                          )}
                          {activeCollaborators.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.avatar} {c.name} ({c.department})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Departamento / Fila */}
                      <div>
                        <label className="block text-[10px] font-bold text-chatTextMuted uppercase mb-1 flex items-center gap-1">
                          <Building2 size={11} className="text-purple-500" />
                          Departamento / Fila
                        </label>
                        <select
                          value={task.departamento}
                          onChange={(e) => handleUpdateTaskField(idx, 'departamento', e.target.value)}
                          className="w-full bg-white dark:bg-chatInputBg border border-slate-200 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-chatTextTitle"
                        >
                          {!DEPARTMENTS_LIST.includes(task.departamento) && (
                            <option value={task.departamento}>{task.departamento}</option>
                          )}
                          {DEPARTMENTS_LIST.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Prioridade */}
                      <div>
                        <label className="block text-[10px] font-bold text-chatTextMuted uppercase mb-1">
                          Prioridade
                        </label>
                        <select
                          value={task.prioridade}
                          onChange={(e) => handleUpdateTaskField(idx, 'prioridade', e.target.value)}
                          className="w-full bg-white dark:bg-chatInputBg border border-slate-200 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-chatTextTitle"
                        >
                          <option value="alta">🔴 Alta</option>
                          <option value="media">🟡 Média</option>
                          <option value="baixa">🔵 Baixa</option>
                          <option value="vip">👑 VIP</option>
                        </select>
                      </div>

                      {/* Prazo */}
                      <div>
                        <label className="block text-[10px] font-bold text-chatTextMuted uppercase mb-1 flex items-center gap-1">
                          <Calendar size={11} />
                          Prazo Sugerido
                        </label>
                        <input
                          type="text"
                          value={task.prazo_sugerido}
                          onChange={(e) => handleUpdateTaskField(idx, 'prazo_sugerido', e.target.value)}
                          className="w-full bg-white dark:bg-chatInputBg border border-slate-200 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-chatTextTitle"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between gap-3">
          <div className="text-[11px] text-chatTextMuted">
            Status inicial dos cartões: <strong className="text-slate-800 dark:text-chatTextTitle">Pendente / A Fazer</strong> • Sincronização em tempo real no Supabase
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-chatBorder text-slate-600 dark:text-chatTextMuted hover:text-slate-900 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={extractedTasks.length === 0 || isSaving}
              onClick={handleConfirmImport}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <PlusCircle size={15} />
              )}
              <span>
                Criar {extractedTasks.length > 0 ? `${extractedTasks.length} ` : ''}Cartões no Kanban
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
