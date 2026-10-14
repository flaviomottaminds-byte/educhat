import React, { useState } from 'react';
import { X, Brain, Plus, Trash2, Crown, Sparkles, Check, Clock, BookOpen, Layers } from 'lucide-react';

export default function AIMemoryModal({
  isOpen,
  onClose,
  vipClients,
  onAddVipClient,
  onRemoveVipClient,
  slas,
  onAddSla,
  onRemoveSla,
  pops,
  onAddPop,
  onRemovePop,
  customPrompt,
  onSaveCustomPrompt
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('vips'); // 'vips' | 'slas' | 'pops' | 'prompt'

  // Form estados
  const [newClientName, setNewClientName] = useState('');
  const [newClientPlan, setNewClientPlan] = useState('Plano Fixo Gold');

  const [newSlaDepartment, setNewSlaDepartment] = useState('Secretaria Acadêmica');
  const [newSlaDemand, setNewSlaDemand] = useState('');
  const [newSlaTime, setNewSlaTime] = useState('48 horas');

  const [newPopTitle, setNewPopTitle] = useState('');
  const [newPopSteps, setNewPopSteps] = useState('');

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

  const handleAddSla = (e) => {
    e.preventDefault();
    if (!newSlaDemand.trim()) return;
    onAddSla({
      id: 'sla_' + Date.now(),
      department: newSlaDepartment,
      demand: newSlaDemand.trim(),
      slaTime: newSlaTime,
    });
    setNewSlaDemand('');
  };

  const handleAddPop = (e) => {
    e.preventDefault();
    if (!newPopTitle.trim() || !newPopSteps.trim()) return;
    onAddPop({
      id: 'pop_' + Date.now(),
      title: newPopTitle.trim(),
      steps: newPopSteps.trim(),
    });
    setNewPopTitle('');
    setNewPopSteps('');
  };

  const handleSavePrompt = () => {
    onSaveCustomPrompt(promptText);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-chatPanel border border-chatBorder rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-yellow-950/40 via-chatPanel to-purple-950/40 border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              <Brain size={24} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Centro de Aprendizado & Procedimentos da IA
              </h3>
              <p className="text-xs text-[#8696a0]">
                Alimente a IA com clientes VIP, prazos de SLA de cada setor e Procedimentos Padrão (POPs)
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

        {/* Abas de Navegação do Cérebro da IA */}
        <div className="flex border-b border-chatBorder bg-chatSidebar px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('vips')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 ${
              activeTab === 'vips'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Crown size={14} />
            <span>1. Clientes VIP ({vipClients.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('slas')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 ${
              activeTab === 'slas'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Clock size={14} />
            <span>2. Prazos & SLAs ({slas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pops')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 ${
              activeTab === 'pops'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <BookOpen size={14} />
            <span>3. Procedimentos (POPs) ({pops.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('prompt')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 ${
              activeTab === 'prompt'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-[#8696a0] hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>4. Diretrizes Gerais</span>
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* ABA 1: CLIENTES VIP */}
          {activeTab === 'vips' && (
            <div className="space-y-4">
              <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-[#8696a0]">
                  Polos e clientes que pagam mensalidade fixa e possuem <strong>atendimento exclusivo com prioridade máxima</strong>.
                </p>

                <form onSubmit={handleAddClient} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do Polo / Cliente VIP"
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

                <div className="space-y-2 pt-2">
                  {vipClients.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-chatPanel border border-chatBorder/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">👑</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{c.name}</p>
                          <p className="text-[10px] text-yellow-400">{c.plan}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveVipClient(c.id)}
                        className="p-1 text-[#8696a0] hover:text-red-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: PRAZOS & SLAS POR SETOR */}
          {activeTab === 'slas' && (
            <div className="space-y-4">
              <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-[#8696a0]">
                  Defina os <strong>prazos máximos acordados (SLAs)</strong> para cada tipo de solicitação da sua empresa. A IA usa esses prazos para alertar atrasos no Kanban!
                </p>

                <form onSubmit={handleAddSla} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={newSlaDepartment}
                    onChange={(e) => setNewSlaDepartment(e.target.value)}
                    className="bg-chatPanel text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  >
                    <option value="Secretaria Acadêmica">Secretaria Acadêmica</option>
                    <option value="Financeiro & Splits">Financeiro & Splits</option>
                    <option value="Suporte a Polos">Suporte a Polos</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Tipo de demanda (ex: Reposição de Aulas)"
                    value={newSlaDemand}
                    onChange={(e) => setNewSlaDemand(e.target.value)}
                    className="md:col-span-2 bg-chatPanel text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Prazo (ex: 48h, 5 dias)"
                      value={newSlaTime}
                      onChange={(e) => setNewSlaTime(e.target.value)}
                      className="flex-1 bg-chatPanel text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                    />
                    <button
                      type="submit"
                      className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-3 py-2 rounded-lg transition"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2">
                  {slas.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-chatPanel border border-chatBorder/60"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-brand-500/20 text-brand-500 font-semibold px-2 py-0.5 rounded">
                            {s.department}
                          </span>
                          <span className="text-xs font-semibold text-white">{s.demand}</span>
                        </div>
                        <p className="text-[11px] text-yellow-400 mt-1 flex items-center gap-1">
                          <Clock size={12} /> Prazo Limite Acordado: <strong>{s.slaTime}</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveSla(s.id)}
                        className="p-1 text-[#8696a0] hover:text-red-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: PROCEDIMENTOS PADRÃO (POPs) */}
          {activeTab === 'pops' && (
            <div className="space-y-4">
              <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-[#8696a0]">
                  Cadastre o <strong>Procedimento Operacional Padrão (POP)</strong> para as demandas mais frequentes. Assim, quando a demanda surgir no chat, a IA já anexa o passo a passo exato para o funcionário não errar!
                </p>

                <form onSubmit={handleAddPop} className="space-y-2 bg-chatPanel p-3 rounded-lg border border-chatBorder">
                  <input
                    type="text"
                    placeholder="Título do Procedimento (ex: POP - Como Emitir 2ª Via de Fatura com Retificação)"
                    value={newPopTitle}
                    onChange={(e) => setNewPopTitle(e.target.value)}
                    className="w-full bg-[#111b21] text-white px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <textarea
                    rows={3}
                    placeholder="Passo a passo do procedimento: 1. Acessar painel Asaas; 2. Cancelar cobrança anterior; 3. Gerar nova cobrança com vencimento atualizado; 4. Notificar polo no chat..."
                    value={newPopSteps}
                    onChange={(e) => setNewPopSteps(e.target.value)}
                    className="w-full bg-[#111b21] text-white p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1 transition"
                    >
                      <Plus size={16} /> Salvar Procedimento Padrão
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2">
                  {pops.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-chatPanel border border-chatBorder/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-white text-xs flex items-center gap-1.5">
                          <BookOpen size={14} className="text-brand-500" />
                          {p.title}
                        </h5>
                        <button
                          onClick={() => onRemovePop(p.id)}
                          className="p-1 text-[#8696a0] hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#aebac1] bg-[#111b21] p-2 rounded whitespace-pre-wrap">
                        {p.steps}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: DIRETRIZES GERAIS (PROMPT) */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-[#8696a0]">
                  Instruções livres para o raciocínio da IA em linguagem natural:
                </p>
                <textarea
                  rows={8}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full bg-chatPanel text-[#d1d7db] p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 font-mono text-xs leading-relaxed"
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[11px] text-[#8696a0]">
                    A IA consulta essa memória para decidir prazos e prioridades.
                  </span>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
                  >
                    {savedSuccess ? <Check size={16} className="text-emerald-300" /> : <Sparkles size={16} />}
                    <span>{savedSuccess ? 'Diretrizes Atualizadas!' : 'Salvar Diretrizes'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-chatSidebar border-t border-chatBorder flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
