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
  AlertCircle,
  Download,
  Search,
  CheckCircle2,
  RefreshCw,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from 'lucide-react';
import {
  parseVipClientsFile,
  upsertVipList,
  parseSlasFile,
  upsertSlaList,
  parsePopsFile,
  upsertPopList,
  getSampleVipCsv,
  getSampleSlaCsv,
  getSamplePopCsv,
  getSampleMemorandoTxt,
  triggerFileDownload
} from '../lib/listParsers';
import { parseEduControlFile } from '../lib/eduControl';
import { getSaoPauloTime } from '../lib/timezone';

export default function AIMemoryModal({
  isOpen,
  onClose,
  vipClients = [],
  onAddVipClient,
  onRemoveVipClient,
  onBatchUpsertVips,
  slas = [],
  onAddSla,
  onRemoveSla,
  onBatchUpsertSlas,
  pops = [],
  onAddPop,
  onRemovePop,
  onBatchUpsertPops,
  customPrompt = '',
  onSaveCustomPrompt,
  learnedDocuments = [],
  onAddDocument,
  onRemoveDocument,
  eduControlStudents = [],
  onSyncStudents,
  collaborators = []
}) {
  if (!isOpen) return null;

  // Abas: 'docs' | 'vips' | 'slas' | 'pops' | 'students' | 'prompt'
  const [activeTab, setActiveTab] = useState('vips');

  // Modo de Importação: 'upsert' (Mesclar/Atualizar) ou 'replace' (Substituir Tudo)
  const [importMode, setImportMode] = useState('upsert');

  // Filtros de busca por aba
  const [searchTerm, setSearchTerm] = useState('');

  // Feedbacks de processamento por aba
  const [feedback, setFeedback] = useState(null); // { type, message, details, timestamp }

  // Exibição do mini-formulário manual opcional (recolhido por padrão)
  const [showManualForm, setShowManualForm] = useState(false);

  // Estados dos formulários manuais mínimos (apenas se o usuário desejar inclusão unitária)
  const [manualVipName, setManualVipName] = useState('');
  const [manualVipPlan, setManualVipPlan] = useState('Plano Fixo Gold');
  const [manualSlaDept, setManualSlaDept] = useState('Secretaria Acadêmica');
  const [manualSlaDemand, setManualSlaDemand] = useState('');
  const [manualSlaTime, setManualSlaTime] = useState('48 horas');
  const [manualPopTitle, setManualPopTitle] = useState('');
  const [manualPopSteps, setManualPopSteps] = useState('');

  // Diretrizes da IA
  const [promptText, setPromptText] = useState(customPrompt);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Refs para inputs de arquivo
  const fileInputRef = useRef(null);

  // Helper para exibir feedback visual claro
  const triggerFeedback = (message, details = '') => {
    setFeedback({
      message,
      details,
      timestamp: getSaoPauloTime()
    });
    setTimeout(() => setFeedback(null), 7000);
  };

  // =========================================================================
  // HANDLERS DE UPLOAD DE ARQUIVOS POR ABA (.CSV e .TXT)
  // =========================================================================

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const fileName = file.name;

      try {
        if (activeTab === 'vips') {
          const parsed = parseVipClientsFile(content);
          if (parsed.length === 0) {
            triggerFeedback('⚠️ Nenhum polo ou cliente VIP identificado no arquivo. Verifique o cabeçalho e delimitador.', fileName);
            return;
          }
          const { updatedList, addedCount, updatedCount } = upsertVipList(vipClients, parsed, importMode);
          if (onBatchUpsertVips) {
            await onBatchUpsertVips(updatedList, fileName, { addedCount, updatedCount });
          } else {
            // Fallback caso não haja handler de lote
            parsed.forEach(item => onAddVipClient && onAddVipClient(item));
          }
          triggerFeedback(
            `👑 Base de Clientes VIP sincronizada! ${parsed.length} polo(s) processado(s) (${addedCount} novo(s), ${updatedCount} atualizado(s)).`,
            `Arquivo: ${fileName} • Modo: ${importMode === 'upsert' ? 'Mesclagem Inteligente' : 'Substituição Completa'}`
          );
        } else if (activeTab === 'slas') {
          const parsed = parseSlasFile(content);
          if (parsed.length === 0) {
            triggerFeedback('⚠️ Nenhum prazo ou demanda de SLA identificado no arquivo.', fileName);
            return;
          }
          const { updatedList, addedCount, updatedCount } = upsertSlaList(slas, parsed, importMode);
          if (onBatchUpsertSlas) {
            await onBatchUpsertSlas(updatedList, fileName, { addedCount, updatedCount });
          } else {
            parsed.forEach(item => onAddSla && onAddSla(item));
          }
          triggerFeedback(
            `⏱️ Prazos & SLAs sincronizados! ${parsed.length} demanda(s) processada(s) (${addedCount} novo(s), ${updatedCount} atualizado(s)).`,
            `Arquivo: ${fileName} • Modo: ${importMode === 'upsert' ? 'Mesclagem Inteligente' : 'Substituição Completa'}`
          );
        } else if (activeTab === 'pops') {
          const parsed = parsePopsFile(content);
          if (parsed.length === 0) {
            triggerFeedback('⚠️ Nenhum procedimento padrão (POP) identificado no arquivo.', fileName);
            return;
          }
          const { updatedList, addedCount, updatedCount } = upsertPopList(pops, parsed, importMode);
          if (onBatchUpsertPops) {
            await onBatchUpsertPops(updatedList, fileName, { addedCount, updatedCount });
          } else {
            parsed.forEach(item => onAddPop && onAddPop(item));
          }
          triggerFeedback(
            `📚 Procedimentos Operacionais (POPs) atualizados! ${parsed.length} roteiro(s) carregado(s) (${addedCount} novo(s), ${updatedCount} atualizado(s)).`,
            `Arquivo: ${fileName} • Modo: ${importMode === 'upsert' ? 'Mesclagem Inteligente' : 'Substituição Completa'}`
          );
        } else if (activeTab === 'students') {
          const parsed = parseEduControlFile(content);
          if (parsed.length === 0) {
            triggerFeedback('⚠️ Nenhum aluno reconhecido no arquivo. Certifique-se de que possui as colunas Base44 (Nome, CPF, Telefone, E-mail).', fileName);
            return;
          }
          if (onSyncStudents) {
            await onSyncStudents(parsed);
          }
          triggerFeedback(
            `🎓 Base de Alunos EduControl sincronizada! ${parsed.length} aluno(s) reconhecido(s) via CPF/Telefone com Sticky Assignment.`,
            `Arquivo: ${fileName} • Anti-duplicidade CPF ativa no Supabase`
          );
        } else if (activeTab === 'docs') {
          // Ingestão geral de memorandos e documentos
          const keywords = [];
          if (/mec|portaria|resolu[çc][ãa]o/i.test(content)) keywords.push('MEC');
          if (/asaas|fatura|split|cobran[çc]a/i.test(content)) keywords.push('Asaas/Financeiro');
          if (/prazo|horas|dias|sla|urgente/i.test(content)) keywords.push('Prazos');
          if (/diploma|certificado|colao|p[oó]s/i.test(content)) keywords.push('Certificação');

          let autoSummary = content.slice(0, 300).trim();
          if (content.length > 300) autoSummary += '...';

          const newDoc = {
            id: 'doc_' + Date.now(),
            title: fileName,
            size: (file.size / 1024).toFixed(1) + ' KB',
            uploadDate: new Date().toLocaleDateString('pt-BR'),
            summary: autoSummary,
            textContent: content,
            keywords: keywords.length > 0 ? keywords : ['Diretriz Interna'],
            suggestedPriority: content.toLowerCase().includes('urgente') ? 'alta' : 'media'
          };

          if (onAddDocument) {
            onAddDocument(newDoc);
          }

          triggerFeedback(
            `📄 Documento "${fileName}" assimilado com sucesso pela memória da IA!`,
            `Tamanho: ${newDoc.size} • Tópicos: ${keywords.join(', ') || 'Diretriz'}`
          );
        }
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        triggerFeedback('❌ Erro ao ler e processar o arquivo. Verifique o formato e tente novamente.', err.message);
      }
    };

    reader.readAsText(file, 'UTF-8');
    e.target.value = null;
  };

  // Download dos Modelos CSV / TXT Padrão
  const handleDownloadSample = () => {
    if (activeTab === 'vips') {
      triggerFileDownload(getSampleVipCsv(), 'modelo_clientes_vip.csv');
    } else if (activeTab === 'slas') {
      triggerFileDownload(getSampleSlaCsv(), 'modelo_prazos_slas.csv');
    } else if (activeTab === 'pops') {
      triggerFileDownload(getSamplePopCsv(), 'modelo_procedimentos_pops.csv');
    } else if (activeTab === 'students') {
      const sampleBase44 = `Nome Completo;CPF;Telefone;E-mail;Curso;Status;Polo;Matrícula;Consultor
Beatriz Oliveira;123.456.789-01;+55 (11) 97766-5544;beatriz@escola.com.br;MBA em Gestão Escolar;Ativo;Polo São Paulo Matriz;EC-2024-5501;Gabriel Carvalho
Lucas Fagundes;234.567.890-12;+55 (19) 98877-1122;lucas.fagundes@clinica.com.br;Pós em Neuropsicopedagogia;Certificado;Polo Campinas;EC-2023-3321;Tatiane
Carla Martins;345.678.901-23;+55 (21) 99112-3344;carla.martins@ensino.br;Formação Pedagógica em Letras;Veterano;Polo Rio de Janeiro;EC-2022-7711;Luiz Augusto`;
      triggerFileDownload(sampleBase44, 'modelo_alunos_educontrol_base44.csv');
    } else if (activeTab === 'docs') {
      triggerFileDownload(getSampleMemorandoTxt(), 'modelo_memorando_diretrizes.txt', 'text/plain;charset=utf-8;');
    }
  };

  // Inclusão manual unitária opcional (apenas como fallback rápido)
  const handleManualAddVip = (e) => {
    e.preventDefault();
    if (!manualVipName.trim()) return;
    onAddVipClient({
      id: 'vip_' + Date.now(),
      name: manualVipName.trim(),
      plan: manualVipPlan,
      since: new Date().getFullYear().toString(),
      importedAt: getSaoPauloTime()
    });
    setManualVipName('');
    triggerFeedback(`👑 Cliente VIP "${manualVipName.trim()}" cadastrado com sucesso.`);
  };

  const handleManualAddSla = (e) => {
    e.preventDefault();
    if (!manualSlaDemand.trim()) return;
    onAddSla({
      id: 'sla_' + Date.now(),
      department: manualSlaDept,
      demand: manualSlaDemand.trim(),
      slaTime: manualSlaTime,
      importedAt: getSaoPauloTime()
    });
    setManualSlaDemand('');
    triggerFeedback(`⏱️ SLA para "${manualSlaDemand.trim()}" (${manualSlaTime}) cadastrado com sucesso.`);
  };

  const handleManualAddPop = (e) => {
    e.preventDefault();
    if (!manualPopTitle.trim() || !manualPopSteps.trim()) return;
    onAddPop({
      id: 'pop_' + Date.now(),
      title: manualPopTitle.trim(),
      steps: manualPopSteps.trim(),
      importedAt: getSaoPauloTime()
    });
    setManualPopTitle('');
    setManualPopSteps('');
    triggerFeedback(`📚 Procedimento "${manualPopTitle.trim()}" registrado com sucesso.`);
  };

  const handleSavePrompt = () => {
    onSaveCustomPrompt(promptText);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Filtragem de busca por aba
  const cleanSearch = searchTerm.trim().toLowerCase();

  const filteredVips = vipClients.filter((v) =>
    (v.name || '').toLowerCase().includes(cleanSearch) ||
    (v.plan || '').toLowerCase().includes(cleanSearch) ||
    (v.since || '').includes(cleanSearch)
  );

  const filteredSlas = slas.filter((s) =>
    (s.demand || '').toLowerCase().includes(cleanSearch) ||
    (s.department || '').toLowerCase().includes(cleanSearch) ||
    (s.slaTime || '').toLowerCase().includes(cleanSearch)
  );

  const filteredPops = pops.filter((p) =>
    (p.title || '').toLowerCase().includes(cleanSearch) ||
    (p.steps || '').toLowerCase().includes(cleanSearch)
  );

  const filteredStudents = (eduControlStudents || []).filter((st) =>
    (st.name || '').toLowerCase().includes(cleanSearch) ||
    (st.cpf || '').includes(cleanSearch) ||
    (st.phone || '').includes(cleanSearch) ||
    (st.course || '').toLowerCase().includes(cleanSearch) ||
    (st.polo || '').toLowerCase().includes(cleanSearch) ||
    (st.academicStatus || '').toLowerCase().includes(cleanSearch)
  );

  const filteredDocs = (learnedDocuments || []).filter((d) =>
    (d.title || '').toLowerCase().includes(cleanSearch) ||
    (d.summary || '').toLowerCase().includes(cleanSearch) ||
    (d.keywords || []).some(k => k.toLowerCase().includes(cleanSearch))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 bg-gradient-to-r from-purple-50 via-white to-yellow-50 dark:from-purple-950/40 dark:via-chatPanel dark:to-yellow-950/40 border-b border-slate-200 dark:border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 shadow-xs">
              <Brain size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-chatTextTitle text-base">
                  Central de Importação & Gestão de Listas
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  ⚡ 100% via Upload de Arquivo
                </span>
              </div>
              <p className="text-xs text-chatTextMuted mt-0.5">
                Alimente o EduChat com planilhas e arquivos .CSV e .TXT sem necessidade de digitação manual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-chatTextTitle rounded-lg hover:bg-slate-100 dark:hover:bg-chatPanel transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas de Navegação (Memorandos, Clientes VIP, Prazos/SLAs, Procedimentos e Alunos) */}
        <div className="flex border-b border-slate-200 dark:border-chatBorder bg-slate-50 dark:bg-chatSidebar px-4 pt-2 gap-1 sm:gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('vips'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'vips'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <Crown size={14} className="text-yellow-600 dark:text-yellow-400" />
            <span>Clientes VIP ({vipClients.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('slas'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'slas'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <Clock size={14} className="text-yellow-600 dark:text-yellow-400" />
            <span>Prazos & SLAs ({slas.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('pops'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'pops'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <BookOpen size={14} className="text-yellow-600 dark:text-yellow-400" />
            <span>Procedimentos ({pops.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('students'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'students'
                ? 'border-purple-600 dark:border-purple-400 text-purple-800 dark:text-purple-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <Database size={14} className="text-purple-600 dark:text-purple-400" />
            <span>Alunos EduControl ({eduControlStudents.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('docs'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'docs'
                ? 'border-purple-600 dark:border-purple-400 text-purple-800 dark:text-purple-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <FileUp size={14} className="text-purple-600 dark:text-purple-400" />
            <span>Memorandos ({learnedDocuments.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('prompt'); setSearchTerm(''); }}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition border-b-2 shrink-0 ${
              activeTab === 'prompt'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'border-transparent text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
            }`}
          >
            <Sparkles size={14} className="text-yellow-600 dark:text-yellow-400" />
            <span>Diretrizes IA</span>
          </button>
        </div>

        {/* Input Oculto de Arquivo */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept={
            activeTab === 'docs'
              ? '.txt,.csv,.md,.json,.pdf,.doc,.docx'
              : '.csv,.txt,.tsv,.md'
          }
        />

        {/* Corpo Principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          
          {/* Banner de Feedback Visual de Processamento */}
          {feedback && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 rounded-xl shadow-xs flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs">{feedback.message}</p>
                  {feedback.details && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {feedback.details}
                    </p>
                  )}
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-1">
                    Horário da Sincronização: {feedback.timestamp} (Horário de Brasília) • Persistido no Supabase
                  </span>
                </div>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ÁREA DE CONTROLES SUPERIORES (Apenas nas abas de dados) */}
          {activeTab !== 'prompt' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-chatSidebar/60 p-3 rounded-xl border border-slate-200 dark:border-chatBorder">
              {/* Barra de Busca Rápida */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Filtrar ${activeTab === 'vips' ? 'clientes VIP' : activeTab === 'slas' ? 'demandas/prazos' : activeTab === 'pops' ? 'procedimentos' : activeTab === 'students' ? 'alunos por Nome, CPF ou Polo' : 'memorandos'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-chatInputBg pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Seletor de Modo de Importação */}
                {activeTab !== 'docs' && (
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="bg-white dark:bg-chatInputBg border border-slate-200 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle focus:outline-none focus:border-brand-500"
                    title="Defina como o novo arquivo deve ser incorporado à base"
                  >
                    <option value="upsert">Modo: Mesclar & Atualizar (Upsert)</option>
                    <option value="replace">Modo: Substituir Lista Completa</option>
                  </select>
                )}

                {/* Baixar Modelo de Exemplo */}
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder hover:border-purple-300 text-slate-700 dark:text-chatTextTitle font-semibold flex items-center gap-1.5 text-[11px] hover:bg-slate-50 transition shadow-2xs"
                  title="Baixar arquivo modelo no formato padrão (.CSV / .TXT)"
                >
                  <Download size={13} className="text-purple-600 dark:text-purple-400" />
                  <span>Baixar Modelo</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 1: CLIENTES VIP */}
          {/* ========================================================================= */}
          {activeTab === 'vips' && (
            <div className="space-y-4">
              {/* Dropzone Limpo e Proeminente para Upload de Arquivo */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-yellow-400/80 dark:border-yellow-500/40 hover:border-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/15 rounded-2xl p-6 text-center cursor-pointer transition group hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition shadow-xs">
                  <Upload size={22} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm">
                  Arrastar e soltar ou selecionar arquivo de Clientes VIP (.CSV ou .TXT)
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-lg mx-auto">
                  Importe ou atualize em lote polos parceiros, faculdades e clientes com plano contratual. Suporta delimitadores <code>;</code>, <code>,</code> ou <code>TAB</code>.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-yellow-800 dark:text-yellow-300 font-semibold">
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    👑 Prioridade Máxima Automática
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    ⏱️ SLA de 4 horas
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    🔄 Upsert Anti-duplicidade Ativo
                  </span>
                </div>
              </div>

              {/* Formulário Manual Opcional (Recolhido para manter a tela limpa) */}
              <div className="border border-slate-200 dark:border-chatBorder rounded-xl overflow-hidden bg-slate-50/50 dark:bg-chatSidebar/30">
                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="w-full p-2.5 px-4 flex items-center justify-between text-left text-xs font-semibold text-slate-600 dark:text-chatTextMuted hover:text-slate-800 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} className="text-brand-600" />
                    Precisa cadastrar apenas um único polo avulso manualmente? (Opcional)
                  </span>
                  {showManualForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showManualForm && (
                  <form onSubmit={handleManualAddVip} className="p-3 border-t border-slate-200 dark:border-chatBorder bg-white dark:bg-chatCard flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Nome do Polo / Faculdade (ex: Polo Vitória)"
                      value={manualVipName}
                      onChange={(e) => setManualVipName(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    />
                    <select
                      value={manualVipPlan}
                      onChange={(e) => setManualVipPlan(e.target.value)}
                      className="bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    >
                      <option value="Plano Fixo Gold">Plano Fixo Gold</option>
                      <option value="Plano Fixo Ilimitado">Plano Fixo Ilimitado</option>
                      <option value="Contrato Corporativo">Contrato Corporativo</option>
                    </select>
                    <button
                      type="submit"
                      className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-xs transition shrink-0"
                    >
                      Adicionar Polo
                    </button>
                  </form>
                )}
              </div>

              {/* Listagem de Clientes VIP */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-chatTextMuted font-semibold px-1">
                  <span>Polos e Clientes Cadastrados ({filteredVips.length})</span>
                  <span>Impacta SLA e Triagem da IA em Tempo Real</span>
                </div>

                {filteredVips.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl text-chatTextMuted">
                    Nenhum cliente VIP encontrado. Suba um arquivo .CSV para carregar em massa.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredVips.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder hover:border-yellow-400 transition shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-base shrink-0">👑</span>
                          <div className="truncate">
                            <p className="font-bold text-slate-800 dark:text-chatTextTitle truncate">{client.name}</p>
                            <p className="text-[10px] text-chatTextMuted">
                              {client.plan} • Contrato {client.since || '2026'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemoveVipClient(client.id)}
                          title="Remover cliente VIP"
                          className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: PRAZOS & SLAs */}
          {/* ========================================================================= */}
          {activeTab === 'slas' && (
            <div className="space-y-4">
              {/* Dropzone Limpo para Prazos e SLAs */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-yellow-400/80 dark:border-yellow-500/40 hover:border-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/15 rounded-2xl p-6 text-center cursor-pointer transition group hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition shadow-xs">
                  <Clock size={22} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm">
                  Subir Arquivo de Prazos & SLAs Institucionais (.CSV ou .TXT)
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-lg mx-auto">
                  Atualize em lote os limites de tempo por setor (Secretaria, Financeiro, Tutoria, Comercial, Expansão).
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-yellow-800 dark:text-yellow-300 font-semibold">
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    ⏱️ Alinhado com o Kanban
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    🔔 Alertas de Atraso Automáticos
                  </span>
                </div>
              </div>

              {/* Formulário Manual Opcional */}
              <div className="border border-slate-200 dark:border-chatBorder rounded-xl overflow-hidden bg-slate-50/50 dark:bg-chatSidebar/30">
                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="w-full p-2.5 px-4 flex items-center justify-between text-left text-xs font-semibold text-slate-600 dark:text-chatTextMuted hover:text-slate-800 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} className="text-brand-600" />
                    Cadastrar uma demanda avulsa de SLA manualmente? (Opcional)
                  </span>
                  {showManualForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showManualForm && (
                  <form onSubmit={handleManualAddSla} className="p-3 border-t border-slate-200 dark:border-chatBorder bg-white dark:bg-chatCard grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={manualSlaDept}
                      onChange={(e) => setManualSlaDept(e.target.value)}
                      className="bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    >
                      <option value="Secretaria Acadêmica">Secretaria Acadêmica</option>
                      <option value="Financeiro & Splits">Financeiro & Splits</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Tutoria">Tutoria</option>
                      <option value="Expansão">Expansão</option>
                      <option value="Suporte a Polos">Suporte a Polos</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Tipo de Demanda (ex: Emissão de Histórico)"
                      value={manualSlaDemand}
                      onChange={(e) => setManualSlaDemand(e.target.value)}
                      className="sm:col-span-2 bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Prazo (ex: 24 horas)"
                        value={manualSlaTime}
                        onChange={(e) => setManualSlaTime(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                      />
                      <button
                        type="submit"
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-3 py-2 rounded-lg shadow-xs transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Lista de SLAs */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-chatTextMuted font-semibold px-1">
                  <span>Regras e SLAs Ativos ({filteredSlas.length})</span>
                </div>

                {filteredSlas.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl text-chatTextMuted">
                    Nenhum prazo configurado. Carregue um arquivo .CSV para definir os SLAs operacionais.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredSlas.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder hover:border-yellow-400 transition shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/40">
                              {s.department}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-chatTextTitle">{s.demand}</span>
                          </div>
                          <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-1 flex items-center gap-1 font-semibold">
                            <Clock size={12} /> Prazo Limite: <strong>{s.slaTime}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => onRemoveSla(s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: PROCEDIMENTOS OPERACIONAIS (POPs) */}
          {/* ========================================================================= */}
          {activeTab === 'pops' && (
            <div className="space-y-4">
              {/* Dropzone Limpo para POPs */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-yellow-400/80 dark:border-yellow-500/40 hover:border-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/15 rounded-2xl p-6 text-center cursor-pointer transition group hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition shadow-xs">
                  <BookOpen size={22} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm">
                  Subir Arquivo de Procedimentos Padrão - POPs (.CSV, .TXT ou .MD)
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-lg mx-auto">
                  Carregue os passo a passos da instituição para que a IA os consulte automaticamente durante o atendimento.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-yellow-800 dark:text-yellow-300 font-semibold">
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    📖 Respostas Automatizadas no Copilot
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-yellow-300 dark:border-yellow-600/40">
                    🧩 Suporta Markdown com '---'
                  </span>
                </div>
              </div>

              {/* Formulário Manual Opcional */}
              <div className="border border-slate-200 dark:border-chatBorder rounded-xl overflow-hidden bg-slate-50/50 dark:bg-chatSidebar/30">
                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="w-full p-2.5 px-4 flex items-center justify-between text-left text-xs font-semibold text-slate-600 dark:text-chatTextMuted hover:text-slate-800 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} className="text-brand-600" />
                    Digitar um procedimento avulso manualmente? (Opcional)
                  </span>
                  {showManualForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showManualForm && (
                  <form onSubmit={handleManualAddPop} className="p-3 border-t border-slate-200 dark:border-chatBorder bg-white dark:bg-chatCard space-y-2">
                    <input
                      type="text"
                      placeholder="Título do Procedimento (ex: POP - Como Emitir 2ª Via no Asaas)"
                      value={manualPopTitle}
                      onChange={(e) => setManualPopTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-chatInputBg px-3 py-2 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    />
                    <textarea
                      rows={3}
                      placeholder="Passos do procedimento: 1. Acessar painel; 2. Localizar cobrança; 3. Atualizar vencimento..."
                      value={manualPopSteps}
                      onChange={(e) => setManualPopSteps(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-chatInputBg p-3 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-chatTextTitle focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-4 py-2 rounded-lg shadow-xs transition"
                      >
                        Salvar POP
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Lista de POPs */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-chatTextMuted font-semibold px-1">
                  <span>Procedimentos Salvos ({filteredPops.length})</span>
                </div>

                {filteredPops.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl text-chatTextMuted">
                    Nenhum procedimento cadastrado. Suba uma planilha ou roteiro para treinar a IA.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredPops.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder space-y-2 shadow-2xs hover:border-yellow-400 transition"
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-800 dark:text-chatTextTitle text-xs flex items-center gap-1.5">
                            <BookOpen size={14} className="text-yellow-600 dark:text-yellow-400" />
                            {p.title}
                          </h5>
                          <button
                            onClick={() => onRemovePop(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-chatTextBody bg-slate-50 dark:bg-[#111b21] p-2.5 rounded-lg border border-slate-200 dark:border-chatBorder whitespace-pre-wrap leading-relaxed">
                          {p.steps}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 4: BASE DE ALUNOS (EduControl / Base44) */}
          {/* ========================================================================= */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {/* Dropzone Limpo para Alunos EduControl */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-400/80 dark:border-purple-500/40 hover:border-purple-500 bg-purple-50/40 dark:bg-purple-950/15 rounded-2xl p-6 text-center cursor-pointer transition group hover:shadow-xs"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition shadow-xs">
                  <Database size={22} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm">
                  Arrastar e soltar arquivo da Base de Alunos EduControl (.CSV ou .TXT)
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-lg mx-auto">
                  Processamento blindado no <strong>Padrão Base44</strong> com os 4 campos essenciais: <strong>Nome Completo, CPF, Telefone e E-mail</strong>.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-purple-800 dark:text-purple-300 font-semibold">
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-purple-300 dark:border-purple-600/40 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-purple-600" /> Anti-duplicidade por CPF
                  </span>
                  <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-purple-300 dark:border-purple-600/40">
                    🔒 Preserva Consultor Responsável (Sticky Assignment)
                  </span>
                </div>
              </div>

              {/* Lista e Reconhecimento da Base de Alunos */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-chatTextMuted font-semibold px-1">
                  <span>Alunos Sincronizados na Base ({filteredStudents.length})</span>
                  <span>Cruzamento automático ao receber mensagem no WhatsApp</span>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl text-chatTextMuted">
                    Nenhum aluno localizado. Arraste ou selecione uma planilha Base44 exportada do EduControl.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {filteredStudents.slice(0, 50).map((st) => (
                      <div
                        key={st.id || st.cpf || st.cleanDigits}
                        className="p-3 rounded-xl bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder hover:border-purple-300 transition shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base shrink-0">🎓</span>
                            <p className="font-bold text-slate-800 dark:text-chatTextTitle text-xs truncate">{st.name}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            st.academicStatus === 'Certificado'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                              : st.academicStatus === 'Veterano'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          }`}>
                            {st.academicStatus || 'Ativo'}
                          </span>
                        </div>
                        <div className="text-[10px] text-chatTextMuted space-y-0.5">
                          <p>CPF: <strong>{st.cpf || 'Não informado'}</strong> • Tel: {st.phone}</p>
                          <p className="truncate">Curso: {st.course} • Polo: {st.polo}</p>
                          <p className="text-purple-700 dark:text-purple-300 font-semibold">
                            Consultor Responsável: {st.assignee || 'Gabriel Carvalho'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {filteredStudents.length > 50 && (
                  <p className="text-[10px] text-center text-chatTextMuted pt-1">
                    Exibindo os primeiros 50 registros de {filteredStudents.length}. Use o campo de filtro para localizar alunos específicos.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 5: MEMORANDOS & DIRETRIZES DA INSTITUIÇÃO */}
          {/* ========================================================================= */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {/* Dropzone Limpo para Memorandos */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 dark:border-purple-600/40 hover:border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl p-6 text-center cursor-pointer transition group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition shadow-xs">
                  <Upload size={22} />
                </div>
                <h4 className="font-bold text-chatTextTitle text-sm">
                  Subir Memorando, Resolução ou Portaria Interna (.TXT, .CSV, .MD ou .PDF)
                </h4>
                <p className="text-xs text-chatTextMuted mt-1 max-w-md mx-auto">
                  A IA lê os prazos, assimila resoluções do MEC e regras da matriz automaticamente sem digitação manual.
                </p>
              </div>

              {/* Lista de Documentos Memorizados */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-chatTextMuted font-semibold px-1">
                  <span>Documentos Memorizados Ativos ({filteredDocs.length})</span>
                </div>

                {filteredDocs.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl text-chatTextMuted">
                    Nenhum documento anexado ainda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-xl shadow-2xs space-y-2 hover:border-purple-400 transition"
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
                            className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-chatTextBody bg-slate-50 dark:bg-[#111b21] p-2.5 rounded-lg border border-slate-200 dark:border-chatBorder leading-relaxed italic">
                          "{doc.summary}"
                        </p>

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

          {/* ========================================================================= */}
          {/* ABA 6: DIRETRIZES DA IA (PROMPT) */}
          {/* ========================================================================= */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder rounded-xl p-4 space-y-3">
                <p className="text-slate-600 dark:text-chatTextMuted">
                  Instruções livres de raciocínio da IA em linguagem natural para priorização automática e SLA:
                </p>
                <textarea
                  rows={8}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full bg-white dark:bg-chatInputBg text-slate-800 dark:text-chatTextTitle p-3 rounded-lg border border-slate-200 dark:border-chatBorder focus:outline-none focus:border-brand-500 font-mono text-xs leading-relaxed shadow-xs"
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[11px] text-chatTextMuted">
                    A IA consulta essa memória viva para decidir prioridades no Kanban e WhatsApp.
                  </span>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition"
                  >
                    {savedSuccess ? <Check size={16} className="text-emerald-300" /> : <Sparkles size={16} />}
                    <span>{savedSuccess ? 'Diretrizes Salvas!' : 'Salvar Diretrizes'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Fechamento e Status Geral */}
        <div className="p-3 sm:px-6 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-chatTextMuted font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Motor de Sincronização em Lote Ativo • Olavo Bilac & EstudeMais</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-xs transition text-xs"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
}
