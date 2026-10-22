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
  "556696354155": { id: "wa-556696354155", name: "Evyllinn Gomes" },
  "5566996354155": { id: "wa-556696354155", name: "Evyllinn Gomes" },
  "6696354155": { id: "wa-556696354155", name: "Evyllinn Gomes" },
  "152093449003127": { id: "wa-556696354155", name: "Evyllinn Gomes" },
};

// Departamentos e opções da URA
const DEPARTMENTS_INFO: Record<string, { name: string; label: string; num: string; keywords: string[] }> = {
  "1": { name: "Tutoria", label: "Tutoria e Apoio Pedagógico", num: "1️⃣", keywords: ["tutoria", "tutor", "duvida", "aula", "ead", "professor"] },
  "2": { name: "Secretaria", label: "Secretaria Acadêmica e Documentos", num: "2️⃣", keywords: ["secretaria", "documento", "diploma", "certificado", "historico", "declaracao", "certidao"] },
  "3": { name: "Pedagógico", label: "Coordenação Pedagógica", num: "3️⃣", keywords: ["pedagogico", "pedagogica", "coordenacao", "grade", "disciplina", "ementa", "matriz"] },
  "4": { name: "Comercial", label: "Comercial e Novas Matrículas", num: "4️⃣", keywords: ["comercial", "matricula", "curso", "pos", "mba", "graduacao", "valor", "inscricao", "preco", "venda"] },
  "5": { name: "Expansão", label: "Expansão e Polos Parceiros", num: "5️⃣", keywords: ["expansao", "polo", "parceria", "unidade", "convenio"] },
  "6": { name: "Financeiro", label: "Financeiro e Boletos", num: "6️⃣", keywords: ["financeiro", "boleto", "pagamento", "fatura", "acordo", "mensalidade", "segunda via"] },
  "7": { name: "Marketing", label: "Marketing e Comunicação", num: "7️⃣", keywords: ["marketing", "comunicacao", "imprensa", "divulgacao"] },
};

// Base de Colaboradores por Departamento (com suporte ao status is_available)
const BASE_COLLABORATORS = [
  { id: "u1", name: "Flávio Motta", department: "Diretoria", is_available: true },
  { id: "u2", name: "Tatiane Salatinos", department: "Comercial", is_available: true },
  { id: "u3", name: "Gabriel Carvalho", department: "Comercial", is_available: true },
  { id: "u4", name: "Michele Cristina", department: "Comercial", is_available: true },
  { id: "u5", name: "Clarice Oliveira", department: "Comercial", is_available: true },
  { id: "u6", name: "Raquel Lopes", department: "Tutoria", is_available: true },
  { id: "u7", name: "Ana Paula", department: "Secretaria", is_available: true },
  { id: "u8", name: "Larissa Machado", department: "Secretaria", is_available: true },
  { id: "u9", name: "Gislaine Santos", department: "Secretaria", is_available: true },
  { id: "u10", name: "Ana Livia", department: "Marketing", is_available: true },
  { id: "u11", name: "Paulo do Vale", department: "Pedagógico", is_available: true },
  { id: "u12", name: "Luiz Augusto", department: "Expansão", is_available: true },
  { id: "u13", name: "Wagner", department: "Comercial", is_available: true },
  { id: "u14", name: "Yasmin", department: "Marketing", is_available: true },
  { id: "u15", name: "Lindomar", department: "Pedagógico", is_available: true },
];

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

// =========================================================================
// MÉTODOS ROBUSTOS DE DESENCRIPTAÇÃO DE MÍDIA WHATSAPP & STORAGE UPLOAD
// =========================================================================

function getExtensionFromMime(mime: string, defaultExt: string = "bin"): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("aac") || m.includes("m4a")) return "m4a";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("wordprocessingml") || m.includes("docx")) return "docx";
  if (m.includes("msword") || m.includes("doc")) return "doc";
  if (m.includes("spreadsheetml") || m.includes("xlsx")) return "xlsx";
  if (m.includes("ms-excel") || m.includes("xls")) return "xls";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("zip")) return "zip";
  if (m.includes("text/plain")) return "txt";
  return defaultExt;
}

