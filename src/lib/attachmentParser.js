/**
 * Utilitário para extração, higienização e manipulação de anexos no EduChat.
 * Trata tags [ARQUIVO_ANEXO:{...}], converte data URLs em Blobs seguros para navegadores
 * Chromium (evitando bloqueios de navegação para data URLs) e padroniza metadados.
 */

const SUPABASE_BASE_URL = 'https://yuhtzkhoxnabrsrhqdni.supabase.co';
const EVOLUTION_BASE_URL = 'https://evolution-api-production-3fb2.up.railway.app';

/**
 * Converte qualquer URL, caminho do Supabase Storage ou Evolution API em URL pública absoluta válida.
 * Evita links quebrados ou caminhos relativos que impedem a abertura do anexo.
 */
export function resolvePublicMediaUrl(urlOrPath, defaultBucket = 'chat-attachments') {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';
  const trimmed = urlOrPath.trim();
  if (!trimmed) return '';

  // 1. Data URLs (Base64) e Blobs locais já são válidos para renderização direta
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Protocol-relative URL (ex: //domain.com/path)
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // 3. URLs HTTP/HTTPS completas
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 4. Caminhos que já começam com a rota do storage do Supabase (/storage/v1/object/public/...)
  if (trimmed.startsWith('/storage/v1/object/public/') || trimmed.startsWith('storage/v1/object/public/')) {
    const clean = trimmed.replace(/^\/?storage\/v1\/object\/public\//, '');
    return `${SUPABASE_BASE_URL}/storage/v1/object/public/${clean}`;
  }

  // 5. Caminhos da Evolution API (ex: /media/... ou media/...)
  if (trimmed.startsWith('/media/') || trimmed.startsWith('media/')) {
    const clean = trimmed.replace(/^\/+/, '');
    return `${EVOLUTION_BASE_URL}/${clean}`;
  }

  // 6. Caminhos com nome de bucket conhecido do Supabase
  let cleanPath = trimmed.replace(/^\/+/, '');
  const knownBuckets = ['chat-attachments', 'chat-audios', 'attachments', 'chat-files', 'documents', 'messages'];
  for (const b of knownBuckets) {
    if (cleanPath.startsWith(`${b}/`)) {
      const rest = cleanPath.slice(b.length + 1);
      return `${SUPABASE_BASE_URL}/storage/v1/object/public/${b}/${rest}`;
    }
  }

  // 7. Caminho relativo padrão do Storage do Supabase (ex: "2026/10/arquivo.pdf" ou "meu-doc.pdf")
  const targetBucket = defaultBucket || 'chat-attachments';
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${targetBucket}/${cleanPath}`;
}

export function extractAttachmentFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { attachment: null, cleanText: '' };
  }

  let cleanText = rawText;
  let attachment = null;

  if (cleanText.includes('[ARQUIVO_ANEXO:')) {
    let searchIdx = 0;
    while (true) {
      const startTag = cleanText.indexOf('[ARQUIVO_ANEXO:', searchIdx);
      if (startTag === -1) break;

      const jsonStart = startTag + '[ARQUIVO_ANEXO:'.length;
      const braceStart = cleanText.indexOf('{', jsonStart);

      if (braceStart === -1) {
        const closeBracket = cleanText.indexOf(']', startTag);
        if (closeBracket !== -1) {
          cleanText = cleanText.slice(0, startTag) + cleanText.slice(closeBracket + 1);
        } else {
          cleanText = cleanText.slice(0, startTag);
        }
        continue;
      }

      // Rastreamento balanceado de chaves { ... } respeitando strings e caracteres escapados
      let depth = 0;
      let inString = false;
      let escape = false;
      let jsonEnd = -1;

      for (let i = braceStart; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"' || char === "'") {
          if (!inString) {
            inString = char;
          } else if (inString === char) {
            inString = false;
          }
          continue;
        }
        if (!inString) {
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
      }

      if (jsonEnd !== -1) {
        const jsonStr = cleanText.slice(braceStart, jsonEnd);
        const tagEnd = cleanText.indexOf(']', jsonEnd);
        const sliceEnd = tagEnd !== -1 ? tagEnd + 1 : jsonEnd;

        if (!attachment) {
          try {
            attachment = JSON.parse(jsonStr);
          } catch {
            try {
              // Sanitiza JSON comum com aspas simples ou quebras de linha
              const sanitizedJson = jsonStr
                .replace(/[\r\n]+/g, ' ')
                .replace(/,\s*}/g, '}')
                .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
              attachment = JSON.parse(sanitizedJson);
            } catch {
              // Extração resiliente via expressões regulares
              const nameMatch = jsonStr.match(/["']?(?:name|fileName|filename)["']?\s*:\s*["']([^"']+)["']/i);
              const sizeMatch = jsonStr.match(/["']?size["']?\s*:\s*["']?([^"',}]+)["']?/i);
              const typeMatch = jsonStr.match(/["']?(?:type|mimetype|mimeType)["']?\s*:\s*["']([^"']+)["']/i);
              const urlMatch = jsonStr.match(/["']?(?:dataUrl|url|mediaUrl|storagePath|path)["']?\s*:\s*["']([^"']+)["']/i);
              if (nameMatch || urlMatch) {
                attachment = {
                  name: nameMatch ? nameMatch[1] : 'arquivo',
                  size: sizeMatch ? sizeMatch[1].trim() : '',
                  type: typeMatch ? typeMatch[1] : '',
                  dataUrl: urlMatch ? urlMatch[1] : '',
                  url: urlMatch ? urlMatch[1] : ''
                };
              }
            }
          }
        }

        cleanText = cleanText.slice(0, startTag) + cleanText.slice(sliceEnd);
        searchIdx = startTag;
      } else {
        const closeBracket = cleanText.indexOf(']', startTag);
        if (closeBracket !== -1) {
          cleanText = cleanText.slice(0, startTag) + cleanText.slice(closeBracket + 1);
        } else {
          cleanText = cleanText.slice(0, startTag);
        }
        break;
      }
    }
  }

  // Normalização do anexo extraído
  if (attachment && typeof attachment === 'object') {
    const rawName = attachment.name || attachment.fileName || attachment.filename || 'arquivo';
    const rawType = (attachment.type || attachment.mimetype || attachment.mimeType || '').toLowerCase().trim();
    const rawUrl = attachment.url || attachment.dataUrl || attachment.mediaUrl || attachment.storagePath || attachment.path || '';
    const resolvedUrl = resolvePublicMediaUrl(rawUrl, rawType.startsWith('audio/') ? 'chat-audios' : 'chat-attachments');

    attachment = {
      ...attachment,
      name: rawName,
      type: rawType,
      url: resolvedUrl || rawUrl,
      dataUrl: resolvedUrl || attachment.dataUrl || rawUrl
    };
  }

  // Salvaguarda final: remove qualquer resquício de tags de anexo ou controle
  cleanText = cleanText
    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
    .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
    .trim();

  return { attachment, cleanText };
}

/**
 * Formata o tamanho em bytes/KB/MB para visualização amigável
 */
export function formatFileSize(rawSize) {
  if (!rawSize) return '';
  if (typeof rawSize === 'number') {
    if (rawSize >= 1048576) return (rawSize / 1048576).toFixed(1) + ' MB';
    if (rawSize >= 1024) return (rawSize / 1024).toFixed(1) + ' KB';
    return rawSize + ' B';
  }

  const str = String(rawSize).trim();
  // Se já termina com KB, MB ou B
  if (/(kb|mb|gb|bytes?|b)$/i.test(str)) {
    return str.toUpperCase();
  }

  const num = parseFloat(str.replace(',', '.'));
  if (isNaN(num)) return str;

  // Se for maior que 1024, pode já estar em KB ou Bytes
  if (num >= 1024) {
    return (num / 1024).toFixed(1) + ' MB';
  }
  return num.toFixed(1) + ' KB';
}

/**
 * Obtém a extensão de um arquivo em letras minúsculas (ex: 'pdf', 'xlsx')
 */
export function getFileExtension(filename = '') {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop().toLowerCase().trim();
  }
  return '';
}

/**
 * Classifica a categoria do arquivo para estilização de cores e ícones.
 * Dá prioridade absoluta ao MIME-type real para evitar que documentos virem áudio.
 */
export function getFileCategory(filename = '', mimeType = '') {
  const mime = (mimeType || '').toLowerCase().trim();
  const ext = getFileExtension(filename);

  if (mime.includes('pdf') || ext === 'pdf') {
    return 'pdf';
  }
  if (mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))) {
    return 'image';
  }
  if (mime.startsWith('audio/')) {
    return 'audio';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('csv') ||
    mime.includes('excel') ||
    ['xlsx', 'xls', 'csv', 'ods'].includes(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    mime.includes('word') ||
    mime.includes('text/plain') ||
    mime.includes('officedocument') ||
    ['docx', 'doc', 'txt', 'rtf', 'odt'].includes(ext)
  ) {
    return 'document';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['pptx', 'ppt', 'odp'].includes(ext)
  ) {
    return 'presentation';
  }
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive';
  }

  // Se o MIME for desconhecido e a extensão for de áudio
  if (!mime && ['mp3', 'wav', 'ogg', 'opus', 'webm', 'm4a', 'aac'].includes(ext)) {
    return 'audio';
  }

  return 'other';
}

/**
 * Converte dataUrl base64 em Blob seguro para o navegador
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.warn('Erro ao decodificar base64 para Blob:', err);
    return null;
  }
}

/**
 * Abre o documento (PDF, imagem, etc.) em nova aba de forma compatível com navegadores Chromium
 */
export function openDocument(attachment) {
  if (!attachment) return;
  const rawUrl =
    attachment.url ||
    attachment.dataUrl ||
    attachment.storagePath ||
    attachment.path ||
    attachment.mediaUrl;
  const fileUrl = resolvePublicMediaUrl(rawUrl, 'chat-attachments');
  const filename = attachment.name || attachment.fileName || 'documento';

  if (!fileUrl) {
    alert(`O arquivo "${filename}" não possui URL válida de visualização.`);
    return;
  }

  // Previne abertura de arquivos brutos cifrados (.enc do WhatsApp)
  if (fileUrl.includes('.enc') || (fileUrl.includes('whatsapp.net') && fileUrl.includes('.enc'))) {
    alert(`O arquivo "${filename}" é uma mídia cifrada bruta do WhatsApp (.enc) e não pôde ser aberta diretamente. As novas mensagens recebidas são agora desencriptadas automaticamente.`);
    return;
  }

  // Se for Base64 (dataUrl)
  if (fileUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(fileUrl);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000); // 2 minutos de retenção para visualização
      return;
    }
  }

  // Se já for URL web externa ou blob existente
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('blob:')) {
    window.open(fileUrl, '_blank');
    return;
  }

  // Fallback para download direto caso a abertura em aba falhe
  downloadDocument(attachment);
}

/**
 * Realiza o download nativo do arquivo no dispositivo do usuário
 */
export function downloadDocument(attachment) {
  if (!attachment) return;
  const rawUrl =
    attachment.url ||
    attachment.dataUrl ||
    attachment.storagePath ||
    attachment.path ||
    attachment.mediaUrl;
  const fileUrl = resolvePublicMediaUrl(rawUrl, 'chat-attachments');
  const filename = attachment.name || attachment.fileName || 'documento';

  if (!fileUrl) {
    alert(`O arquivo "${filename}" não pôde ser baixado.`);
    return;
  }

  // Previne download inútil de arquivos brutos cifrados (.enc do WhatsApp)
  if (fileUrl.includes('.enc') || (fileUrl.includes('whatsapp.net') && fileUrl.includes('.enc'))) {
    alert(`O arquivo "${filename}" é uma mídia cifrada bruta do WhatsApp (.enc) e não pôde ser baixado diretamente. As novas mídias recebidas são agora desencriptadas automaticamente.`);
    return;
  }

  // Se for Base64 (dataUrl)
  if (fileUrl.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(fileUrl);
      if (blob) {
        const finalUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = finalUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(finalUrl), 60000);
        return;
      }
    } catch (err) {
      console.warn('Erro ao baixar dataUrl base64:', err);
    }
  }

  // Para URLs remotas (HTTP / HTTPS):
  // Tenta fetch para criar Blob local e forçar download com o nome correto do arquivo
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Falha HTTP ao obter arquivo');
        return res.blob();
      })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
      })
      .catch((err) => {
        console.warn('Fallback para download direto do link:', err);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    return;
  }

  // Fallback padrão
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
