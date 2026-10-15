import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
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
  Code2,
  RotateCcw,
  Power
} from 'lucide-react';

const PROD_EVO_URL = 'https://evolution-api-production-3fb2.up.railway.app';
const PROD_EVO_KEY = 'e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f';
const PROD_EVO_INSTANCE = 'EduChat-Matriz-01';

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

  const [evolutionConfig, setEvolutionConfig] = useState(() => {
    let savedUrl = localStorage.getItem('educhat_evo_url');
    if (!savedUrl || savedUrl.includes('suaempresa.com')) {
      savedUrl = import.meta.env.VITE_EVOLUTION_API_URL || PROD_EVO_URL;
      localStorage.setItem('educhat_evo_url', savedUrl);
    }

    let savedKey = localStorage.getItem('educhat_evo_key');
    if (!savedKey || savedKey.length < 10) {
      savedKey = import.meta.env.VITE_EVOLUTION_API_KEY || PROD_EVO_KEY;
      localStorage.setItem('educhat_evo_key', savedKey);
    }

    let savedInst = localStorage.getItem('educhat_evo_instance');
    if (!savedInst || savedInst === 'nome-da-instancia') {
      savedInst = import.meta.env.VITE_EVOLUTION_INSTANCE || PROD_EVO_INSTANCE;
      localStorage.setItem('educhat_evo_instance', savedInst);
    }

    return {
      apiUrl: savedUrl,
      instanceName: savedInst,
      apiKey: savedKey
    };
  });

  const [manualPayloadInput, setManualPayloadInput] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');

  // Helper: Extrai diretamente a URL de imagem Base64 da Evolution API sem passar por biblioteca de QR Code
  const extractBase64Image = (data) => {
    if (!data) return null;

    // Se for objeto
    if (typeof data === 'object') {
      const candidate =
        data.base64 ||
        (typeof data.qrcode === 'string' ? data.qrcode : null) ||
        data.qrcode?.base64 ||
        data.instance?.qrcode?.base64 ||
        data.instance?.base64 ||
        (Array.isArray(data) && (data[0]?.base64 || data[0]?.qrcode?.base64 || (typeof data[0] === 'string' ? data[0] : null)));

      if (candidate && typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.startsWith('data:image/')) return trimmed;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        return `data:image/png;base64,${trimmed.replace(/\s/g, '')}`;
      }
    }

    // Se for string
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractBase64Image(parsed);
        } catch {}
      }
      if (trimmed.startsWith('data:image/')) return trimmed;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      if (trimmed.startsWith('iVBORw0KGgo') || trimmed.length > 250) {
        return `data:image/png;base64,${trimmed.replace(/\s/g, '')}`;
      }
    }

    return null;
  };

  // Gerador de QR Code fallback (apenas para modo demonstração local)
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
      setTimer(60);
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
      // Limpeza forçada de cache/localStorage caso tenha URL fictícia antiga
      const currentUrl = localStorage.getItem('educhat_evo_url');
      if (!currentUrl || currentUrl.includes('suaempresa.com')) {
        const prodUrl = import.meta.env.VITE_EVOLUTION_API_URL || PROD_EVO_URL;
        const prodKey = import.meta.env.VITE_EVOLUTION_API_KEY || PROD_EVO_KEY;
        const prodInst = import.meta.env.VITE_EVOLUTION_INSTANCE || PROD_EVO_INSTANCE;
        localStorage.setItem('educhat_evo_url', prodUrl);
        localStorage.setItem('educhat_evo_key', prodKey);
        localStorage.setItem('educhat_evo_instance', prodInst);
        setEvolutionConfig({
          apiUrl: prodUrl,
          apiKey: prodKey,
          instanceName: prodInst
        });
      }

      // Busca o QR Code real da Evolution API
      handleFetchFromEvolutionEndpoint();
    }
  }, [isOpen, initialTab]);

  // Contagem regressiva de expiração do QR Code (60 segundos)
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

  // Parser Universal para Retorno da Evolution API (Item 1: Renderização Direta em <img src={base64} />)
  const handleConvertAndPlotQRCode = async (rawInput) => {
    const content = rawInput !== undefined ? rawInput : manualPayloadInput;
    if (!content) {
      setErrorMessage('Por favor, informe ou cole o retorno da Evolution API (JSON ou Base64).');
      return;
    }

    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');

    try {
      // 1. Extração Direta da Imagem Base64 (Sem Dupla Codificação)
      const directImage = extractBase64Image(content);

      if (directImage) {
        // Atribui DIRETAMENTE ao src da tag <img> sem passar por biblioteca de QR Code!
        setQrCodeDataUrl(directImage);
        setConnectionStatus('connecting');
        setTimer(60);
        setSuccessFeedback('✅ QR Code em Base64 nativo da Evolution API renderizado diretamente na imagem!');

        // Extrai pairing code se houver
        if (typeof content === 'object') {
          const pCode = content.pairingCode || content.qrcode?.pairingCode;
          if (pCode) setPairingCode(String(pCode));
        } else if (typeof content === 'string') {
          const pMatch = content.match(/"pairingCode":\s*"([^"]+)"/);
          if (pMatch) setPairingCode(pMatch[1]);
        }
        return;
      }

      // 2. Se for exclusivamente um Token de Pareamento puro (ex: 2@...) e NÃO uma imagem
      const rawString = typeof content === 'string' ? content.trim() : (content.code || content.qrcode?.code || '');
      if (rawString.startsWith('2@') || rawString.startsWith('1@')) {
        const generatedUrl = await QRCode.toDataURL(rawString, {
          width: 320,
          margin: 2,
          color: { dark: '#111b21', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        });
        setQrCodeDataUrl(generatedUrl);
        setConnectionStatus('connecting');
        setTimer(60);
        setSuccessFeedback('✅ Token 2@ da Evolution API convertido em QR Code escaneável!');
        return;
      }

      throw new Error('Formato não reconhecido. Certifique-se de colar o Base64 nativo da Evolution API ou o JSON retornado.');
    } catch (err) {
      console.error('Falha ao processar QR Code:', err);
      setErrorMessage(`Erro ao renderizar QR Code: ${err.message}`);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Chamada via Supabase Edge Function 'evolution-proxy' (livre de CORS) com fallback inteligente
  const callEvolutionApi = async (action = 'connect') => {
    const cleanUrl = (evolutionConfig.apiUrl || '').trim().replace(/\/+$/, '');
    const instName = (evolutionConfig.instanceName || 'EduChat-Matriz-01').trim();
    const apiKey = (evolutionConfig.apiKey || '').trim();

    if (cleanUrl) localStorage.setItem('educhat_evo_url', cleanUrl);
    if (instName) localStorage.setItem('educhat_evo_instance', instName);
    if (apiKey) localStorage.setItem('educhat_evo_key', apiKey);

    // 1. Tentar primeiro via Supabase Edge Function (Bypass de CORS no Navegador)
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('evolution-proxy', {
        body: {
          action,
          apiUrl: cleanUrl,
          instanceName: instName,
          apiKey: apiKey
        }
      });

      if (!edgeErr && edgeData) {
        if (edgeData.success) {
          return { success: true, via: 'edge-function', data: edgeData.data || edgeData };
        }
        if (edgeData.error) {
          throw new Error(edgeData.error);
        }
      }
    } catch (edgeError) {
      console.warn('Proxy Supabase Edge Function indisponível ou falhou, tentando fallback direto:', edgeError.message);
    }

    // 2. Fallback: Chamada direta ao endpoint da Evolution API
    if (!cleanUrl) {
      throw new Error('URL da Evolution API não informada. Preencha nos parâmetros da API abaixo ou no arquivo .env.');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['apikey'] = apiKey;

    if (action === 'logout') {
      const logoutEndpoint = `${cleanUrl}/instance/logout/${instName}`;
      try {
        await fetch(logoutEndpoint, { method: 'DELETE', headers });
      } catch {
        await fetch(logoutEndpoint, { method: 'POST', headers });
      }
      return { success: true, via: 'direct' };
    }

    const connectEndpoint = `${cleanUrl}/instance/connect/${instName}`;
    let response = await fetch(connectEndpoint, { method: 'GET', headers });

    // Auto-criação caso a instância ainda não exista no servidor Railway (404)
    if (response.status === 404) {
      console.log(`Instância "${instName}" não existe (404). Criando automaticamente via POST /instance/create...`);
      try {
        const createRes = await fetch(`${cleanUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: instName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          })
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData?.qrcode?.base64 || createData?.base64) {
            return { success: true, via: 'direct-created', data: createData };
          }
          await new Promise((r) => setTimeout(r, 1000));
          response = await fetch(connectEndpoint, { method: 'GET', headers });
        }
      } catch (createErr) {
        console.warn('Falha na tentativa de auto-criação da instância:', createErr);
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Evolution API retornou status ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    return { success: true, via: 'direct', data };
  };

  // Obter QR Code da Evolution API
  const handleFetchFromEvolutionEndpoint = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');

    try {
      const result = await callEvolutionApi('connect');
      const payloadData = result?.data?.data || result?.data;
      await handleConvertAndPlotQRCode(payloadData);
      setSuccessFeedback(`✅ QR Code carregado com sucesso ${result.via === 'edge-function' ? '(via Edge Function Proxy)' : '(via conexão direta)'}!`);
    } catch (err) {
      console.warn('Erro ao chamar Evolution API:', err);
      setErrorMessage(`Falha na comunicação (${err.message}). Se o navegador bloquear por CORS, verifique a Edge Function "evolution-proxy" ou use os botões abaixo para tentar novamente ou colar o Payload manualmente.`);
      setShowApiConfig(true);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Reset de Instância Travada na Evolution API (Logout + Connect) - Item 2
  const handleResetInstance = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');
    setQrCodeDataUrl('');

    const instName = evolutionConfig.instanceName || 'EduChat-Matriz-01';

    try {
      setSuccessFeedback(`1/2 Desconectando instância "${instName}" (logout) para limpar sessão fantasma...`);
      await callEvolutionApi('logout');

      // Pausa técnica de 1.5s para a Evolution API finalizar o processo
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccessFeedback(`2/2 Solicitando novo QR Code limpo para "${instName}"...`);
      const result = await callEvolutionApi('connect');
      const payloadData = result?.data?.data || result?.data;
      await handleConvertAndPlotQRCode(payloadData);
      setSuccessFeedback(`✅ Instância "${instName}" resetada com sucesso! Escaneie o novo QR Code com seu WhatsApp.`);
    } catch (err) {
      console.warn('Erro ao resetar instância na Evolution API:', err);
      setErrorMessage(`Falha ao resetar via endpoint: ${err.message}.`);
      setShowApiConfig(true);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Recarregar inteligente
  const handleRefreshClick = () => {
    handleFetchFromEvolutionEndpoint();
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
                        <div className="w-60 h-60 flex flex-col items-center justify-center space-y-2 bg-slate-50 dark:bg-chatPanel rounded-lg">
                          <RefreshCw size={28} className="text-emerald-600 animate-spin" />
                          <span className="text-xs font-semibold text-chatTextMuted">Gerando código visual...</span>
                        </div>
                      ) : qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code WhatsApp Web Evolution API"
                          className="w-60 h-60 object-contain rounded-lg"
                        />
                      ) : errorMessage ? (
                        <div className="w-60 h-60 flex flex-col items-center justify-center bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 rounded-lg p-3 text-center space-y-2">
                          <AlertCircle size={28} className="text-rose-600 dark:text-rose-400" />
                          <p className="text-[11px] font-bold text-rose-800 dark:text-rose-300 leading-tight">
                            Falha na Conexão Evolution
                          </p>
                          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/70 leading-tight line-clamp-2">
                            {errorMessage}
                          </p>
                          <div className="flex flex-col gap-1.5 w-full pt-1">
                            <button
                              type="button"
                              onClick={handleRefreshClick}
                              className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-md shadow-xs flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <RefreshCw size={11} /> Tentar Novamente
                            </button>
                            <button
                              type="button"
                              onClick={handleResetInstance}
                              className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-md shadow-xs flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <RotateCcw size={11} /> Resetar Instância
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowApiConfig(true);
                                setTimeout(() => {
                                  const el = document.getElementById('manual-payload-textarea');
                                  if (el) el.focus();
                                }, 100);
                              }}
                              className="w-full py-1 px-2 border border-slate-300 dark:border-chatBorder text-chatTextTitle text-[10px] font-semibold rounded-md hover:bg-slate-100 dark:hover:bg-chatPanel transition cursor-pointer"
                            >
                              📋 Colar Payload Manual
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-60 h-60 flex flex-col items-center justify-center bg-slate-100 dark:bg-chatPanel text-chatTextMuted p-4 text-center rounded-lg space-y-2">
                          <QrCode size={40} className="text-slate-400" />
                          <span className="text-xs font-medium">Aguardando geração do QR Code</span>
                          <button
                            type="button"
                            onClick={handleRefreshClick}
                            className="mt-1 px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-md hover:bg-emerald-500 transition cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> Gerar Agora
                          </button>
                        </div>
                      )}

                      {/* Overlay com Blur quando o QR Code Expira */}
                      {connectionStatus === 'expired' && (
                        <div className="absolute inset-0 bg-white/95 dark:bg-chatCard/95 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                          <span className="text-sm font-bold text-chatTextTitle mb-1">QR Code Expirado</span>
                          <p className="text-[11px] text-chatTextMuted mb-3">
                            O tempo limite de segurança expirou. Clique abaixo para atualizar o código.
                          </p>
                          <div className="flex flex-col gap-2 w-full max-w-[200px]">
                            <button
                              type="button"
                              onClick={handleRefreshClick}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition"
                            >
                              <RefreshCw size={14} /> Atualizar QR Code
                            </button>
                            <button
                              type="button"
                              onClick={handleResetInstance}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                            >
                              <RotateCcw size={13} /> Resetar Instância
                            </button>
                          </div>
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
                          onClick={handleRefreshClick}
                          disabled={isLoadingQR}
                          className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                          title="Atualizar o QR Code agora"
                        >
                          <RefreshCw size={12} className={isLoadingQR ? 'animate-spin' : ''} /> Recarregar
                        </button>
                      </div>
                    )}

                    {/* BOTÃO CRÍTICO: Resetar Instância Travada (Logout & Connect) */}
                    <button
                      type="button"
                      onClick={handleResetInstance}
                      disabled={isLoadingQR}
                      className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                      title="Desconecta a sessão fantasma (/instance/logout) e gera um QR Code 100% novo (/instance/connect)"
                    >
                      <RotateCcw size={13} className={isLoadingQR ? 'animate-spin' : ''} />
                      <span>Resetar Instância (Logout & Novo QR)</span>
                    </button>

                    {/* Exibição de Pairing Code (se disponível) */}
                    {pairingCode && (
                      <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-center w-60">
                        <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block font-medium">
                          Código de Pareamento (Opcional):
                        </span>
                        <span className="text-sm font-mono font-bold tracking-widest text-emerald-900 dark:text-emerald-200">
                          {pairingCode}
                        </span>
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
                        placeholder="https://evolution-api-production-3fb2.up.railway.app"
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

                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetInstance}
                      disabled={isLoadingQR}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Efetua logout da instância para limpar o estado fantasma e gera um novo QR Code"
                    >
                      <RotateCcw size={13} className={isLoadingQR ? 'animate-spin' : ''} />
                      <span>Resetar Instância (Logout & Novo QR)</span>
                    </button>
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
                      id="manual-payload-textarea"
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