function detectMimeAndExtFromBytes(
  bytes: Uint8Array,
  fallbackMime: string,
  typeCategory: "audio" | "image" | "document" | "video" | "sticker"
): { mimetype: string; ext: string } {
  const len = bytes.length;
  // OGG (OggS): 0x4F 0x67 0x67 0x53
  if (len >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { mimetype: "audio/ogg; codecs=opus", ext: "ogg" };
  }
  // MP3: ID3 (0x49 0x44 0x33) or 0xFF 0xFB / 0xFF 0xF3
  if (len >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { mimetype: "audio/mpeg", ext: "mp3" };
  }
  if (len >= 2 && bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2)) {
    return { mimetype: "audio/mpeg", ext: "mp3" };
  }
  // WAV: RIFF ... WAVE
  if (
    len >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    return { mimetype: "audio/wav", ext: "wav" };
  }
  // JPEG: 0xFF 0xD8 0xFF
  if (len >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mimetype: "image/jpeg", ext: "jpg" };
  }
  // PNG: 0x89 0x50 0x4E 0x47
  if (len >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { mimetype: "image/png", ext: "png" };
  }
  // WEBP: RIFF ... WEBP
  if (
    len >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mimetype: "image/webp", ext: "webp" };
  }
  // GIF: GIF87a or GIF89a
  if (len >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mimetype: "image/gif", ext: "gif" };
  }
  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (len >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimetype: "application/pdf", ext: "pdf" };
  }
  // ZIP / DOCX / XLSX: PK.. (0x50 0x4B 0x03 0x04)
  if (len >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    if (fallbackMime.includes("wordprocessingml") || fallbackMime.includes("docx")) {
      return { mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
    }
    if (fallbackMime.includes("spreadsheetml") || fallbackMime.includes("xlsx")) {
      return { mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
    }
    return { mimetype: "application/zip", ext: "zip" };
  }
  // MP4: ....ftyp
  if (len >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mimetype: "video/mp4", ext: "mp4" };
  }

  // Fallback baseado no fallbackMime
  const cleanMime = fallbackMime || (typeCategory === "audio" ? "audio/ogg; codecs=opus" : typeCategory === "image" ? "image/jpeg" : "application/pdf");
  const ext = getExtensionFromMime(cleanMime, typeCategory === "audio" ? "ogg" : typeCategory === "image" ? "jpg" : "pdf");
  return { mimetype: cleanMime, ext };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "").replace(/[\r\n\s]/g, "");
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Desencripta mensagem de mídia utilizando endpoint oficial da Evolution API (/chat/getBase64FromMediaMessage)
async function fetchDecryptedMediaFromEvolution(
  keyObj: any,
  rawMsg: any,
  rawItem: any,
  evoUrl: string,
  evoKey: string,
  evoInstance: string
): Promise<{ base64?: string; mimetype?: string } | null> {
  try {
    const endpoint = `${evoUrl.replace(/\/+$/, "")}/chat/getBase64FromMediaMessage/${evoInstance}`;
    const fullMessage = {
      key: keyObj,
      message: rawMsg
    };

    console.log(`📡 [Evolution Decrypt] Solicitando base64 desencriptado em: ${endpoint}`);

    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evoKey,
      },
      body: JSON.stringify({
        message: fullMessage,
        convertToMp4: false
      }),
    });

    if (!res.ok && rawItem?.key) {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evoKey,
        },
        body: JSON.stringify({
          message: rawItem,
          convertToMp4: false
        }),
      });
    }

    if (res.ok) {
      const data = await res.json();
      const b64 = data?.base64 || data?.data?.base64 || data?.media?.base64 || (typeof data === "string" ? data : null);
      const mime = data?.mimetype || data?.data?.mimetype || data?.mimeType;
      if (b64 && typeof b64 === "string" && b64.length > 50) {
        console.log(`✅ [Evolution Decrypt] Base64 desencriptado obtido com sucesso! (${b64.length} chars, MIME: ${mime || 'não especificado'})`);
        return { base64: b64, mimetype: mime };
      }
    } else {
      console.warn(`⚠️ [Evolution Decrypt] Resposta não-OK da API (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.warn("⚠️ [Evolution Decrypt] Exceção ao chamar /chat/getBase64FromMediaMessage:", err);
  }
  return null;
}

// Resolução unificada de mídia desencriptada (payload pronto ou busca sob demanda)
async function resolveDecryptedMedia(
  mediaObj: any,
  itemObj: any,
  bodyContext: any,
  rawMsg: any,
  evoConfig?: { url: string; key: string; instance: string }
): Promise<{ base64?: string; mimetype?: string } | null> {
  // 1. Prioridade A: Base64 já entregue no webhook (quando base64: true está configurado na Evolution API)
  const candidateB64 =
    (typeof mediaObj?.base64 === "string" && mediaObj.base64.trim()) ||
    (typeof itemObj?.base64 === "string" && itemObj.base64.trim()) ||
    (typeof rawMsg?.base64 === "string" && rawMsg.base64.trim()) ||
    (typeof bodyContext?.data?.message?.base64 === "string" && bodyContext.data.message.base64.trim()) ||
    (typeof bodyContext?.data?.base64 === "string" && bodyContext.data.base64.trim()) ||
    (typeof bodyContext?.base64 === "string" && bodyContext.base64.trim());

  let mime = mediaObj?.mimetype || itemObj?.mimetype || itemObj?.mediaType;

  if (candidateB64 && candidateB64.length > 50) {
    console.log(`✅ [Media Resolver] Mídia desencriptada detectada diretamente no payload do webhook! (${candidateB64.length} chars)`);
    return { base64: candidateB64, mimetype: mime };
  }

  // 2. Prioridade B: Desencriptação obrigatória sob demanda via Evolution API
  if (evoConfig && evoConfig.url && evoConfig.key && evoConfig.instance) {
    const keyObj = itemObj?.key || bodyContext?.data?.key || {};
    if (keyObj && (keyObj.id || keyObj.remoteJid)) {
      console.log(`🔄 [Media Resolver] Mídia recebida sem base64 direto. Chamando Evolution API para desencriptar...`);
      const fetched = await fetchDecryptedMediaFromEvolution(
        keyObj,
        rawMsg,
        itemObj,
        evoConfig.url,
        evoConfig.key,
        evoConfig.instance
      );
      if (fetched && fetched.base64) {
        return fetched;
      }
    }
  }

  return null;
}

// Upload estrito da mídia desencriptada para o Supabase Storage com nomeação e MIME-TYPE reais
async function uploadDecryptedMediaToStorage(
  supabase: any,
  supabaseUrl: string,
  base64Data: string,
  declaredMime: string,
  chatId: string,
  typeCategory: "audio" | "image" | "document" | "video" | "sticker",
  originalFileName?: string
): Promise<{ publicUrl: string; fileName: string; mimetype: string; size: number } | null> {
  try {
    if (!supabase || !base64Data) return null;
    const bytes = base64ToUint8Array(base64Data);
    if (bytes.length === 0) return null;

    // Detecta o MIME-TYPE real e a extensão examinando os magic bytes do buffer desencriptado
    const { mimetype: realMime, ext } = detectMimeAndExtFromBytes(bytes, declaredMime, typeCategory);
    const bucket = typeCategory === "audio" ? "chat-audios" : "chat-attachments";

    // Nomeação segura do arquivo: remove terminação .enc se existir
    let safeName = originalFileName || `${typeCategory}_${Date.now()}.${ext}`;
    if (safeName.toLowerCase().endsWith(".enc")) {
      safeName = safeName.slice(0, -4);
    }
    // Garante extensão correta
    if (!safeName.toLowerCase().endsWith(`.${ext}`)) {
      const dotIdx = safeName.lastIndexOf(".");
      if (dotIdx !== -1) {
        const oldExt = safeName.substring(dotIdx + 1).toLowerCase();
        if (oldExt === "enc" || oldExt === "bin" || (typeCategory === "audio" && !["ogg", "mp3", "m4a", "wav"].includes(oldExt))) {
          safeName = `${safeName.substring(0, dotIdx)}.${ext}`;
        }
      } else {
        safeName = `${safeName}.${ext}`;
      }
    }

    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storagePath = `whatsapp/${chatId}/${uniquePrefix}_${safeName}`;

    console.log(`📤 [Storage Upload] Gravando arquivo desencriptado no Supabase Storage: ${bucket}/${storagePath} (${bytes.length} bytes, MIME: ${realMime})`);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType: realMime,
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ [Storage Upload] Erro ao gravar mídia no bucket ${bucket}:`, uploadError);
      return null;
    }

    const { data: pubData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const publicUrl = pubData?.publicUrl || `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${storagePath}`;
    console.log(`✅ [Storage Upload] Mídia desencriptada gravada com sucesso! URL pública: ${publicUrl}`);

    return {
      publicUrl,
      fileName: safeName,
      mimetype: realMime,
      size: bytes.length
    };
  } catch (err) {
    console.error("❌ [Storage Upload] Falha no processamento/upload da mídia desencriptada:", err);
    return null;
  }
}

