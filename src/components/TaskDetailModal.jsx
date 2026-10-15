import React, { useState } from 'react';
import {
  X,
  Clock,
  UserCheck,
  Building2,
  Paperclip,
  Sparkles,
  Send,
  Download,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  AlertCircle,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  UserPlus
} from 'lucide-react';

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onUpdateStatus,
  onUpdateTask,
  onDeleteTask,
  currentUser,
  collaborators = []
}) {
  const [newComment, setNewComment] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task?.title || '');
  const [editDesc, setEditDesc] = useState(task?.desc || '');
  const [isScheduling, setIsScheduling] = useState(false);
  const [customDueDate, setCustomDueDate] = useState(task?.dueDate || '');

  if (!isOpen || !task) return null;

  const realCollaborators = collaborators.filter((c) => !c.isBot);

  const statusList = [
    { id: 'backlog', label: 'A Fazer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    { id: 'in_progress', label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
    { id: 'waiting', label: 'Aguardando Retorno', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
    { id: 'done', label: 'Concluído', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' }
  ];

  const handleSaveTitleDesc = () => {
    onUpdateTask(task.id, {
      title: editTitle.trim() || task.title,
      desc: editDesc.trim()
    });
    setIsEditingTitle(false);
  };

  // Delegar Demanda para outro Colaborador (Item 5)
  const handleDelegate = (newAssigneeName) => {
    if (newAssigneeName === task.assignee) return;
    const targetCollab = realCollaborators.find((c) => c.name === newAssigneeName);
    if (!targetCollab) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: `🔄 Demanda delegada de ${task.assignee} para ${targetCollab.name} (${targetCollab.department}) por ${currentUser.name}.`,
      timestamp: `${timeStr} - ${now.toLocaleDateString('pt-BR')}`
    };

    onUpdateTask(task.id, {
      assignee: targetCollab.name,
      assigneeAvatar: targetCollab.avatar || '👤',
      department: targetCollab.department,
      comments: [...(task.comments || []), commentObj]
    });
  };

  // Agendar Prazo / Horário (Item 3)
  const handleSchedule = (newDueDate) => {
    if (!newDueDate) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: `📅 Prazo reagendado para: "${newDueDate}" por ${currentUser.name}.`,
      timestamp: `${timeStr} - ${now.toLocaleDateString('pt-BR')}`
    };

    onUpdateTask(task.id, {
      dueDate: newDueDate,
      comments: [...(task.comments || []), commentObj]
    });
    setIsScheduling(false);
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${now.toLocaleDateString('pt-BR')}`;
    const commentObj = {
      id: 'c_' + Date.now(),
      author: currentUser.name,
      avatar: currentUser.avatar,
      dept: currentUser.department,
      text: newComment.trim(),
      timestamp: timeStr
    };

    const updatedComments = [...(task.comments || []), commentObj];
    onUpdateTask(task.id, { comments: updatedComments });
    setNewComment('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const attachment = {
        id: 'att_' + Date.now(),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        dataUrl: reader.result,
        author: currentUser.name,
        date: new Date().toLocaleDateString('pt-BR')
      };
      const updatedAttachments = [...(task.attachments || []), attachment];
      onUpdateTask(task.id, { attachments: updatedAttachments });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-chatPanel w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho do Card Ampliado */}
        <div className="p-5 bg-slate-50 dark:bg-chatSidebar border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-chatTextMuted bg-slate-200 dark:bg-chatCard px-2 py-0.5 rounded">
              ID: {task.id.slice(0, 10)}
            </span>
            {task.isVip || task.priority === 'vip' ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 border border-yellow-300 flex items-center gap-1 shadow-2xs">
                <span>👑</span> VIP (PLANO FIXO)
              </span>
            ) : (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded uppercase border ${
                task.priority === 'alta'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300'
                  : task.priority === 'media'
                  ? 'bg-amber-100 text-amber-800 dark:bg-yellow-950/40 dark:text-yellow-300 border-amber-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300'
              }`}>
                Prioridade {task.priority || 'Padrão'}
              </span>
            )}
            <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-500/30">
              {task.channel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditTitle(task.title);
                setEditDesc(task.desc || '');
                setIsEditingTitle(!isEditingTitle);
              }}
              title="Editar título e descrição do Kanban"
              className="p-1.5 rounded-lg text-chatTextMuted hover:text-brand-600 hover:bg-slate-200 dark:hover:bg-chatCard transition flex items-center gap-1 text-xs font-medium"
            >
              <Edit2 size={15} />
              <span>{isEditingTitle ? 'Cancelar Edição' : 'Editar'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-200 dark:hover:bg-chatCard transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Corpo do Modal Ampliado com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Título e Descrição (Modo Visualização ou Edição - Item 2) */}
          {isEditingTitle ? (
            <div className="space-y-3 bg-brand-50/50 dark:bg-brand-950/20 p-4 rounded-xl border border-brand-200 dark:border-brand-500/30">
              <div>
                <label className="block text-xs font-bold text-chatTextMuted mb-1">Título da Demanda:</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm font-bold bg-white dark:bg-chatCard text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-chatTextMuted mb-1">Descrição / Contexto:</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-chatCard text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3 py-1.5 text-xs text-chatTextMuted hover:text-chatTextTitle"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTitleDesc}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition"
                >
                  <Check size={14} /> Salvar Alterações
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-chatTextTitle leading-snug">
                {task.title}
              </h2>
              {task.desc && (
                <p className="text-sm text-chatTextBody mt-2 whitespace-pre-wrap leading-relaxed">
                  {task.desc}
                </p>
              )}
            </div>
          )}

          {/* Justificativa da IA para a Prioridade */}
          {(task.aiReason || task.isVip) && (
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 p-3.5 rounded-xl flex items-start gap-3 text-xs">
              <Sparkles size={18} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-bold text-purple-900 dark:text-purple-200">
                  Classificação Inteligente da IA:
                </p>
                <p className="text-purple-800 dark:text-purple-300 mt-0.5">
                  {task.aiReason || (task.isVip ? 'Classificado com prioridade máxima por se tratar de um parceiro VIP contratual.' : 'Prioridade regulada com base nos SLAs operacionais.')}
                </p>
              </div>
            </div>
          )}

          {/* Grid de Metadados Interativos: Solicitante, Responsável (DELEGAR), Prazo (AGENDAR), Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-chatBorder">
              <span className="text-[11px] text-chatTextMuted block font-medium">Solicitante:</span>
              <p className="text-xs font-bold text-chatTextTitle mt-1 truncate">
                {task.requester || 'Não especificado'}
              </p>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                {task.requesterDept || 'Origem Geral'}
              </span>
            </div>

            {/* DELEGAR: Seletor Interativo de Responsável (Item 5) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-chatBorder">
              <span className="text-[11px] text-chatTextMuted block font-medium mb-1">
                Responsável (Delegar):
              </span>
              <select
                value={task.assignee}
                onChange={(e) => handleDelegate(e.target.value)}
                className="w-full bg-white dark:bg-chatCard text-xs font-bold text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                title="Trocar ou delegar o responsável por esta demanda"
              >
                {realCollaborators.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.avatar} {c.name} ({c.department})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-chatTextMuted font-medium block mt-1">
                Setor: {task.department}
              </span>
            </div>

            {/* AGENDAR: Seletor de Prazo Interativo (Item 3) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-chatBorder">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-chatTextMuted font-medium">Prazo / Agendamento:</span>
                <button
                  type="button"
                  onClick={() => setIsScheduling(!isScheduling)}
                  className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                >
                  {isScheduling ? 'Fechar' : 'Agendar'}
                </button>
              </div>

              {!isScheduling ? (
                <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-chatTextTitle">
                  <Clock size={14} className="text-amber-500" />
                  <span className="truncate">{task.dueDate || 'Em 48 horas'}</span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <select
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        handleSchedule(e.target.value);
                      }
                    }}
                    defaultValue=""
                    className="w-full bg-white dark:bg-chatCard text-[11px] font-semibold text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded px-1.5 py-1"
                  >
                    <option value="" disabled>Escolha um horário:</option>
                    <option value="Hoje às 17h">Hoje às 17h</option>
                    <option value="Amanhã às 09h">Amanhã às 09h</option>
                    <option value="Sexta-feira às 18h">Sexta-feira às 18h</option>
                    <option value="Em 24 horas">Em 24 horas</option>
                    <option value="Em 48 horas">Em 48 horas</option>
                    <option value="custom">Personalizado...</option>
                  </select>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Ex: 20/10 às 14h"
                      value={customDueDate}
                      onChange={(e) => setCustomDueDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-chatCard text-[11px] px-1.5 py-0.5 border border-slate-300 dark:border-chatBorder rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleSchedule(customDueDate)}
                      className="px-2 py-0.5 bg-brand-600 text-white rounded text-[10px] font-bold"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status da Coluna */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-chatBorder">
              <span className="text-[11px] text-chatTextMuted block font-medium mb-1">Status Atual:</span>
              <select
                value={task.status}
                onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                className="w-full bg-white dark:bg-chatCard text-xs font-bold text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                {statusList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mensagem de Origem no Chat */}
          {task.sourceMessage && (
            <div className="bg-slate-50 dark:bg-chatSidebar p-3.5 rounded-xl border-l-4 border-brand-500 text-xs">
              <span className="font-bold text-chatTextTitle flex items-center gap-1.5 mb-1">
                <MessageSquare size={13} className="text-brand-600" /> Contexto Original:
              </span>
              <p className="text-chatTextBody italic">"{task.sourceMessage}"</p>
            </div>
          )}

          {/* Seção de Arquivos e Anexos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-chatTextMuted flex items-center gap-1.5">
                <Paperclip size={14} /> Documentos e Anexos ({task.attachments?.length || 0})
              </h3>
              <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg border border-brand-200 dark:border-brand-500/30 flex items-center gap-1.5 transition">
                <Paperclip size={13} />
                <span>Anexar Arquivo</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xlsx"
                />
              </label>
            </div>

            {task.attachments && task.attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {task.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-slate-50 dark:bg-chatSidebar border border-chatBorder rounded-xl flex items-center justify-between hover:border-brand-400 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {file.type?.includes('image') ? (
                        <ImageIcon size={22} className="text-blue-500 shrink-0" />
                      ) : (
                        <FileText size={22} className="text-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-chatTextTitle truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-chatTextMuted">
                          {file.size} • por {file.author}
                        </p>
                      </div>
                    </div>
                    <a
                      href={file.dataUrl}
                      download={file.name}
                      title="Baixar arquivo"
                      className="p-1.5 text-chatTextMuted hover:text-brand-600 rounded-lg hover:bg-slate-200 dark:hover:bg-chatCard transition"
                    >
                      <Download size={15} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center border border-dashed border-slate-300 dark:border-chatBorder rounded-xl text-xs text-chatTextMuted">
                Nenhum arquivo anexado a esta demanda.
              </div>
            )}
          </div>

          {/* Histórico de Atualizações e Notas Internas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-chatTextMuted flex items-center gap-1.5">
              <Clock size={14} /> Atualizações e Notas Internas ({task.comments?.length || 0})
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-chatSidebar border border-chatBorder text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>{c.avatar || '👤'}</span>
                        <span className="font-bold text-chatTextTitle">{c.author}</span>
                        {c.dept && (
                          <span className="text-[10px] bg-slate-200 dark:bg-chatCard px-1.5 py-0.2 rounded text-chatTextMuted">
                            {c.dept}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-chatTextMuted">{c.timestamp}</span>
                    </div>
                    <p className="text-chatTextBody pl-5">{c.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-chatTextMuted italic">
                  Nenhuma anotação registrada ainda. Adicione uma atualização abaixo:
                </p>
              )}
            </div>

            {/* Formulário de Nova Anotação */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva uma atualização sobre o andamento..."
                className="flex-1 text-xs bg-white dark:bg-chatInputBg text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Send size={13} />
                <span>Registrar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Rodapé com Ações Rápidas e Exclusão */}
        <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-t border-chatBorder flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              if (window.confirm(`Tem certeza que deseja excluir a demanda "${task.title}" do Kanban?`)) {
                if (onDeleteTask) onDeleteTask(task.id);
                onClose();
              }
            }}
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-500/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            title="Excluir demanda permanentemente"
          >
            <Trash2 size={13} />
            <span>Excluir Demanda</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
