import React, { useState } from 'react';
import {
  X,
  QrCode,
  Smartphone,
  Wifi,
  BatteryCharging,
  Zap,
  CheckCircle2,
  RefreshCw,
  Send,
  Bot,
  UserCheck,
  Shield,
  Headphones,
  Sliders
} from 'lucide-react';

export default function WhatsAppConnectionModal({
  isOpen,
  onClose,
  onSimulateWebhook
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'qrcode' | 'settings'
  const [selectedScenario, setSelectedScenario] = useState('carteira');
  const [customMsg, setCustomMsg] = useState('');
  const [simulatedFeedback, setSimulatedFeedback] = useState(null);

  const handleRunSimulation = (scenarioType) => {
    let payload = {};
    if (scenarioType === 'carteira') {
      payload = {
        fromPhone: '+55 11 98765-4321',
        senderName: 'Lucas Mendes',
        messageText: customMsg.trim() || 'Olá Gabriel, boa tarde! Conseguiu confirmar o cupom de desconto na matrícula do MBA?',
        contactId: 'wa-lucas-mendes'
      };
    } else if (scenarioType === 'veterano') {
      payload = {
        fromPhone: '+55 19 97123-4567',
        senderName: 'Juliana Rocha',
        messageText: customMsg.trim() || 'Oi pessoal, boa tarde! Gostaria de uma ajuda da secretaria para emissão de histórico.',
        contactId: 'wa-juliana-rocha'
      };
    } else if (scenarioType === 'inedito') {
      payload = {
        fromPhone: '+55 21 99888-1122',
        senderName: 'Carlos Eduardo',
        messageText: customMsg.trim() || 'Boa tarde! Quero saber valores e turmas abertas para novas matrículas.',
        contactId: 'wa-carlos-eduardo'
      };
    } else if (scenarioType === 'audio') {
      payload = {
        fromPhone: '+55 11 98765-4321',
        senderName: 'Lucas Mendes',
        messageText: '🎙️ [ÁUDIO_TRANSCRIÇÃO: "Olá Gabriel! Te mandei esse áudio só para confirmar se o pagamento pode ser parcelado no boleto bancário sem juros, ok? Fico no aguardo!"]',
        isAudio: true,
        audioTranscription: 'Olá Gabriel! Te mandei esse áudio só para confirmar se o pagamento pode ser parcelado no boleto bancário sem juros, ok? Fico no aguardo!',
        contactId: 'wa-lucas-mendes'
      };
    }

    const result = onSimulateWebhook(payload);
    setSimulatedFeedback(result);
    setCustomMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-chatCard w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-chatTextTitle leading-tight flex items-center gap-2">
                Conexão WhatsApp & Motor de Webhooks
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Instância Ativa
                </span>
              </h2>
              <p className="text-xs text-chatTextMuted">
                Gateway Evolution API • Roteamento por Carteira, Veteranos e URA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-200 dark:hover:bg-chatBorder transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="flex border-b border-chatBorder bg-slate-50 dark:bg-chatSidebar px-6 pt-2">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'simulator'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Zap size={15} />
            Simulador de Webhook & Roteamento
          </button>
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'qrcode'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <QrCode size={15} />
            QR Code & Aparelho Conectado
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Sliders size={15} />
            Status do Gateway
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'simulator' && (
            <div className="space-y-4">
              <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-500/20 rounded-xl p-3.5 text-xs text-brand-900 dark:text-brand-200 leading-relaxed">
                <span className="font-bold flex items-center gap-1.5 mb-1 text-brand-800 dark:text-brand-300">
                  <Zap size={14} /> Teste as 3 Portas de Entrada em Tempo Real:
                </span>
                Dispare mensagens simuladas de WhatsApp para ver a trava de carteira, o autoatendimento de veteranos e a URA funcionando de forma instantânea no EduChat.
              </div>

              {/* Seletor de Cenários */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('carteira');
                    handleRunSimulation('carteira');
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedScenario === 'carteira'
                      ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-chatBorder hover:bg-slate-50 dark:hover:bg-chatPanel'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                      Porta 1
                    </span>
                    <span className="text-xs">🔥</span>
                  </div>
                  <h4 className="text-xs font-bold text-chatTextTitle">Carteira Ativa</h4>
                  <p className="text-[11px] text-chatTextMuted mt-1">
                    Lead com card em andamento. Notifica <strong>apenas o consultor</strong> responsável (Gabriel).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('veterano');
                    handleRunSimulation('veterano');
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedScenario === 'veterano'
                      ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-chatBorder hover:bg-slate-50 dark:hover:bg-chatPanel'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Porta 2
                    </span>
                    <span className="text-xs">🎓</span>
                  </div>
                  <h4 className="text-xs font-bold text-chatTextTitle">Aluno Veterano (Opção C)</h4>
                  <p className="text-[11px] text-chatTextMuted mt-1">
                    Card concluído. <strong>Acolhimento IA de retenção</strong> sem incomodar o vendedor.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedScenario('inedito');
                    handleRunSimulation('inedito');
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedScenario === 'inedito'
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-chatBorder hover:bg-slate-50 dark:hover:bg-chatPanel'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Porta 3
                    </span>
                    <span className="text-xs">✨</span>
                  </div>
                  <h4 className="text-xs font-bold text-chatTextTitle">Número Inédito (URA)</h4>
                  <p className="text-[11px] text-chatTextMuted mt-1">
                    Primeiro contato. Dispara <strong>URA de 4 opções</strong> e classifica o setor no Kanban.
                  </p>
                </button>
              </div>

              {/* Botão de Envio de Áudio */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-chatPanel p-3 rounded-xl border border-slate-200 dark:border-chatBorder">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Headphones size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-chatTextTitle">Simular Mensagem de Áudio WhatsApp</h5>
                    <p className="text-[11px] text-chatTextMuted">Testa o Speech-to-Text com transcrição automática para o consultor e para a IA.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRunSimulation('audio')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  Disparar Áudio
                </button>
              </div>

              {/* Feedback do Roteamento */}
              {simulatedFeedback && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Evento Webhook Processado com Sucesso!
                    </span>
                    <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                      {simulatedFeedback.doorName}
                    </span>
                  </div>
                  <div className="text-xs text-chatTextTitle space-y-1">
                    <p><strong>Remetente:</strong> {simulatedFeedback.studentName} ({simulatedFeedback.fromPhone})</p>
                    <p><strong>Roteamento:</strong> {simulatedFeedback.systemMessage || simulatedFeedback.notificationText}</p>
                    {simulatedFeedback.targetAssignee && (
                      <p><strong>Fila / Responsável:</strong> <span className="bg-white dark:bg-chatCard px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 font-semibold">{simulatedFeedback.targetAssignee}</span></p>
                    )}
                  </div>
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={onClose}
                      className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Ir para o Chat do Aluno →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'qrcode' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4 text-center">
              <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EduChat_WhatsApp_Gateway_5511987654321"
                  alt="QR Code WhatsApp"
                  className="w-48 h-48"
                />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-chatTextTitle">
                  WhatsApp Conectado ao Número Oficial
                </h4>
                <p className="text-xs text-chatTextMuted max-w-sm">
                  Abra o WhatsApp no celular da sua instituição, acesse <strong>Aparelhos Conectados</strong> e aponte para reconectar a qualquer momento.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => alert('Nova chave de sessão gerada!')}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-chatBorder text-xs font-semibold text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatPanel transition flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Atualizar QR Code
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Instância WhatsApp</span>
                  <p className="font-bold text-chatTextTitle">EduChat-Matriz-01</p>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <Wifi size={12} /> Conexão Estável (12ms)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Número Vinculado</span>
                  <p className="font-bold text-chatTextTitle">+55 (11) 98765-4321</p>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <BatteryCharging size={12} /> Bateria 94% • Carregando
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-2 text-xs">
                <h5 className="font-bold text-chatTextTitle flex items-center gap-1.5">
                  <Shield size={14} className="text-brand-600" />
                  URL do Webhook Supabase
                </h5>
                <code className="block bg-white dark:bg-chatCard p-2 rounded-lg border border-slate-200 dark:border-chatBorder text-[11px] font-mono text-chatTextMuted break-all select-all">
                  https://btyxawhwnoykrcbavzts.supabase.co/functions/v1/whatsapp-webhook
                </code>
                <p className="text-[11px] text-chatTextMuted">
                  Eventos escutados: <code>messages.upsert</code>, <code>messages.update</code>, <code>connection.update</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 bg-chatPanel border-t border-chatBorder flex items-center justify-between shrink-0">
          <span className="text-[11px] text-chatTextMuted">
            Trava de Carteira Ativa: <strong>Ligada</strong> • Speech-to-Text: <strong>Ativo</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
}
