import React, { useState, useMemo } from 'react';
import {
  X,
  MessageSquarePlus,
  Smartphone,
  Send,
  User,
  Building2,
  Sparkles,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { canonicalizeWhatsAppPhone, canonicalizeChatId } from '../data/initialData';

const DEPARTMENTS = [
  'Comercial',
  'Tutoria',
  'Secretaria',
  'Pedagógico',
  'Financeiro',
  'Expansão',
  'Diretoria'
];

export default function NewWhatsAppChatModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser = {}
}) {
  const [phoneInput, setPhoneInput] = useState('');
  const [contactName, setContactName] = useState('');
  const [department, setDepartment] = useState('Comercial');
  const [firstMessage, setFirstMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Limpeza e prévia do telefone em tempo real
  const cleanDigits = useMemo(() => {
    return (phoneInput || '').replace(/\D/g, '');
  }, [phoneInput]);

  const canonicalPhone = useMemo(() => {
    return canonicalizeWhatsAppPhone(phoneInput);
  }, [phoneInput]);

  const formattedPreview = useMemo(() => {
    if (!canonicalPhone) return '';
    const d = canonicalPhone;
    if (d.startsWith('55') && d.length === 13) {
      return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
    if (d.length >= 10) {
      return `+${d}`;
    }
    return d;
  }, [canonicalPhone]);

  const isValidPhone = cleanDigits.length >= 10;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isValidPhone) {
      setErrorMsg('Por favor, informe um número de WhatsApp válido com DDD (mínimo 10 dígitos).');
      return;
    }

    if (!firstMessage.trim()) {
      setErrorMsg('Por favor, digite a primeira mensagem para iniciar o atendimento.');
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        rawPhone: phoneInput,
        canonicalPhone,
        chatId: canonicalizeChatId(canonicalPhone),
        contactName: contactName.trim() || `WhatsApp (${formattedPreview || canonicalPhone})`,
        department,
        firstMessage: firstMessage.trim()
      });

      // Limpa os campos
      setPhoneInput('');
      setContactName('');
      setFirstMessage('');
      setDepartment('Comercial');
      onClose();
    } catch (err) {
      console.error('Erro ao iniciar atendimento WhatsApp:', err);
      setErrorMsg(err.message || 'Falha ao iniciar conversa via Evolution API. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  const setQuickTemplate = (txt) => {
    setFirstMessage(txt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-chatPanel w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder overflow-hidden flex flex-col">
        {/* Topo do Modal */}
        <div className="px-6 py-4 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageSquarePlus size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Novo Atendimento WhatsApp</h3>
              <p className="text-xs text-emerald-100">Iniciar conversa ativa com novo número ou lead</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campo: Número de WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-chatTextTitle mb-1.5 flex items-center gap-1.5">
              <Smartphone size={14} className="text-emerald-600" />
              <span>Número de WhatsApp *</span>
            </label>
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Ex: (11) 93059-4591 ou 11930594591"
              autoFocus
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle placeholder:text-chatTextMuted focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            {cleanDigits && (
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className={isValidPhone ? "text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1" : "text-amber-600 font-semibold"}>
                  {isValidPhone ? (
                    <>
                      <Check size={12} className="stroke-[3]" />
                      <span>Destino canônico: {formattedPreview}</span>
                    </>
                  ) : (
                    <span>⚠️ Digite pelo menos DDD + 8 ou 9 dígitos</span>
                  )}
                </span>
                {isValidPhone && (
                  <span className="text-chatTextMuted font-mono">DDI: +55 (Brasil)</span>
                )}
              </div>
            )}
          </div>

          {/* Campo: Nome do Aluno / Contato */}
          <div>
            <label className="block text-xs font-bold text-chatTextTitle mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-blue-600" />
              <span>Nome do Aluno / Lead (Opcional)</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Pedro Henrique Sampaio (Lead MBA)"
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle placeholder:text-chatTextMuted focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Campo: Fila / Departamento */}
          <div>
            <label className="block text-xs font-bold text-chatTextTitle mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-purple-600" />
              <span>Fila / Departamento Inicial</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold cursor-pointer"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Campo: Primeira Mensagem */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-chatTextTitle flex items-center gap-1.5">
                <Send size={14} className="text-emerald-600" />
                <span>Primeira Mensagem *</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickTemplate(`Olá${contactName ? ` ${contactName}` : ''}! Aqui é da Faculdade Olavo Bilac. Tudo bem? Como posso te ajudar hoje?`)}
                  className="text-[10.5px] text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 transition cursor-pointer"
                >
                  ⚡ Saudação
                </button>
              </div>
            </div>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Digite a mensagem que o aluno irá receber agora no WhatsApp..."
              rows={3}
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle placeholder:text-chatTextMuted focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Rodapé / Botões */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-chatBorder">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatCard transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !isValidPhone || !firstMessage.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Disparando WhatsApp...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Enviar & Iniciar Atendimento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
