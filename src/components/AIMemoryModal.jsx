import React, { useState, useRef } from 'react';
import {
  X,
  Brain,
  Plus,
  Trash2,
  Crown,
  Sparkles,
  Check,
  Clock,
  BookOpen,
  FileText,
  Upload,
  Layers,
  FileUp,
  AlertCircle
} from 'lucide-react';

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
  onSaveCustomPrompt,
  learnedDocuments = [],
  onAddDocument,
  onRemoveDocument
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('docs'); // 'vips' | 'slas' | 'pops' | 'prompt' | 'docs'

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
  const [docFeedback, setDocFeedback] = useState('');

  const docInputRef = useRef(null);

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

  // Ingestão e Processamento de Documentos da IA (Item 3)
  const handleDocumentUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result || '';
      const text = typeof content === 'string' ? content : '';

      // 1. Detecção automática de Clientes VIP se for CSV ou lista
      let vipsFound = 0;
      if (file.name.endsWith('.csv') || text.includes('VIP') || text.includes('Plano')) {
        const lines = text.split('\n');
        lines.forEach((line) => {
          const parts = line.split(/[,;\t]/);
          if (parts.length >= 1 && parts[0].trim().length > 3) {
            const name = parts[0].replace(/["']/g, '').trim();
            const plan = parts[1]?.replace(/["']/g, '').trim() || 'Plano Fixo Corporativo';
            if (name.toLowerCase() !== 'nome' && name.toLowerCase() !== 'cliente' && !vipClients.some(v => v.name.toLowerCase() === name.toLowerCase())) {
              onAddVipClient({
                id: 'vip_doc_' + Date.now() + '_' + Math.random().toString(36).substring(7),
                name,
                plan,
                since: new Date().getFullYear().toString()
              });
              vipsFound++;
            }
          }
        });
      }

      // 2. Extração de palavras-chave e resumo da diretriz
      const keywords = [];
      if (/mec|portaria|resolu[çc][ãa]o/i.test(text)) keywords.push('MEC');
      if (/asaas|fatura|split|cobran[çc]a/i.test(text)) keywords.push('Asaas/Financeiro');
      if (/prazo|horas|dias|sla|urgente/i.test(text)) keywords.push('Prazos');
      if (/diploma|certificado|colao|p[oó]s/i.test(text)) keywords.push('Certificação');

      let autoSummary = text.slice(0, 300).trim();
      if (text.length > 300) autoSummary += '...';

      // 3. Cadastrar documento aprendido
      const newDoc = {
        id: 'doc_' + Date.now(),
        title: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        uploadDate: new Date().toLocaleDateString('pt-BR'),
        summary: autoSummary,
        textContent: text,
        keywords: keywords.length > 0 ? keywords : ['Diretriz Interna'],
        suggestedPriority: text.toLowerCase().includes('urgente') ? 'alta' : 'media'
      };

      if (onAddDocument) {
        onAddDocument(newDoc);
      }

      const feedback = vipsFound > 0
        ? `✅ Documento "${file.name}" assimilado! ${vipsFound} clientes VIP identificados e adicionados automaticamente.`
        : `✅ Documento "${file.name}" assimilado com sucesso pela IA!`;

      setDocFeedback(feedback);
      setTimeout(() => setDocFeedback(''), 5000);
    };

    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-chatCard border border-chatBorder rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-yellow-100 via-chatCard to-purple-100 dark:from-yellow-950/40 dark:via-chatPanel dark:to-purple-950/40 border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
              <Brain size={24} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-chatTextTitle text-base flex items-center gap-2">
                Centro de Aprendizado & Procedimentos da IA
              </h3>
              <p className="text-xs text-chatTextMuted">
                Alimente a IA com documentos, memorandos, clientes VIP, prazos de SLA e POPs
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

        {/* Abas de Navegação do Cérebro da IA */}
        <div className="flex border-b border-chatBorder bg-slate-100 dark:bg-chatSidebar px-4 pt-2 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'docs'
                ? 'border-purple-600 dark:border-purple-400 text-purple-800 dark:text-purple-300'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <FileUp size={14} className="text-purple-600 dark:text-purple-400" />
            <span>📄 Memorandos & Documentos ({learnedDocuments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vips')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'vips'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Crown size={14} />
            <span>Clientes VIP ({vipClients.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('slas')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'slas'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Clock size={14} />
            <span>Prazos & SLAs ({slas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pops')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'pops'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <BookOpen size={14} />
            <span>Procedimentos ({pops.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('prompt')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'prompt'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Sparkles size={14} />
            <span>Diretrizes Gerais</span>
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* ABA 0: INGESTÃO DE DOCUMENTOS & MEMORANDOS (Item 3) */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {docFeedback && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
                  {docFeedback}
                </div>
              )}

              {/* Área de Upload Drag & Drop / Seletor */}
              <div
                onClick={() => docInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 dark:border-purple-600/40 hover:border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl p-6 text-center cursor-pointer transition group"
              >
                <input
                  type="file"
                  ref={docInputRef}
                  onChange={handleDocumentUpload}
                  className="hidden"
                  accept=".txt,.csv,.md,.json,.doc,.docx,.pdf"
                />
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition shadow-xs">
                  <Upload size={22} />
                </div>
                <h4 className="font-bold text-chatTextTitle text-sm">
                  Subir Memorando, Lista VIP ou Novo Procedimento
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-md mx-auto">
                  Clique ou arraste arquivos <strong>.TXT, .CSV, .MD, .JSON ou .PDF</strong>. A IA lê os prazos, assimila normas e atualiza o Kanban automaticamente.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                    📜 Novos Prazos
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                    👑 Planilha de Clientes VIP
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                    🏛️ Diretrizes MEC
                  </span>
                </div>
              </div>

              {/* Lista de Documentos Aprendidos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-chatTextTitle text-xs uppercase tracking-wider text-chatTextMuted">
                    Base de Documentos Memorizados ({learnedDocuments.length})
                  </h4>
                  <span className="text-[10px] text-chatTextMuted">
                    Ativos no Motor de Decisão da IA
                  </span>
                </div>

                {learnedDocuments.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-300 dark:border-chatBorder rounded-xl text-chatTextMuted space-y-1">
                    <FileText size={24} className="mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold text-xs">Nenhum documento anexado ainda.</p>
                    <p className="text-[11px]">Suba memorandos internos ou listas de contratos para a IA aprender.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {learnedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-chatCard border border-chatBorder rounded-xl shadow-xs space-y-2 hover:border-purple-400 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="truncate">
                              <h5 className="font-bold text-xs text-chatTextTitle truncate">
                                {doc.title}
                              </h5>
                              <p className="text-[10px] text-chatTextMuted">
                                {doc.size} • Adicionado em {doc.uploadDate}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveDocument && onRemoveDocument(doc.id)}
                            title="Remover documento da memória da IA"
                            className="p-1 text-chatTextMuted hover:text-red-500 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Resumo extraído */}
                        <p className="text-[11px] text-chatTextBody bg-slate-50 dark:bg-[#111b21] p-2.5 rounded-lg border border-chatBorder leading-relaxed italic">
                          "{doc.summary}"
                        </p>

                        {/* Tags de Tópicos */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {doc.keywords?.map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-semibold border border-purple-200 dark:border-purple-500/30"
                            >
                              🏷️ {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 1: CLIENTES VIP */}
          {activeTab === 'vips' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300 font-bold">
                  <Crown size={16} />
                  <span>Polos e Clientes VIP com Plano Fixo Contratual</span>
                </div>
                <p className="text-yellow-700 dark:text-yellow-400">
                  Qualquer chamado, solicitação ou mensagem citando esses nomes receberá automaticamente <strong>Prioridade Máxima (VIP)</strong> e <strong>SLA de até 4 horas</strong>.
                </p>
              </div>

              <form onSubmit={handleAddClient} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do Polo / Faculdade (ex: Polo Salvador, FM Educacional)"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="flex-1 bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                />
                <select
                  value={newClientPlan}
                  onChange={(e) => setNewClientPlan(e.target.value)}
                  className="bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                >
                  <option value="Plano Fixo Gold">Plano Fixo Gold</option>
                  <option value="Plano Fixo Ilimitado">Plano Fixo Ilimitado</option>
                  <option value="Contrato Corporativo">Contrato Corporativo</option>
                </select>
                <button
                  type="submit"
                  className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm transition"
                >
                  <Plus size={16} /> Adicionar
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {vipClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-chatCard border border-chatBorder shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">👑</span>
                      <div>
                        <p className="font-semibold text-chatTextTitle">{client.name}</p>
                        <p className="text-[11px] text-chatTextMuted">{client.plan} • Cliente desde {client.since || '2026'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveVipClient(client.id)}
                      className="p-1 text-chatTextMuted hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 2: PRAZOS & SLAs */}
          {activeTab === 'slas' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-chatTextMuted">
                  Defina os prazos operacionais máximos que a IA deve respeitar para cada tipo de demanda interna.
                </p>

                <form onSubmit={handleAddSla} className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={newSlaDepartment}
                      onChange={(e) => setNewSlaDepartment(e.target.value)}
                      className="bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                    >
                      <option value="Secretaria Acadêmica">Secretaria Acadêmica</option>
                      <option value="Financeiro & Splits">Financeiro & Splits</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Tutoria">Tutoria</option>
                      <option value="Expansão">Expansão</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Tipo de Demanda (ex: Emissão de Histórico)"
                      value={newSlaDemand}
                      onChange={(e) => setNewSlaDemand(e.target.value)}
                      className="bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Prazo (ex: 24 horas, 48 horas)"
                        value={newSlaTime}
                        onChange={(e) => setNewSlaTime(e.target.value)}
                        className="w-full bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                      />
                      <button
                        type="submit"
                        className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-3 py-2 rounded-lg shadow-sm transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-2 pt-2">
                  {slas.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-chatCard border border-chatBorder shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-brand-500/20 text-brand-600 dark:text-brand-500 font-semibold px-2 py-0.5 rounded">
                            {s.department}
                          </span>
                          <span className="text-xs font-semibold text-chatTextTitle">{s.demand}</span>
                        </div>
                        <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-1 flex items-center gap-1 font-medium">
                          <Clock size={12} /> Prazo Limite Acordado: <strong>{s.slaTime}</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveSla(s.id)}
                        className="p-1 text-chatTextMuted hover:text-red-500 transition"
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
              <div className="bg-slate-50 dark:bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-chatTextMuted">
                  Cadastre o <strong>Procedimento Operacional Padrão (POP)</strong> para as demandas mais frequentes.
                </p>

                <form onSubmit={handleAddPop} className="space-y-2 bg-chatCard p-3 rounded-lg border border-chatBorder shadow-sm">
                  <input
                    type="text"
                    placeholder="Título do Procedimento (ex: POP - Como Emitir 2ª Via de Fatura com Retificação)"
                    value={newPopTitle}
                    onChange={(e) => setNewPopTitle(e.target.value)}
                    className="w-full bg-chatInputBg text-chatTextTitle px-3 py-2 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <textarea
                    rows={3}
                    placeholder="Passo a passo do procedimento: 1. Acessar painel Asaas; 2. Cancelar cobrança anterior; 3. Gerar nova cobrança com vencimento atualizado; 4. Notificar polo no chat..."
                    value={newPopSteps}
                    onChange={(e) => setNewPopSteps(e.target.value)}
                    className="w-full bg-chatInputBg text-chatTextTitle p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 text-xs"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm transition"
                    >
                      <Plus size={16} /> Salvar Procedimento Padrão
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2">
                  {pops.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-chatCard border border-chatBorder space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-chatTextTitle text-xs flex items-center gap-1.5">
                          <BookOpen size={14} className="text-brand-600 dark:text-brand-500" />
                          {p.title}
                        </h5>
                        <button
                          onClick={() => onRemovePop(p.id)}
                          className="p-1 text-chatTextMuted hover:text-red-500 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-[11px] text-chatTextBody bg-slate-100 dark:bg-[#111b21] p-2.5 rounded whitespace-pre-wrap border border-chatBorder">
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
              <div className="bg-slate-50 dark:bg-chatSidebar border border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-chatTextMuted">
                  Instruções livres para o raciocínio da IA em linguagem natural:
                </p>
                <textarea
                  rows={8}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full bg-chatInputBg text-chatTextTitle p-3 rounded-lg border border-chatBorder focus:outline-none focus:border-brand-500 font-mono text-xs leading-relaxed shadow-sm"
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[11px] text-chatTextMuted">
                    A IA consulta essa memória para decidir prazos e prioridades.
                  </span>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
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
        <div className="p-4 bg-slate-100 dark:bg-chatSidebar border-t border-chatBorder flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-sm transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
