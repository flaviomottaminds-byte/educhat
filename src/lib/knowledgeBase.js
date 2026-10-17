import { supabase } from './supabase';

const LOCAL_STORAGE_KEY = 'educhat_knowledge_base';

export const INITIAL_KNOWLEDGE_DOCS = [
  {
    id: 'doc_init_1',
    title: 'Regras de Atendimento e Prazos de Matrícula (Diretoria).pdf',
    category: 'Secretaria',
    file_type: 'pdf',
    size: '142.0 KB',
    summary: 'Determina que todas as solicitações de matrícula, reposição de aula e certidões devem ser tratadas em no máximo 48h pela Secretaria Acadêmica.',
    content: `MEMORANDO DIRETORIA 01/2026:
Fica determinado que todas as solicitações de matrícula, reposições de aulas, transferência de polo e certidões devem ser tratadas em no máximo 48h úteis pela Secretaria Acadêmica.
Dúvidas sobre financeiro e split de pagamentos devem ser encaminhadas ao Setor Financeiro imediatamente.`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

/**
 * Extrai texto legível de arquivos diversos (.csv, .txt, .pdf, .json, .md)
 */
export async function extractTextFromFile(file) {
  if (!file) return { text: '', summary: '' };

  const fileName = file.name || 'documento';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buffer = reader.result;
          const textDecoder = new TextDecoder('latin1');
          const raw = textDecoder.decode(buffer);

          // Extrai sequências de texto entre parênteses típicas de objetos PDF (ex: (Texto) Tj)
          const chunks = [];
          const regex = /\(([^)]{2,})\)\s*(?:Tj|'|")/g;
          let match;
          while ((match = regex.exec(raw)) !== null) {
            if (match[1]) {
              const clean = match[1].replace(/\\[nrtbf()\\]/g, ' ').trim();
              if (clean.length > 2) chunks.push(clean);
            }
          }

          let extracted = chunks.join(' ').trim();
          if (extracted.length < 50) {
            // Fallback: extrai cadeias legíveis de caracteres alfanuméricos
            const cleaned = raw.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ');
            extracted = cleaned
              .split(/\s+/)
              .filter((w) => w.length > 2 && /^[a-zA-Z0-9À-ÿ.,:;!?%@&()/-]+$/.test(w))
              .join(' ')
              .slice(0, 80000);
          }

          const summary = extracted.slice(0, 300).trim() + (extracted.length > 300 ? '...' : '');
          resolve({ text: extracted, summary });
        } catch (err) {
          console.warn('Erro ao extrair PDF:', err);
          resolve({ text: '', summary: 'Não foi possível extrair o texto completo do PDF.' });
        }
      };
      reader.onerror = () => resolve({ text: '', summary: 'Erro na leitura do arquivo.' });
      reader.readAsArrayBuffer(file);
    });
  }

  // Arquivos de texto (.csv, .txt, .md, .json, .tsv)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const nonEmptyLines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      let summary = '';
      if (ext === 'csv' || ext === 'tsv') {
        const header = nonEmptyLines[0] || '';
        summary = `Tabela indexada com ${nonEmptyLines.length - 1} registros/linhas. Colunas: ${header.slice(0, 200)}`;
      } else {
        summary = content.slice(0, 300).trim();
        if (content.length > 300) summary += '...';
      }

      resolve({ text: content, summary });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Busca todos os documentos da Base de Conhecimento IA (Supabase com fallback localStorage)
 */
export async function fetchKnowledgeBaseDocs() {
  let docs = [];

  // 1. Tenta buscar na tabela oficial `ai_knowledge_base`
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        docs = data.map((d) => ({
          ...d,
          textContent: d.content || d.textContent || ''
        }));
      }
    } catch (e) {
      console.warn('Aviso ao consultar ai_knowledge_base:', e);
    }

    // 2. Fallback caso a tabela oficial ainda não tenha registros ou falhe
    if (docs.length === 0) {
      try {
        const { data: fbData } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', 'sys_knowledge')
          .order('created_at', { ascending: false });

        if (Array.isArray(fbData) && fbData.length > 0) {
          docs = fbData
            .map((r) => {
              try {
                return JSON.parse(r.text);
              } catch {
                return null;
              }
            })
            .filter(Boolean);
        }
      } catch {}
    }
  }

  // 3. Fallback de cache local
  if (docs.length === 0 && typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          docs = parsed;
        }
      }

      // Migração de cache anterior (educhat_learned_docs)
      if (docs.length === 0) {
        const oldDocs = localStorage.getItem('educhat_learned_docs');
        if (oldDocs) {
          const parsedOld = JSON.parse(oldDocs);
          if (Array.isArray(parsedOld) && parsedOld.length > 0) {
            docs = parsedOld.map((d) => ({
              id: d.id || 'doc_' + Date.now(),
              title: d.title || 'Documento',
              category: d.keywords?.[0] || 'Geral',
              file_type: (d.title || '').split('.').pop() || 'txt',
              size: d.size || '1 KB',
              summary: d.summary || '',
              content: d.textContent || d.content || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          }
        }
      }
    } catch {}
  }

  if (docs.length === 0) {
    docs = INITIAL_KNOWLEDGE_DOCS;
  }

  // Salva no cache local sincronizado
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(docs));
    } catch {}
  }

  return docs;
}

/**
 * Grava ou atualiza um documento na Base de Conhecimento (Supabase + LocalStorage)
 */
export async function saveKnowledgeBaseDoc(doc) {
  if (!doc || !doc.title) return null;

  const normalizedDoc = {
    id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: doc.title.trim(),
    category: doc.category || 'Geral',
    file_type: doc.file_type || doc.fileType || 'txt',
    size: doc.size || '1 KB',
    summary: doc.summary || (doc.content ? doc.content.slice(0, 300) : ''),
    content: doc.content || doc.textContent || '',
    metadata: doc.metadata || {},
    created_at: doc.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Persistência na tabela `ai_knowledge_base`
  if (supabase) {
    try {
      await supabase.from('ai_knowledge_base').upsert([normalizedDoc]);
    } catch (err) {
      console.warn('Aviso ao persistir em ai_knowledge_base:', err);
    }

    // 2. Persistência redundante em `messages` (chat_id: sys_knowledge) para compatibilidade instantânea
    try {
      await supabase.from('messages').upsert([
        {
          id: `sys_kb_${normalizedDoc.id}`,
          chat_id: 'sys_knowledge',
          sender_id: 'system',
          sender_name: 'Knowledge Base',
          text: JSON.stringify(normalizedDoc),
          timestamp: 'SYS'
        }
      ]);
    } catch (err) {
      console.warn('Aviso ao sincronizar documento de conhecimento em messages:', err);
    }
  }

  // 3. Atualiza LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const filtered = existing.filter((d) => d.id !== normalizedDoc.id);
      const nextList = [normalizedDoc, ...filtered];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return normalizedDoc;
}

/**
 * Remove um documento da Base de Conhecimento (Supabase + LocalStorage)
 */
export async function deleteKnowledgeBaseDoc(docId) {
  if (!docId) return;

  if (supabase) {
    try {
      await supabase.from('ai_knowledge_base').delete().eq('id', docId);
    } catch {}

    try {
      await supabase.from('messages').delete().eq('id', `sys_kb_${docId}`);
      await supabase.from('messages').delete().eq('id', docId);
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const filtered = existing.filter((d) => d.id !== docId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  }
}
