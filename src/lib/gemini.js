// Integração Nativa com a API do Google Gemini (Google AI) para o EduChat
// Capacita o bot de autoatendimento contínuo e inteligente com RAG de documentos memorizados

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-1.5-flash';

export function getGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('educhat_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
}

export function saveGeminiApiKey(apiKey) {
  if (typeof window === 'undefined') return;
  if (apiKey) {
    localStorage.setItem('educhat_gemini_api_key', apiKey.trim());
  } else {
    localStorage.removeItem('educhat_gemini_api_key');
  }
}

/**
 * Constrói o System Prompt humanizado com base nas regras do MEC,
 * documentos memorizados, POPs, SLAs e contexto acadêmico do aluno (EduControl).
 */
function buildSystemInstruction({
  student = null,
  learnedDocuments = [],
  pops = [],
  slas = [],
  customPrompt = '',
  department = 'Geral',
  userName = 'Aluno'
}) {
  let prompt = `Você é o EduChat AI, assistente educacional oficial e humanizado da Faculdade Olavo Bilac • Grupo EstudeMais.\n`;
  prompt += `Seu objetivo é acolher os alunos e interessados via WhatsApp com empatia, clareza, tom acolhedor e soluções práticas, mantendo diálogos contínuos, inteligentes e contextualizados.\n\n`;

  // Contexto Acadêmico do Aluno Reconhecido (EduControl)
  if (student) {
    prompt += `--- DADOS DO ALUNO EM ATENDIMENTO (EduControl) ---\n`;
    prompt += `• Nome: ${student.name || userName}\n`;
    prompt += `• Curso: ${student.course || 'Graduação / Pós'}\n`;
    prompt += `• Polo: ${student.polo || 'Matriz'}\n`;
    prompt += `• Situação Acadêmica: ${student.academicStatus || 'Ativo'}\n`;
    prompt += `• Matrícula: ${student.matricula || '-'}\n`;
    if (student.cpf) prompt += `• CPF: ${student.cpf}\n`;
    prompt += `Trate o aluno pelo seu primeiro nome (${(student.name || userName).split(' ')[0]}) e demonstre conhecimento sobre seu curso e polo.\n\n`;
  }

  // Base de Conhecimento Memorizada (Documentos Internos e Memorandos)
  if (learnedDocuments && learnedDocuments.length > 0) {
    prompt += `--- BASES DE CONHECIMENTO INTERNAS APRENDIDAS (MEMORANDOS & PROCEDIMENTOS) ---\n`;
    learnedDocuments.forEach((doc, idx) => {
      prompt += `[DOC ${idx + 1}: ${doc.title}]\n`;
      if (doc.summary) prompt += `Resumo: ${doc.summary}\n`;
      if (doc.textContent) prompt += `Trecho: ${doc.textContent.slice(0, 1000)}\n`;
    });
    prompt += `Utilize com prioridade essas diretrizes ao responder dúvidas de prazos, documentação e processos.\n\n`;
  }

  // POPs (Procedimentos Operacionais Padrão)
  if (pops && pops.length > 0) {
    prompt += `--- PROCEDIMENTOS OPERACIONAIS PADRÃO (POPs) ---\n`;
    pops.forEach((p) => {
      prompt += `• ${p.title || p.name}: ${p.desc || p.description || p.steps || ''}\n`;
    });
    prompt += `\n`;
  }

  // SLAs Institucionais
  if (slas && slas.length > 0) {
    prompt += `--- PRAZOS E SLAS POR SETOR ---\n`;
    slas.forEach((s) => {
      prompt += `• ${s.department || s.setor}: ${s.sla || s.prazo || 'Até 24h'}\n`;
    });
    prompt += `\n`;
  }

  // Diretrizes Oficiais do MEC
  prompt += `--- REGRAS OFICIAIS DO MEC ---\n`;
  prompt += `• Portaria MEC nº 1.095/2018: Expedição de diploma em até 60 dias corridos após colação (prorrogável por igual período).\n`;
  prompt += `• Resolução CNE/CES nº 1/2018: Cursos de pós lato sensu exigem carga mínima de 360 horas.\n`;
  prompt += `• Documentação obrigatória: RG/CNH, Histórico Escolar autenticado, Certidão de Nascimento/Casamento e Diploma.\n\n`;

  // Diretrizes Personalizadas da Instituição
  if (customPrompt) {
    prompt += `--- DIRETRIZES ESPECÍFICAS DA GESTÃO ---\n${customPrompt}\n\n`;
  }

  prompt += `--- REGRAS DE COMUNICAÇÃO NO WHATSAPP ---\n`;
  prompt += `1. Seja cordial, natural e use formatação do WhatsApp (*negrito*, emojis pontuais e quebras de linha curtas).\n`;
  prompt += `2. Evite respostas robóticas, longas ou frias. Vá direto ao ponto e solucione a dúvida.\n`;
  prompt += `3. Se a demanda exigir atuação humana ou assinatura oficial, informe gentilmente que você já registrou o processo e a equipe da fila (${department}) dará seguimento.\n`;
  prompt += `4. NUNCA diga que você travou ou é apenas um robô estático. Você é o assistente inteligente contínuo.\n`;

  return prompt;
}

/**
 * Realiza chamada à API do Google Gemini com fallback inteligente
 */