// Extrator universal de conteúdo textual e mídia do WhatsApp
async function extractMessageContent(
  rawMsg: any,
  rawItem?: any,
  bodyContext?: any,
  supabase?: any,
  supabaseUrl?: string,
  chatId?: string,
  evoConfig?: { url: string; key: string; instance: string }
): Promise<{ text: string; isAudio: boolean; isMedia: boolean; audioUrl?: string; duration?: string }> {
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
  // 2. TRATAMENTO DE MÍDIAS COM DESENCRIPTAÇÃO OBRIGATÓRIA & UPLOAD NO STORAGE
  // NUNCA grava arquivos encriptados (.enc) diretamente no Supabase Storage!
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
    const seconds = Number(audio.seconds || item?.seconds || 14);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const duration = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    const transcription = audio.transcription || audio.transcript || item?.transcription || "";

    // 1. Desencripta a mídia obrigatoriamente
    const decrypted = await resolveDecryptedMedia(audio, item, bodyContext, rawMsg, evoConfig);
    let finalAudioUrl = "";

    if (decrypted && decrypted.base64) {
      // 2. Upload para o bucket 'chat-audios' com MIME real
      const uploaded = await uploadDecryptedMediaToStorage(
        supabase,
        supabaseUrl || "https://yuhtzkhoxnabrsrhqdni.supabase.co",
        decrypted.base64,
        decrypted.mimetype || audio.mimetype || "audio/ogg; codecs=opus",
        chatId || "geral",
        "audio",
        "audio.ogg"
      );
      if (uploaded) {
        finalAudioUrl = uploaded.publicUrl;
      }
    }

    let messageText = "🎵 Áudio recebido";
    if (finalAudioUrl) {
      const attachmentPayload = JSON.stringify({
        name: `audio_${Date.now()}.ogg`,
        type: decrypted?.mimetype || "audio/ogg; codecs=opus",
        url: finalAudioUrl,
        dataUrl: finalAudioUrl,
        duration: duration,
        isAudio: true
      });
      messageText += `\n[ARQUIVO_ANEXO:${attachmentPayload}]`;
      messageText += `\n<!-- AUDIO_URL:${finalAudioUrl} -->`;
    }
    messageText += `\n<!-- IS_AUDIO:true -->`;

    if (transcription) {
      messageText += `\n[ÁUDIO_TRANSCRIÇÃO: "${transcription}"]`;
    }

    return {
      text: messageText,
      isAudio: true,
      isMedia: true,
      audioUrl: finalAudioUrl,
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
    const decrypted = await resolveDecryptedMedia(stk, item, bodyContext, rawMsg, evoConfig);
    let finalStkUrl = "";

    if (decrypted && decrypted.base64) {
      const uploaded = await uploadDecryptedMediaToStorage(
        supabase,
        supabaseUrl || "https://yuhtzkhoxnabrsrhqdni.supabase.co",
        decrypted.base64,
        decrypted.mimetype || stk.mimetype || "image/webp",
        chatId || "geral",
        "sticker",
        "sticker.webp"
      );
      if (uploaded) {
        finalStkUrl = uploaded.publicUrl;
      }
    }

    let messageText = "💟 Figurinha recebida";
    if (finalStkUrl) {
      messageText += `\n[ARQUIVO_ANEXO:${JSON.stringify({
        name: "sticker.webp",
        type: decrypted?.mimetype || "image/webp",
        url: finalStkUrl,
        dataUrl: finalStkUrl
      })}]`;
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
    const decrypted = await resolveDecryptedMedia(img, item, bodyContext, rawMsg, evoConfig);
    let finalImageUrl = "";

    if (decrypted && decrypted.base64) {
      const uploaded = await uploadDecryptedMediaToStorage(
        supabase,
        supabaseUrl || "https://yuhtzkhoxnabrsrhqdni.supabase.co",
        decrypted.base64,
        decrypted.mimetype || img.mimetype || "image/jpeg",
        chatId || "geral",
        "image",
        "imagem.jpg"
      );
      if (uploaded) {
        finalImageUrl = uploaded.publicUrl;
      }
    }

    let text = imageCaption ? imageCaption : "🖼️ Imagem recebida";
    if (finalImageUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({
        name: "imagem.jpg",
        type: decrypted?.mimetype || "image/jpeg",
        url: finalImageUrl,
        dataUrl: finalImageUrl,
        isImage: true
      })}]`;
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
    const decrypted = await resolveDecryptedMedia(vid, item, bodyContext, rawMsg, evoConfig);
    let finalVidUrl = "";

    if (decrypted && decrypted.base64) {
      const uploaded = await uploadDecryptedMediaToStorage(
        supabase,
        supabaseUrl || "https://yuhtzkhoxnabrsrhqdni.supabase.co",
        decrypted.base64,
        decrypted.mimetype || vid.mimetype || "video/mp4",
        chatId || "geral",
        "video",
        "video.mp4"
      );
      if (uploaded) {
        finalVidUrl = uploaded.publicUrl;
      }
    }

    let text = videoCaption ? videoCaption : "🎥 Vídeo recebido";
    if (finalVidUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({
        name: "video.mp4",
        type: decrypted?.mimetype || vid.mimetype || "video/mp4",
        url: finalVidUrl,
        dataUrl: finalVidUrl,
        isVideo: true
      })}]`;
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
    const rawFileName = doc.fileName || doc.title || item?.fileName || "documento.pdf";
    const decrypted = await resolveDecryptedMedia(doc, item, bodyContext, rawMsg, evoConfig);
    let finalDocUrl = "";
    let finalDocName = rawFileName;

    if (decrypted && decrypted.base64) {
      const uploaded = await uploadDecryptedMediaToStorage(
        supabase,
        supabaseUrl || "https://yuhtzkhoxnabrsrhqdni.supabase.co",
        decrypted.base64,
        decrypted.mimetype || doc.mimetype || "application/pdf",
        chatId || "geral",
        "document",
        rawFileName
      );
      if (uploaded) {
        finalDocUrl = uploaded.publicUrl;
        finalDocName = uploaded.fileName;
      }
    }

    let text = docCaption
      ? docCaption
      : (finalDocName ? `📄 Documento recebido: ${finalDocName}` : "📄 Documento recebido");

    if (finalDocUrl) {
      text += `\n[ARQUIVO_ANEXO:${JSON.stringify({
        name: finalDocName,
        type: decrypted?.mimetype || doc.mimetype || "application/pdf",
        url: finalDocUrl,
        dataUrl: finalDocUrl,
        isFile: true
      })}]`;
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

  return { text: "", isAudio: false, isMedia: false };
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

    const rawEvent = String(body?.event || "").toLowerCase().replace(/[-_]/g, ".");
    const isNewMessageEvent = rawEvent === "messages.upsert" || rawEvent === "message.upsert";

    // 1. FILTRO RIGOROSO NO WEBHOOK: Apenas mensagens reais entrantes (messages.upsert)
    // IGNORE e retorne 200 OK silenciosamente para eventos de messages.update, ack (recibos de entrega/leitura), presence.update, connection, etc.
    if (!isNewMessageEvent) {
      console.log(`ℹ️ [Evolution Webhook] Evento de status/ack/presença/sistema ignorado silenciosamente: ${body?.event}`);
      return new Response(
        JSON.stringify({ success: true, message: `Evento ${body?.event} ignorado silenciosamente (apenas messages.upsert é persistido).` }),
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

    // Configurações da Evolution API para desencriptação sob demanda e auto-sincronização
    const evoUrl = (Deno.env.get("EVOLUTION_API_URL") || Deno.env.get("VITE_EVOLUTION_API_URL") || "https://evolution-api-production-3fb2.up.railway.app").replace(/\/+$/, "");
    const evoKey = (Deno.env.get("EVOLUTION_API_KEY") || Deno.env.get("VITE_EVOLUTION_API_KEY") || "e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f").trim();
    const evoInstance = String(body?.instance || Deno.env.get("EVOLUTION_INSTANCE") || Deno.env.get("VITE_EVOLUTION_INSTANCE") || "EduChat-Matriz-01").trim();
    const evoConfig = { url: evoUrl, key: evoKey, instance: evoInstance };

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

      // 2. BLOQUEIO DE LOOP (PREVENÇÃO):
      // Mensagens enviadas pela própria instância/API (fromMe: true) não devem ser reinseridas como novas mensagens nem gerar loops
      if (fromMe) {
        console.log("ℹ️ [Evolution Webhook] Ignorando evento com fromMe: true para evitar loops de sistema e mensagens fantasmas.");
        continue;
      }

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
      const pushName = String(m?.pushName || body?.data?.pushName || body?.pushName || "").trim();
      const senderId = chatId;
      const senderName = pushName || (known ? known.name : (cleanPhone ? "Lead " + formatPhone(cleanPhone) : "Lead WhatsApp"));

      // Conteúdo da mensagem com unwrap completo, prioridades e desencriptação obrigatória de mídias
      const content = await extractMessageContent(
        m?.message || m,
        m,
        body,
        supabase,
        supabaseUrl,
        chatId,
        evoConfig
      );
      const messageText = (content.text || "").trim();

      // Descarte estrito de mensagens sem conteúdo real (evita gravar "Mensagem recebida" fantasma)
      if (!messageText || messageText === "💬 Mensagem recebida" || messageText === "Mensagem recebida") {
        console.log("⚠️ [Evolution Webhook] Mensagem sem conteúdo real de texto ou mídia descartada.");
        continue;
      }

      // Horário formatado estritamente no fuso oficial de São Paulo (America/Sao_Paulo)
      const timeStr = formatSaoPauloTime(m?.messageTimestamp || body?.data?.messageTimestamp || Date.now());
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const rawId = keyObj.id || m?.id;
      const rawIdStr = rawId ? String(rawId) : "";
      const messageId = rawIdStr ? (rawIdStr.startsWith("wa_") ? rawIdStr : "wa_" + rawIdStr) : "wa_in_" + Date.now() + "_" + randomSuffix;

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

      // 1. TRAVA DE ATUALIZAÇÃO DE DATA (WEBHOOK):
      // O Webhook SÓ DEVE dar UPDATE no last_message_at ou updated_at de um contato SE, E SOMENTE SE,
      // uma mensagem real de texto/mídia foi inserida com sucesso no banco de dados.
      if (!insertError && inserted && inserted.length > 0 && messageText) {
        try {
          await supabase
            .from("chats")
            .upsert([
              {
                id: chatId,
                phone: cleanPhone,
                last_message: messageText.length > 250 ? messageText.slice(0, 247) + "..." : messageText,
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            ], { onConflict: "id" });
        } catch (_cErr) {
          // Ignora silenciosamente se a tabela 'chats' não existir no banco
        }

        try {
          await supabase
            .from("contacts")
            .update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", chatId);
        } catch (_cErr) {
          // Ignora silenciosamente se a tabela 'contacts' não existir no banco
        }
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

      // =========================================================================
      // ETAPA 5A: ROTEAMENTO SEQUENCIAL URA + ROUND-ROBIN + CONTROLE DE DISPONIBILIDADE
      // REQUISITO: A atribuição de um atendente DEVE ocorrer estritamente APÓS a escolha
      // do departamento na URA. NENHUM atendente é atribuído antes da interação.
      // =========================================================================
      let isAlreadyAssigned = false;
      try {
        const { data: asgnRows } = await supabase
          .from("messages")
          .select("text")
          .eq("chat_id", chatId)
          .like("text", "%<!-- ASSIGNMENT:%")
          .order("created_at", { ascending: false })
          .limit(1);

        if (asgnRows && asgnRows.length > 0) {
          const match = asgnRows[0].text.match(/<!-- ASSIGNMENT:([\s\S]*?) -->/);
          if (match) {
            const parsedAsgn = JSON.parse(match[1]);
            if (parsedAsgn.assigned_to || (parsedAsgn.assignee && !parsedAsgn.assignee.includes("URA") && !parsedAsgn.assignee.includes("Aguardando"))) {
              isAlreadyAssigned = true;
            }
          }
        }
      } catch (_e) {}

      // Se ainda NÃO está atribuído a um atendente, verifica se a mensagem é a ESCOLHA DA URA
      if (!isAlreadyAssigned) {
        const rawLower = (messageText || "").toLowerCase().trim();
        let chosenDeptKey: string | null = null;

        const numMatch = rawLower.match(/\b([1-7])\b/);
        if (numMatch && DEPARTMENTS_INFO[numMatch[1]]) {
          chosenDeptKey = numMatch[1];
        } else {
          for (const [key, d] of Object.entries(DEPARTMENTS_INFO)) {
            if (rawLower.includes(d.name.toLowerCase()) || d.keywords.some((k) => rawLower.includes(k))) {
              chosenDeptKey = key;
              break;
            }
          }
        }

        // CASO 1: O aluno respondeu com a escolha do departamento na URA!
        if (chosenDeptKey) {
          const deptInfo = DEPARTMENTS_INFO[chosenDeptKey];
          console.log(`🎯 [Roteamento URA] Aluno escolheu departamento: ${deptInfo.name}`);

          // 1. Busca mapa de disponibilidade dos usuários no Supabase (sys_user_availability)
          const { data: availRows } = await supabase
            .from("messages")
            .select("text")
            .eq("chat_id", "sys_user_availability");

          const availabilityMap: Record<string, boolean> = {};
          if (Array.isArray(availRows)) {
            for (const r of availRows) {
              try {
                const p = JSON.parse(r.text);
                if (p.userId) availabilityMap[p.userId] = p.is_available;
              } catch {}
            }
          }

          // 2. Colaboradores do departamento escolhido
          const deptUsers = BASE_COLLABORATORS.filter((c) => {
            const cD = c.department.toLowerCase();
            const tD = deptInfo.name.toLowerCase();
            return cD.includes(tD) || tD.includes(cD);
          });

          // 3. Filtra apenas os que estão DISPONÍVEIS (is_available !== false)
          const availableUsers = deptUsers.filter((c) => {
            if (availabilityMap[c.id] !== undefined) return availabilityMap[c.id] === true;
            return c.is_available !== false;
          });

          let assignedCollab: any = null;
          let assignedId: string | null = null;
          let assignedName: string | null = null;

          if (availableUsers.length === 0) {
            // SE TODOS estiverem em pausa: o chat fica assigned_to = null na fila do departamento, aguardando alguém ficar online
            console.log(`⏸️ [Roteamento URA] Todos os consultores de ${deptInfo.name} estão em pausa. Chat permanece na fila (assigned_to = null).`);
            assignedCollab = null;
            assignedId = null;
            assignedName = null;
          } else if (availableUsers.length === 1) {
            // Se 1 utilizador disponível: atribui a ele (assigned_to = ID)
            assignedCollab = availableUsers[0];
            assignedId = assignedCollab.id;
            assignedName = assignedCollab.name;
            console.log(`👤 [Roteamento URA] 1 consultor disponível em ${deptInfo.name}: Atribuído a ${assignedName} (${assignedId})`);
          } else {
            // Se múltiplos disponíveis: distribui via Round-Robin (para o utilizador há mais tempo sem receber atendimento)
            const { data: recentAsgns } = await supabase
              .from("messages")
              .select("text, created_at")
              .like("text", "%<!-- ASSIGNMENT:%")
              .order("created_at", { ascending: false })
              .limit(50);

            const lastAssignedAt: Record<string, number> = {};
            if (Array.isArray(recentAsgns)) {
              for (const row of recentAsgns) {
                try {
                  const mText = row.text || "";
                  const match = mText.match(/<!-- ASSIGNMENT:([\s\S]*?) -->/);
                  if (match) {
                    const data = JSON.parse(match[1]);
                    const uId = data.assigned_to;
                    if (uId && !lastAssignedAt[uId]) {
                      lastAssignedAt[uId] = new Date(row.created_at).getTime();
                    }
                  }
                } catch {}
              }
            }

            const sorted = [...availableUsers].sort((a, b) => {
              const tA = lastAssignedAt[a.id] || 0;
              const tB = lastAssignedAt[b.id] || 0;
              return tA - tB; // menor timestamp = há mais tempo sem receber atendimento
            });

            assignedCollab = sorted[0];
            assignedId = assignedCollab.id;
            assignedName = assignedCollab.name;
            console.log(`🔄 [Roteamento URA] Round-Robin aplicado entre ${availableUsers.length} consultores. Selecionado: ${assignedName} (${assignedId})`);
          }

          // 4. Insere auditoria de atribuição no Supabase
          const assignmentPayload = {
            chatId,
            department: deptInfo.name,
            assignee: assignedName,
            assigned_to: assignedId,
            status: assignedId ? "carteira_ativa" : "fila_departamento",
            statusLabel: assignedId ? `Atendimento • ${assignedName}` : `Fila • ${deptInfo.name}`,
            updatedBy: "URA WhatsApp",
            timestamp: timeInfo.timeStr
          };

          const auditNotice = assignedId
            ? `📌 [Roteamento URA + Round-Robin] Atendimento direcionado para o setor "${deptInfo.name}" com o consultor "${assignedName}".\n<!-- ASSIGNMENT:${JSON.stringify(assignmentPayload)} -->`
            : `📌 [Roteamento URA] Atendimento direcionado para a fila do setor "${deptInfo.name}" (Todos os consultores em pausa/almoço).\n<!-- ASSIGNMENT:${JSON.stringify(assignmentPayload)} -->`;

          await supabase.from("messages").insert([{
            id: "asgn_" + Date.now(),
            chat_id: chatId,
            sender_id: "system",
            sender_name: "EduChat (Sistema)",
            text: auditNotice,
            timestamp: timeInfo.timeStr
          }]);

          // 5. Envia mensagem de confirmação para o aluno no WhatsApp
          const targetNumber = cleanPhone || remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
          const evoUrl = Deno.env.get("EVOLUTION_API_URL") || "https://evolution-api-production-3fb2.up.railway.app";
          const evoKey = Deno.env.get("EVOLUTION_API_KEY") || "e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f";
          const evoInstance = Deno.env.get("EVOLUTION_INSTANCE") || "EduChat-Matriz-01";

          const confirmText = assignedId
            ? `✅ Perfeito! Seu atendimento foi direcionado para o setor de *${deptInfo.name}* com o consultor(a) *${assignedName}*.\n\nO consultor já recebeu seu histórico e continuará seu atendimento em instantes!`
            : `✅ Sua solicitação foi direcionada para a fila de *${deptInfo.name}*.\n\nNo momento todos os nossos consultores deste setor estão em intervalo/pausa (almoço). Seu atendimento está reservado com prioridade e você será atendido assim que um consultor retornar!`;

          let sentConfirmId = "";
          try {
            const sendRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evoKey },
              body: JSON.stringify({ number: targetNumber, text: confirmText })
            });
            if (sendRes.ok) {
              const sData = await sendRes.json().catch(() => ({}));
              sentConfirmId = sData?.key?.id || sData?.id || "";
            }
          } catch (_e) {}

          const botConfirmMsg = {
            id: sentConfirmId ? (sentConfirmId.startsWith("wa_") ? sentConfirmId : "wa_" + sentConfirmId) : "wa_ura_conf_" + Date.now(),
            chat_id: chatId,
            sender_id: "u_matriz",
            sender_name: "EduChat Matriz (URA)",
            text: `${confirmText}\n<!-- STATUS:delivered -->`,
            timestamp: timeInfo.timeStr
          };

          await supabase.from("messages").upsert([botConfirmMsg], { onConflict: "id" });
          insertedMessages.push(botConfirmMsg);

          continue;
        }

        // CASO 2: Mensagem recebida antes de passar pela URA (primeiro contato / saudação)
        // Se estiver em horário comercial, envia o menu de opções da URA
        if (!timeInfo.isAfterHours) {
          let sentUraRecently = false;
          try {
            const { data: recentUra } = await supabase
              .from("messages")
              .select("created_at")
              .eq("chat_id", chatId)
              .eq("sender_id", "u_matriz")
              .like("text", "%Para agilizarmos seu atendimento%")
              .order("created_at", { ascending: false })
              .limit(1);

            if (recentUra && recentUra.length > 0) {
              const lastUraTime = new Date(recentUra[0].created_at).getTime();
              if (Date.now() - lastUraTime < 15 * 60 * 1000) {
                sentUraRecently = true;
              }
            }
          } catch (_e) {}

          if (!sentUraRecently) {
            const uraMenu = `Olá! Seja muito bem-vindo(a) à nossa instituição! 👋\n\nPara agilizarmos seu atendimento com o consultor ideal, por favor digite o número da opção desejada:\n\n1️⃣ Tutoria e Apoio Pedagógico\n2️⃣ Secretaria Acadêmica e Documentos\n3️⃣ Coordenação Pedagógica\n4️⃣ Comercial e Novas Matrículas\n5️⃣ Expansão e Polos Parceiros\n6️⃣ Financeiro e Boletos\n7️⃣ Marketing e Comunicação`;

            const targetNumber = cleanPhone || remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
            const evoUrl = Deno.env.get("EVOLUTION_API_URL") || "https://evolution-api-production-3fb2.up.railway.app";
            const evoKey = Deno.env.get("EVOLUTION_API_KEY") || "e0e80ca25b168c9b0e559b1b7949f80ea06a94b920cb911acddc7b9a9b02475f";
            const evoInstance = Deno.env.get("EVOLUTION_INSTANCE") || "EduChat-Matriz-01";

            let sentMenuId = "";
            try {
              const sRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoKey },
                body: JSON.stringify({ number: targetNumber, text: uraMenu })
              });
              if (sRes.ok) {
                const sData = await sRes.json().catch(() => ({}));
                sentMenuId = sData?.key?.id || sData?.id || "";
              }
            } catch (_e) {}

            const botMenuMsg = {
              id: sentMenuId ? (sentMenuId.startsWith("wa_") ? sentMenuId : "wa_" + sentMenuId) : "wa_ura_menu_" + Date.now(),
              chat_id: chatId,
              sender_id: "u_matriz",
              sender_name: "EduChat Matriz (URA)",
              text: `${uraMenu}\n<!-- STATUS:delivered -->`,
              timestamp: timeInfo.timeStr
            };

            await supabase.from("messages").upsert([botMenuMsg], { onConflict: "id" });
            insertedMessages.push(botMenuMsg);

            // Chat permanece aguardando escolha na URA (assigned_to = null)
            continue;
          }
        }
      }

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
            // 3. ALIMENTAÇÃO DINÂMICA DO PROMPT VIA BASE DE CONHECIMENTO IA:
            // Busca os blocos de texto/documentos gravados no Supabase e injeta no prompt da IA
            let knowledgeContext = "";
            try {
              const { data: kbDocs, error: kbErr } = await supabase
                .from("ai_knowledge_base")
                .select("title, category, content, summary")
                .limit(15);

              if (!kbErr && Array.isArray(kbDocs) && kbDocs.length > 0) {
                knowledgeContext = kbDocs
                  .map((d: any) => `### DOCUMENTO: ${d.title} (Setor: ${d.category || 'Geral'})\n${d.summary ? `Resumo: ${d.summary}\n` : ''}${d.content}`)
                  .join("\n\n---\n\n");
              } else {
                // Fallback para registros em sys_knowledge na tabela messages
                const { data: fallbackDocs } = await supabase
                  .from("messages")
                  .select("text")
                  .eq("chat_id", "sys_knowledge")
                  .limit(15);
                if (Array.isArray(fallbackDocs) && fallbackDocs.length > 0) {
                  knowledgeContext = fallbackDocs
                    .map((r: any) => {
                      try {
                        const parsed = JSON.parse(r.text);
                        return `### DOCUMENTO: ${parsed.title}\n${parsed.content || parsed.textContent || ''}`;
                      } catch {
                        return '';
                      }
                    })
                    .filter(Boolean)
                    .join("\n\n---\n\n");
                }
              }
            } catch (err) {
              console.warn("Aviso ao buscar base de conhecimento para o prompt:", err);
            }

            const gPrompt = `Você é o Assistente Virtual Oficial do EduChat (Faculdade Olavo Bilac • Grupo EstudeMais).
Horário atual em Brasília: ${timeInfo.timeStr} (Fora do expediente comercial de 08h às 19h).
Aja com cordialidade, acolhimento e profissionalismo. Informe gentilmente que o atendimento dos consultores humanos encerrou-se às 19h, mas que você assumiu o atendimento de plantão para ajudar imediatamente.

${knowledgeContext ? `=== BASE DE CONHECIMENTO OFICIAL (DOCUMENTOS, CURSOS E REGRAS) ===
Utilize com prioridade absoluta as informações oficiais abaixo para sanar dúvidas sobre catálogo de cursos, valores, prazos, matrículas e diretrizes institucionais:

${knowledgeContext.slice(0, 32000)}

================================================================================\n` : ''}
Responda de forma clara, prestativa e objetiva à mensagem do aluno/lead:
"${messageText}"`;

            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: gPrompt }] }],
                generationConfig: { maxOutputTokens: 350, temperature: 0.6 }
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

        // Atualiza last_message na conversa apenas se a resposta foi gravada com sucesso
        if (!aiInsertErr && aiReplyText) {
          try {
            await supabase.from("chats").upsert([
              {
                id: chatId,
                phone: cleanPhone,
                last_message: aiReplyText.length > 250 ? aiReplyText.slice(0, 247) + "..." : aiReplyText,
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ], { onConflict: "id" });
          } catch (_cErr) {}

          try {
            await supabase.from("contacts").update({
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq("id", chatId);
          } catch (_cErr) {}
        }
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
