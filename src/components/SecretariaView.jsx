import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Building2,
  FileText,
  Search,
  Plus,
  Edit2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  Phone,
  Mail,
  MapPin,
  Wallet,
  Percent,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SecretariaView({ currentUser = {}, onBackToChat }) {
  const [activeTab, setActiveTab] = useState('alunos'); // 'alunos' | 'polos' | 'matriculas'

  // Estados de Dados
  const [students, setStudents] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Estados de Busca e Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Paginação
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modais de Criação e Edição
  const [studentModal, setStudentModal] = useState({ isOpen: false, isEditing: false, data: null });
  const [hubModal, setHubModal] = useState({ isOpen: false, isEditing: false, data: null });
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, student: null, processes: [] });

  // 1. Carregamento de Dados Principais
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'alunos') {
        const { data, error } = await supabase
          .from('alunos')
          .select('*')
          .order('created_date', { ascending: false })
          .limit(300);
        if (error) throw error;
        setStudents(data || []);
      } else if (activeTab === 'polos') {
        const { data, error } = await supabase
          .from('polos')
          .select('*')
          .order('nome_exibicao', { ascending: true })
          .limit(300);
        if (error) throw error;
        setHubs(data || []);
      } else if (activeTab === 'matriculas') {
        const { data, error } = await supabase
          .from('matriculas')
          .select('*')
          .order('created_date', { ascending: false })
          .limit(300);
        if (error) throw error;
        setProcesses(data || []);
      }

      // Carrega Polos e Consultores para alimentar selects auxiliares
      const [hubsRes, consRes] = await Promise.all([
        supabase.from('polos').select('id, nome_exibicao, razao_social, polo_uf').order('nome_exibicao'),
        supabase.from('consultores').select('id, nome').order('nome')
      ]);
      if (hubsRes.data) setHubs(hubsRes.data);
      if (consRes.data) setConsultants(consRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados da secretaria:', err);
      setErrorMsg(`Falha na consulta ao banco de dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [activeTab, loadData]);

  // Toast automático
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Mapa de Polos para consulta O(1)
  const hubsMap = useMemo(() => {
    const map = new Map();
    (hubs || []).forEach((h) => map.set(h.id, h));
    return map;
  }, [hubs]);

  // 2. Filtragem de Alunos
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const cleanDigits = term.replace(/\D/g, '');

    return students.filter((s) => {
      if (selectedHubFilter !== 'all' && s.hub_id !== selectedHubFilter) return false;
      if (!term) return true;

      const nameMatch = (s.nome_completo || '').toLowerCase().includes(term);
      const emailMatch = (s.email || '').toLowerCase().includes(term);
      const cpfMatch = cleanDigits && (s.cpf || '').replace(/\D/g, '').includes(cleanDigits);
      const phoneMatch = cleanDigits && (s.telefone || '').replace(/\D/g, '').includes(cleanDigits);

      return nameMatch || emailMatch || cpfMatch || phoneMatch;
    });
  }, [students, searchTerm, selectedHubFilter]);

  // 3. Filtragem de Polos
  const filteredHubs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return hubs.filter((h) => {
      if (!term) return true;
      const nameMatch = (h.nome_exibicao || '').toLowerCase().includes(term);
      const razaoMatch = (h.razao_social || '').toLowerCase().includes(term);
      const cnpjMatch = (h.cnpj || '').toLowerCase().includes(term);
      const cityMatch = (h.polo_nome_municipio || '').toLowerCase().includes(term);
      const ufMatch = (h.polo_uf || '').toLowerCase().includes(term);

      return nameMatch || razaoMatch || cnpjMatch || cityMatch || ufMatch;
    });
  }, [hubs, searchTerm]);

  // 4. Filtragem de Matrículas
  const filteredProcesses = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return processes.filter((m) => {
      if (selectedStatusFilter !== 'all' && m.status !== selectedStatusFilter) return false;
      if (!term) return true;
      const courseMatch = (m.nome_curso || '').toLowerCase().includes(term);
      const typeMatch = (m.tipo_processo || '').toLowerCase().includes(term);
      const codeMatch = (m.codigo_verificacao || '').toLowerCase().includes(term);

      return courseMatch || typeMatch || codeMatch;
    });
  }, [processes, searchTerm, selectedStatusFilter]);

  // Paginação computada
  const paginatedData = useMemo(() => {
    let source = [];
    if (activeTab === 'alunos') source = filteredStudents;
    else if (activeTab === 'polos') source = filteredHubs;
    else if (activeTab === 'matriculas') source = filteredProcesses;

    const start = (page - 1) * pageSize;
    return source.slice(start, start + pageSize);
  }, [activeTab, filteredStudents, filteredHubs, filteredProcesses, page]);

  const totalPages = useMemo(() => {
    let total = 0;
    if (activeTab === 'alunos') total = filteredStudents.length;
    else if (activeTab === 'polos') total = filteredHubs.length;
    else if (activeTab === 'matriculas') total = filteredProcesses.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [activeTab, filteredStudents.length, filteredHubs.length, filteredProcesses.length]);

  // Formatação de CPF
  const formatCPF = (val) => {
    if (!val) return '-';
    const digits = String(val).replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return val;
  };

  // Formatação de Telefone
  const formatPhone = (val) => {
    if (!val) return '-';
    const digits = String(val).replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (digits.length === 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return val;
  };

  // 5. Abertura do Dossiê do Aluno
  const handleOpenStudentDetails = async (student) => {
    try {
      const { data } = await supabase
        .from('matriculas')
        .select('*')
        .eq('student_id', student.id)
        .order('created_date', { ascending: false });
      setDetailsModal({ isOpen: true, student, processes: data || [] });
    } catch (e) {
      console.warn('Erro ao carregar matrículas do aluno:', e);
      setDetailsModal({ isOpen: true, student, processes: [] });
    }
  };

  // 6. Salvamento de Aluno (Insert / Update direto no Supabase)
  const handleSaveStudent = async (formData) => {
    try {
      setLoading(true);
      const cleanCpf = (formData.cpf || '').replace(/\D/g, '');
      const cleanPhone = (formData.telefone || '').replace(/\D/g, '');

      const payload = {
        nome_completo: formData.nome_completo.trim(),
        cpf: cleanCpf || formData.cpf,
        email: formData.email ? formData.email.trim() : null,
        telefone: cleanPhone || formData.telefone,
        hub_id: formData.hub_id || null,
        rg: formData.rg ? formData.rg.trim() : null,
        rg_orgao_expedidor: formData.rg_orgao_expedidor ? formData.rg_orgao_expedidor.trim() : null,
        data_nascimento: formData.data_nascimento || null,
        nacionalidade: formData.nacionalidade || 'Brasileira',
        forma_ingresso: formData.forma_ingresso || 'Vestibular',
        filiacao_mae_nome: formData.filiacao_mae_nome ? formData.filiacao_mae_nome.trim() : null,
        filiacao_pai_nome: formData.filiacao_pai_nome ? formData.filiacao_pai_nome.trim() : null,
        updated_date: new Date().toISOString()
      };

      if (studentModal.isEditing && studentModal.data?.id) {
        const { error } = await supabase.from('students').update(payload).eq('id', studentModal.data.id);
        if (error) throw error;
        setSuccessToast(`Aluno "${payload.nome_completo}" atualizado com sucesso!`);
      } else {
        const newId = `stu_${Date.now()}`;
        payload.id = newId;
        payload.created_date = new Date().toISOString();
        const { error } = await supabase.from('students').insert([payload]);
        if (error) throw error;
        setSuccessToast(`Novo aluno "${payload.nome_completo}" cadastrado no Supabase!`);
      }

      setStudentModal({ isOpen: false, isEditing: false, data: null });
      loadData();
    } catch (err) {
      console.error('Erro ao salvar aluno:', err);
      alert(`Erro ao salvar aluno: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 7. Salvamento de Polo (Insert / Update direto no Supabase)
  const handleSaveHub = async (formData) => {
    try {
      setLoading(true);
      const cleanCnpj = (formData.cnpj || '').replace(/\D/g, '');
      const cleanPhone = (formData.telefone || '').replace(/\D/g, '');

      const payload = {
        nome_exibicao: formData.nome_exibicao.trim(),
        razao_social: (formData.razao_social || formData.nome_exibicao).trim(),
        cnpj: cleanCnpj || formData.cnpj,
        telefone: cleanPhone || formData.telefone,
        email_login: formData.email_login ? formData.email_login.trim() : null,
        consultant_id: formData.consultant_id || null,
        polo_nome_municipio: formData.polo_nome_municipio ? formData.polo_nome_municipio.trim() : null,
        polo_uf: formData.polo_uf ? formData.polo_uf.trim().toUpperCase() : null,
        // Configurações do Asaas & Split Financeiro
        asaas_wallet_id: formData.asaas_wallet_id ? formData.asaas_wallet_id.trim() : null,
        percentual_comissao_polo: Number(formData.percentual_comissao_polo || 0),
        regime_cobranca: formData.regime_cobranca || 'fatura_vaga',
        updated_date: new Date().toISOString()
      };

      if (hubModal.isEditing && hubModal.data?.id) {
        const { error } = await supabase.from('hubs').update(payload).eq('id', hubModal.data.id);
        if (error) throw error;
        setSuccessToast(`Polo "${payload.nome_exibicao}" atualizado com sucesso!`);
      } else {
        const newId = `hub_${Date.now()}`;
        payload.id = newId;
        payload.created_date = new Date().toISOString();
        const { error } = await supabase.from('hubs').insert([payload]);
        if (error) throw error;
        setSuccessToast(`Novo Polo "${payload.nome_exibicao}" cadastrado no Supabase!`);
      }

      setHubModal({ isOpen: false, isEditing: false, data: null });
      loadData();
    } catch (err) {
      console.error('Erro ao salvar polo:', err);
      alert(`Erro ao salvar polo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 dark:bg-chatBg text-chatTextTitle overflow-hidden font-sans">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500 animate-slide-in text-sm font-medium">
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="px-6 py-4 bg-white dark:bg-chatPanel border-b border-chatBorder flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-500 rounded-xl">
              <GraduationCap size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Secretaria Acadêmica & Operação</h1>
              <p className="text-xs text-chatTextMuted">
                Gestão unificada de Alunos, Matrículas e Polos Parceiros (Cérebro Único Supabase)
              </p>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS & BOTÃO VOLTAR */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 dark:bg-chatCard p-1 rounded-xl flex gap-1 border border-chatBorder">
            <button
              onClick={() => setActiveTab('alunos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'alunos'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-chatTextMuted hover:text-chatTextTitle hover:bg-white/50'
              }`}
            >
              <GraduationCap size={14} />
              Alunos ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('polos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'polos'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-chatTextMuted hover:text-chatTextTitle hover:bg-white/50'
              }`}
            >
              <Building2 size={14} />
              Polos ({hubs.length})
            </button>
            <button
              onClick={() => setActiveTab('matriculas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'matriculas'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-chatTextMuted hover:text-chatTextTitle hover:bg-white/50'
              }`}
            >
              <FileText size={14} />
              Matrículas ({processes.length})
            </button>
          </div>

          <button
            onClick={loadData}
            title="Recarregar Dados"
            className="p-2 border border-chatBorder hover:bg-slate-100 dark:hover:bg-chatCard rounded-xl text-chatTextMuted transition cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <section className="px-6 py-3.5 bg-white/60 dark:bg-chatPanel/60 border-b border-chatBorder flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-chatTextMuted" />
            <input
              type="text"
              placeholder={
                activeTab === 'alunos'
                  ? 'Buscar aluno por Nome, CPF, Telefone ou E-mail...'
                  : activeTab === 'polos'
                  ? 'Buscar polo por Nome, Razão, CNPJ ou Cidade...'
                  : 'Buscar matrícula por Curso ou Código...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-chatTextMuted hover:text-chatTextTitle"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* FILTROS ESPECÍFICOS POR ABA */}
        <div className="flex items-center gap-2">
          {activeTab === 'alunos' && (
            <select
              value={selectedHubFilter}
              onChange={(e) => setSelectedHubFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl text-xs text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer"
            >
              <option value="all">Todos os Polos</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nome_exibicao || h.razao_social} {h.polo_uf ? `(${h.polo_uf})` : ''}
                </option>
              ))}
            </select>
          )}

          {activeTab === 'matriculas' && (
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-chatCard border border-chatBorder rounded-xl text-xs text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="Em Analise">Em Análise</option>
              <option value="Concluído">Concluído</option>
              <option value="Emitido">Emitido</option>
              <option value="Pendente">Pendente</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          )}

          {/* BOTÕES DE AÇÃO PRIMÁRIA */}
          {activeTab === 'alunos' && (
            <button
              onClick={() => setStudentModal({ isOpen: true, isEditing: false, data: null })}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus size={15} />
              Novo Aluno
            </button>
          )}

          {activeTab === 'polos' && (
            <button
              onClick={() => setHubModal({ isOpen: true, isEditing: false, data: null })}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus size={15} />
              Novo Polo Parceiro
            </button>
          )}
        </div>
      </section>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (TABELAS) */}
      <main className="flex-1 overflow-auto p-6">
        {errorMsg && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TABELA: ALUNOS */}
        {activeTab === 'alunos' && (
          <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-chatCard/80 border-b border-chatBorder text-chatTextMuted uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Aluno</th>
                    <th className="py-3 px-4 font-semibold">CPF</th>
                    <th className="py-3 px-4 font-semibold">Contato</th>
                    <th className="py-3 px-4 font-semibold">Polo de Apoio</th>
                    <th className="py-3 px-4 font-semibold">Cadastro</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chatBorder">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-chatTextMuted">
                        Nenhum aluno localizado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((aluno) => {
                      const polo = hubsMap.get(aluno.hub_id);
                      return (
                        <tr key={aluno.id} className="hover:bg-slate-50/60 dark:hover:bg-chatCard/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-chatTextTitle">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-xs shrink-0">
                                {aluno.nome_completo ? aluno.nome_completo.charAt(0).toUpperCase() : '?'}
                              </span>
                              <div>
                                <p className="font-semibold">{aluno.nome_completo}</p>
                                <p className="text-[10.5px] text-chatTextMuted font-normal">{aluno.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-chatTextBody">
                            {formatCPF(aluno.cpf)}
                          </td>
                          <td className="py-3.5 px-4 text-chatTextBody">
                            <div className="space-y-0.5">
                              {aluno.telefone && (
                                <p className="flex items-center gap-1.5 text-[11px]">
                                  <Phone size={12} className="text-chatTextMuted" />
                                  <span>{formatPhone(aluno.telefone)}</span>
                                </p>
                              )}
                              {aluno.email && (
                                <p className="flex items-center gap-1.5 text-[11px] text-chatTextMuted truncate max-w-[180px]">
                                  <Mail size={12} />
                                  <span>{aluno.email}</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {polo ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-chatCard border border-chatBorder text-chatTextBody">
                                <Building2 size={12} className="text-chatTextMuted" />
                                <span className="truncate max-w-[140px]">{polo.nome_exibicao || polo.razao_social}</span>
                                {polo.polo_uf && <span className="text-[10px] text-chatTextMuted font-mono">({polo.polo_uf})</span>}
                              </span>
                            ) : (
                              <span className="text-chatTextMuted text-[11px]">Sem polo vinculado</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-chatTextMuted text-[11px]">
                            {aluno.created_date ? new Date(aluno.created_date).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenStudentDetails(aluno)}
                                title="Ver Matrículas & Dossiê"
                                className="p-1.5 text-chatTextMuted hover:text-brand-600 hover:bg-brand-500/10 rounded-lg transition cursor-pointer"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => setStudentModal({ isOpen: true, isEditing: true, data: aluno })}
                                title="Editar Cadastro"
                                className="p-1.5 text-chatTextMuted hover:text-brand-600 hover:bg-brand-500/10 rounded-lg transition cursor-pointer"
                              >
                                <Edit2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABELA: POLOS PARCEIROS */}
        {activeTab === 'polos' && (
          <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-chatCard/80 border-b border-chatBorder text-chatTextMuted uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Polo Parceiro</th>
                    <th className="py-3 px-4 font-semibold">CNPJ / CPF</th>
                    <th className="py-3 px-4 font-semibold">Localização</th>
                    <th className="py-3 px-4 font-semibold">Regime & Comissão</th>
                    <th className="py-3 px-4 font-semibold">Asaas Wallet ID</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chatBorder">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-chatTextMuted">
                        Nenhum polo parceiro localizado.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((polo) => (
                      <tr key={polo.id} className="hover:bg-slate-50/60 dark:hover:bg-chatCard/50 transition">
                        <td className="py-3.5 px-4 font-semibold text-chatTextTitle">
                          <div>
                            <p className="font-semibold">{polo.nome_exibicao || polo.razao_social}</p>
                            {polo.razao_social && polo.razao_social !== polo.nome_exibicao && (
                              <p className="text-[10.5px] text-chatTextMuted font-normal">{polo.razao_social}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-chatTextBody">
                          {polo.cnpj || polo.cpf || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-chatTextBody">
                          <p className="flex items-center gap-1.5 text-[11px]">
                            <MapPin size={12} className="text-chatTextMuted" />
                            <span>{polo.polo_nome_municipio || '-'} / {polo.polo_uf || '-'}</span>
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">
                              {polo.regime_cobranca || 'Fatura por Vaga'}
                            </span>
                            <p className="text-[10.5px] text-chatTextMuted flex items-center gap-1">
                              <Percent size={11} /> Comissão: {Number(polo.percentual_comissao_polo || 0)}%
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {polo.asaas_wallet_id ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={12} />
                              <span className="truncate max-w-[120px]">{polo.asaas_wallet_id}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <AlertCircle size={12} />
                              Não configurada
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setHubModal({ isOpen: true, isEditing: true, data: polo })}
                            title="Editar Polo & Configuração Asaas"
                            className="p-1.5 text-chatTextMuted hover:text-brand-600 hover:bg-brand-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABELA: MATRÍCULAS & PROCESSOS */}
        {activeTab === 'matriculas' && (
          <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-chatCard/80 border-b border-chatBorder text-chatTextMuted uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Curso / Matrícula</th>
                    <th className="py-3 px-4 font-semibold">Tipo</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Cód. Verificação</th>
                    <th className="py-3 px-4 font-semibold">Data Criação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chatBorder">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-chatTextMuted">
                        Nenhuma matrícula localizada.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((m) => {
                      const isApproved = m.status === 'Concluído' || m.status === 'Emitido';
                      const isAnalyzing = m.status === 'Em Analise';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-chatCard/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-chatTextTitle">
                            <p className="font-semibold">{m.nome_curso || 'Curso não informado'}</p>
                            <p className="text-[10.5px] text-chatTextMuted font-mono font-normal">{m.id}</p>
                          </td>
                          <td className="py-3.5 px-4 text-chatTextBody">
                            <span className="px-2 py-0.5 rounded text-[10.5px] bg-slate-100 dark:bg-chatCard border border-chatBorder">
                              {m.tipo_processo || 'Geral'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                isApproved
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : isAnalyzing
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-chatCard text-chatTextMuted border-chatBorder'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : isAnalyzing ? 'bg-amber-500' : 'bg-slate-400'}`} />
                              {m.status || 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-chatTextBody">
                            {m.codigo_verificacao ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-chatCard border border-chatBorder">
                                {m.codigo_verificacao}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-chatTextMuted text-[11px]">
                            {m.created_date ? new Date(m.created_date).toLocaleDateString('pt-BR') : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAGINAÇÃO INFERIOR */}
        <footer className="mt-4 flex items-center justify-between text-xs text-chatTextMuted">
          <div>
            Página <span className="font-semibold text-chatTextTitle">{page}</span> de{' '}
            <span className="font-semibold text-chatTextTitle">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-chatBorder hover:bg-white dark:hover:bg-chatCard disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-chatBorder hover:bg-white dark:hover:bg-chatCard disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: CADASTRO / EDIÇÃO DE ALUNO */}
      {/* ========================================================================= */}
      {studentModal.isOpen && (
        <StudentModal
          isEditing={studentModal.isEditing}
          initialData={studentModal.data}
          hubs={hubs}
          onClose={() => setStudentModal({ isOpen: false, isEditing: false, data: null })}
          onSave={handleSaveStudent}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CADASTRO / EDIÇÃO DE POLO (COM CONFIGURAÇÃO ASAAS) */}
      {/* ========================================================================= */}
      {hubModal.isOpen && (
        <HubModal
          isEditing={hubModal.isEditing}
          initialData={hubModal.data}
          consultants={consultants}
          onClose={() => setHubModal({ isOpen: false, isEditing: false, data: null })}
          onSave={handleSaveHub}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DOSSIÊ & MATRÍCULAS DO ALUNO */}
      {/* ========================================================================= */}
      {detailsModal.isOpen && detailsModal.student && (
        <StudentDetailsModal
          student={detailsModal.student}
          processes={detailsModal.processes}
          hub={hubsMap.get(detailsModal.student.hub_id)}
          onClose={() => setDetailsModal({ isOpen: false, student: null, processes: [] })}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENTE AUXILIAR: MODAL DE ALUNO
// -------------------------------------------------------------------------
function StudentModal({ isEditing, initialData, hubs = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    nome_completo: initialData?.nome_completo || '',
    cpf: initialData?.cpf || '',
    email: initialData?.email || '',
    telefone: initialData?.telefone || '',
    hub_id: initialData?.hub_id || '',
    rg: initialData?.rg || '',
    rg_orgao_expedidor: initialData?.rg_orgao_expedidor || '',
    data_nascimento: initialData?.data_nascimento ? initialData.data_nascimento.slice(0, 10) : '',
    filiacao_mae_nome: initialData?.filiacao_mae_nome || '',
    filiacao_pai_nome: initialData?.filiacao_pai_nome || '',
    nacionalidade: initialData?.nacionalidade || 'Brasileira'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome_completo.trim()) {
      alert('Nome completo é obrigatório!');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-500/10 text-brand-600 rounded-lg">
              <GraduationCap size={18} />
            </span>
            <h3 className="font-bold text-sm text-chatTextTitle">
              {isEditing ? 'Editar Aluno' : 'Novo Aluno'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-chatTextMuted hover:text-chatTextTitle rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-chatTextTitle">Nome Completo *</label>
            <input
              type="text"
              required
              value={formData.nome_completo}
              onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Ex: Carlos Eduardo da Silva"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">CPF *</label>
              <input
                type="text"
                required
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Telefone / WhatsApp</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="(11) 99999-8888"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="aluno@email.com"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Polo de Apoio</label>
              <select
                value={formData.hub_id}
                onChange={(e) => setFormData({ ...formData, hub_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Selecione um Polo...</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome_exibicao || h.razao_social} {h.polo_uf ? `(${h.polo_uf})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">RG</label>
              <input
                type="text"
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Órgão Emissor</label>
              <input
                type="text"
                value={formData.rg_orgao_expedidor}
                onChange={(e) => setFormData({ ...formData, rg_orgao_expedidor: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="SSP SP"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Data de Nascimento</label>
              <input
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Nome da Mãe</label>
              <input
                type="text"
                value={formData.filiacao_mae_nome}
                onChange={(e) => setFormData({ ...formData, filiacao_mae_nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Nome do Pai</label>
              <input
                type="text"
                value={formData.filiacao_pai_nome}
                onChange={(e) => setFormData({ ...formData, filiacao_pai_nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-chatBorder flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-chatBorder hover:bg-slate-100 dark:hover:bg-chatCard transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition cursor-pointer"
            >
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENTE AUXILIAR: MODAL DE POLO & CONFIGURAÇÃO ASAAS
// -------------------------------------------------------------------------
function HubModal({ isEditing, initialData, consultants = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    nome_exibicao: initialData?.nome_exibicao || '',
    razao_social: initialData?.razao_social || '',
    cnpj: initialData?.cnpj || initialData?.cpf || '',
    telefone: initialData?.telefone || '',
    email_login: initialData?.email_login || '',
    consultant_id: initialData?.consultant_id || '',
    polo_nome_municipio: initialData?.polo_nome_municipio || '',
    polo_uf: initialData?.polo_uf || '',
    // Integração Asaas
    asaas_wallet_id: initialData?.asaas_wallet_id || '',
    percentual_comissao_polo: initialData?.percentual_comissao_polo || 0,
    regime_cobranca: initialData?.regime_cobranca || 'fatura_vaga'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome_exibicao.trim()) {
      alert('Nome de exibição do polo é obrigatório!');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-500/10 text-brand-600 rounded-lg">
              <Building2 size={18} />
            </span>
            <h3 className="font-bold text-sm text-chatTextTitle">
              {isEditing ? 'Editar Polo Parceiro' : 'Novo Polo Parceiro'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-chatTextMuted hover:text-chatTextTitle rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Nome de Exibição / Fantasia *</label>
              <input
                type="text"
                required
                value={formData.nome_exibicao}
                onChange={(e) => setFormData({ ...formData, nome_exibicao: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Ex: Polo São Gonçalo - Centro"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Razão Social</label>
              <input
                type="text"
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Ex: Instituto Educacional SG Ltda"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">CNPJ ou CPF</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">Telefone de Contato</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1 text-chatTextTitle">Município</label>
              <input
                type="text"
                value={formData.polo_nome_municipio}
                onChange={(e) => setFormData({ ...formData, polo_nome_municipio: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Ex: São Gonçalo"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-chatTextTitle">UF</label>
              <input
                type="text"
                maxLength={2}
                value={formData.polo_uf}
                onChange={(e) => setFormData({ ...formData, polo_uf: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none uppercase font-mono"
                placeholder="RJ"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-chatTextTitle">Consultor Comercial Responsável</label>
            <select
              value={formData.consultant_id}
              onChange={(e) => setFormData({ ...formData, consultant_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">Nenhum consultor selecionado</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* SEÇÃO FINANCEIRA: INTEGRAÇÃO ASAAS & SPLIT */}
          <div className="pt-3 border-t border-chatBorder">
            <h4 className="font-bold text-xs uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3 flex items-center gap-1.5">
              <Wallet size={14} />
              Integração Financeira & Split Automático (Asaas)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-chatTextTitle">
                  Asaas Wallet ID (Carteira do Polo)
                </label>
                <input
                  type="text"
                  value={formData.asaas_wallet_id}
                  onChange={(e) => setFormData({ ...formData, asaas_wallet_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono text-[11px]"
                  placeholder="Ex: b6a5921da8a1244bf..."
                />
                <p className="text-[10px] text-chatTextMuted mt-1">
                  Identificador da subconta no Asaas para onde a comissão é transferida via Split.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-chatTextTitle">
                  Comissão do Polo (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.percentual_comissao_polo}
                    onChange={(e) => setFormData({ ...formData, percentual_comissao_polo: e.target.value })}
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                    placeholder="25.0"
                  />
                  <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-chatTextMuted" />
                </div>
                <p className="text-[10px] text-chatTextMuted mt-1">
                  Percentual automático aplicado sobre o valor de cada cobrança emitida.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <label className="block font-semibold mb-1 text-chatTextTitle">Regime de Cobrança</label>
              <select
                value={formData.regime_cobranca}
                onChange={(e) => setFormData({ ...formData, regime_cobranca: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-chatCard border border-chatBorder rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="fatura_vaga">Fatura por Vaga (Paga no ato da matrícula)</option>
                <option value="split_direto">Split Direto (Dividido na conta do aluno via Asaas)</option>
                <option value="mensalidade_fixa">Mensalidade Fixa (Plano Fixo Mensal)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-chatBorder flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-chatBorder hover:bg-slate-100 dark:hover:bg-chatCard transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition cursor-pointer"
            >
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Polo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENTE AUXILIAR: MODAL DE DOSSIÊ DO ALUNO
// -------------------------------------------------------------------------
function StudentDetailsModal({ student, processes = [], hub, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-chatPanel border border-chatBorder rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-chatBorder flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-brand-500/10 text-brand-600 font-bold flex items-center justify-center text-sm">
              {student.nome_completo ? student.nome_completo.charAt(0).toUpperCase() : '?'}
            </span>
            <div>
              <h3 className="font-bold text-sm text-chatTextTitle">{student.nome_completo}</h3>
              <p className="text-[11px] text-chatTextMuted font-mono">CPF: {student.cpf || 'Não informado'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-chatTextMuted hover:text-chatTextTitle rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* CARTÃO DE DADOS PESSOAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-chatCard rounded-xl border border-chatBorder">
            <div>
              <span className="text-[10px] uppercase font-bold text-chatTextMuted block">Polo Vinculado</span>
              <p className="font-semibold text-chatTextTitle">{hub ? hub.nome_exibicao || hub.razao_social : 'Nenhum'}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-chatTextMuted block">Telefone</span>
              <p className="font-semibold text-chatTextTitle">{student.telefone || '-'}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-chatTextMuted block">E-mail</span>
              <p className="font-semibold text-chatTextTitle">{student.email || '-'}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-chatTextMuted block">Nacionalidade</span>
              <p className="font-semibold text-chatTextTitle">{student.nacionalidade || 'Brasileira'}</p>
            </div>
          </div>

          {/* MATRÍCULAS E PROCESSOS VINCULADOS */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-chatTextTitle mb-2.5 flex items-center gap-1.5">
              <FileText size={14} className="text-brand-600" />
              Matrículas & Processos Acadêmicos ({processes.length})
            </h4>

            {processes.length === 0 ? (
              <div className="p-4 rounded-xl border border-chatBorder text-center text-chatTextMuted">
                Aluno com cadastro preliminar (nenhuma matrícula registrada).
              </div>
            ) : (
              <div className="space-y-2">
                {processes.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-chatBorder bg-white dark:bg-chatCard flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <p className="font-semibold text-chatTextTitle">{p.nome_curso}</p>
                      <p className="text-[10.5px] text-chatTextMuted">
                        Tipo: <span className="font-medium text-chatTextBody">{p.tipo_processo || 'Geral'}</span> | Registrado em:{' '}
                        {p.created_date ? new Date(p.created_date).toLocaleDateString('pt-BR') : '-'}
                      </p>
                      {p.codigo_verificacao && (
                        <p className="text-[10.5px] font-mono text-brand-600 mt-0.5">
                          Cód. Verificação: {p.codigo_verificacao}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold border ${
                        p.status === 'Concluído' || p.status === 'Emitido'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                          : p.status === 'Em Analise'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200'
                          : 'bg-slate-100 text-chatTextMuted border-chatBorder'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-chatBorder bg-slate-50/50 dark:bg-chatCard/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition cursor-pointer"
          >
            Fechar Dossiê
          </button>
        </div>
      </div>
    </div>
  );
}
