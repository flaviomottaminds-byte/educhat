import React, { useState, useEffect, useMemo } from 'react';
import { X, Hash, UserPlus, Check, ChevronDown, Shield, Building2, Mail, Briefcase } from 'lucide-react';

const STANDARD_QUEUES = [
  { id: 'Comercial', name: 'Comercial', channelId: 'c-comercial', label: 'Comercial & Vendas (#comercial)' },
  { id: 'Marketing', name: 'Marketing', channelId: 'c-marketing', label: 'Marketing & Comunicação (#marketing)' },
  { id: 'Tutoria', name: 'Tutoria', channelId: 'c-tutoria', label: 'Tutoria Acadêmica (#tutoria)' },
  { id: 'Secretaria', name: 'Secretaria', channelId: 'c-secretaria', label: 'Secretaria & Documentos (#secretaria)' },
  { id: 'Pedagógico', name: 'Pedagógico', channelId: 'c-pedagogico', label: 'Coordenação Pedagógica (#pedagogico)' },
  { id: 'Expansão', name: 'Expansão', channelId: 'c-expansao', label: 'Expansão & Novos Polos (#expansao)' },
  { id: 'Diretoria', name: 'Diretoria', channelId: 'c-diretoria', label: 'Diretoria & Gestão Executiva (#diretoria)' }
];

const DEFAULT_ROLES = {
  Comercial: 'Comercial & Vendas',
  Marketing: 'Marketing & Comunicação',
  Tutoria: 'Tutoria Acadêmica',
  Secretaria: 'Secretaria Acadêmica',
  Pedagógico: 'Coordenação Pedagógica',
  Expansão: 'Expansão & Novos Polos',
  Diretoria: 'Diretoria & Gestão Geral'
};

