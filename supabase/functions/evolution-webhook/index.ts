// =========================================================================
// SUPABASE EDGE FUNCTION: EVOLUTION API WEBHOOK RECEIVER
// Endpoint: /functions/v1/evolution-webhook
// =========================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Contatos pré-cadastrados do EduChat (carteira padrão)
const KNOWN_CONTACTS: Record<string, { id: string; name: string }> = {
  "5511987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "11987654321": { id: "wa-lucas-mendes", name: "Lucas Mendes (Lead MBA)" },
  "5519971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "19971234567": { id: "wa-juliana-rocha", name: "Juliana Rocha (Aluna Pós)" },
  "5521998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
  "21998881122": { id: "wa-carlos-eduardo", name: "Carlos Eduardo (Contato Inédito)" },
  "5511930594591": { id: "wa-5511930594591", name: "Flávio Alexandre Motta" },
  "551130594591": { id: "wa-5511930594591", name: "Flávio Alexandre Motta" },
};

// Normalização canônica do número de WhatsApp (padrão único com 9º dígito móvel)
function canonicalizeWhatsAppPhone(raw?: string | null): string {
  if (!raw) return "";
  let clean = String(raw).split("@")[0].split(":")[0].replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    const ddd = clean.slice(2, 4);
    const last8 = clean.slice(-8);
    return `55${ddd}9${last8}`;
  }
  return clean;
}

function canonicalizeChatId(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (s.startsWith("wa-")) s = s.slice(3);
  const phone = canonicalizeWhatsAppPhone(s);
  return phone ? `wa-${phone}` : (s ? `wa-${s}` : "");
}

// Extração robusta do número de telefone real, tratando o modo LID (Linked ID) do WhatsApp
function extractCleanPhone(remoteJid: string, remoteJidAlt?: string): string {
  let target = "";
  if (remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) {
    target = remoteJidAlt;
  } else if (remoteJid && remoteJid.includes("@s.whatsapp.net")) {
    target = remoteJid;
  } else if (remoteJidAlt) {
    target = remoteJidAlt;
  } else {
    target = remoteJid || "";
  }

  // Remove domínio (@s.whatsapp.net, @lid, @c.us)
  const withoutDomain = target.split("@")[0] || "";
  // Remove sufixo de dispositivo do Baileys/Multi-Device (:1, :24, etc.)
  const phoneOnly = withoutDomain.split(":")[0] || "";
  // Extrai apenas os dígitos
  return phoneOnly.replace(/\D/g, "");
}

// Formatação amigável de telefone brasileiro
function formatPhone(digits: string): string {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return "+55 (" + d.slice(2, 4) + ") " + d.slice(4, 9) + "-" + d.slice(9);
  }
  if (d.length === 12 && d.startsWith("55")) {
    return "+55 (" + d.slice(2, 4) + ") " + d.slice(4, 8) + "-" + d.slice(8);
  }
  if (d.length === 11) {
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }
  if (d.length >= 10) {
    return "+" + d;
  }
  return digits;
}

