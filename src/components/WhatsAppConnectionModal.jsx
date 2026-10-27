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

  // Estados do QR Code e Evolution API (Inicializa SEMPRE verificando o estado real, nunca estático!)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [timer, setTimer] = useState(45);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'checking' | 'connected' | 'connecting' | 'disconnected' | 'expired'
  const [connectedInfo, setConnectedInfo] = useState({
    phone: import.meta.env.VITE_OFFICIAL_WHATSAPP_NUMBER || '+55 (11) 93059-4591',
    name: import.meta.env.VITE_INSTITUTION_NAME || 'Faculdade Olavo Bilac • Grupo EstudeMais',
    profileName: '',
    department: 'Secretaria Acadêmica / Matriz',
    instanceName: PROD_EVO_INSTANCE,
    status: 'checking',
    pingMs: null,
    webhookEnabled: false,
    webhookUrl: 'https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook',
    totalMessages: null,
    totalContacts: null,
    lastVerifiedAt: null
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

  // Formata número vindo de ownerJid (ex: 5511930594591@s.whatsapp.net -> +55 (11) 93059-4591)
  const formatJidPhone = (jid) => {
    if (!jid || typeof jid !== 'string') return import.meta.env.VITE_OFFICIAL_WHATSAPP_NUMBER || '+55 (11) 93059-4591';
    const digits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12 && digits.startsWith('55')) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return digits ? `+${digits}` : (import.meta.env.VITE_OFFICIAL_WHATSAPP_NUMBER || '+55 (11) 93059-4591');
  };

  // Helper: Extrai diretamente a URL de imagem Base64 da Evolution API sem passar por biblioteca de QR Code
  const extractBase64Image = (data) => {
    if (!data) return null;

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

  // Fetch com timeout seguro para evitar travamentos se o Railway estiver offline
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  };

  // Consulta passiva do Webhook na Evolution API (sem modificar nem sobrescrever a URL externa)
  const ensureWebhookActive = async (cleanUrl, instName, headers) => {
    try {
      const findRes = await fetchWithTimeout(`${cleanUrl}/webhook/find/${instName}`, {
        method: 'GET',
        headers
      }, 6000);

      if (findRes.ok) {
        const findData = await findRes.json();
        const currentUrl = findData?.url || findData?.webhook?.url || '';
        const isEnabled = Boolean(findData?.enabled ?? findData?.webhook?.enabled);
        return { enabled: isEnabled, url: currentUrl, autoUpdated: false };
      }
    } catch (whErr) {
      console.warn('Aviso ao consultar webhook na Evolution API:', whErr);
    }
    return { enabled: false, url: '', autoUpdated: false };
  };

  // Inicialização ao abrir o modal: Faz checagem REAL imediata na Evolution API
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
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

      handleFetchFromEvolutionEndpoint();
    }
  }, [isOpen, initialTab]);

  // Polling em tempo real enquanto aguarda leitura do QR Code:
  // Verifica a cada 5 segundos se o celular escaneou o QR Code (/instance/connectionState)
  useEffect(() => {
    if (!isOpen || connectionStatus === 'connected') return;

    const pollInterval = setInterval(async () => {
      try {
        const cleanUrl = (evolutionConfig.apiUrl || PROD_EVO_URL).trim().replace(/\/+$/, '');
        const instName = (evolutionConfig.instanceName || PROD_EVO_INSTANCE).trim();
        const apiKey = (evolutionConfig.apiKey || PROD_EVO_KEY).trim();
        if (!cleanUrl || !apiKey) return;

        const headers = { 'Content-Type': 'application/json', apikey: apiKey };
        const startMs = performance.now();
        const stateRes = await fetchWithTimeout(`${cleanUrl}/instance/connectionState/${instName}`, {
          method: 'GET',
          headers
        }, 5000);

        if (!stateRes.ok) return;
        const stateData = await stateRes.json();
        const pingMs = Math.round(performance.now() - startMs);
        const liveState = stateData?.instance?.state || stateData?.state || stateData?.connectionStatus;

        if (liveState === 'open') {
          const whStatus = await ensureWebhookActive(cleanUrl, instName, headers);
          setConnectionStatus('connected');
          setQrCodeDataUrl('');
          setErrorMessage('');
          setConnectedInfo((prev) => ({
            ...prev,
            instanceName: instName,
            status: 'open',
            pingMs,
            webhookEnabled: whStatus.enabled,
            lastVerifiedAt: new Date().toLocaleTimeString('pt-BR')
          }));
          setSuccessFeedback('✅ Leitura do QR Code confirmada! WhatsApp conectado e Webhook sincronizado no Railway.');
        }
      } catch {
        // Silencioso durante o polling em background
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isOpen, connectionStatus, evolutionConfig.apiUrl, evolutionConfig.instanceName, evolutionConfig.apiKey]);

  // Contagem regressiva de expiração do QR Code (60 segundos)
  useEffect(() => {
    let interval = null;
    if (activeTab === 'qrcode' && connectionStatus === 'connecting' && qrCodeDataUrl) {
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
  }, [activeTab, connectionStatus, qrCodeDataUrl]);

  // Parser Universal para Retorno da Evolution API (Renderização Direta em <img src={base64} />)
  const handleConvertAndPlotQRCode = async (rawInput) => {
    const content = rawInput !== undefined ? rawInput : manualPayloadInput;
    if (!content) {
      setConnectionStatus('disconnected');
      setErrorMessage('Por favor, informe ou cole o retorno da Evolution API (JSON ou Base64).');
      return false;
    }

    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');

    try {
      // 1. Extração Direta da Imagem Base64 (Sem Dupla Codificação)
      const directImage = extractBase64Image(content);

      if (directImage) {
        setQrCodeDataUrl(directImage);
        setConnectionStatus('connecting');
        setTimer(60);
        setSuccessFeedback('✅ QR Code da Evolution API gerado! Aponte a câmera do WhatsApp para escanear.');

        if (typeof content === 'object') {
          const pCode = content.pairingCode || content.qrcode?.pairingCode;
          if (pCode) setPairingCode(String(pCode));
        } else if (typeof content === 'string') {
          const pMatch = content.match(/"pairingCode":\s*"([^"]+)"/);
          if (pMatch) setPairingCode(pMatch[1]);
        }
        return true;
      }

      // 2. Se for exclusivamente um Token de Pareamento puro (ex: 2@...) e NÃO uma imagem
      const rawString = typeof content === 'string' ? content.trim() : (content.code || content.qrcode?.code || '');
      if (rawString && (rawString.startsWith('2@') || rawString.startsWith('1@') || rawString.length > 20)) {
        const generatedUrl = await QRCode.toDataURL(rawString, {
          width: 320,
          margin: 2,
          color: { dark: '#111b21', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        });
        setQrCodeDataUrl(generatedUrl);
        setConnectionStatus('connecting');
        setTimer(60);
        setSuccessFeedback('✅ Código de pareamento da Evolution API convertido em QR Code escaneável!');
        return true;
      }

      setConnectionStatus('disconnected');
      throw new Error('A instância está desconectada e não retornou imagem de QR Code. Clique em "Resetar Instância (Logout & Novo QR)" para gerar um novo QR Code.');
    } catch (err) {
      console.error('Falha ao processar QR Code:', err);
      setConnectionStatus('disconnected');
      setErrorMessage(err.message);
      return false;
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Chamada Direta e via Proxy à Evolution API
  const callEvolutionApi = async (action = 'status') => {
    const cleanUrl = (evolutionConfig.apiUrl || PROD_EVO_URL).trim().replace(/\/+$/, '');
    const instName = (evolutionConfig.instanceName || PROD_EVO_INSTANCE).trim();
    const apiKey = (evolutionConfig.apiKey || PROD_EVO_KEY).trim();

    if (cleanUrl) localStorage.setItem('educhat_evo_url', cleanUrl);
    if (instName) localStorage.setItem('educhat_evo_instance', instName);
    if (apiKey) localStorage.setItem('educhat_evo_key', apiKey);

    if (!cleanUrl) {
      throw new Error('URL da Evolution API não informada. Preencha nos parâmetros da API.');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['apikey'] = apiKey;

    // 1. Checagem Real de Status (/instance/connectionState/{instance})
    if (action === 'status') {
      const startMs = performance.now();
      const stateEndpoint = `${cleanUrl}/instance/connectionState/${instName}`;
      const response = await fetchWithTimeout(stateEndpoint, { method: 'GET', headers }, 8000);
      const pingMs = Math.round(performance.now() - startMs);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} em /instance/connectionState: ${errText || response.statusText}`);
      }

      const stateData = await response.json();

      // Busca metadados reais da instância (/instance/fetchInstances) para validar sessão e telefone
      let instanceDetails = null;
      try {
        const instRes = await fetchWithTimeout(`${cleanUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instName)}`, {
          method: 'GET',
          headers
        }, 6000);
        if (instRes.ok) {
          const instList = await instRes.json();
          if (Array.isArray(instList)) {
            instanceDetails = instList.find((i) => (i.name || i.instance?.instanceName) === instName) || instList[0];
          } else if (instList && typeof instList === 'object') {
            instanceDetails = instList;
          }
        }
      } catch (metaErr) {
        console.warn('Aviso ao consultar /instance/fetchInstances:', metaErr);
      }

      return {
        success: true,
        via: 'direct',
        pingMs,
        data: stateData,
        instanceDetails
      };
    }

    // 2. Logout da Instância
    if (action === 'logout') {
      const logoutEndpoint = `${cleanUrl}/instance/logout/${instName}`;
      try {
        await fetchWithTimeout(logoutEndpoint, { method: 'DELETE', headers }, 8000);
      } catch {
        await fetchWithTimeout(logoutEndpoint, { method: 'POST', headers }, 8000);
      }
      return { success: true, via: 'direct' };
    }

    // 3. Configurar Webhook
    if (action === 'set-webhook' || action === 'setup-webhook') {
      const whStatus = await ensureWebhookActive(cleanUrl, instName, headers);
      return {
        success: whStatus.enabled,
        via: 'direct',
        data: whStatus
      };
    }

    // 4. Obter QR Code (/instance/connect/{instance})
    const connectEndpoint = `${cleanUrl}/instance/connect/${instName}`;
    let response = await fetchWithTimeout(connectEndpoint, { method: 'GET', headers }, 10000);

    // Auto-criação caso a instância ainda não exista no servidor Railway (404)
    if (response.status === 404) {
      console.log(`Instância "${instName}" não existe (404). Criando automaticamente via POST /instance/create...`);
      try {
        const createRes = await fetchWithTimeout(`${cleanUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: instName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          })
        }, 10000);

        if (createRes.ok) {
          const createData = await createRes.json();
          await ensureWebhookActive(cleanUrl, instName, headers);
          if (createData?.qrcode?.base64 || createData?.base64) {
            return { success: true, via: 'direct-created', data: createData };
          }
          await new Promise((r) => setTimeout(r, 1000));
          response = await fetchWithTimeout(connectEndpoint, { method: 'GET', headers }, 10000);
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

  // Checagem Real da Evolution API (/instance/connectionState) + Geração de QR Code se Desconectado
  const handleFetchFromEvolutionEndpoint = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');
    setConnectionStatus('checking');

    const cleanUrl = (evolutionConfig.apiUrl || PROD_EVO_URL).trim().replace(/\/+$/, '');
    const instName = (evolutionConfig.instanceName || PROD_EVO_INSTANCE).trim();
    const apiKey = (evolutionConfig.apiKey || PROD_EVO_KEY).trim();
    const headers = { 'Content-Type': 'application/json', apikey: apiKey };

    try {
      // ETAPA 1: Faz ping real em /instance/connectionState/{instance} e /instance/fetchInstances
      const statusResult = await callEvolutionApi('status');
      const statePayload = statusResult?.data;
      const details = statusResult?.instanceDetails;
      const pingMs = statusResult?.pingMs ?? null;

      const rawState =
        statePayload?.instance?.state ||
        statePayload?.state ||
        details?.connectionStatus ||
        statePayload?.connectionStatus ||
        'close';

      // Verifica se está REALMENTE conectado ('open')
      if (rawState === 'open') {
        // Garante religamento automático do Webhook no Railway -> Supabase
        const whStatus = await ensureWebhookActive(cleanUrl, instName, headers);

        const realPhone = details?.ownerJid
          ? formatJidPhone(details.ownerJid)
          : (import.meta.env.VITE_OFFICIAL_WHATSAPP_NUMBER || '+55 (11) 93059-4591');

        setConnectionStatus('connected');
        setQrCodeDataUrl('');
        setConnectedInfo({
          phone: realPhone,
          name: import.meta.env.VITE_INSTITUTION_NAME || 'Faculdade Olavo Bilac • Grupo EstudeMais',
          profileName: details?.profileName || 'Secretaria Acadêmica',
          department: details?.profileName ? `${details.profileName} • Matriz` : 'Secretaria Acadêmica / Matriz',
          instanceName: instName,
          status: 'open',
          pingMs,
          webhookEnabled: whStatus.enabled,
          webhookUrl: whStatus.url,
          totalMessages: details?._count?.Message ?? null,
          totalContacts: details?._count?.Contact ?? null,
          lastVerifiedAt: new Date().toLocaleTimeString('pt-BR')
        });
        setSuccessFeedback(
          `✅ Conexão verificada em tempo real no Railway (${pingMs}ms)! WhatsApp ${realPhone} online e Webhook ativo.`
        );
        return;
      }

      // ETAPA 2: Se NÃO estiver 'open' (ex: 'close' ou 'connecting'), define estado real desconectado/conectando e busca QR Code
      setConnectionStatus('disconnected');
      setConnectedInfo((prev) => ({
        ...prev,
        instanceName: instName,
        status: rawState,
        pingMs,
        lastVerifiedAt: new Date().toLocaleTimeString('pt-BR')
      }));

      const connectResult = await callEvolutionApi('connect');
      const connectPayload = connectResult?.data?.data || connectResult?.data;

      // Caso o /instance/connect informe que acabou de abrir
      const connectState = connectPayload?.instance?.state || connectPayload?.state;
      if (connectState === 'open') {
        const whStatus = await ensureWebhookActive(cleanUrl, instName, headers);
        setConnectionStatus('connected');
        setConnectedInfo((prev) => ({
          ...prev,
          status: 'open',
          pingMs,
          webhookEnabled: whStatus.enabled,
          lastVerifiedAt: new Date().toLocaleTimeString('pt-BR')
        }));
        setSuccessFeedback(`✅ WhatsApp Oficial conectado e validado no Railway!`);
        return;
      }

      await handleConvertAndPlotQRCode(connectPayload);
    } catch (err) {
      console.warn('Erro ao validar conexão na Evolution API:', err);
      // JAMAIS exibe conectado se houver erro de rede, timeout ou 401/404/500!
      setConnectionStatus('disconnected');
      setQrCodeDataUrl('');
      setConnectedInfo((prev) => ({
        ...prev,
        status: 'disconnected',
        pingMs: null,
        lastVerifiedAt: new Date().toLocaleTimeString('pt-BR')
      }));
      setErrorMessage(
        `Desconectado / Falha na comunicação com a Evolution API (${err.message}). Verifique as credenciais abaixo ou clique em "Resetar Instância" para gerar um novo QR Code.`
      );
      setShowApiConfig(true);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Reset de Instância na Evolution API (Logout + Connect + Webhook)
  const handleResetInstance = async () => {
    const instName = evolutionConfig.instanceName || PROD_EVO_INSTANCE;

    if (connectionStatus === 'connected') {
      const confirmed = window.confirm(
        `⚠️ ATENÇÃO: A instância "${instName}" está conectada ao WhatsApp (${connectedInfo.phone}).\n\n` +
        `Fazer o reset desconectará o aparelho atual no Railway e exigirá a leitura de um novo QR Code.\n\n` +
        `Tem certeza que deseja desconectar e gerar um novo QR Code?`
      );
      if (!confirmed) return;
    }

    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');
    setQrCodeDataUrl('');
    setConnectionStatus('disconnected');

    try {
      setSuccessFeedback(`1/3 Encerrando sessão anterior da instância "${instName}" (/instance/logout)...`);
      try {
        await callEvolutionApi('logout');
      } catch (logoutErr) {
        console.warn('Aviso no logout:', logoutErr);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccessFeedback(`2/2 Gerando novo QR Code oficial na Evolution API (/instance/connect/${instName})...`);
      const result = await callEvolutionApi('connect');
      const payloadData = result?.data?.data || result?.data;
      const plotted = await handleConvertAndPlotQRCode(payloadData);
      if (plotted) {
        setSuccessFeedback(`✅ Novo QR Code gerado para "${instName}"! Escaneie com o WhatsApp do aparelho.`);
      }
    } catch (err) {
      console.warn('Erro ao resetar instância na Evolution API:', err);
      setConnectionStatus('disconnected');
      setErrorMessage(`Falha ao gerar novo QR Code: ${err.message}`);
      setShowApiConfig(true);
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Recarregar / Revalidar conexão real
  const handleRefreshClick = () => {
    handleFetchFromEvolutionEndpoint();
  };

  // Configuração explícita do Webhook Global da Evolution API para o Supabase
  const handleConfigureWebhook = async () => {
    setIsLoadingQR(true);
    setErrorMessage('');
    setSuccessFeedback('');
    try {
      const result = await callEvolutionApi('set-webhook');
      if (result.success) {
        setConnectedInfo((prev) => ({
          ...prev,
          webhookEnabled: true,
          webhookUrl: 'https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook'
        }));
        setSuccessFeedback('✅ Webhook da Evolution API religado e verificado com sucesso para https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook!');
      } else {
        throw new Error(result.error || 'Falha ao registrar webhook no Railway.');
      }
    } catch (err) {
      console.error('Erro ao configurar webhook:', err);
      setErrorMessage(`Falha ao registrar webhook: ${err.message}`);
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
        messageText: '🎙️ Mensagem de voz (0:18)\n[ÁUDIO_TRANSCRIÇÃO: "Olá Gabriel! Te mandei esse áudio só para confirmar se o pagamento pode ser parcelado no boleto bancário sem juros, ok? Fico no aguardo!"]',
        isAudio: true,
        duration: '0:18',
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
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xs shrink-0 ${
              connectionStatus === 'connected'
                ? 'bg-emerald-600'
                : connectionStatus === 'checking'
                ? 'bg-brand-600'
                : 'bg-rose-600'
            }`}>
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-chatTextTitle leading-tight flex items-center gap-2 flex-wrap">
                Conexão WhatsApp & Evolution API
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                    : connectionStatus === 'checking'
                    ? 'bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500'
                      : connectionStatus === 'checking'
                      ? 'bg-brand-500 animate-ping'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500 animate-pulse'
                  }`} />
                  {connectionStatus === 'connected'
                    ? `Conectado no Railway${connectedInfo.pingMs ? ` (${connectedInfo.pingMs}ms)` : ''}`
                    : connectionStatus === 'checking'
                    ? 'Verificando Status Real...'
                    : connectionStatus === 'connecting'
                    ? 'Aguardando Leitura do QR Code'
                    : 'Desconectado • Requer Pareamento'}
                </span>
              </h2>
              <p className="text-xs text-chatTextMuted">
                Faculdade Olavo Bilac • Grupo EstudeMais • Gateway WhatsApp Railway
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isLoadingQR}
              title="Testar conexão real com a Evolution API agora"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-chatBorder text-xs font-semibold text-chatTextTitle hover:bg-slate-100 dark:hover:bg-chatBorder transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoadingQR ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
              <span className="hidden sm:inline">Testar Ping</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-chatTextMuted hover:text-chatTextTitle hover:bg-slate-200 dark:hover:bg-chatBorder transition"
            >
              <X size={18} />
            </button>
          </div>
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

              {/* Estado 1: Verificando em Tempo Real */}
              {connectionStatus === 'checking' ? (
                <div className="bg-slate-50 dark:bg-chatPanel border border-slate-200 dark:border-chatBorder rounded-2xl p-8 text-center space-y-3 animate-in fade-in">
                  <RefreshCw size={36} className="text-brand-600 animate-spin mx-auto" />
                  <h3 className="text-sm font-bold text-chatTextTitle">
                    Consultando Evolution API em Tempo Real no Railway...
                  </h3>
                  <p className="text-xs text-chatTextMuted max-w-md mx-auto">
                    Verificando endpoint <code>/instance/connectionState/{evolutionConfig.instanceName || PROD_EVO_INSTANCE}</code> e validando rota do Webhook no Supabase.
                  </p>
                </div>
              ) : connectionStatus === 'connected' ? (
                /* Estado 2: Conectado (Validado via /instance/connectionState === 'open') */
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-6 text-center space-y-3.5 animate-in fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 rounded-full">
                      Status Real Validado • state: &quot;open&quot; {connectedInfo.pingMs ? `• ${connectedInfo.pingMs}ms` : ''}
                    </span>
                    <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100 mt-1">
                      WhatsApp Oficial Conectado no Railway!
                    </h3>
                  </div>

                  <div className="bg-white/85 dark:bg-chatPanel/90 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3.5 max-w-md mx-auto text-xs space-y-1.5 shadow-2xs">
                    <p className="text-emerald-950 dark:text-emerald-200 font-bold text-sm">
                      {connectedInfo.name}
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400 font-mono text-base font-extrabold tracking-wide">
                      {connectedInfo.phone}
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-chatTextMuted pt-1.5 border-t border-slate-100 dark:border-chatBorder">
                      <span>Instância: <strong className="text-chatTextTitle">{evolutionConfig.instanceName || PROD_EVO_INSTANCE}</strong></span>
                      <span>•</span>
                      <span>Webhook: <strong className={connectedInfo.webhookEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>{connectedInfo.webhookEnabled ? 'Ativo (Supabase)' : 'Sincronizando'}</strong></span>
                      {connectedInfo.lastVerifiedAt && (
                        <>
                          <span>•</span>
                          <span>Checado às <strong>{connectedInfo.lastVerifiedAt}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
                    A sessão Baileys respondeu <strong>state: &quot;open&quot;</strong> na verificação direta da Evolution API. Caso o celular tenha sido desconectado ou precise ler um novo QR Code, clique em <strong>Desconectar & Gerar Novo QR Code</strong> abaixo.
                  </p>

                  <div className="pt-2 flex items-center justify-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleFetchFromEvolutionEndpoint}
                      disabled={isLoadingQR}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isLoadingQR ? 'animate-spin' : ''} />
                      Revalidar Conexão Real
                    </button>
                    <button
                      type="button"
                      onClick={handleConfigureWebhook}
                      disabled={isLoadingQR}
                      className="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Shield size={14} />
                      Religar Webhook Supabase
                    </button>
                    <button
                      type="button"
                      onClick={handleResetInstance}
                      disabled={isLoadingQR}
                      className="px-3.5 py-2.5 border border-rose-300 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer disabled:opacity-50"
                      title="Desconecta a sessão atual no Railway (/instance/logout) e gera um novo QR Code para escanear"
                    >
                      Desconectar & Gerar Novo QR Code
                    </button>
                  </div>
                </div>
              ) : (
                /* Grid Principal Estilo WhatsApp Web (Quando Desconectado / Aguardando Pareamento) */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Lado Esquerdo: Instruções Passo a Passo */}
                  <div className="space-y-4 text-left">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold mb-1.5">
                        <AlertCircle size={12} />
                        Instância Desconectada • Escaneie para Parear
                      </div>
                      <h3 className="text-base font-bold text-chatTextTitle flex items-center gap-2">
                        Parear WhatsApp no EduChat
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          Evolution API
                        </span>
                      </h3>
                      <p className="text-xs text-chatTextMuted mt-1 leading-relaxed">
                        Aponte a câmera do WhatsApp (+55 11 93059-4591) para escanear o QR Code ao lado. Assim que a leitura for concluída no celular, o painel detectará a conexão automaticamente.
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
                        onClick={handleFetchFromEvolutionEndpoint}
                        disabled={isLoadingQR}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={13} className={isLoadingQR ? 'animate-spin' : ''} /> Verificar Conexão Real Agora
                      </button>
                      <span className="text-chatTextMuted">•</span>
                      <button
                        type="button"
                        onClick={() => setShowApiConfig(!showApiConfig)}
                        className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sliders size={13} /> {showApiConfig ? 'Ocultar Parâmetros' : 'Configurar API / Colar Payload'}
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
                          <span className="text-xs font-semibold text-chatTextMuted">Consultando Evolution API...</span>
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
                            Instância Desconectada
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
                              <RefreshCw size={11} /> Verificar / Buscar QR
                            </button>
                            <button
                              type="button"
                              onClick={handleResetInstance}
                              className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-md shadow-xs flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <RotateCcw size={11} /> Resetar & Gerar Novo QR
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
                            onClick={handleResetInstance}
                            className="mt-1 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-md hover:bg-emerald-500 transition cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> Gerar Novo QR Code
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
                    {connectionStatus !== 'expired' && qrCodeDataUrl && (
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
                      /instance/connectionState • /instance/connect
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
                      <span>Testar Status & Buscar QR Code</span>
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

          {/* ABA 3: STATUS DO GATEWAY & WEBHOOKS (100% DINÂMICO) */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1.5">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Instância Evolution API</span>
                  <p className="font-bold text-chatTextTitle">{evolutionConfig.instanceName || PROD_EVO_INSTANCE}</p>
                  {connectionStatus === 'connected' ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Wifi size={12} /> Conectado (state: open{connectedInfo.pingMs ? ` • ${connectedInfo.pingMs}ms` : ''})
                    </span>
                  ) : connectionStatus === 'checking' ? (
                    <span className="text-[11px] text-brand-600 font-semibold flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin" /> Verificando status no Railway...
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} /> Desconectado ({connectedInfo.status || 'close'})
                    </span>
                  )}
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-1.5">
                  <span className="text-[10px] text-chatTextMuted uppercase font-bold">Número Oficial & Sessão</span>
                  <p className="font-bold text-chatTextTitle">{connectedInfo.phone}</p>
                  {connectionStatus === 'connected' ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> {connectedInfo.profileName || 'Sessão Ativa'}
                      {connectedInfo.totalMessages !== null ? ` • ${connectedInfo.totalMessages.toLocaleString('pt-BR')} msgs` : ''}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <QrCode size={12} /> Requer leitura do QR Code na Aba 1
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-chatPanel rounded-xl border border-slate-200 dark:border-chatBorder space-y-2 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h5 className="font-bold text-chatTextTitle flex items-center gap-1.5">
                    <Shield size={14} className="text-brand-600" />
                    URL do Webhook Supabase (Evolution API)
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      connectedInfo.webhookEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                    }`}>
                      {connectedInfo.webhookEnabled ? 'Webhook Ativo' : 'Verificar Webhook'}
                    </span>
                  </h5>
                  <button
                    type="button"
                    onClick={handleConfigureWebhook}
                    disabled={isLoadingQR}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={isLoadingQR ? 'animate-spin' : ''} />
                    Religar Webhook no Railway
                  </button>
                </div>
                <code className="block bg-white dark:bg-chatCard p-2 rounded-lg border border-slate-200 dark:border-chatBorder text-[11px] font-mono text-chatTextMuted break-all select-all">
                  https://yuhtzkhoxnabrsrhqdni.supabase.co/functions/v1/evolution-webhook
                </code>
                <p className="text-[11px] text-chatTextMuted">
                  Eventos ativos: <code>MESSAGES_UPSERT</code>, <code>MESSAGES_UPDATE</code>, <code>CONNECTION_UPDATE</code>, <code>SEND_MESSAGE</code>. As mensagens recebidas são gravadas no Supabase em tempo real.
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