export default function NewItemModal({ isOpen, onClose, type, onSave, channels = [], initialData = null }) {
  if (!isOpen) return null;

  // Monta lista dinâmica de filas unificando canais cadastrados no sistema com filas padrão
  const availableQueues = useMemo(() => {
    const queueMap = new Map();
    STANDARD_QUEUES.forEach((q) => queueMap.set(q.id.toLowerCase(), q));

    (channels || []).forEach((ch) => {
      if (!ch || ch.name === 'geral') return;
      const deptName = ch.department && ch.department !== 'Todos'
        ? ch.department
        : ch.name.charAt(0).toUpperCase() + ch.name.slice(1);
      const key = deptName.toLowerCase();
      if (!queueMap.has(key)) {
        queueMap.set(key, {
          id: deptName,
          name: deptName,
          channelId: ch.id || `c-${ch.name.toLowerCase()}`,
          label: `${deptName} (#${ch.name})`
        });
      }
    });

    return Array.from(queueMap.values());
  }, [channels]);

  const [formData, setFormData] = useState(() => {
    if (type === 'channel') {
      return {
        name: initialData?.name || '',
        desc: initialData?.desc || '',
        department: initialData?.department || 'Comercial'
      };
    }
    return {
      id: initialData?.id || null,
      name: initialData?.name || '',
      email: initialData?.email || '',
      department: initialData?.department || 'Comercial',
      role: initialData?.role || 'Comercial & Vendas',
      roleType: initialData?.roleType || 'colaborador',
      avatar: initialData?.avatar || '👨‍💼',
    };
  });

  useEffect(() => {
    if (!isOpen) return;
    if (type === 'channel') {
      setFormData({
        name: initialData?.name || '',
        desc: initialData?.desc || '',
        department: initialData?.department || 'Comercial'
      });
    } else {
      setFormData({
        id: initialData?.id || null,
        name: initialData?.name || '',
        email: initialData?.email || '',
        department: initialData?.department || 'Comercial',
        role: initialData?.role || (initialData?.department ? DEFAULT_ROLES[initialData.department] || 'Comercial & Vendas' : 'Comercial & Vendas'),
        roleType: initialData?.roleType || 'colaborador',
        avatar: initialData?.avatar || '👨‍💼',
      });
    }
  }, [isOpen, type, initialData]);

  const handleDepartmentChange = (e) => {
    const selectedDept = e.target.value;
    setFormData((prev) => ({
      ...prev,
      department: selectedDept,
      role: DEFAULT_ROLES[selectedDept] || prev.role || `${selectedDept} & Atendimento`
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'channel') {
      if (!formData.name.trim()) return;
      onSave({
        id: initialData?.id || 'c-' + Date.now(),
        name: formData.name.toLowerCase().replace(/\s+/g, '-'),
        desc: formData.desc || 'Canal operacional da equipe',
        department: formData.department || 'Todos',
        unread: 0,
      });
    } else {
      if (!formData.name.trim()) return;

      const matchedQueue = availableQueues.find(
        (q) => q.id.toLowerCase() === (formData.department || '').toLowerCase()
      ) || availableQueues[0];

      const cleanName = formData.name.trim();
      const generatedEmail = (formData.email || '').trim() ||
        `${cleanName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@educhat.com`;

      onSave({
        id: formData.id || 'u_' + Date.now(),
        name: cleanName,
        email: generatedEmail,
        department: matchedQueue.id,
        channelId: matchedQueue.channelId || `c-${matchedQueue.name.toLowerCase()}`,
        role: (formData.role || '').trim() || DEFAULT_ROLES[matchedQueue.id] || `${matchedQueue.id} & Atendimento`,
        roleType: formData.roleType || 'colaborador',
        avatar: formData.avatar || '👨‍💼',
        online: true,
        isBot: false,
      });
    }
    onClose();
  };

  const isEditing = Boolean(initialData?.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-chatCard border border-chatBorder rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-500">
              {type === 'channel' ? <Hash size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3 className="font-bold text-chatTextTitle text-base leading-tight">
                {type === 'channel'
                  ? 'Criar Novo Canal Operacional'
                  : isEditing
                  ? 'Editar Colaborador / Consultor'
                  : 'Cadastrar Novo Colaborador'}
              </h3>
              <p className="text-[11px] text-chatTextMuted">
                {type === 'channel'
                  ? 'Crie uma sala temática para demandas e discussões'
                  : 'Defina a fila oficial e o perfil de atendimento da equipe'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-chatTextMuted hover:text-chatTextTitle rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário com rolagem segura */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {type === 'channel' ? (
            <>
              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Nome do Canal:
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-chatTextMuted text-sm">#</span>
                  <input
                    type="text"
                    required
                    placeholder="ex: cobrancas-polos, suporte-ead, vestibular"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-chatInputBg text-chatTextTitle pl-8 pr-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Fila / Departamento Vinculado:
                </label>
                <div className="relative">
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs cursor-pointer appearance-none pr-8 font-medium"
                  >
                    <option value="Todos">🌐 Todos os Departamentos (Geral)</option>
                    {availableQueues.map((q) => (
                      <option key={q.id} value={q.id}>
                        🎯 {q.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-chatTextMuted">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Descrição do Canal / Finalidade:
                </label>
                <textarea
                  rows={3}
                  placeholder="Explique quais demandas ou setores devem interagir neste canal..."
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  className="w-full bg-chatInputBg text-chatTextTitle p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs"
                />
              </div>
            </>
          ) : (
            <>
              {/* Nome Completo */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5">
                  Nome Completo do Colaborador: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Wagner Silva, Yasmin Oliveira..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs font-medium"
                />
              </div>

              {/* Fila / Departamento (Select Obrigatório Sem Digitação Livre) */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5 flex items-center justify-between">
                  <span>Fila / Departamento: <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Building2 size={12} /> Roteamento Inteligente
                  </span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.department}
                    onChange={handleDepartmentChange}
                    className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border-2 border-brand-500/50 focus:border-brand-600 focus:outline-none text-xs shadow-xs cursor-pointer appearance-none pr-8 font-semibold text-brand-900 dark:text-brand-300"
                  >
                    {availableQueues.map((queue) => (
                      <option key={queue.id} value={queue.id} className="py-1">
                        🎯 {queue.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-600 dark:text-brand-400">
                    <ChevronDown size={15} />
                  </div>
                </div>
                <p className="text-[10.5px] text-chatTextMuted mt-1">
                  Atendimentos e rechamadas de alunos serão direcionados estritamente para esta fila.
                </p>
              </div>

              {/* Cargo / Função no Departamento */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5 flex items-center gap-1">
                  <Briefcase size={12} className="text-chatTextMuted" />
                  <span>Cargo / Especialidade:</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Comercial & Vendas, Consultor EAD, etc."
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs"
                />
              </div>

              {/* E-mail de Acesso */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5 flex items-center gap-1">
                  <Mail size={12} className="text-chatTextMuted" />
                  <span>E-mail Corporativo:</span>
                </label>
                <input
                  type="email"
                  placeholder="ex: wagner@educhat.com (opcional, gerado automaticamente)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs font-mono"
                />
              </div>

              {/* Tipo de Perfil / Acesso de Carteira */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5 flex items-center gap-1">
                  <Shield size={12} className="text-chatTextMuted" />
                  <span>Nível de Acesso no EduChat:</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.roleType}
                    onChange={(e) => setFormData({ ...formData, roleType: e.target.value })}
                    className="w-full bg-white dark:bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-xs cursor-pointer appearance-none pr-8 font-medium"
                  >
                    <option value="colaborador">
                      👤 Consultor / Colaborador (Visão restrita à própria carteira e setor)
                    </option>
                    <option value="diretor">
                      🛡️ Gestão Geral / Diretoria (Visão irrestrita de todas as filas e auditoria)
                    </option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-chatTextMuted">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* Seleção de Avatar / Emoji */}
              <div>
                <label className="block font-semibold text-chatTextTitle mb-1.5">
                  Ícone / Avatar:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '👨‍🏫', '👩‍🏫', '👨‍🎓', '👩‍🎨', '🧑‍💼', '🧑‍💻'].map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setFormData({ ...formData, avatar: emoji })}
                      className={`text-xl p-2 rounded-xl border transition cursor-pointer ${
                        formData.avatar === emoji
                          ? 'border-brand-500 bg-brand-500/20 scale-110 shadow-xs'
                          : 'border-chatBorder bg-slate-100 dark:bg-chatSidebar hover:bg-slate-200 dark:hover:bg-chatBorder/50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-chatBorder flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-chatTextMuted hover:text-chatTextTitle transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Check size={16} />
              <span>
                {type === 'channel'
                  ? 'Criar Canal'
                  : isEditing
                  ? 'Salvar Alterações'
                  : 'Cadastrar Colaborador'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