export async function generateGeminiChatReply({
  message,
  history = [],
  student = null,
  learnedDocuments = [],
  pops = [],
  slas = [],
  customPrompt = '',
  department = 'Geral',
  userName = 'Aluno'
}) {
  const apiKey = getGeminiApiKey();

  const systemInstruction = buildSystemInstruction({
    student,
    learnedDocuments,
    pops,
    slas,
    customPrompt,
    department,
    userName
  });

  // Se houver chave do Gemini configurada, chama a API oficial do Google AI
  if (apiKey) {
    try {
      const contents = [];

      // Converte histórico recente de mensagens (até as últimas 8 mensagens)
      const recentHistory = (history || []).slice(-8);
      recentHistory.forEach((h) => {
        if (!h.text) return;
        const role = (h.fromStudent || h.senderId?.startsWith('wa-') || h.senderId === student?.id) ? 'user' : 'model';
        contents.push({
          role,
          parts: [{ text: h.text }]
        });
      });

      // Adiciona mensagem atual do aluno
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const requestBody = {
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
          topP: 0.9
        }
      };

      // Tenta modelo principal gemini-2.5-flash
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      // Se der erro 404 de modelo, tenta o gemini-1.5-flash
      if (!response.ok && response.status === 404) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );
      }

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim()) {
          return candidateText.trim();
        }
      } else {
        const errText = await response.text();
        console.warn('Aviso da API Gemini:', response.status, errText);
      }
    } catch (apiErr) {
      console.warn('Erro ao conectar com API Gemini:', apiErr);
    }
  }

  // =========================================================================
  // MOTOR GENERATIVO CONTEXTUAL LOCAL (FALLBACK RESILIENTE DE ALTA PRECISÃO)
  // Garante que o chat NUNCA trave caso a rede esteja instável ou a chave pendente.
  // =========================================================================
  return generateLocalIntelligentReply({
    message,
    student,
    learnedDocuments,
    pops,
    slas,
    department,
    userName
  });
}

function generateLocalIntelligentReply({
  message,
  student,
  learnedDocuments,
  pops,
  slas,
  department,
  userName
}) {
  const q = (message || '').toLowerCase();
  const firstName = (student?.name || userName || 'aluno(a)').split(' ')[0];

  // 1. Busca específica nos documentos memorizados
  const matchedDoc = (learnedDocuments || []).find((doc) => {
    const titleMatch = q.includes((doc.title || '').toLowerCase().slice(0, 10));
    const kwMatch = doc.keywords && doc.keywords.some((kw) => q.includes(kw.toLowerCase()));
    return titleMatch || kwMatch;
  });

  if (matchedDoc) {
    return `Olá, ${firstName}! Localizei essa informação diretamente no documento interno *${matchedDoc.title}*:\n\n${matchedDoc.summary || matchedDoc.textContent?.slice(0, 300)}\n\nPosso te ajudar com mais algum detalhe sobre esse procedimento?`;
  }

  // 2. Diplomas e Certificados
  if (q.includes('diploma') || q.includes('certificado') || q.includes('conclus') || q.includes('prazo')) {
    const course = student?.course ? `do curso de *${student.course}*` : '';
    return `Olá, ${firstName}! Conforme as diretrizes oficiais do MEC (Portaria 1.095/2018), a emissão do seu documento ${course} é processada pela Secretaria Acadêmica em até *60 dias corridos* após a colação de grau.\n\nCaso precise da *Certidão de Conclusão Provisória* ou histórico de notas, já posso registrar a solicitação para nossa equipe!`;
  }

  // 3. Financeiro, Boletos e Mensalidades
  if (q.includes('boleto') || q.includes('pagamento') || q.includes('mensalidade') || q.includes('financeiro') || q.includes('valor') || q.includes('segunda via') || q.includes('2 via')) {
    return `Olá, ${firstName}! Para a 2ª via do seu boleto ou negociação financeira, você pode acessar diretamente o Portal do Aluno ou me informar o mês de referência que direciono imediatamente ao setor *Financeiro* para emissão com o código de barras atualizado.`;
  }

  // 4. Tutoria, Aulas e Plataforma EAD
  if (q.includes('aula') || q.includes('portal') || q.includes('eaula') || q.includes('acesso') || q.includes('professor') || q.includes('tutoria') || q.includes('nota') || q.includes('prova')) {
    return `Olá, ${firstName}! Suas atividades e disciplinas estão disponíveis no ambiente virtual de aprendizagem. Se estiver enfrentando alguma instabilidade de login ou dúvida de conteúdo com o tutor, me confirme seu e-mail institucional para verificarmos seu acesso agora mesmo!`;
  }

  // 5. Matrículas e Novos Cursos
  if (q.includes('matricula') || q.includes('matrícula') || q.includes('curso') || q.includes('pos') || q.includes('pós') || q.includes('mba') || q.includes('inscric')) {
    return `Olá, ${firstName}! Nossas turmas para cursos de Graduação e Pós-Graduação EAD estão com condições especiais de matrícula nesta semana, incluindo bolsas de incentivo. Gostaria de receber a grade curricular e a proposta de valores no seu WhatsApp?`;
  }

  // Resposta conversacional humanizada padrão
  return `Olá, ${firstName}! Estou acompanhando seu atendimento aqui no EduChat. Registrei sua mensagem: _"${message}"_.\n\nComo posso te orientar melhor agora? Se desejar, posso encaminhar imediatamente para um consultor especialista da nossa equipe!`;
}
