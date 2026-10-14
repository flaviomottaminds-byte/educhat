import React, { useState } from 'react';
import { X, Hash, UserPlus, Check } from 'lucide-react';

export default function NewItemModal({ isOpen, onClose, type, onSave }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState(
    type === 'channel'
      ? { name: '', desc: '' }
      : { name: '', role: '', avatar: '👨‍💼' }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'channel') {
      if (!formData.name.trim()) return;
      onSave({
        id: 'c-' + Date.now(),
        name: formData.name.toLowerCase().replace(/\s+/g, '-'),
        desc: formData.desc || 'Canal operacional da equipe',
        unread: 0,
      });
    } else {
      if (!formData.name.trim()) return;
      onSave({
        id: 'u-' + Date.now(),
        name: formData.name,
        role: formData.role || 'Colaborador',
        avatar: formData.avatar || '👤',
        online: true,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-chatCard border border-chatBorder rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-500">
              {type === 'channel' ? <Hash size={18} /> : <UserPlus size={18} />}
            </div>
            <h3 className="font-bold text-chatTextTitle text-base">
              {type === 'channel' ? 'Criar Novo Canal Operacional' : 'Adicionar Colaborador'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-chatTextMuted hover:text-chatTextTitle rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
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
                    className="w-full bg-chatInputBg text-chatTextTitle pl-8 pr-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-sm"
                  />
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
                  className="w-full bg-chatInputBg text-chatTextTitle p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Nome Completo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mariana Costa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Cargo / Setor:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Coordenadora de Polos, Atendente EAD, etc."
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-chatInputBg text-chatTextTitle px-3 py-2.5 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs shadow-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-chatTextMuted mb-1.5">
                  Avatar / Emoji:
                </label>
                <div className="flex gap-2">
                  {['👨‍💼', '👩‍💻', '👨‍🔧', '👩‍🏫', '👨‍🎓', '👩‍💼', '🧑‍💻'].map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setFormData({ ...formData, avatar: emoji })}
                      className={`text-xl p-2 rounded-lg border transition ${
                        formData.avatar === emoji
                          ? 'border-brand-500 bg-brand-500/20 scale-110'
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
          <div className="pt-3 border-t border-chatBorder flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-chatTextMuted hover:text-chatTextTitle transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold flex items-center gap-1.5 shadow-md transition"
            >
              <Check size={16} />
              <span>{type === 'channel' ? 'Criar Canal' : 'Cadastrar Colaborador'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