// Formatação de horário oficial no fuso de São Paulo, Brasil (America/Sao_Paulo, UTC-3)
function formatSaoPauloTime(dateOrTimestamp?: any): string {
  try {
    let ms: number;
    if (!dateOrTimestamp) {
      ms = Date.now();
    } else if (dateOrTimestamp instanceof Date) {
      ms = dateOrTimestamp.getTime();
    } else if (typeof dateOrTimestamp === "number") {
      ms = dateOrTimestamp > 1e11 ? dateOrTimestamp : dateOrTimestamp * 1000;
    } else if (typeof dateOrTimestamp === "string" && !isNaN(Number(dateOrTimestamp))) {
      const num = Number(dateOrTimestamp);
      ms = num > 1e11 ? num : num * 1000;
    } else {
      const parsed = new Date(dateOrTimestamp).getTime();
      ms = isNaN(parsed) ? Date.now() : parsed;
    }

    // Offset estrito de São Paulo, Brasil: UTC-3 permanente (-3 horas = -10.800.000 ms)
    const spDate = new Date(ms - (3 * 3600 * 1000));
    const hours = String(spDate.getUTCHours()).padStart(2, "0");
    const minutes = String(spDate.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch (_e) {
    const d = new Date(Date.now() - (3 * 3600 * 1000));
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  }
}

// Conversão precisa para o fuso de Brasília (America/Sao_Paulo, UTC-3)
// e cálculo se a mensagem chegou fora do expediente (19:00 ou mais, antes das 08:00 ou fim de semana)
function getBrasiliaTime(dateOrTimestamp?: any): {
  hour: number;
  minute: number;
  weekday: string;
  isAfterHours: boolean;
  timeStr: string;
} {
  let date: Date;
  if (!dateOrTimestamp) {
    date = new Date();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else if (typeof dateOrTimestamp === "number") {
    date = new Date(dateOrTimestamp > 1e11 ? dateOrTimestamp : dateOrTimestamp * 1000);
  } else if (typeof dateOrTimestamp === "string" && !isNaN(Number(dateOrTimestamp))) {
    const num = Number(dateOrTimestamp);
    date = new Date(num > 1e11 ? num : num * 1000);
  } else {
    date = new Date(dateOrTimestamp);
    if (isNaN(date.getTime())) date = new Date();
  }

  try {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(date);
    let hour = 0;
    let minute = 0;
    let weekday = "";
    for (const p of parts) {
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = parseInt(p.value, 10);
      if (p.type === "weekday") weekday = p.value;
    }
    const isWeekend =
      weekday.toLowerCase().startsWith("sáb") ||
      weekday.toLowerCase().startsWith("dom") ||
      weekday.toLowerCase().startsWith("sat") ||
      weekday.toLowerCase().startsWith("sun");
    // REGRA 1: Fora de expediente = 19:00 ou mais (hour >= 19), antes das 08:00 (hour < 8) ou fim de semana
    const isAfterHours = hour >= 19 || hour < 8 || isWeekend;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { hour, minute, weekday, isAfterHours, timeStr };
  } catch (_e) {
    const spMs = date.getTime() - (3 * 3600 * 1000);
    const spDate = new Date(spMs);
    const hour = spDate.getUTCHours();
    const minute = spDate.getUTCMinutes();
    const day = spDate.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isAfterHours = hour >= 19 || hour < 8 || isWeekend;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { hour, minute, weekday: "", isAfterHours, timeStr };
  }
}

// Normalizador universal de mensagens recebidas de qualquer formato da Evolution API v2
function extractRawMessages(body: any): any[] {
  if (!body) return [];

  // Shape 1: body.data é um array de mensagens
  if (Array.isArray(body.data)) {
    return body.data;
  }

  // Shape 2: body.data.messages é um array (Baileys notify)
  if (body.data && Array.isArray(body.data.messages)) {
    return body.data.messages;
  }

  // Shape 3: body.messages é um array
  if (Array.isArray(body.messages)) {
    return body.messages;
  }

  // Shape 4: body.data é um objeto com key ou message
  if (body.data && typeof body.data === "object" && (body.data.key || body.data.message || body.data.id)) {
    return [body.data];
  }

  // Shape 5: body diretamente é um objeto de mensagem com key ou message
  if (body.key || body.message) {
    return [body];
  }

  // Shape 6: body.data é um objeto genérico não vazio
  if (body.data && typeof body.data === "object" && Object.keys(body.data).length > 0) {
    return [body.data];
  }

  return [];
}

// Desembrulha containers do Baileys/WhatsApp Web (ephemeral, viewOnce, documentWithCaption, etc.)
function unwrapBaileysMessage(rawMsg: any): any {
  if (!rawMsg) return {};
  let msg = rawMsg;
  if (typeof msg === "string") {
    try {
      msg = JSON.parse(msg);
    } catch {
      return { conversation: msg };
    }
  }

  // Desempacota camadas aninhadas comuns do WhatsApp Web / Baileys
  for (let i = 0; i < 6; i++) {
    if (msg?.ephemeralMessage?.message) {
      msg = msg.ephemeralMessage.message;
    } else if (msg?.viewOnceMessage?.message) {
      msg = msg.viewOnceMessage.message;
    } else if (msg?.viewOnceMessageV2?.message) {
      msg = msg.viewOnceMessageV2.message;
    } else if (msg?.viewOnceMessageV2Extension?.message) {
      msg = msg.viewOnceMessageV2Extension.message;
    } else if (msg?.documentWithCaptionMessage?.message) {
      msg = msg.documentWithCaptionMessage.message;
    } else if (msg?.message && typeof msg.message === "object") {
      msg = msg.message;
    } else {
      break;
    }
  }
  return msg;
}

// Extrator universal de conteúdo textual e mídia do WhatsApp
function extractMessageContent(
  rawMsg: any,
  rawItem?: any,
  bodyContext?: any
): { text: string; isAudio: boolean; isMedia: boolean; audioUrl?: string; duration?: string } {
  // Desembrulha mensagem e camadas
  const msg = unwrapBaileysMessage(rawMsg);
  const item = rawItem || {};

  // =========================================================================
  // 1. MAPEAMENTO DE TEXTO NA ORDEM ESTRITA DE PRIORIDADE (Item 1)
  // =========================================================================

  // a) message.conversation (texto simples)
  const convText =
    (typeof msg?.conversation === "string" && msg.conversation.trim()) ||
    (typeof item?.conversation === "string" && item.conversation.trim()) ||
    (typeof item?.message?.conversation === "string" && item.message.conversation.trim());

  if (convText) {
    return { text: convText, isAudio: false, isMedia: false };
  }

  // b) message.extendedTextMessage.text (texto em resposta a outra mensagem ou com link)
  const extendedText =
    (typeof msg?.extendedTextMessage?.text === "string" && msg.extendedTextMessage.text.trim()) ||
    (typeof item?.extendedTextMessage?.text === "string" && item.extendedTextMessage.text.trim()) ||
    (typeof item?.message?.extendedTextMessage?.text === "string" && item.message.extendedTextMessage.text.trim()) ||
    (typeof msg?.extendedTextMessage?.description === "string" && msg.extendedTextMessage.description.trim());

  if (extendedText) {
    return { text: extendedText, isAudio: false, isMedia: false };
  }

  // c) message.imageMessage.caption / message.videoMessage.caption / documentMessage.caption (texto em legendas de mídia)
  const imageCaption =
    (typeof msg?.imageMessage?.caption === "string" && msg.imageMessage.caption.trim()) ||
    (typeof item?.imageMessage?.caption === "string" && item.imageMessage.caption.trim()) ||
    (typeof item?.caption === "string" && (msg?.imageMessage || item?.messageType === "imageMessage") && item.caption.trim());

  const videoCaption =
    (typeof msg?.videoMessage?.caption === "string" && msg.videoMessage.caption.trim()) ||
    (typeof item?.videoMessage?.caption === "string" && item.videoMessage.caption.trim()) ||
    (typeof item?.caption === "string" && (msg?.videoMessage || item?.messageType === "videoMessage") && item.caption.trim());

  const docCaption =
    (typeof msg?.documentMessage?.caption === "string" && msg.documentMessage.caption.trim()) ||
    (typeof msg?.documentWithCaptionMessage?.message?.documentMessage?.caption === "string" && msg.documentWithCaptionMessage.message.documentMessage.caption.trim()) ||
    (typeof item?.documentMessage?.caption === "string" && item.documentMessage.caption.trim());

  // d) Respostas de botões, listas e enquetes
  const buttonText =
    (typeof msg?.buttonsResponseMessage?.selectedDisplayText === "string" && msg.buttonsResponseMessage.selectedDisplayText.trim()) ||
    (typeof msg?.templateButtonReplyMessage?.selectedDisplayText === "string" && msg.templateButtonReplyMessage.selectedDisplayText.trim()) ||
    (typeof msg?.listResponseMessage?.title === "string" && msg.listResponseMessage.title.trim()) ||
    (typeof msg?.interactiveResponseMessage?.body?.text === "string" && msg.interactiveResponseMessage.body.text.trim());

  if (buttonText) {
    return { text: buttonText, isAudio: false, isMedia: false };
  }

  // e) Reações a mensagens
  if (msg?.reactionMessage?.text) {
    return { text: `[Reação: ${msg.reactionMessage.text}]`, isAudio: false, isMedia: false };
  }

  // f) Contato Compartilhado
  if (msg?.contactMessage?.displayName) {
    return { text: `👤 Contato compartilhado: ${msg.contactMessage.displayName}`, isAudio: false, isMedia: false };
  }
  if (msg?.contactsArrayMessage) {
    return { text: "👥 [Contatos compartilhados]", isAudio: false, isMedia: false };
  }

  // g) Localização
  if (msg?.locationMessage || msg?.liveLocationMessage) {
    return { text: "📍 Localização compartilhada", isAudio: false, isMedia: false };
  }

  // =========================================================================
  // 2. TRATAMENTO DE MÍDIAS (Item 2)
  // Se for estritamente áudio, figurinha, imagem ou documento sem texto,
  // grava algo descritivo como "🎵 Áudio recebido", "🖼️ Imagem recebida" ou "📄 Documento recebido"
  // =========================================================================

  // 1. ÁUDIO (Push-to-Talk / gravação de voz ou arquivo de áudio)
  const isAudioType = Boolean(
    msg?.audioMessage ||
    item?.messageType === "audioMessage" ||
    item?.mediaType === "audio" ||
    item?.isAudio
  );

  if (isAudioType) {
    const audio = msg?.audioMessage || item?.audioMessage || {};
    const rawAudioUrl = audio.url || audio.mediaUrl || item?.mediaUrl || item?.url || "";
    const rawBase64 = audio.base64 || item?.base64 || "";
    const mimetype = audio.mimetype || "audio/ogg; codecs=opus";
    const seconds = Number(audio.seconds || item?.seconds || 14);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const duration = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    let dataUrl = "";
    if (rawBase64) {
      dataUrl = rawBase64.startsWith("data:") ? rawBase64 : `data:${mimetype};base64,${rawBase64}`;
    } else if (rawAudioUrl) {
      dataUrl = rawAudioUrl;
    }

    let messageText = "🎵 Áudio recebido";
    if (dataUrl) {
      const attachmentPayload = JSON.stringify({
        name: `audio_${Date.now()}.ogg`,
        type: mimetype,
        dataUrl: dataUrl,
        duration: duration,
        isAudio: true
      });
      messageText += `\n[ARQUIVO_ANEXO:${attachmentPayload}]`;
      messageText += `\n<!-- AUDIO_URL:${dataUrl} -->`;
    }
    messageText += `\n<!-- IS_AUDIO:true -->`;

    const transcription = audio.transcription || audio.transcript || item?.transcription || "";
    if (transcription) {
      messageText += `\n[ÁUDIO_TRANSCRIÇÃO: "${transcription}"]`;
    }

    return {
      text: messageText,
      isAudio: true,
      isMedia: true,
      audioUrl: dataUrl,
      duration: duration
    };
  }

  // 2. FIGURINHA (Sticker)
  const isSticker = Boolean(
    msg?.stickerMessage ||
    item?.messageType === "stickerMessage" ||
    item?.mediaType === "sticker"
  );

  if (isSticker) {
    const stk = msg?.stickerMessage || item?.stickerMessage || {};
    const stkUrl = stk.url || stk.mediaUrl || item?.mediaUrl || item?.url || "";
    const stkBase64 = stk.base64 || item?.base64 || "";
    const mimetype = stk.mimetype || "image/webp";
    let dataUrl = stkUrl;
    if (stkBase64) {
      dataUrl = stkBase64.startsWith("data:") ? stkBase64 : `data:${mimetype};base64,${stkBase64}`;
    }
    let messageText = "💟 Figurinha recebida";
    if (dataUrl) {
      messageText += `\n[ARQUIVO_ANEXO:${JSON.stringify({ name: "sticker.webp", type: mimetype, dataUrl })}]`;
    }
    return { text: messageText, isAudio: false, isMedia: true };
  }

  // 3. IMAGEM
  const isImageType = Boolean(
    msg?.imageMessage ||
    item?.messageType === "imageMessage" ||
    item?.mediaType === "image"
  );

  if (isImageType) {
    const img = msg?.imageMessage || item?.imageMessage || {};
    const imgUrl = img.url || img.mediaUrl || item?.mediaUrl || item?.url || "";
    const base64 = img.base64 || item?.base64 || "";
    const mimetype = img.mimetype || "image/jpeg";
    let dataUrl = imgUrl;
    if (base64) {
      dataUrl = base64.startsWith("data:") ? base64 : `data:${mimetype};base64,${base64}`;
    }

    // Se tem legenda, usa a legenda; caso contrário usa "🖼️ Imagem recebida"
    let text = imageCaption ? imageCaption : "🖼️ Imagem recebida";
    if (dataUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({ name: "imagem.jpg", type: mimetype, dataUrl })}]`;
    }
    return { text, isAudio: false, isMedia: true };
  }

  // 4. VÍDEO
  const isVideoType = Boolean(
    msg?.videoMessage ||
    item?.messageType === "videoMessage" ||
    item?.mediaType === "video"
  );

  if (isVideoType) {
    const vid = msg?.videoMessage || item?.videoMessage || {};
    const vidUrl = vid.url || vid.mediaUrl || item?.mediaUrl || item?.url || "";
    const mimetype = vid.mimetype || "video/mp4";

    let text = videoCaption ? videoCaption : "🎥 Vídeo recebido";
    if (vidUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({ name: "video.mp4", type: mimetype, dataUrl: vidUrl })}]`;
    }
    return { text, isAudio: false, isMedia: true };
  }

  // 5. DOCUMENTO
  const isDocType = Boolean(
    msg?.documentMessage ||
    msg?.documentWithCaptionMessage ||
    item?.messageType === "documentMessage" ||
    item?.mediaType === "document"
  );

  if (isDocType) {
    const doc = msg?.documentMessage || msg?.documentWithCaptionMessage?.message?.documentMessage || item?.documentMessage || {};
    const fileName = doc.fileName || doc.title || item?.fileName || "";
    const docUrl = doc.url || doc.mediaUrl || item?.mediaUrl || item?.url || "";
    const mimetype = doc.mimetype || "application/pdf";

    let text = docCaption
      ? docCaption
      : (fileName ? `📄 Documento recebido: ${fileName}` : "📄 Documento recebido");

    if (docUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({ name: fileName || "documento.pdf", type: mimetype, dataUrl: docUrl })}]`;
    }
    return { text, isAudio: false, isMedia: true };
  }

  // =========================================================================
  // 3. FALLBACKS DE TEXTO GERAL DA EVOLUTION API (body, text, content)
  // =========================================================================
  const generalText =
    (typeof item?.text === "string" && item.text.trim()) ||
    (typeof item?.body === "string" && item.body.trim()) ||
    (typeof item?.content === "string" && item.content.trim()) ||
    (typeof bodyContext?.data?.text === "string" && bodyContext.data.text.trim()) ||
    (typeof bodyContext?.data?.body === "string" && bodyContext.data.body.trim()) ||
    (typeof bodyContext?.data?.content === "string" && bodyContext.data.content.trim());

  if (generalText) {
    return { text: generalText, isAudio: false, isMedia: false };
  }

  if (typeof msg === "string" && msg.trim()) {
    return { text: msg.trim(), isAudio: false, isMedia: false };
  }

  return { text: "💬 Mensagem recebida", isAudio: false, isMedia: false };
}

Deno.serve(async (req: Request) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Healthcheck simples via GET
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "active",
        service: "EduChat Evolution API Webhook Receiver",
        timestamp: new Date().toISOString(),
        version: "2.1",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Payload JSON inválido ou vazio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // LOGS DETALHADOS NO PAINEL DO SUPABASE (Item 2)
    // Permite inspecionar linha a linha na aba "Edge Functions -> Logs"
    // =========================================================================
    console.log("================================================================");
    console.log("📥 [Evolution Webhook] Nova requisição recebida: " + formatSaoPauloTime() + " (SP) | " + new Date().toISOString() + " (UTC)");
    console.log("🏷️ Evento bruto: " + String(body?.event) + " | Instância: " + String(body?.instance));

    const eventName = String(body?.event || "").toUpperCase();

    // Filtra eventos que não envolvam mensagem
    if (eventName.includes("CONNECTION") || eventName.includes("QRCODE")) {
      console.log("ℹ️ Evento de estado de conexão ignorado para inserção de mensagens: " + eventName);
      return new Response(
        JSON.stringify({ success: true, message: "Evento " + eventName + " recebido com sucesso." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicialização do cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yuhtzkhoxnabrsrhqdni.supabase.co";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "sb_publishable_A54HdxBc1e2vqNBNHYkXFg_4VRXvqrp";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Extração robusta da lista de mensagens
    const rawMessages = extractRawMessages(body);
    console.log("📋 [Etapa 1] Mensagens extraídas do payload: " + rawMessages.length + " item(ns)");

    if (rawMessages.length === 0) {
      console.log("⚠️ Nenhuma mensagem identificada no pacote recebido.");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma mensagem a processar." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedMessages: any[] = [];

    for (const m of rawMessages) {
      const keyObj = m?.key || body?.data?.key || {};
      const remoteJid = String(keyObj.remoteJid || m?.remoteJid || body?.sender || "");
      const remoteJidAlt = String(keyObj.remoteJidAlt || m?.remoteJidAlt || "");

      // Ignora broadcast e stories
      if (remoteJid.includes("broadcast") || remoteJid.includes("@status")) {
        console.log("ℹ️ Ignorando transmissão de status/story: " + remoteJid);
        continue;
      }

      const fromMe = Boolean(
        keyObj.fromMe === true ||
        String(keyObj.fromMe) === "true" ||
        m?.fromMe === true ||
        String(m?.fromMe) === "true" ||
        body?.data?.fromMe === true ||
        String(body?.data?.fromMe) === "true"
      );
      const isGroup = Boolean(
        remoteJid.endsWith("@g.us") ||
        remoteJidAlt.endsWith("@g.us") ||
        remoteJid.includes("-") ||
        Boolean(keyObj.participant) ||
        Boolean(m?.participant) ||
        Boolean(m?.isGroup) ||
        Boolean(body?.data?.isGroup)
      );
      const rawPhone = extractCleanPhone(remoteJid, remoteJidAlt);
      const cleanPhone = canonicalizeWhatsAppPhone(rawPhone || remoteJid);

      // Mapeamento do Chat ID canônico único
      const known = cleanPhone ? KNOWN_CONTACTS[cleanPhone] : null;
      let chatId = "";
      if (known) {
        chatId = known.id;
      } else if (cleanPhone) {
        chatId = canonicalizeChatId(cleanPhone);
      } else {
        chatId = canonicalizeChatId(remoteJid) || "wa-desconhecido";
      }

      // Nome do remetente
      let senderId = "";
      let senderName = "";

      if (fromMe) {
        senderId = "u_matriz";
        senderName = "EduChat Matriz (Oficial)";
      } else {
        senderId = chatId;
        const pushName = String(m?.pushName || body?.data?.pushName || body?.pushName || "").trim();
        senderName = pushName || (known ? known.name : (cleanPhone ? "Lead " + formatPhone(cleanPhone) : "Lead WhatsApp"));
      }

      const isBotOrSystem = Boolean(
        fromMe ||
        senderId === "u_matriz" ||
        senderId === "u_ia_copilot" ||
        senderId === "bot" ||
        senderId === "system" ||
        senderId.startsWith("u_") ||
        String(senderName).toLowerCase().includes("assistente ia") ||
        String(senderName).toLowerCase().includes("educhat") ||
        String(m?.pushName || "").toLowerCase().includes("educhat") ||
        String(m?.pushName || "").toLowerCase().includes("assistente ia")
      );

      // Conteúdo da mensagem com unwrap completo e prioridades
      const content = extractMessageContent(m?.message || m, m, body);
      const messageText = content.text;

      // Horário formatado estritamente no fuso oficial de São Paulo (America/Sao_Paulo)
      const timeStr = formatSaoPauloTime(m?.messageTimestamp || body?.data?.messageTimestamp || Date.now());
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const rawId = keyObj.id || m?.id;
      const rawIdStr = rawId ? String(rawId) : "";
      const messageId = rawIdStr ? (rawIdStr.startsWith("wa_") ? rawIdStr : "wa_" + rawIdStr) : "wa_in_" + Date.now() + "_" + randomSuffix;

      // =========================================================================
      // TRATAMENTO DE ATUALIZAÇÃO DE STATUS (MESSAGES_UPDATE: sent -> delivered -> read)
      // =========================================================================
      if (eventName.includes("UPDATE") || m?.update) {
        const updateStatusNum = Number(m?.update?.status ?? body?.data?.update?.status ?? m?.status ?? 0);
        let newStatus = "";
        if (updateStatusNum >= 4) newStatus = "read";
        else if (updateStatusNum >= 3) newStatus = "delivered";
        else if (updateStatusNum >= 2) newStatus = "sent";

        if (newStatus && messageId) {
          const { data: targetMsg } = await supabase
            .from("messages")
            .select("id, text")
            .eq("id", messageId)
            .maybeSingle();

          if (targetMsg) {
            let updatedText = targetMsg.text || "";
            if (updatedText.includes("<!-- STATUS:")) {
              updatedText = updatedText.replace(/<!-- STATUS:[^\s>]+ -->/g, `<!-- STATUS:${newStatus} -->`);
            } else {
              updatedText = `${updatedText}\n<!-- STATUS:${newStatus} -->`;
            }
            await supabase.from("messages").update({ text: updatedText }).eq("id", messageId);
            console.log(`✅ [Evolution Webhook] Status da mensagem ${messageId} atualizado para ${newStatus}`);
          }
        }
        continue;
      }

      // =========================================================================
      // DEDUPLICAÇÃO DE MENSAGENS ENVIADAS (ECHO DO WEBHOOK fromMe: true)
      // =========================================================================
      if (fromMe) {
        // 1. Tenta achar pelo id exato
        let { data: existingMsg } = await supabase
          .from("messages")
          .select("id, text, sender_id, sender_name, timestamp")
          .eq("id", messageId)
          .maybeSingle();

        // 2. Se não achou pelo id exato, verifica se existe mensagem recente enviada no mesmo chat com o mesmo texto
        if (!existingMsg && messageText) {
          const cleanIncoming = messageText
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, "")
            .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, "")
            .trim();

          if (cleanIncoming) {
            const { data: candidateMsgs } = await supabase
              .from("messages")
              .select("id, text, sender_id, sender_name, timestamp")
              .eq("chat_id", chatId)
              .order("created_at", { ascending: false })
              .limit(5);

            if (candidateMsgs && candidateMsgs.length > 0) {
              existingMsg = candidateMsgs.find((cm: any) => {
                const cleanCm = (cm.text || "")
                  .replace(/<!--[\s\S]*?-->/g, "")
                  .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, "")
                  .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, "")
                  .trim();
                return cleanCm === cleanIncoming;
              }) || null;
            }
          }
        }

        if (existingMsg) {
          console.log(`ℹ️ [Evolution Webhook] Mensagem enviada ${messageId} já existe no banco (${existingMsg.id}). Atualizando apenas status para delivered...`);
          let updatedText = existingMsg.text || "";
          if (updatedText.includes("<!-- STATUS:")) {
            updatedText = updatedText.replace(/<!-- STATUS:[^\s>]+ -->/g, "<!-- STATUS:delivered -->");
          } else {
            updatedText = `${updatedText}\n<!-- STATUS:delivered -->`;
          }

          if (existingMsg.id !== messageId) {
            await supabase
              .from("messages")
              .update({ id: messageId, text: updatedText })
              .eq("id", existingMsg.id);
          } else {
            await supabase
              .from("messages")
              .update({ text: updatedText })
              .eq("id", messageId);
          }

          insertedMessages.push({ id: messageId, status: "delivered", updated: true });
          continue; // Pula a inserção para NUNCA criar nova linha no banco!
        }
      }

      // =========================================================================
      // LOGS DETALHADOS DE CADA ETAPA DA EXTRAÇÃO (Item 2)
      // =========================================================================
      console.log("🔍 [Etapa 2 - Extração de Identificadores]:", {
        remoteJid: remoteJid,
        remoteJidAlt: remoteJidAlt,
        rawPhone: rawPhone,
        cleanPhone: cleanPhone,
        chatId: chatId,
        fromMe: fromMe,
        senderName: senderName,
      });

      console.log("📝 [Etapa 3 - Conteúdo da Mensagem]:", {
        messageId: messageId,
        messageType: m?.messageType || typeof m?.message,
        messageText: messageText.length > 70 ? messageText.slice(0, 67) + "..." : messageText,
        isAudio: content.isAudio,
        isMedia: content.isMedia,
        timeFormattedSP: timeStr,
      });

      let textToInsert = messageText;
      if (fromMe && !textToInsert.includes("<!-- STATUS:")) {
        textToInsert = `${textToInsert}\n<!-- STATUS:delivered -->`;
      }

      // 4. Inserção / Upsert idempotente na tabela 'messages' do EduChat
      const insertPayload = {
        id: messageId,
        chat_id: chatId,
        sender_id: senderId,
        sender_name: senderName,
        text: textToInsert,
        timestamp: timeStr,
      };

      console.log("💾 [Etapa 4 - Gravando no Supabase (public.messages)]:", insertPayload);

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .upsert([insertPayload], { onConflict: "id" })
        .select();

      if (insertError) {
        console.error("❌ Erro ao gravar mensagem no Supabase:", insertError);
      } else {
        console.log("✅ [Supabase] Mensagem gravada/atualizada com sucesso! ID: " + messageId + " | Chat: " + chatId);
        insertedMessages.push(inserted && inserted[0] ? inserted[0] : { id: messageId });
      }

      // Atualiza tabela de conversas/chats (last_message e updated_at) se existir no Supabase
      try {
        await supabase
          .from("chats")
          .upsert([
            {
              id: chatId,
              phone: cleanPhone,
              last_message: messageText.length > 250 ? messageText.slice(0, 247) + "..." : messageText,
              updated_at: new Date().toISOString(),
            }
          ], { onConflict: "id" });
      } catch (_cErr) {
        // Ignora silenciosamente se a tabela 'chats' não existir no banco
      }

      // =========================================================================
      // ETAPA 5: DECISÃO DE ATENDIMENTO IA (HORÁRIO DE EXPEDIENTE)
      // =========================================================================
      // 1. BLOQUEIO ABSOLUTO DE AUTO-RESPOSTA (IGNORAR FROM_ME, GRUPOS E BOTS):
      // O gatilho que aciona o Google Gemini NUNCA deve ser disparado se a mensagem
      // recebida pelo webhook for do próprio sistema (fromMe === true), grupo (isGroup)
      // ou se o autor for bot/sistema (u_matriz, u_ia_copilot, etc).
      if (fromMe || isGroup || isBotOrSystem) {
        console.log(`🛑 [Decisão Webhook] Auto-resposta bloqueada: Mensagem de sistema/fromMe/grupo/bot não aciona IA (fromMe: ${fromMe}, isGroup: ${isGroup}, senderId: ${senderId}).`);
        continue;
      }

      const timeInfo = getBrasiliaTime(m?.messageTimestamp || Date.now());

      // LOGS DE DIAGNÓSTICO OBRIGATÓRIOS (Item 3)
      if (!timeInfo.isAfterHours) {
        console.log(`⏸️ [Decisão Webhook] Horário Comercial: IA pausada (Hora Brasília: ${timeInfo.timeStr})`);
      } else {
        console.log(`🤖 [Decisão Webhook] Fora de Expediente: IA assumindo (Hora Brasília: ${timeInfo.timeStr})`);
      }

      // REGRA 2: A IA assume a conversa independentemente do número que envia a mensagem de teste,
      // a menos que a conversa já esteja vinculada e "Aberta" por um colaborador humano.
      let isHumanOpen = false;
      try {
        const { data: recentHumanMsgs } = await supabase
          .from("messages")
          .select("sender_id, created_at")
          .eq("chat_id", chatId)
          .not("sender_id", "in", `("${chatId}","u_ia_copilot","bot","bot_ura","bot_retencao","system")`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (recentHumanMsgs && recentHumanMsgs.length > 0) {
          const lastHumanTime = new Date(recentHumanMsgs[0].created_at).getTime();
          // Aberta se humano atendeu nos últimos 20 minutos
          if (Date.now() - lastHumanTime < 20 * 60 * 1000) {
            isHumanOpen = true;
            console.log(`👤 [Decisão Webhook] Conversa com atendimento humano recente: IA não intervirá.`);
          }
        }
      } catch (_err) {
        isHumanOpen = false;
      }

      if (timeInfo.isAfterHours && !isHumanOpen) {
        console.log(`✨ [Decisão Webhook] Fora de Expediente: IA disparando resposta para ${senderName} (${cleanPhone || remoteJid})`);

        const evoUrl = Deno.env.get("EVOLUTION_API_URL") || "https://evolution-api-production-3fb2.up.railway.app";
        const evoKey = Deno.env.get("EVOLUTION_API_KEY") || "e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f";
        const evoInstance = Deno.env.get("EVOLUTION_INSTANCE") || "EduChat-Matriz-01";

        let aiReplyText = `Olá, ${senderName}! Nosso horário de atendimento comercial encerrou-se às 19h.\n\nEu sou o Assistente IA de Plantão do EduChat e assumi seu atendimento para não deixar você esperando! 🌙\n\nComo posso te ajudar agora? (Você pode tirar dúvidas sobre cursos, matrículas, notas fiscais ou deixar uma solicitação para a equipe amanhecer com ela pronta).`;

        const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
        if (geminiApiKey && messageText) {
          try {
            const gPrompt = `Você é o Assistente Virtual Oficial do EduChat (Faculdade Olavo Bilac • Grupo EstudeMais).
Horário atual em Brasília: ${timeInfo.timeStr} (Fora do expediente comercial de 08h às 19h).
Aja com cordialidade e acolhimento. Informe gentilmente que o atendimento dos consultores humanos encerrou-se às 19h, mas que você assumiu o atendimento de plantão para ajudar imediatamente.
Responda de forma clara e objetiva à mensagem do aluno/lead:
"${messageText}"`;

            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: gPrompt }] }],
                generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
              })
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              const gen = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (gen) aiReplyText = gen.trim();
            }
          } catch (gemErr) {
            console.warn("Aviso ao gerar resposta Gemini no Webhook:", gemErr);
          }
        }

        // Dispara a mensagem via Evolution API de volta para o WhatsApp
        const targetNumber = cleanPhone || remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
        let evoSentId = "";
        if (targetNumber) {
          try {
            const sendRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evoKey
              },
              body: JSON.stringify({
                number: targetNumber,
                text: aiReplyText
              })
            });
            if (sendRes.ok) {
              const sendData = await sendRes.json().catch(() => ({}));
              evoSentId = sendData?.key?.id || sendData?.id || sendData?.messageId || (Array.isArray(sendData) && sendData[0]?.key?.id) || "";
            }
            console.log(`📤 [Evolution Webhook] Resposta IA enviada via WhatsApp para ${targetNumber} (Status ${sendRes.status}, ID: ${evoSentId})`);
          } catch (sErr) {
            console.warn("Erro ao disparar WhatsApp na Evolution API:", sErr);
          }
        }

        // =========================================================================
        // 2. REGISTRO ÚNICO (FIM DA CAIXA AMARELA):
        // Registra no banco de dados APENAS UMA VEZ como mensagem ENVIADA pelo sistema
        // (sender_id: 'u_matriz', status: delivered -> renderiza como balão verde no lado direito).
        // NUNCA inserir como remetente 'u_ia_copilot' simulando mensagem recebida!
        // =========================================================================
        const botId = evoSentId ? (evoSentId.startsWith("wa_") ? evoSentId : "wa_" + evoSentId) : "wa_ia_" + Date.now();
        const aiMessagePayload = {
          id: botId,
          chat_id: chatId,
          sender_id: "u_matriz",
          sender_name: "EduChat Matriz (Assistente IA)",
          text: `${aiReplyText}\n<!-- STATUS:delivered -->`,
          timestamp: timeInfo.timeStr
        };

        const { error: aiInsertErr } = await supabase
          .from("messages")
          .upsert([aiMessagePayload], { onConflict: "id" });

        if (aiInsertErr) {
          console.error("❌ Erro ao registrar resposta da IA no Supabase:", aiInsertErr);
        } else {
          console.log(`✅ [Supabase] Resposta IA registrada como mensagem ENVIADA única: ${botId}`);
          insertedMessages.push(aiMessagePayload);
        }

        // Atualiza last_message na conversa
        try {
          await supabase.from("chats").upsert([
            {
              id: chatId,
              phone: cleanPhone,
              last_message: aiReplyText.length > 250 ? aiReplyText.slice(0, 247) + "..." : aiReplyText,
              updated_at: new Date().toISOString()
            }
          ], { onConflict: "id" });
        } catch (_cErr) {}
      }
    }

    console.log("🎉 [Etapa 6 - Conclusão]: " + insertedMessages.length + " mensagem(ns) persistida(s).");
    console.log("================================================================");

    return new Response(
      JSON.stringify({
        success: true,
        processed: rawMessages.length,
        insertedCount: insertedMessages.length,
        messages: insertedMessages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("🔥 [Evolution Webhook] Falha crítica de processamento:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Erro interno ao processar webhook.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
