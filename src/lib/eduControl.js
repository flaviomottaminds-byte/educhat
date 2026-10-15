// =========================================================================
// NÚCLEO DE DADOS & INTELIGÊNCIA EDUCONTROL (FACULDADE OLAVO BILAC / ESTUDEMAIS)
// Padrão Base44: Nome Completo, CPF, Telefone e E-mail
// Gerencia a base de alunos, reconhecimento em tempo real e sincronização
// =========================================================================

// Limpeza, validação e formatação estrita de CPF (Chave Primária de Unicidade)
export function cleanStudentCPF(rawCPF) {
  if (!rawCPF) return { isValid: false, cleanDigits: '', formattedCPF: '' };

  let digits = String(rawCPF).replace(/\D/g, '');

  // Preenche zeros à esquerda caso exportações do Excel/CSV tenham truncado zeros iniciais
  if (digits.length >= 9 && digits.length < 11) {
    digits = digits.padStart(11, '0');
  }

  // Validação de 11 dígitos e rejeição de sequências homogêneas conhecidas (ex: 11111111111)
  const isValid = digits.length === 11 && !/^(\d)\1{10}$/.test(digits);

  let formattedCPF = rawCPF;
  if (digits.length === 11) {
    formattedCPF = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  return {
    isValid,
    cleanDigits: digits,
    formattedCPF
  };
}

// Limpeza e normalização estrita de telefone para reconhecimento de alunos
export function cleanStudentPhone(rawPhone) {
  if (!rawPhone) return { isValid: false, cleanDigits: '', formattedPhone: '', waId: '' };

  let digits = String(rawPhone).replace(/\D/g, '');

  // Remove zero à esquerda do DDD caso exista (ex: 011999998888 -> 11999998888)
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }

  // Se tiver 10 ou 11 dígitos, adiciona DDI 55 do Brasil
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Validação padrão Brasil (DDI 55 + DDD + 8 ou 9 dígitos = 12 ou 13 dígitos)
  const isValid = digits.startsWith('55') && (digits.length === 12 || digits.length === 13);

  let formattedPhone = digits;
  if (isValid) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9) {
      formattedPhone = `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    } else {
      formattedPhone = `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    }
  } else if (digits.length >= 10) {
    formattedPhone = `+${digits}`;
  }

  return {
    isValid,
    cleanDigits: digits,
    formattedPhone,
    waId: digits ? `wa-${digits}` : ''
  };
}

// Busca direta por CPF na base de alunos
export function matchStudentByCPF(rawCPF, studentList = []) {
  if (!rawCPF || !Array.isArray(studentList) || studentList.length === 0) return null;
  const { cleanDigits } = cleanStudentCPF(rawCPF);
  if (!cleanDigits || cleanDigits.length < 9) return null;

  return studentList.find((s) => {
    if (!s) return false;
    const sCpf = (s.cleanCPF || s.cpf || '').replace(/\D/g, '');
    return sCpf === cleanDigits || (sCpf.length === 11 && cleanDigits.length === 11 && sCpf === cleanDigits);
  }) || null;
}

// Cruzamento universal de aluno por Telefone, CPF, E-mail ou ID
export function matchStudentByPhone(phoneOrIdOrCpf, studentList = []) {
  if (!phoneOrIdOrCpf || !Array.isArray(studentList) || studentList.length === 0) return null;

  const targetStr = String(phoneOrIdOrCpf).trim();
  const targetDigits = targetStr.replace(/\D/g, '');

  // 1. Verificação por CPF (se possuir 11 dígitos ou formatação com pontos/traço)
  if (targetDigits.length === 11 && (targetStr.includes('.') || targetStr.includes('-') || !targetStr.startsWith('55'))) {
    const byCpf = matchStudentByCPF(targetDigits, studentList);
    if (byCpf) return byCpf;
  }

  // 2. Busca direta por id, waId, CPF ou cleanDigits exato
  const exact = studentList.find((s) => {
    if (!s) return false;
    if (s.id === targetStr || s.waId === targetStr) return true;
    if (s.cleanCPF && s.cleanCPF === targetDigits) return true;
    if (s.cleanDigits && s.cleanDigits === targetDigits) return true;
    if (s.email && targetStr.includes('@') && s.email.toLowerCase() === targetStr.toLowerCase()) return true;
    return false;
  });
  if (exact) return exact;

  if (!targetDigits || targetDigits.length < 8) return null;

  // 3. Busca por sufixo de 8 ou 9 dígitos de telefone (tolera variações de DDI 55 ou nono dígito)
  const last8 = targetDigits.slice(-8);
  const last9 = targetDigits.length >= 9 ? targetDigits.slice(-9) : null;

  return studentList.find((s) => {
    if (!s) return false;
    if (s.cleanCPF && s.cleanCPF === targetDigits) return true;
    if (!s.cleanDigits) return false;
    const sDigits = s.cleanDigits;
    if (last9 && sDigits.endsWith(last9)) return true;
    if (sDigits.endsWith(last8)) return true;
    return false;
  }) || null;
}

