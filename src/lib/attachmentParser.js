/**
 * Utilitário para extração, higienização e manipulação de anexos no EduChat.
 * Trata tags [ARQUIVO_ANEXO:{...}], converte data URLs em Blobs seguros para navegadores
 * Chromium (evitando bloqueios de navegação para data URLs) e padroniza metadados.
 */

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
              const nameMatch = jsonStr.match(/["']?name["']?\s*:\s*["']([^"']+)["']/i);
              const sizeMatch = jsonStr.match(/["']?size["']?\s*:\s*["']?([^"',}]+)["']?/i);
              const typeMatch = jsonStr.match(/["']?type["']?\s*:\s*["']([^"']+)["']/i);
              const urlMatch = jsonStr.match(/["']?(?:dataUrl|url)["']?\s*:\s*["']([^"']+)["']/i);
              if (nameMatch) {
                attachment = {
                  name: nameMatch[1],
                  size: sizeMatch ? sizeMatch[1].trim() : '',
                  type: typeMatch ? typeMatch[1] : '',
                  dataUrl: urlMatch ? urlMatch[1] : ''
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
 * Classifica a categoria do arquivo para estilização de cores e ícones
 */
export function getFileCategory(filename = '', mimeType = '') {
  const ext = getFileExtension(filename);
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) {
    return 'pdf';
  }
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv') || mime.includes('excel')) {
    return 'spreadsheet';
  }
  if (['docx', 'doc', 'txt', 'rtf', 'odt'].includes(ext) || mime.includes('word') || mime.includes('text/plain')) {
    return 'document';
  }
  if (['pptx', 'ppt', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return 'presentation';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
    return 'image';
  }
  if (['mp3', 'wav', 'ogg', 'opus', 'webm', 'm4a', 'aac'].includes(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return 'archive';
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
  const fileUrl = attachment.dataUrl || attachment.url;
  const filename = attachment.name || 'documento';

  if (!fileUrl) {
    alert(`O arquivo "${filename}" não possui URL válida de visualização.`);
    return;
  }

  // Se já for URL web externa ou blob existente
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('blob:')) {
    window.open(fileUrl, '_blank');
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

  // Fallback para download direto caso a abertura em aba falhe
  downloadDocument(attachment);
}

/**
 * Realiza o download nativo do arquivo no dispositivo do usuário
 */
export function downloadDocument(attachment) {
  if (!attachment) return;
  const fileUrl = attachment.dataUrl || attachment.url;
  const filename = attachment.name || 'documento';

  if (!fileUrl) {
    alert(`O arquivo "${filename}" não pôde ser baixado.`);
    return;
  }

  try {
    let finalUrl = fileUrl;
    let shouldRevoke = false;

    if (fileUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(fileUrl);
      if (blob) {
        finalUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }
    }

    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(finalUrl), 60000);
    }
  } catch (err) {
    console.warn('Erro no download:', err);
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
