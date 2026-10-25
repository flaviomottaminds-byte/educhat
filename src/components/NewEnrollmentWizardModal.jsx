import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Building2,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Search,
  UserPlus,
  Percent,
  Wallet,
  Calendar,
  CreditCard,
  FileCheck,
  Check,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function NewEnrollmentWizardModal({
  isOpen,
  onClose,
  onSuccess,
  hubs = [],
  preselectedStudent = null
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // STEP 1: ALUNO & POLO
  const [studentMode, setStudentMode] = useState(preselectedStudent ? 'existing' : 'existing');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(preselectedStudent || null);

  const [newStudentData, setNewStudentData] = useState({
    nome_completo: '',
    cpf: '',
    email: '',
    telefone: '',
    rg: ''
  });

  const [selectedHubId, setSelectedHubId] = useState(preselectedStudent?.hub_id || '');

  // STEP 2: CURSO & DOCUMENTOS
  const [processData, setProcessData] = useState({
    tipo_processo: 'EJA',
    nome_curso: 'Ensino Médio - EJA EAD',
    periodo_ingresso: '2026.1',
    categoria_curso: 'Educação Básica',
    url_dossie_pdf: ''
  });

  // STEP 3: FINANCEIRO & SPLIT ASAAS
  const [billingData, setBillingData] = useState({
    valor_total: 1200,
    billing_type: 'PIX', // 'PIX' | 'BOLETO' | 'CREDIT_CARD'
    data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    descricao: ''
  });

  // STEP 4: RESULTADO DA INTEGRAÇÃO
  const [integrationResult, setIntegrationResult] = useState(null);

  // Inicializa aluno pré-selecionado se houver
  useEffect(() => {
    if (preselectedStudent) {
      setSelectedStudent(preselectedStudent);
      setStudentMode('existing');
      if (preselectedStudent.hub_id) {
        setSelectedHubId(preselectedStudent.hub_id);
      }
    }
  }, [preselectedStudent]);

  // Busca rápida de alunos com debounce
  useEffect(() => {
    if (studentMode !== 'existing' || !studentSearchTerm.trim()) {
      setStudentSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const term = studentSearchTerm.trim();
        const cleanDigits = term.replace(/\D/g, '');

        let query = supabase.from('alunos').select('*').limit(8);

        if (cleanDigits.length >= 3) {
          query = query.or(`cpf.ilike.%${cleanDigits}%,telefone.ilike.%${cleanDigits}%`);
        } else {
          query = query.ilike('nome_completo', `%${term}%`);
        }

        const { data } = await query;
        setStudentSearchResults(data || []);
      } catch (e) {
        console.warn('Erro na busca de alunos:', e);
      } finally {
        setSearchingStudents(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentSearchTerm, studentMode]);

  // Identifica Polo selecionado e suas regras de Split
  const currentHub = useMemo(() => {
    return hubs.find((h) => h.id === selectedHubId) || null;
  }, [hubs, selectedHubId]);

  // Cálculos de Split em tempo real
  const splitCalculations = useMemo(() => {
    const total = Number(billingData.valor_total || 0);
    const percentualPolo = Number(currentHub?.percentual_comissao_polo || 0);
    const valorPolo = Number(((total * percentualPolo) / 100).toFixed(2));
    const valorMatriz = Number((total - valorPolo).toFixed(2));

    return {
      total,
      percentualPolo,
      valorPolo,
      valorMatriz,
      walletConfigured: Boolean(currentHub?.asaas_wallet_id)
    };
  }, [billingData.valor_total, currentHub]);

  // Validação por Etapa
  const canProceedStep1 = useMemo(() => {
    if (!selectedHubId) return false;
    if (studentMode === 'existing') {
      return Boolean(selectedStudent?.id);
    } else {
      return Boolean(newStudentData.nome_completo.trim() && newStudentData.cpf.trim());
    }
  }, [selectedHubId, studentMode, selectedStudent, newStudentData]);

  const canProceedStep2 = useMemo(() => {
    return Boolean(processData.nome_curso.trim() && processData.tipo_processo);
  }, [processData]);

  const canProceedStep3 = useMemo(() => {
    return Number(billingData.valor_total) > 0 && Boolean(billingData.data_vencimento);
  }, [billingData]);

  // Submissão do Wizard -> Dispara Edge Function asaas-billing
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const studentPayload = studentMode === 'existing'
        ? {
            id: selectedStudent.id,
            nome_completo: selectedStudent.nome_completo,
            cpf: selectedStudent.cpf,
            email: selectedStudent.email,
            telefone: selectedStudent.telefone,
            rg: selectedStudent.rg,
            hub_id: selectedHubId
          }
        : {
            nome_completo: newStudentData.nome_completo.trim(),
            cpf: newStudentData.cpf.replace(/\D/g, '') || newStudentData.cpf,
            email: newStudentData.email ? newStudentData.email.trim() : null,
            telefone: newStudentData.telefone ? newStudentData.telefone.replace(/\D/g, '') : null,
            rg: newStudentData.rg ? newStudentData.rg.trim() : null,
            hub_id: selectedHubId
          };

      const academicProcessPayload = {
        tipo_processo: processData.tipo_processo,
        nome_curso: processData.nome_curso,
        periodo_ingresso: processData.periodo_ingresso,
        categoria_curso: processData.categoria_curso,
        url_dossie_pdf: processData.url_dossie_pdf || null
      };

      const hubPayload = {
        id: currentHub.id,
        nome_exibicao: currentHub.nome_exibicao || currentHub.razao_social,
        asaas_wallet_id: currentHub.asaas_wallet_id || null,
        percentual_comissao_polo: Number(currentHub.percentual_comissao_polo || 0)
      };

      const billingPayload = {
        valor_total: Number(billingData.valor_total),
        billing_type: billingData.billing_type,
        data_vencimento: billingData.data_vencimento,
        descricao: billingData.descricao || `Matrícula: ${processData.nome_curso}`
      };

      // Invocação da Edge Function Asaas Billing
      const { data, error } = await supabase.functions.invoke('asaas-billing', {
        body: {
          student: studentPayload,
          academicProcess: academicProcessPayload,
          hub: hubPayload,
          billing: billingPayload
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao comunicar com a Edge Function.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setIntegrationResult(data);
      setCurrentStep(4);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error('Falha no fechamento da matrícula:', err);
      setErrorMessage(`Falha na criação da matrícula: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPix = (payload) => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* CABEÇALHO DO WIZARD */}
        <div className="px-6 py-4 border-b border-chatBorder flex items-center justify-between bg-slate-50/70 dark:bg-chatCard/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl">
              <GraduationCap size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-chatTextTitle flex items-center gap-2">
                Nova Matrícula & Cobrança Asaas
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600">
                  Cérebro Único
                </span>
              </h2>
              <p className="text-xs text-chatTextMuted">
                Fluxo unificado: Aluno, Matrícula, Fatura Asaas e Split do Polo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatCard rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* STEPPER PROGRESS BAR */}
        <div className="px-6 py-3 bg-slate-100/50 dark:bg-chatCard/30 border-b border-chatBorder">
          <div className="flex items-center justify-between text-xs">
            <div className={`flex items-center gap-1.5 ${currentStep >= 1 ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-chatTextMuted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-chatCard text-chatTextMuted'}`}>
                1
              </span>
              <span>Aluno & Polo</span>
            </div>
            <div className="w-8 h-[1px] bg-chatBorder" />
            <div className={`flex items-center gap-1.5 ${currentStep >= 2 ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-chatTextMuted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-chatCard text-chatTextMuted'}`}>
                2
              </span>
              <span>Curso & Dados</span>
            </div>
            <div className="w-8 h-[1px] bg-chatBorder" />
            <div className={`flex items-center gap-1.5 ${currentStep >= 3 ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-chatTextMuted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-chatCard text-chatTextMuted'}`}>
                3
              </span>
              <span>Financeiro & Split</span>
            </div>
            <div className="w-8 h-[1px] bg-chatBorder" />
            <div className={`flex items-center gap-1.5 ${currentStep === 4 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-chatTextMuted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-chatCard text-chatTextMuted'}`}>
                4
              </span>
              <span>Cobrança</span>
            </div>
          </div>
        </div>

        {/* ALERTA DE ERRO */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CORPO DO FORMULÁRIO */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* ========================================================================= */}
          {/* ETAPA 1: ALUNO & POLO DE APOIO */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-chatTextTitle">1. Seleção de Aluno</span>
                <div className="bg-slate-100 dark:bg-chatCard p-1 rounded-xl flex gap-1 border border-chatBorder">
                  <button
                    type="button"
                    onClick={() => setStudentMode('existing')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                      studentMode === 'existing'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-chatTextMuted hover:text-chatTextTitle'
                    }`}
                  >
                    Aluno Cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentMode('new')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                      studentMode === 'new'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-chatTextMuted hover:text-chatTextTitle'
                    }`}
                  >
                    + Novo Aluno
                  </button>
                </div>
              </div>

              {studentMode === 'existing' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-chatTextMuted" />
                    <input
                      type="text"
                      placeholder="Pesquise por Nome, CPF ou Telefone do aluno..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-xs shadow-2xs"
                    />
                    {searchingStudents && (
                      <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-chatTextMuted" />
                    )}
                  </div>

                  {studentSearchResults.length > 0 && !selectedStudent && (
                    <div className="max-h-48 overflow-y-auto border border-chatBorder rounded-xl divide-y divide-chatBorder bg-white dark:bg-chatCard shadow-sm">
                      {studentSearchResults.map((stu) => (
                        <div
                          key={stu.id}
                          onClick={() => {
                            setSelectedStudent(stu);
                            if (stu.hub_id) setSelectedHubId(stu.hub_id);
                            setStudentSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-slate-50 dark:hover:bg-chatPanel cursor-pointer flex items-center justify-between transition"
                        >
                          <div>
                            <p className="font-semibold text-chatTextTitle">{stu.nome_completo}</p>
                            <p className="text-[11px] text-chatTextMuted font-mono">CPF: {stu.cpf || 'Não informado'}</p>
                          </div>
                          <button
                            type="button"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-brand-500/10 text-brand-600 rounded-lg"
                          >
                            Selecionar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedStudent && (
                    <div className="p-3.5 bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-xs">
                          {selectedStudent.nome_completo.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold text-chatTextTitle">{selectedStudent.nome_completo}</p>
                          <p className="text-[11px] text-chatTextMuted font-mono">
                            CPF: {selectedStudent.cpf} {selectedStudent.telefone ? `| Tel: ${selectedStudent.telefone}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(null)}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Trocar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-chatBorder bg-slate-50/50 dark:bg-chatCard/30 space-y-3">
                  <div>
                    <label className="block font-semibold mb-1 text-chatTextTitle">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={newStudentData.nome_completo}
                      onChange={(e) => setNewStudentData({ ...newStudentData, nome_completo: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Ex: Amanda Silva Ferreira"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-chatTextTitle">CPF *</label>
                      <input
                        type="text"
                        required
                        value={newStudentData.cpf}
                        onChange={(e) => setNewStudentData({ ...newStudentData, cpf: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-chatTextTitle">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={newStudentData.telefone}
                        onChange={(e) => setNewStudentData({ ...newStudentData, telefone: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="(11) 98888-7777"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-chatTextTitle">E-mail</label>
                      <input
                        type="email"
                        value={newStudentData.email}
                        onChange={(e) => setNewStudentData({ ...newStudentData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="aluno@email.com"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-chatTextTitle">RG</label>
                      <input
                        type="text"
                        value={newStudentData.rg}
                        onChange={(e) => setNewStudentData({ ...newStudentData, rg: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="12.345.678-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SELEÇÃO DO POLO */}
              <div className="pt-2 border-t border-chatBorder">
                <label className="block font-bold text-sm text-chatTextTitle mb-2">
                  2. Polo Parceiro Responsável *
                </label>
                <select
                  value={selectedHubId}
                  onChange={(e) => setSelectedHubId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer text-xs"
                >
                  <option value="">Selecione o Polo da Matrícula...</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nome_exibicao || h.razao_social} {h.polo_uf ? `(${h.polo_uf})` : ''} - Split:{' '}
                      {Number(h.percentual_comissao_polo || 0)}%
                    </option>
                  ))}
                </select>

                {currentHub && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-100/70 dark:bg-chatCard/50 border border-chatBorder flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-chatTextTitle">
                        {currentHub.nome_exibicao || currentHub.razao_social}
                      </p>
                      <p className="text-[11px] text-chatTextMuted">
                        Comissão Contratual do Polo:{' '}
                        <span className="font-bold text-brand-600 dark:text-brand-400">
                          {Number(currentHub.percentual_comissao_polo || 0)}%
                        </span>
                      </p>
                    </div>
                    <div>
                      {currentHub.asaas_wallet_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Wallet: {currentHub.asaas_wallet_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200">
                          <AlertCircle size={12} />
                          Sem Wallet ID (Sem split automático)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: CURSO & DADOS ACADÊMICOS */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <span className="font-bold text-sm text-chatTextTitle block">
                Detalhes do Curso e Processo
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-chatTextTitle">Modalidade / Tipo *</label>
                  <select
                    value={processData.tipo_processo}
                    onChange={(e) => setProcessData({ ...processData, tipo_processo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="EJA">EJA (Ensino Fundamental / Médio)</option>
                    <option value="Certificação">Certificação Por Competência</option>
                    <option value="Graduação">Graduação EAD</option>
                    <option value="Pós-Graduação">Pós-Graduação</option>
                    <option value="Técnico">Curso Técnico Profissionalizante</option>
                    <option value="Outros">Outros Cursos Livres</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-chatTextTitle">Período de Ingresso</label>
                  <input
                    type="text"
                    value={processData.periodo_ingresso}
                    onChange={(e) => setProcessData({ ...processData, periodo_ingresso: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder="2026.1 ou Imediato"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-chatTextTitle">Nome do Curso / Habilitação *</label>
                <input
                  type="text"
                  required
                  value={processData.nome_curso}
                  onChange={(e) => setProcessData({ ...processData, nome_curso: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                  placeholder="Ex: Ensino Médio EJA EAD ou Técnico em Enfermagem"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-chatTextTitle">Link do Dossiê Documental / Drive</label>
                <input
                  type="url"
                  value={processData.url_dossie_pdf}
                  onChange={(e) => setProcessData({ ...processData, url_dossie_pdf: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="https://drive.google.com/... ou link de PDF"
                />
                <p className="text-[10.5px] text-chatTextMuted mt-1">
                  Documentação de matrícula para validação da Secretaria Acadêmica.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: FINANCEIRO & SPLIT ASAAS */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <span className="font-bold text-sm text-chatTextTitle block">
                Condições de Pagamento & Split com Polo
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-chatTextTitle">Valor Total da Matrícula (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-chatTextMuted font-bold">R$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={billingData.valor_total}
                      onChange={(e) => setBillingData({ ...billingData, valor_total: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-chatTextTitle">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={billingData.data_vencimento}
                    onChange={(e) => setBillingData({ ...billingData, data_vencimento: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-chatTextTitle">Forma de Cobrança</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingData({ ...billingData, billing_type: 'PIX' })}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      billingData.billing_type === 'PIX'
                        ? 'border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-chatBorder hover:bg-slate-50 dark:hover:bg-chatCard text-chatTextMuted'
                    }`}
                  >
                    <QrCode size={18} />
                    <span className="text-xs">PIX Instantâneo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingData({ ...billingData, billing_type: 'BOLETO' })}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      billingData.billing_type === 'BOLETO'
                        ? 'border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-chatBorder hover:bg-slate-50 dark:hover:bg-chatCard text-chatTextMuted'
                    }`}
                  >
                    <FileText size={18} />
                    <span className="text-xs">Boleto Bancário</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingData({ ...billingData, billing_type: 'CREDIT_CARD' })}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      billingData.billing_type === 'CREDIT_CARD'
                        ? 'border-brand-600 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-chatBorder hover:bg-slate-50 dark:hover:bg-chatCard text-chatTextMuted'
                    }`}
                  >
                    <CreditCard size={18} />
                    <span className="text-xs">Cartão de Crédito</span>
                  </button>
                </div>
              </div>

              {/* CARD DE SIMULAÇÃO DE SPLIT EM TEMPO REAL */}
              <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                    <Wallet size={14} />
                    Divisão de Receita (Split Asaas)
                  </span>
                  <span className="text-[11px] font-semibold text-brand-600">
                    Comissão Polo: {splitCalculations.percentualPolo}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-chatCard border border-chatBorder">
                    <span className="text-[10px] text-chatTextMuted uppercase font-bold block">
                      Repasse Polo Parceiro
                    </span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      R$ {splitCalculations.valorPolo.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-chatTextMuted mt-0.5 truncate">
                      {currentHub?.asaas_wallet_id ? `Wallet: ${currentHub.asaas_wallet_id}` : 'Sem Wallet configurada'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white dark:bg-chatCard border border-chatBorder">
                    <span className="text-[10px] text-chatTextMuted uppercase font-bold block">
                      Matriz / Mantenedora
                    </span>
                    <p className="text-sm font-bold text-chatTextTitle font-mono">
                      R$ {splitCalculations.valorMatriz.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-chatTextMuted mt-0.5">
                      Retenção direta na conta Matriz
                    </p>
                  </div>
                </div>

                <p className="text-[10.5px] text-chatTextMuted">
                  * Ao emitir a cobrança, o Asaas registrará automaticamente a regra de liquidação dividida, creditando cada parte no momento do pagamento.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: SUCESSO & COBRANÇA GERADA */}
          {/* ========================================================================= */}
          {currentStep === 4 && integrationResult && (
            <div className="space-y-4 animate-fade-in text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>

              <div>
                <h3 className="text-base font-bold text-chatTextTitle">
                  Matrícula e Cobrança Geradas com Sucesso!
                </h3>
                <p className="text-xs text-chatTextMuted mt-0.5">
                  Processo registrado no Supabase e cobrança atrelada com split no Asaas.
                </p>
              </div>

              {/* CARD DE DETALHES PIX OU BOLETO */}
              <div className="p-4 rounded-xl border border-chatBorder bg-slate-50 dark:bg-chatCard text-left space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-chatBorder pb-2">
                  <span className="text-chatTextMuted">ID do Processo:</span>
                  <span className="font-mono font-bold text-brand-600">{integrationResult.processId}</span>
                </div>

                <div className="flex items-center justify-between text-xs border-b border-chatBorder pb-2">
                  <span className="text-chatTextMuted">ID Pagamento Asaas:</span>
                  <span className="font-mono text-chatTextTitle">{integrationResult.asaas?.paymentId}</span>
                </div>

                {/* SE FOR PIX */}
                {integrationResult.asaas?.pixPayload && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-semibold text-chatTextTitle block">
                      Código PIX Copia e Cola:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={integrationResult.asaas.pixPayload}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-chatPanel border border-chatBorder rounded-lg font-mono text-[11px] truncate text-chatTextMuted"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPix(integrationResult.asaas.pixPayload)}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                      >
                        {copiedPix ? <Check size={14} /> : <Copy size={14} />}
                        {copiedPix ? 'Copiado!' : 'Copiar PIX'}
                      </button>
                    </div>
                  </div>
                )}

                {/* BOTÕES DE LINK EXTERNO */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {integrationResult.asaas?.invoiceUrl && (
                    <a
                      href={integrationResult.asaas.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-chatBorder hover:bg-white dark:hover:bg-chatPanel text-xs font-semibold flex items-center gap-1.5 text-chatTextTitle transition"
                    >
                      <ExternalLink size={13} />
                      Abrir Fatura Asaas
                    </a>
                  )}

                  {integrationResult.asaas?.bankSlipUrl && (
                    <a
                      href={integrationResult.asaas.bankSlipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-chatBorder hover:bg-white dark:hover:bg-chatPanel text-xs font-semibold flex items-center gap-1.5 text-chatTextTitle transition"
                    >
                      <FileText size={13} />
                      Download Boleto PDF
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DE NAVEGAÇÃO ENTRE PASSOS */}
        <div className="px-6 py-3.5 border-t border-chatBorder bg-slate-50/70 dark:bg-chatCard/50 flex items-center justify-between">
          {currentStep < 4 ? (
            <>
              <button
                type="button"
                disabled={currentStep === 1 || isSubmitting}
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-chatBorder hover:bg-white dark:hover:bg-chatCard transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={15} />
                Voltar
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  disabled={currentStep === 1 ? !canProceedStep1 : !canProceedStep2}
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  Próximo
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canProceedStep3 || isSubmitting}
                  onClick={handleFinalSubmit}
                  className="px-6 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Gerando Matrícula & Asaas...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      Concluir Matrícula & Emitir
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition cursor-pointer"
              >
                Concluir e Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
