import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Brain,
  Upload,
  FileText,
  FileSpreadsheet,
  BookOpen,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Key,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit2,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import {
  fetchKnowledgeBaseDocs,
  saveKnowledgeBaseDoc,
  deleteKnowledgeBaseDoc,
  extractTextFromFile
} from '../lib/knowledgeBase';
import { getGeminiApiKey, saveGeminiApiKey } from '../lib/gemini';
import { getSaoPauloTime } from '../lib/timezone';

export default function AIMemoryModal({
  isOpen,
  onClose,
  learnedDocuments = [],
  onAddDocument,
  onRemoveDocument,
  customPrompt = '',
  onSaveCustomPrompt,
  vipClients = [],
  onBatchUpsertVips
}) {
  if (!isOpen) return null;

  // Estado dos documentos da Base de Conhecimento
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Modo de ingestão: 'upload' ou 'text'
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'text'

  // Formulário de colagem de texto livre
  const [freeTextTitle, setFreeTextTitle] = useState('');
  const [freeTextCategory, setFreeTextCategory] = useState('Catálogo de Cursos');
  const [freeTextContent, setFreeTextContent] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);

  // Modal de visualização / inspeção de conteúdo
  const [viewingDoc, setViewingDoc] = useState(null);

  // Configuração da API Gemini & Diretrizes
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(getGeminiApiKey());
  const [promptText, setPromptText] = useState(customPrompt);
  const [keySaved, setKeySaved] = useState(false);

  const fileInputRef = useRef(null);

  // Carrega documentos do Supabase / LocalStorage na inicialização
  useEffect(() => {
    let active = true;
    const loadDocs = async () => {
      setIsLoading(true);
      try {
        const loaded = await fetchKnowledgeBaseDocs();
        if (active) {
          setDocuments(loaded);
        }
      } catch (err) {
        console.warn('Erro ao carregar documentos de conhecimento:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadDocs();
    return () => {
      active = false;
    };
  }, []);

  const triggerFeedback = (message, details = '', isError = false) => {
    setFeedback({ message, details, isError, timestamp: getSaoPauloTime() });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Upload e Ingestão de Arquivo (.csv, .txt, .pdf, .json, .md)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
    const fileSizeKB = (file.size / 1024).toFixed(1) + ' KB';

    try {
      triggerFeedback('Processando e indexando documento...', fileName);
      const { text, summary } = await extractTextFromFile(file);

      if (!text || text.trim().length === 0) {
        triggerFeedback('⚠️ O arquivo parece vazio ou não foi possível extrair o texto legível.', fileName, true);
        return;
      }

      // Detecta categoria automática a partir do nome
      let category = 'Geral';
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes('curso') || lowerName.includes('catalogo') || lowerName.includes('grade')) {
        category = 'Catálogo de Cursos';
      } else if (lowerName.includes('matricula') || lowerName.includes('secretaria') || lowerName.includes('diploma')) {
        category = 'Secretaria & Matrículas';
      } else if (lowerName.includes('financeiro') || lowerName.includes('preco') || lowerName.includes('boleto')) {
        category = 'Financeiro & Preços';
      } else if (lowerName.includes('sla') || lowerName.includes('prazo') || lowerName.includes('regra')) {
        category = 'Regras & Prazos';
      }

      const newDoc = {
        id: `doc_${Date.now()}`,
        title: fileName,
        category,
        file_type: ext,
        size: fileSizeKB,
        summary: summary || text.slice(0, 250),
        content: text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const saved = await saveKnowledgeBaseDoc(newDoc);
      setDocuments((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);

      if (onAddDocument) {
        onAddDocument({
          id: saved.id,
          title: saved.title,
          size: saved.size,
          uploadDate: new Date().toLocaleDateString('pt-BR'),
          summary: saved.summary,
          textContent: saved.content,
          keywords: [saved.category]
        });
      }

      triggerFeedback(
        `📄 Documento "${fileName}" salvo na Base de Conhecimento da IA!`,
        `Tamanho: ${fileSizeKB} • Categoria: ${category} • Pronto para consultas pelo Gemini.`
      );
    } catch (err) {
      console.error('Erro ao ingerir arquivo:', err);
      triggerFeedback('❌ Erro ao ler e indexar o arquivo.', err.message, true);
    } finally {
      if (e.target) e.target.value = null;
    }
  };

  // Ingestão de Texto Livre
  const handleSaveFreeText = async (e) => {
    e.preventDefault();
    if (!freeTextTitle.trim() || !freeTextContent.trim()) {
      triggerFeedback('⚠️ Preencha o título e o conteúdo do documento.', '', true);
      return;
    }

    setIsSavingText(true);
    try {
      const title = freeTextTitle.trim();
      const content = freeTextContent.trim();
      const sizeKB = (new Blob([content]).size / 1024).toFixed(1) + ' KB';
      const summary = content.slice(0, 260) + (content.length > 260 ? '...' : '');

      const newDoc = {
        id: `doc_${Date.now()}`,
        title,
        category: freeTextCategory,
        file_type: 'txt',
        size: sizeKB,
        summary,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const saved = await saveKnowledgeBaseDoc(newDoc);
      setDocuments((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);

      if (onAddDocument) {
        onAddDocument({
          id: saved.id,
          title: saved.title,
          size: saved.size,
          uploadDate: new Date().toLocaleDateString('pt-BR'),
          summary: saved.summary,
          textContent: saved.content,
          keywords: [saved.category]
        });
      }

      setFreeTextTitle('');
      setFreeTextContent('');
      setInputMode('upload');
      triggerFeedback(
        `✅ Documento "${title}" adicionado à Base de Conhecimento!`,
        `Categoria: ${freeTextCategory} • Tamanho: ${sizeKB}`
      );
    } catch (err) {
      triggerFeedback('❌ Falha ao salvar documento de texto.', err.message, true);
    } finally {
      setIsSavingText(false);
    }
  };

  // Exclusão de Documento Completo
  const handleDeleteDoc = async (docId, title) => {
    if (!window.confirm(`Deseja remover "${title}" da Base de Conhecimento da IA?`)) {
      return;
    }

    try {
      await deleteKnowledgeBaseDoc(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (onRemoveDocument) onRemoveDocument(docId);
      triggerFeedback(`🗑️ Documento "${title}" removido com sucesso.`);
    } catch (err) {
      triggerFeedback('❌ Erro ao excluir documento.', err.message, true);
    }
  };

  // Salvar Chave Gemini e Prompt
  const handleSaveSettings = () => {
    saveGeminiApiKey(geminiKey);
    if (onSaveCustomPrompt) {
      onSaveCustomPrompt(promptText);
    }
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  // Limpeza de cartões acidentais na tabela VIP (caso o usuário tenha importado anteriormente)
  const handleClearVipAccidents = () => {
    if (window.confirm('Deseja limpar os cartões que foram gerados acidentalmente na antiga aba VIP?')) {
      if (onBatchUpsertVips) {
        onBatchUpsertVips([], 'limpeza_manual', { addedCount: 0, updatedCount: 0 });
      }
      try {
        localStorage.removeItem('educhat_vip_clients');
      } catch {}
      triggerFeedback('✨ Cartões de clientes VIP limpos com sucesso!');
    }
  };

  // Filtragem dos documentos por busca
  const cleanSearch = searchTerm.trim().toLowerCase();
  const filteredDocs = documents.filter((d) => {
    const title = (d.title || '').toLowerCase();
    const cat = (d.category || '').toLowerCase();
    const sum = (d.summary || '').toLowerCase();
    return title.includes(cleanSearch) || cat.includes(cleanSearch) || sum.includes(cleanSearch);
  });

  const getDocIcon = (fileType = '') => {
    const t = fileType.toLowerCase();
    if (t === 'csv' || t === 'tsv') return <FileSpreadsheet size={20} className="text-emerald-500" />;
    if (t === 'pdf') return <BookOpen size={20} className="text-rose-500" />;
    return <FileText size={20} className="text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho Unificado: Base de Conhecimento IA */}
        <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-emerald-50 dark:from-purple-950/40 dark:via-chatPanel dark:to-emerald-950/30 border-b border-slate-200 dark:border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
              <Brain size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-chatTextTitle text-base">
                  Base de Conhecimento IA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                  {documents.length} Documento(s)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  ⚡ Ingestão RAG Sem Limitações
                </span>
              </div>
              <p className="text-xs text-chatTextMuted mt-0.5">
                Faça upload de catálogos de cursos, regras e manuais (.csv, .txt, .pdf) ou cole textos para alimentar as respostas do robô.
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

        {/* Input Oculto de Arquivo */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".csv,.txt,.pdf,.json,.md,.tsv,.doc,.docx"
        />

        {/* Corpo Principal com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          
          {/* Feedback Visual */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 transition animate-in fade-in duration-200 ${
                feedback.isError
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {feedback.isError ? (
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">{feedback.message}</span>
                {feedback.details && <span className="text-[11px] opacity-80 mt-0.5 block">{feedback.details}</span>}
              </div>
            </div>
          )}

          {/* Seletor de Método de Ingestão: Upload vs Colar Texto Livre */}
          <div className="bg-slate-50 dark:bg-chatSidebar/60 p-4 rounded-xl border border-slate-200 dark:border-chatBorder">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-800 dark:text-chatTextTitle flex items-center gap-2">
                <Upload size={16} className="text-purple-600 dark:text-purple-400" />
                Adicionar Conhecimento para a IA
              </span>
              <div className="flex gap-1 bg-white dark:bg-chatPanel p-1 rounded-lg border border-slate-200 dark:border-chatBorder">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    inputMode === 'upload'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
                  }`}
                >
                  📁 Upload de Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    inputMode === 'text'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-chatTextMuted hover:text-slate-800 dark:hover:text-chatTextTitle'
                  }`}
                >
                  ✍️ Colar Texto Livre
                </button>
              </div>
            </div>

            {/* Painel: Upload de Arquivos (.csv, .txt, .pdf) */}
            {inputMode === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 dark:border-purple-800/60 hover:border-purple-500 dark:hover:border-purple-600 rounded-xl p-6 text-center cursor-pointer bg-white/70 dark:bg-chatCard/50 transition hover:bg-purple-50/40 dark:hover:bg-purple-950/20 group"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <Upload size={22} />
                </div>
                <p className="font-semibold text-slate-800 dark:text-chatTextTitle text-sm">
                  Clique ou arraste seu arquivo aqui
                </p>
                <p className="text-xs text-chatTextMuted mt-1">
                  Formatos aceitos: <strong>.CSV</strong> (Catálogos, tabelas), <strong>.TXT</strong>, <strong>.PDF</strong> (Ementas, manuais), <strong>.JSON</strong>, <strong>.MD</strong>
                </p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-2 font-medium">
                  ✦ O conteúdo será salvo como documento integral na memória da IA sem criar cards desnecessários.
                </p>
              </div>
            ) : (
              /* Painel: Colar Texto Livre */
              <form onSubmit={handleSaveFreeText} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle mb-1">
                      Título do Documento / Tema:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Catálogo de Cursos FACOB 2026, Regras de TCC..."
                      value={freeTextTitle}
                      onChange={(e) => setFreeTextTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle mb-1">
                      Categoria / Setor:
                    </label>
                    <select
                      value={freeTextCategory}
                      onChange={(e) => setFreeTextCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Catálogo de Cursos">Catálogo de Cursos</option>
                      <option value="Secretaria & Matrículas">Secretaria & Matrículas</option>
                      <option value="Financeiro & Preços">Financeiro & Preços</option>
                      <option value="Pedagógico & Ementas">Pedagógico & Ementas</option>
                      <option value="Regras & Prazos">Regras & Prazos</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle mb-1">
                    Conteúdo / Texto Livre:
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Cole aqui o texto, ementas, perguntas frequentes, lista de cursos com valores, regras de matrícula..."
                    value={freeTextContent}
                    onChange={(e) => setFreeTextContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFreeTextTitle('');
                      setFreeTextContent('');
                      setInputMode('upload');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-chatTextMuted hover:bg-slate-100 dark:hover:bg-chatPanel transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingText}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Plus size={14} />
                    {isSavingText ? 'Salvando...' : 'Salvar Documento'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Barra de Busca e Listagem de Documentos */}
          <div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm flex items-center gap-2">
                  <FolderOpen size={16} className="text-purple-600 dark:text-purple-400" />
                  Documentos & Arquivos na Memória da IA ({filteredDocs.length})
                </h4>
                <p className="text-[11px] text-chatTextMuted">
                  Estes blocos são injetados diretamente no prompt do Gemini para responder com base no contexto oficial.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-chatTextMuted" />
                <input
                  type="text"
                  placeholder="Buscar documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Lista de Documentos */}
            {isLoading ? (
              <div className="p-8 text-center text-chatTextMuted">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-600" />
                Carregando documentos da base...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-chatBorder rounded-xl bg-slate-50/50 dark:bg-chatSidebar/20">
                <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-chatTextTitle">
                  Nenhum documento encontrado na Base de Conhecimento
                </p>
                <p className="text-xs text-chatTextMuted mt-1">
                  Faça o upload do catálogo de cursos ou cole um texto acima para abastecer o robô.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-chatBorder bg-white dark:bg-chatPanel/70 hover:border-purple-300 dark:hover:border-purple-800 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-chatSidebar shrink-0 mt-0.5">
                        {getDocIcon(doc.file_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 dark:text-chatTextTitle text-xs truncate max-w-md">
                            {doc.title}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-chatSidebar text-slate-600 dark:text-slate-300">
                            {doc.file_type || 'TXT'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                            {doc.category || 'Geral'}
                          </span>
                          <span className="text-[10px] text-chatTextMuted">
                            {doc.size || '1 KB'}
                          </span>
                        </div>
                        <p className="text-xs text-chatTextMuted mt-1 line-clamp-2">
                          {doc.summary || doc.content?.slice(0, 200)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setViewingDoc(doc)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs text-slate-700 dark:text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatSidebar transition flex items-center gap-1.5"
                        title="Ver conteúdo completo"
                      >
                        <Eye size={13} className="text-purple-600 dark:text-purple-400" />
                        <span>Ver Conteúdo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id, doc.title)}
                        className="p-1.5 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Remover documento da memória"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Limpeza de Cartões Antigos VIP (Se houver resquício do erro anterior de 1200+ cards) */}
          {Array.isArray(vipClients) && vipClients.length > 50 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 text-xs block">
                  Identificados {vipClients.length} cartões acidentais na lista VIP
                </span>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Como o catálogo foi salvo anteriormente como Clientes VIP, você pode limpar esses cards com um clique.
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearVipAccidents}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 transition"
              >
                Limpar {vipClients.length} Cards VIP
              </button>
            </div>
          )}

          {/* Seção Expansível: Configurações do Gemini & Diretrizes */}
          <div className="border border-slate-200 dark:border-chatBorder rounded-xl overflow-hidden bg-slate-50/50 dark:bg-chatSidebar/40">
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="w-full p-3 flex items-center justify-between text-left font-semibold text-slate-700 dark:text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatPanel transition"
            >
              <div className="flex items-center gap-2">
                <Key size={15} className="text-purple-600 dark:text-purple-400" />
                <span>Chave da API Google Gemini & Prompt do Sistema</span>
              </div>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSettings && (
              <div className="p-4 border-t border-slate-200 dark:border-chatBorder space-y-3 bg-white dark:bg-chatCard">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle mb-1">
                    Chave da API Google Gemini (gemini-2.5-flash):
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle font-mono"
                  />
                  <p className="text-[10px] text-chatTextMuted mt-1">
                    Esta chave é utilizada pelo EduChat e sincronizada com as Edge Functions para atendimentos fora de expediente.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-chatTextTitle mb-1">
                    Instruções Gerais de Comportamento (System Prompt):
                  </label>
                  <textarea
                    rows={4}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Instruções gerais sobre o tom de voz e regras de atendimento da IA..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-chatSidebar border border-slate-200 dark:border-chatBorder text-xs text-slate-800 dark:text-chatTextTitle font-mono"
                  />
                </div>

                <div className="flex justify-end items-center gap-2">
                  {keySaved && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={14} /> Salvo com sucesso!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition"
                  >
                    Salvar Configurações
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-3 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between shrink-0">
          <span className="text-[11px] text-chatTextMuted">
            💡 Documentos indexados alimentam o Gemini no plantão fora de expediente e no Copilot interno.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-chatPanel dark:hover:bg-slate-700 text-white font-semibold text-xs transition"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Modal de Leitura / Inspeção de Documento */}
      {viewingDoc && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-chatCard border border-slate-200 dark:border-chatBorder rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 dark:border-chatBorder flex items-center justify-between bg-slate-50 dark:bg-chatSidebar">
              <div className="flex items-center gap-2">
                {getDocIcon(viewingDoc.file_type)}
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-chatTextTitle text-sm">
                    {viewingDoc.title}
                  </h4>
                  <span className="text-[11px] text-chatTextMuted">
                    Categoria: {viewingDoc.category} • Tamanho: {viewingDoc.size}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-chatTextTitle rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-chatTextTitle bg-slate-50/30 dark:bg-chatSidebar/20">
              {viewingDoc.content || viewingDoc.textContent || 'Sem conteúdo legível disponível.'}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-chatBorder flex justify-end bg-slate-50 dark:bg-chatSidebar">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-purple-600 text-white font-semibold text-xs"
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
