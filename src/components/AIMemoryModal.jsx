import React, { useState } from 'react';
import { X, Brain, Plus, Trash2, Crown, Sparkles, Check, HelpCircle } from 'lucide-react';

export default function AIMemoryModal({
  isOpen,
  onClose,
  vipClients,
  onAddVipClient,
  onRemoveVipClient,
  customPrompt,
  onSaveCustomPrompt
}) {
  if (!isOpen) return null;

  const [newClientName, setNewClientName] = useState('');
  const [newClientPlan, setNewClientPlan] = useState('Plano Fixo Gold');
  const [promptText, setPromptText] = useState(customPrompt);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    onAddVipClient({
      id: 'vip_' + Date.now(),
      name: newClientName.trim(),
      plan: newClientPlan,
      since: '2026',
    });
    setNewClientName('');
  };

  const handleSavePrompt = () => {
    onSaveCustomPrompt(promptText);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-chatPanel border border-chatBorder rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-yellow-950/40 via-chatPanel to-purple-950/40 border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              <Brain size={22} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Memória & Aprendizado da IA
                <span className="text-[10px] bg-yellow-500/20 text-yellow-300 font-bold px-2 py-0.5 rounded-full border border-yellow-500/30">
                  REGRAS VIP
                </span>
              </h3>
              <p className="text-xs text-[#8696a0]">
                Ensine a IA a reconhecer clientes do Plano Fixo e calibrar prioridades automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8696a0] hover:text-white rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com abas ou seções */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Seção 1: Base de Clientes VIP (Plano Fixo) */}
          <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Crown size={16} className="text-yellow-400" />
                Base de Clientes / Polos VIP (Plano Fixo)
              </h4>
              <span className="text-[11px] text-[#8696a0]">
                {vipClients.length} cadastrados
              </span>
            </div>
            <p className="text-[#8696a0] text-[11px]">
              Sempre que a IA encontrar o nome destes polos nas conversas, ela classificará a demanda como <strong>Prioridade Máxima (VIP)</strong> no Kanban.
            </p>

            {/* Formulário para adicionar cliente VIP */}
            <form onSubmit={handleAddClient} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Nome do Polo / Cliente (ex: Polo Campinas, Faculdade Fama)"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="flex-1 bg-chatPanel text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
              />
              <select
                value={newClientPlan}
                onChange={(e) => setNewClientPlan(e.target.value)}
                className="bg-chatPanel text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
              >
                <option value="Plano Fixo Gold">Plano Fixo Gold</option>
                <option value="Plano Fixo Ilimitado">Plano Fixo Ilimitado</option>
                <option value="Contrato Corporativo">Contrato Corporativo</option>
              </select>
              <button
                type="submit"
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1 transition"
              >
                <Plus size={16} /> Adicionar
              </button>
            </form>

            {/* Lista de VIPs */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pt-2">
              {vipClients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-chatPanel border border-chatBorder/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">👑</span>
                    <div>
                      <p className="text-xs font-semibold text-white">{c.name}</p>
                      <p className="text-[10px] text-yellow-400/80">{c.plan}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveVipClient(c.id)}
                    className="p-1 text-[#8696a0] hover:text-red-400 rounded transition"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Seção 2: Instruções em Linguagem Natural para a IA (O Cérebro) */}
          <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Instruções Personalizadas de Operação (Prompt da IA)
              </h4>
            </div>
            <p className="text-[#8696a0] text-[11px]">
              Escreva em português como a IA deve se comportar e raciocinar ao analisar as conversas da equipe:
            </p>

            <textarea
              rows={5}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full bg-chatPanel text-[#d1d7db] p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 font-mono text-xs leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#8696a0]">
                A IA aplica essas regras em tempo real em todas as mensagens.
              </span>
              <button
                onClick={handleSavePrompt}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-md transition"
              >
                {savedSuccess ? <Check size={16} className="text-emerald-300" /> : <Sparkles size={16} />}
                <span>{savedSuccess ? 'Regras Salvas com Sucesso!' : 'Salvar Instruções da IA'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-chatSidebar border-t border-chatBorder flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition"
          >
            Concluir Configuração
          </button>
        </div>
      </div>
    </div>
  );
}
