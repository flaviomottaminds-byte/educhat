import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  Sliders,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Key,
  Globe,
  Server,
  Code2
} from 'lucide-react';

export default function WhatsAppConnectionModal({
  isOpen,
  onClose,
  onSimulateWebhook,
  initialTab = 'qrcode'
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState(initialTab); // 'qrcode' | 'simulator' | 'settings'
  const [selectedScenario, setSelectedScenario] = useState('carteira');
  const [customMsg, setCustomMsg] = useState('');
  const [simulatedFeedback, setSimulatedFeedback] = useState(null);

  // Estados do QR Code e Evolution API
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [timer, setTimer] = useState(45);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'expired'
  const [connectedInfo, setConnectedInfo] = useState({
    phone: '+55 (11) 98765-4321',
    name: 'EduChat Matriz Oficial',
    battery: 94
  });

  const [evolutionConfig, setEvolutionConfig] = useState(() => ({
    apiUrl: localStorage.getItem('educhat_evo_url') || 'https://api.evolution.suaempresa.com',
    instanceName: localStorage.getItem('educhat_evo_instance') || 'EduChat-Matriz-01',
    apiKey: localStorage.getItem('educhat_evo_key') || ''
  }));

  const [manualPayloadInput, setManualPayloadInput] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  // Gerador de QR Code com QRCode library
  const generateFreshQRCode = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');
    try {
      const mockSessionCode = `2@WA_EDUCHAT_${Date.now()}_EVOLUTION_API_${Math.random().toString(36).substring(2, 9)}`;
      const url = await QRCode.toDataURL(mockSessionCode, {
        width: 320,
        margin: 2,
        color: {
          dark: '#111b21',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeDataUrl(url);
      setConnectionStatus('connecting');
      setTimer(45);
    } catch (err) {
      console.error('Erro ao gerar QR Code inicial:', err);
      setErrorMessage('Falha ao renderizar código QR.');
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Inicialização ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      generateFreshQRCode();
    }
  }, [isOpen, initialTab]);

  // Contagem regressiva de expiração do QR Code (45 segundos)
  useEffect(() => {
    let interval = null;
    if (activeTab === 'qrcode' && connectionStatus === 'connecting') {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setConnectionStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, connectionStatus]);

  // Parser Universal para Retorno da Evolution API (JSON, Base64 puro, DataURL ou Token)
  const handleConvertAndPlotQRCode = async (rawInput) => {
    const content = (rawInput || manualPayloadInput || '').trim();
    if (!content) {
      setErrorMessage('Por favor, informe ou cole o retorno da Evolution API (JSON, base64 ou token).');
      return;
    }

    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');

    try {
      let target = content;

      // 1. Caso o conteúdo seja um JSON stringificado
      if ((target.startsWith('{') && target.endsWith('}')) || (target.startsWith('[') && target.endsWith(']'))) {
        try {
          const parsed = JSON.parse(target);
          if (parsed.base64) {
            target = parsed.base64;
          } else if (parsed.qrcode?.base64) {
            target = parsed.qrcode.base64;
          } else if (parsed.code) {
            target = parsed.code;
          } else if (parsed.qrcode?.code) {
            target = parsed.qrcode.code;
          } else if (Array.isArray(parsed) && parsed[0]?.base64) {
            target = parsed[0].base64;
          }
          if (parsed.pairingCode || parsed.qrcode?.pairingCode) {
            setPairingCode(parsed.pairingCode || parsed.qrcode?.pairingCode);
          }
        } catch (e) {
          console.warn('Payload não é JSON estrito, processando como string direta:', e);
        }
      }

      // 2. Se for uma Data URL direta (data:image/png;base64,...)
      if (target.startsWith('data:image/')) {
        setQrCodeDataUrl(target);
        setConnectionStatus('connecting');
        setTimer(45);
        setSuccessFeedback('QR Code visual em Base64 renderizado com sucesso!');
        setIsLoadingQR(false);
        return;
      }

      // 3. Se for string Base64 pura sem o prefixo data:image/png;base64,
      if (target.startsWith('iVBORw0KGgo') || (/^[A-Za-z0-9+/=]{80,}$/.test(target.replace(/\s/g, '')))) {
        const cleanBase64 = target.replace(/\s/g, '');
        const fullDataUrl = `data:image/png;base64,${cleanBase64}`;
        setQrCodeDataUrl(fullDataUrl);
        setConnectionStatus('connecting');
        setTimer(45);
        setSuccessFeedback('Base64 pura da Evolution API convertida em imagem PNG e renderizada!');
        setIsLoadingQR(false);
        return;
      }

      // 4. Se for token ou pairing code do WhatsApp (ex: 2@..., URL ou string de texto)
      // Desenha com a biblioteca QRCode nativa
      const generatedUrl = await QRCode.toDataURL(target, {
        width: 320,
        margin: 2,
        color: {
          dark: '#111b21', // Cor oficial do WhatsApp
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });

      setQrCodeDataUrl(generatedUrl);
      setConnectionStatus('connecting');
      setTimer(45);
      setSuccessFeedback('Token / código de pareamento convertido em QR Code escaneável com sucesso!');
    } catch (err) {
      console.error('Falha ao processar QR Code:', err);
      setErrorMessage('Não foi possível converter o payload da Evolution API em imagem.');
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Chamada direta ao endpoint da Evolution API (/instance/connect/{instance})
  const handleFetchFromEvolutionEndpoint = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');

    try {
      const cleanUrl = evolutionConfig.apiUrl.replace(/\/+$/, '');
      const endpoint = `${cleanUrl}/instance/connect/${evolutionConfig.instanceName}`;

      localStorage.setItem('educhat_evo_url', evolutionConfig.apiUrl);
      localStorage.setItem('educhat_evo_instance', evolutionConfig.instanceName);
      localStorage.setItem('educhat_evo_key', evolutionConfig.apiKey);

      const headers = { 'Content-Type': 'application/json' };
      if (evolutionConfig.apiKey) {
        headers['apikey'] = evolutionConfig.apiKey;
      }

      const response = await fetch(endpoint, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      await handleConvertAndPlotQRCode(data);
      setSuccessFeedback(`Conectado à instância "${evolutionConfig.instanceName}" e QR Code carregado!`);
    } catch (err) {
      console.warn('Erro ao chamar Evolution API:', err);
      setErrorMessage(`Falha na requisição (${err.message}). Verifique o CORS ou cole o payload JSON/Base64 diretamente abaixo.`);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Executar simulação de webhooks (Portas 1, 2, 3 e Áudio)
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
      <div className="bg-white dark:bg-chatCard w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-chatTextTitle leading-tight flex items-center gap-2">
                Conexão WhatsApp & Evolution API
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {connectionStatus === 'connected' ? 'Instância Pareada' : 'Aguardando Escaneamento'}
                </span>
              </h2>
              <p className="text-xs text-chatTextMuted">
                Gateway WhatsApp Web • QR Code Visual & Roteamento Inteligente
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
        <div className="flex border-b border-chatBorder bg-slate-50 dark:bg-chatSidebar px-6 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'qrcode'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <QrCode size={15} />
            Conectar Aparelho (QR Code)
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'simulator'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-chatTextMuted hover:text-chatTextTitle'
            }`}
          >
            <Zap size={15} />
            Simulador de Webhooks & Carteira
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
          {/* ABA 1: QR CODE VISUAL & ESCANEÁVEL (ESTILO WHATSAPP WEB) */}
          {activeTab === 'qrcode' && (
            <div className="space-y-6">
              {/* Feedback de Erro ou Sucesso */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {successFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span className="flex-1">{successFeedback}</span>
                </div>
              )}

              {/* Se o aparelho já estiver conectado */}
              {connectionStatus === 'connected' ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-6 text-center space-y-3 animate-in fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                    WhatsApp Conectado com Sucesso!
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-md mx-auto">
                    O número <strong>{connectedInfo.phone}</strong> está autenticado via Evolution API e pronto para receber mensagens e webhooks no EduChat.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConnectionStatus('connecting')}
                      className="px-4 py-2 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                    >
                      Reconectar Outro Aparelho
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Concluir & Abrir Atendimentos
                    </button>
                  </div>
                </div>
              ) : (
                /* Grid Principal Estilo WhatsApp Web */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Lado Esquerdo: Instruções Passo a Passo */}
                  <div className="space-y-4 text-left">
                    <div>
                      <h3 className="text-base font-bold text-chatTextTitle flex items-center gap-2">
                        Usar o WhatsApp no EduChat
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          WhatsApp Web
                        </span>
                      </h3>
                      <p className="text-xs text-chatTextMuted mt-1 leading-relaxed">
                        Aponte a câmera do WhatsApp para escanear o código visual e autorizar a sincronização de alunos e mensagens.
                      </p>
                    </div>

                    <div className="space-y-3 text-xs text-chatTextTitle">
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-chatPanel border border-slate-300 dark:border-chatBorder flex items-center justify-center font-bold text-[11px] shrink-0 text-brand-600">
                          1
                        </span>
                        <span>Abra o <strong>WhatsApp</strong> no seu celular</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-chatPanel border border-slate-300 dark:border-chatBorder flex items-center justify-center font-bold text-[11px] shrink-0 text-brand-600">
                          2
                        </span>
                        <span>Toque em <strong>Mais opções</strong> (⋮) no Android ou <strong>Configurações</strong> (⚙️) no iPhone</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-chatPanel border border-slate-300 dark:border-chatBorder flex items-center justify-center font-bold text-[11px] shrink-0 text-brand-600">
                          3
                        </span>
                        <span>Selecione <strong>Aparelhos Conectados</strong> e depois <strong>Conectar um aparelho</strong></span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-chatPanel border border-slate-300 dark:border-chatBorder flex items-center justify-center font-bold text-[11px] shrink-0 text-brand-600">
                          4
                        </span>
                        <span>Aponte seu celular para o <strong>QR Code visual</strong> ao lado para parear</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setConnectionStatus('connected')}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} /> Simular Leitura Concluída
                      </button>
                      <span className="text-chatTextMuted">•</span>
                      <button
                        type="button"
                        onClick={() => setShowApiConfig(!showApiConfig)}
                        className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                      >
                        <Sliders size={13} /> {showApiConfig ? 'Ocultar Parâmetros' : 'Chamar API / Colar Payload'}
                      </button>
                    </div>
                  </div>

                  {/* Lado Direito: Imagem do QR Code Visual e Escaneável */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative p-3.5 bg-white rounded-2xl shadow-xl border-2 border-slate-200 dark:border-chatBorder group">
                      {/* Guias Verdes dos 4 Cantos (Estilo WhatsApp) */}
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-600 rounded-tl pointer-events-none" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-600 rounded-tr pointer-events-none" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-600 rounded-bl pointer-events-none" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-600 rounded-br pointer-events-none" />

                      {/* Renderização da Imagem Visual (PNG / Base64) */}
                      {isLoadingQR ? (
                        <div className="w-60 h-60 flex flex-col items-center justify-center space-y-2 bg-slate-50">
                          <RefreshCw size={28} className="text-emerald-600 animate-spin" />
                          <span className="text-xs font-semibold text-chatTextMuted">Gerando código visual...</span>
                        </div>
                      ) : qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code WhatsApp Web Evolution API"
                          className="w-60 h-60 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-60 h-60 flex flex-col items-center justify-center bg-slate-100 text-chatTextMuted p-4 text-center">
                          <QrCode size={40} className="mb-2 text-slate-400" />
                          <span className="text-xs">Aguardando geração do QR Code</span>
                        </div>
                      )}

                      {/* Overlay com Blur quando o QR Code Expira */}
                      {connectionStatus === 'expired' && (
                        <div className="absolute inset-0 bg-white/95 dark:bg-chatCard/95 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                          <span className="text-sm font-bold text-chatTextTitle mb-1">QR Code Expirado</span>
                          <p className="text-[11px] text-chatTextMuted mb-3">
                            O tempo limite de segurança expirou. Clique abaixo para atualizar o código.
                          </p>
                          <button
                            type="button"
                            onClick={generateFreshQRCode}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
                          >
                            <RefreshCw size={14} /> Atualizar QR Code
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Temporizador e Botão de Atualização Manual */}
                    {connectionStatus !== 'expired' && (
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span className="text-chatTextMuted flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Expira em: <strong className="font-mono text-chatTextTitle">{timer}s</strong>
                        </span>
                        <button
                          type="button"
                          onClick={generateFreshQRCode}
                          className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                          title="Atualizar o QR Code agora"
                        >
                          <RefreshCw size={12} /> Recarregar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Painel Expansível de Integração Evolution API & Conversor Manual */}
              {showApiConfig && (
                <div className="bg-slate-50 dark:bg-chatPanel border border-slate-200 dark:border-chatBorder rounded-2xl p-4 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-chatBorder pb-2">
                    <span className="text-xs font-bold text-chatTextTitle flex items-center gap-1.5">
                      <Server size={14} className="text-emerald-600" />
                      Parâmetros da Evolution API & Conversor de Payload
                    </span>
                    <span className="text-[10px] text-chatTextMuted font-mono">
                      /instance/connect
                    </span>
                  </div>

                  {/* Configurações do Endpoint */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-chatTextMuted mb-1">
                        URL da Evolution API:
                      </label>
                      <input
                        type="text"
                        value={evolutionConfig.apiUrl}
                        onChange={(e) => setEvolutionConfig({ ...evolutionConfig, apiUrl: e.target.value })}
                        placeholder="https://api.evolution.suaempresa.com"
                        className="w-full bg-white dark:bg-chatCard border border-slate-300 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-chatTextTitle focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-chatTextMuted mb-1">
                        Nome da Instância:
                      </label>
                      <input
                        type="text"
                        value={evolutionConfig.instanceName}
                        onChange={(e) => setEvolutionConfig({ ...evolutionConfig, instanceName: e.target.value })}
                        placeholder="EduChat-Matriz-01"
                        className="w-full bg-white dark:bg-chatCard border border-slate-300 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-chatTextTitle focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-chatTextMuted mb-1">
                        Global API Key:
                      </label>
                      <input
                        type="password"
                        value={evolutionConfig.apiKey}
                        onChange={(e) => setEvolutionConfig({ ...evolutionConfig, apiKey: e.target.value })}
                        placeholder="Sua chave secreta"
                        className="w-full bg-white dark:bg-chatCard border border-slate-300 dark:border-chatBorder rounded-lg px-2.5 py-1.5 text-chatTextTitle focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleFetchFromEvolutionEndpoint}
                      disabled={isLoadingQR}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isLoadingQR ? 'animate-spin' : ''} />
                      <span>Buscar QR Code da Evolution API</span>
                    </button>
                  </div>

                  {/* Campo de Colagem Manual Inteligente (Garante o funcionamento com qualquer payload bruto) */}
                  <div className="border-t border-chatBorder pt-3 space-y-2">
                    <label className="block text-[11px] font-bold text-chatTextTitle flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Code2 size={13} className="text-brand-600" />
                        Colar Retorno Bruto (Payload JSON, Base64 ou Token):
                      </span>
                      <span className="text-[10px] text-chatTextMuted font-normal">
                        Converte texto em imagem imediatamente
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={manualPayloadInput}
                      onChange={(e) => setManualPayloadInput(e.target.value)}
                      placeholder='Ex: {"base64":"data:image/png;base64,iVBORw0K..."} ou iVBORw0KGgo... ou 2@abc123token...'
                      className="w-full bg-white dark:bg-chatCard border border-slate-300 dark:border-chatBorder rounded-lg p-2 text-xs font-mono text-chatTextTitle placeholder:text-chatTextMuted focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleConvertAndPlotQRCode()}
                        className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                      >
                        <QrCode size={13} />
                        <span>Plotar Imagem do QR Code</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: SIMULADOR DE WEBHOOKS & ROTAS POR CARTEIRA */}
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

          {/* ABA 3: STATUS DO GATEWAY & WEBHOOKS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Instância WhatsApp</span>
                  <p className="font-bold text-chatTextTitle">{evolutionConfig.instanceName}</p>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <Wifi size={12} /> Conexão Estável (12ms)
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Número Vinculado</span>
                  <p className="font-bold text-chatTextTitle">{connectedInfo.phone}</p>
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
            Gateway: <strong>Evolution API</strong> • QR Code: <strong>Renderização Visual Ativa</strong>
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