// Parser universal blindado para o padrão EduControl (Base44)
// Campos Essenciais: Nome Completo, CPF, Telefone e E-mail
// Trata UTF-8 com/sem BOM, separadores vírgula e ponto-e-vírgula, aspas escapadas e quebras de linha
export function parseEduControlFile(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') return [];

  // Remove BOM UTF-8 se presente
  const cleanContent = fileContent.replace(/^\uFEFF/, '').trim();
  if (!cleanContent) return [];

  // Parser RFC-4180 completo com suporte a quebras de linha e aspas internas
  const tokenizeCSV = (text) => {
    // Detecta delimitador da primeira linha de cabeçalho
    const firstLineEnd = text.search(/\r?\n/);
    const headerLine = firstLineEnd !== -1 ? text.substring(0, firstLineEnd) : text;

    const tabCount = (headerLine.match(/\t/g) || []).length;
    const pipeCount = (headerLine.match(/\|/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;

    let delimiter = ',';
    if (tabCount > semicolonCount && tabCount > commaCount && tabCount > pipeCount) {
      delimiter = '\t';
    } else if (pipeCount > semicolonCount && pipeCount > commaCount) {
      delimiter = '|';
    } else if (semicolonCount >= commaCount) {
      delimiter = ';';
    }

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Pula aspa duplicada
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Pula \n de CRLF
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  const rows = tokenizeCSV(cleanContent);
  if (rows.length < 2) return [];

  // Normalização de cabeçalhos
  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  );

  const findIdx = (keywords) =>
    headers.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));

  // Mapeamento dos 4 Campos Essenciais do Padrão Base44
  const nameIdx = findIdx(['nome_completo', 'nome_aluno', 'nome', 'aluno', 'estudante', 'cliente', 'razao']);
  const cpfIdx = findIdx(['cpf', 'cpf_aluno', 'cpf_do_aluno', 'documento', 'doc', 'cpf_cnpj', 'identificacao']);
  const phoneIdx = findIdx(['telefone', 'celular', 'whatsapp', 'phone', 'contato', 'tel', 'fone', 'telefone_1', 'celular_1', 'movel']);
  const emailIdx = findIdx(['email', 'e_mail', 'e_mail_aluno', 'e_mail_do_aluno', 'mail', 'correio', 'correio_eletronico']);

  // Mapeamento de Campos Secundários / Acadêmicos do EduControl
  const courseIdx = findIdx(['curso', 'course', 'programa', 'especializacao', 'graduacao', 'pos', 'titulo']);
  const statusIdx = findIdx(['status', 'situacao', 'estado', 'fase', 'condicao', 'academic_status']);
  const poloIdx = findIdx(['polo', 'unidade', 'campus', 'cidade', 'filial', 'municipio']);
  const matriculaIdx = findIdx(['matricula', 'ra', 'registro', 'id_aluno', 'codigo', 'inscricao']);
  const assigneeIdx = findIdx(['consultor', 'responsavel', 'atendente', 'tutor', 'orientador', 'vendedor']);

  const parsedStudents = [];
  const seenCPFs = new Set();
  const seenPhones = new Set();

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    // 4 Campos Essenciais do EduControl Base44
    const rawName = nameIdx !== -1 ? cols[nameIdx] : cols[0] || '';
    const rawCpf = cpfIdx !== -1 ? cols[cpfIdx] : '';
    const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : (cpfIdx === -1 && cols.length > 1 ? cols[1] : '');
    const rawEmail = emailIdx !== -1 ? cols[emailIdx] : '';

    // Campos Acadêmicos Opcionais
    const rawCourse = courseIdx !== -1 ? cols[courseIdx] : 'Pós-Graduação & MBA';
    const rawStatus = statusIdx !== -1 ? cols[statusIdx] : 'Ativo';
    const rawPolo = poloIdx !== -1 ? cols[poloIdx] : 'Polo Matriz';
    const rawMatricula = matriculaIdx !== -1 ? cols[matriculaIdx] : `EC-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawAssignee = assigneeIdx !== -1 ? cols[assigneeIdx] : '';

    if (!rawName && !rawPhone && !rawCpf) continue;

    const cpfInfo = cleanStudentCPF(rawCpf);
    const phoneInfo = cleanStudentPhone(rawPhone);

    // Chave de unicidade primária por CPF, com fallback para telefone
    const primaryKey = cpfInfo.cleanDigits
      ? `cpf_${cpfInfo.cleanDigits}`
      : (phoneInfo.cleanDigits ? `phone_${phoneInfo.cleanDigits}` : `row_${i}`);

    // Deduplicação interna no CSV: previne repetição de CPF ou Telefone no mesmo lote
    if (cpfInfo.cleanDigits && seenCPFs.has(cpfInfo.cleanDigits)) {
      continue;
    }
    if (!cpfInfo.cleanDigits && phoneInfo.cleanDigits && seenPhones.has(phoneInfo.cleanDigits)) {
      continue;
    }

    if (cpfInfo.cleanDigits) seenCPFs.add(cpfInfo.cleanDigits);
    if (phoneInfo.cleanDigits) seenPhones.add(phoneInfo.cleanDigits);

    // Normalização visual do status acadêmico
    const normStatus = (rawStatus || '').toLowerCase();
    let academicStatus = 'Ativo';
    if (normStatus.includes('certif') || normStatus.includes('diplom') || normStatus.includes('conclui')) {
      academicStatus = 'Certificado';
    } else if (normStatus.includes('veteran') || normStatus.includes('antig') || normStatus.includes('reing')) {
      academicStatus = 'Veterano';
    } else if (normStatus.includes('tranc') || normStatus.includes('canc') || normStatus.includes('desist')) {
      academicStatus = 'Trancado';
    } else if (normStatus.includes('inadimp') || normStatus.includes('bloq') || normStatus.includes('pendent')) {
      academicStatus = 'Inadimplente';
    } else if (normStatus.includes('lead') || normStatus.includes('interess')) {
      academicStatus = 'Lead';
    }

    // Identificador único de sistema: prioriza CPF
    const studentId = cpfInfo.cleanDigits
      ? `ec_cpf_${cpfInfo.cleanDigits}`
      : (phoneInfo.waId || `ec_${phoneInfo.cleanDigits || i}`);

    parsedStudents.push({
      id: studentId,
      waId: phoneInfo.waId || (phoneInfo.cleanDigits ? `wa-${phoneInfo.cleanDigits}` : ''),
      cpf: cpfInfo.formattedCPF || rawCpf,
      cleanCPF: cpfInfo.cleanDigits,
      cpfValid: cpfInfo.isValid,
      cleanDigits: phoneInfo.cleanDigits,
      name: rawName || (cpfInfo.formattedCPF ? `Aluno CPF ${cpfInfo.formattedCPF}` : `Aluno (${phoneInfo.formattedPhone})`),
      phone: phoneInfo.formattedPhone || rawPhone,
      email: rawEmail,
      course: rawCourse || 'Gestão Educacional',
      academicStatus,
      polo: rawPolo || 'Matriz São Paulo',
      matricula: rawMatricula,
      assignee: rawAssignee || 'Gabriel Carvalho',
      department: academicStatus === 'Certificado' || academicStatus === 'Veterano'
        ? 'Secretaria Acadêmica'
        : 'Comercial',
      financialStatus: academicStatus === 'Inadimplente' ? 'Mensalidade Pendente' : 'Adimplente (Asaas OK)',
      origin: 'EduControl (Base44)',
      importedAt: new Date().toISOString()
    });
  }

  return parsedStudents;
}

// Base Pré-Carregada Oficial de Alunos Reconhecidos (Olavo Bilac / Grupo EstudeMais)
// Contendo os 4 campos essenciais: Nome Completo, CPF, Telefone e E-mail
export const INITIAL_EDUCONTROL_STUDENTS = [
  {
    id: 'ec_cpf_12345678901',
    waId: 'wa-5511987654321',
    cleanDigits: '5511987654321',
    cpf: '123.456.789-01',
    cleanCPF: '12345678901',
    cpfValid: true,
    name: 'Lucas Mendes',
    phone: '+55 (11) 98765-4321',
    email: 'lucas.mendes@escolaexemplo.com.br',
    course: 'MBA em Gestão Escolar e Inovação',
    academicStatus: 'Ativo',
    polo: 'Polo Campinas',
    matricula: 'EC-2024-8841',
    assignee: 'Gabriel Carvalho',
    department: 'Secretaria Acadêmica',
    financialStatus: 'Adimplente (Split Asaas OK)',
    progress: '78%',
    avgGrade: '9.4',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'ec_cpf_23456789012',
    waId: 'wa-5519971234567',
    cleanDigits: '5519971234567',
    cpf: '234.567.890-12',
    cleanCPF: '23456789012',
    cpfValid: true,
    name: 'Juliana Rocha',
    phone: '+55 (19) 97123-4567',
    email: 'juliana.rocha@clinica.med.br',
    course: 'Pós em Neuropsicopedagogia Clínica',
    academicStatus: 'Certificado',
    polo: 'Polo São Paulo Matriz',
    matricula: 'EC-2023-4109',
    assignee: 'Tatiane',
    department: 'Secretaria Acadêmica',
    financialStatus: 'Quadro Concluído • Diploma Emitido',
    progress: '100%',
    avgGrade: '9.8',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'ec_cpf_34567890123',
    waId: 'wa-5521998881122',
    cleanDigits: '5521998881122',
    cpf: '345.678.901-23',
    cleanCPF: '34567890123',
    cpfValid: true,
    name: 'Carlos Eduardo',
    phone: '+55 (21) 99888-1122',
    email: 'carlos.edu@colegioestudante.com.br',
    course: 'Formação Pedagógica em História',
    academicStatus: 'Veterano',
    polo: 'Polo Rio de Janeiro',
    matricula: 'EC-2022-1205',
    assignee: 'Luiz Augusto',
    department: 'Coordenação Pedagógica',
    financialStatus: 'Adimplente (Contrato Renovado)',
    progress: '85%',
    avgGrade: '8.7',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'ec_cpf_45678901234',
    waId: 'wa-5541988776655',
    cleanDigits: '5541988776655',
    cpf: '456.789.012-34',
    cleanCPF: '45678901234',
    cpfValid: true,
    name: 'Mariana Silveira',
    phone: '+55 (41) 98877-6655',
    email: 'mariana.silveira@pedagogia.edu.br',
    course: 'Licenciatura em Pedagogia',
    academicStatus: 'Ativo',
    polo: 'Polo Curitiba',
    matricula: 'EC-2024-9120',
    assignee: 'Gabriel Carvalho',
    department: 'Secretaria Acadêmica',
    financialStatus: 'Adimplente',
    progress: '45%',
    avgGrade: '9.1',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'ec_cpf_56789012345',
    waId: 'wa-5531991238899',
    cleanDigits: '5531991238899',
    cpf: '567.890.123-45',
    cleanCPF: '56789012345',
    cpfValid: true,
    name: 'Roberto Albuquerque',
    phone: '+55 (31) 99123-8899',
    email: 'roberto.alb@universidade.com.br',
    course: 'MBA em Docência no Ensino Superior',
    academicStatus: 'Certificado',
    polo: 'Polo Belo Horizonte',
    matricula: 'EC-2023-7762',
    assignee: 'Tatiane',
    department: 'Secretaria Acadêmica',
    financialStatus: 'Certificado Emitido e Registrado MEC',
    progress: '100%',
    avgGrade: '9.6',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'ec_cpf_67890123456',
    waId: 'wa-5571992345566',
    cleanDigits: '5571992345566',
    cpf: '678.901.234-56',
    cleanCPF: '67890123456',
    cpfValid: true,
    name: 'Fernanda Souza',
    phone: '+55 (71) 99234-5566',
    email: 'fernanda.souza@adv.oab.org.br',
    course: 'Pós em Direito Educacional e Regulação MEC',
    academicStatus: 'Veterano',
    polo: 'Polo Salvador',
    matricula: 'EC-2022-3341',
    assignee: 'Luiz Augusto',
    department: 'Coordenação Pedagógica',
    financialStatus: 'Adimplente',
    progress: '92%',
    avgGrade: '9.0',
    origin: 'EduControl (Base44)',
    importedAt: '2026-10-15T00:00:00Z'
  }
];
