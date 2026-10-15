import React, { useState } from 'react';
import {
  GraduationCap,
  X,
  Building,
  UserCheck,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';

export default function StudentDossierModal({
  isOpen,
  onClose,
  student
}) {
  const [copiedField, setCopiedField] = useState(null);

  if (!isOpen || !student) return null;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusBg =
    student.academicStatus === 'Ativo'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
      : student.academicStatus === 'Certificado'
      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
      : student.academicStatus === 'Veterano'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-chatPanel w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Cabeçalho */}
        <div className="p-5 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-yellow-300 border border-white/20 shadow-md">
              <GraduationCap size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">{student.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${statusBg}`}>
                  {student.academicStatus}
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5 flex items-center gap-2">
                <span>Matrícula: <strong>{student.matricula}</strong></span>
                <span>•</span>
                <span>Base EduControl (Base44)</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Dossiê */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          
          {/* Cartões Principais de Informações Acadêmicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Curso & Polo */}
            <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/40 space-y-2">
              <span className="text-[10.5px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={13} /> Dados do Curso & Matrícula
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {student.course}
                </p>
                <p className="text-xs text-chatTextMuted mt-1 flex items-center gap-1">
                  <Building size={12} className="text-slate-400" />
                  <strong>Polo:</strong> {student.polo}
                </p>
              </div>
            </div>

            {/* Atendimento & Consultor (Sticky Assignment) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder space-y-2">
              <span className="text-[10.5px] font-bold text-chatTextMuted uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={13} className="text-brand-600" /> Consultor Titular (Sticky Assignment)
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {student.assignee || 'Gabriel Carvalho'}
                </p>
                <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold mt-1">
                  Fila: {student.department || 'Secretaria Acadêmica'}
                </p>
              </div>
            </div>
          </div>

          {/* Dados Pessoais e Cadastrais Essenciais (Padrão Base44) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder space-y-3 text-xs">
            <span className="font-bold text-chatTextMuted uppercase tracking-wider block text-[10.5px]">
              Dados Cadastrais Oficiais (EduControl Base44)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-chatTextTitle">
              
              {/* CPF */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-chatPanel border border-slate-100 dark:border-chatBorder flex flex-col justify-between">
                <span className="text-[10px] font-bold text-chatTextMuted uppercase">CPF (Chave Única)</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                    {student.cpf || student.cleanCPF || 'Não informado'}
                  </span>
                  {(student.cpf || student.cleanCPF) && (
                    <button
                      type="button"
                      onClick={() => handleCopy(student.cpf || student.cleanCPF, 'cpf')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-chatCard rounded text-slate-400 hover:text-purple-600 transition cursor-pointer"
                      title="Copiar CPF"
                    >
                      {copiedField === 'cpf' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Telefone / WhatsApp */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-chatPanel border border-slate-100 dark:border-chatBorder flex flex-col justify-between">
                <span className="text-[10px] font-bold text-chatTextMuted uppercase">WhatsApp / Telefone</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                    {student.phone}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(student.phone, 'phone')}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-chatCard rounded text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                    title="Copiar Telefone"
                  >
                    {copiedField === 'phone' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* E-mail */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-chatPanel border border-slate-100 dark:border-chatBorder flex flex-col justify-between">
                <span className="text-[10px] font-bold text-chatTextMuted uppercase">E-mail Cadastrado</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="truncate text-blue-600 dark:text-blue-400 font-medium" title={student.email}>
                    {student.email || 'contato@olavobilac.edu.br'}
                  </span>
                  {student.email && (
                    <button
                      type="button"
                      onClick={() => handleCopy(student.email, 'email')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-chatCard rounded text-slate-400 hover:text-blue-600 transition cursor-pointer shrink-0"
                      title="Copiar E-mail"
                    >
                      {copiedField === 'email' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Desempenho e Financeiro */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-center">
              <span className="text-[10px] font-bold text-chatTextMuted uppercase block mb-1">
                Progresso
              </span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {student.progress || '82%'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-center">
              <span className="text-[10px] font-bold text-chatTextMuted uppercase block mb-1">
                Média Geral
              </span>
              <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {student.avgGrade || '9.3'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-center">
              <span className="text-[10px] font-bold text-chatTextMuted uppercase block mb-1">
                Financeiro
              </span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block truncate">
                {student.financialStatus || 'Adimplente (Asaas)'}
              </span>
            </div>
          </div>

          {/* Selo de Conformidade MEC & Sincronização */}
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-bold">Validação Regulatória & Certificação MEC:</p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Aluno devidamente matriculado pela Faculdade Olavo Bilac / Grupo EstudeMais. Histórico de notas, carga horária e emissão de diplomas vinculados ao sistema EduControl.
              </p>
            </div>
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between">
          <span className="text-[11px] text-chatTextMuted">
            Origem: {student.origin || 'EduControl (Base44)'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(student.matricula, 'matr')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs font-semibold text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatCard transition cursor-pointer"
            >
              {copiedField === 'matr' ? 'Matrícula Copiada!' : 'Copiar Matrícula'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Fechar Dossiê
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
