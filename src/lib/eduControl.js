// =========================================================================
// NÚCLEO DE DADOS & INTELIGÊNCIA EDUCONTROL (FACULDADE OLAVO BILAC / ESTUDEMAIS)
// Gerencia a base de alunos, reconhecimento em tempo real e sincronização
// =========================================================================

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

// Cruzamento inteligente de telefone com a base do EduControl
export function matchStudentByPhone(phoneOrId, studentList = []) {
  if (!phoneOrId || !Array.isArray(studentList) || studentList.length === 0) return null;

  const targetDigits = String(phoneOrId).replace(/\D/g, '');
  if (!targetDigits || targetDigits.length < 8) return null;

  // 1. Busca direta por cleanDigits ou id
  const exact = studentList.find((s) => {
    if (!s) return false;
    if (s.id === phoneOrId || s.waId === phoneOrId) return true;
    if (s.cleanDigits && s.cleanDigits === targetDigits) return true;
    return false;
  });
  if (exact) return exact;

  // 2. Busca por sufixo de 8 ou 9 dígitos (tolera variações de DDI ou 9º dígito)
  const last8 = targetDigits.slice(-8);
  const last9 = targetDigits.length >= 9 ? targetDigits.slice(-9) : null;

  return studentList.find((s) => {
    if (!s || !s.cleanDigits) return false;
    const sDigits = s.cleanDigits;
    if (last9 && sDigits.endsWith(last9)) return true;
    if (sDigits.endsWith(last8)) return true;
    return false;
  }) || null;
}

// Parser universal de arquivos EduControl (.csv, .txt, delimitados por vírgula, ponto e vírgula, tabulação ou pipe)
export function parseEduControlFile(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') return [];

  // Remove BOM UTF-8 se presente
  const cleanContent = fileContent.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Detecta delimitador da primeira linha
  const headerLine = lines[0];
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

  // Divisão de campos respeitando aspas
  const parseLine = (line) => {
    const row = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  };

  const headers = parseLine(headerLine).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
  );

  const findIdx = (keywords) => headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const nameIdx = findIdx(['nome', 'name', 'aluno', 'estudante', 'cliente', 'razao']);
  const phoneIdx = findIdx(['telefone', 'celular', 'whatsapp', 'phone', 'contato', 'tel', 'fone', 'movel']);
  const courseIdx = findIdx(['curso', 'course', 'programa', 'especializacao', 'graduacao', 'pos', 'titulo']);
  const statusIdx = findIdx(['status', 'situacao', 'estado', 'fase', 'condicao', 'academic_status']);
  const poloIdx = findIdx(['polo', 'unidade', 'campus', 'cidade', 'filial', 'municipio']);
  const matriculaIdx = findIdx(['matricula', 'ra', 'registro', 'id_aluno', 'codigo', 'inscricao']);
  const assigneeIdx = findIdx(['consultor', 'responsavel', 'atendente', 'tutor', 'orientador', 'vendedor']);
  const emailIdx = findIdx(['email', 'mail', 'correio']);

  const parsedStudents = [];
  const seenPhones = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const rawName = nameIdx !== -1 ? cols[nameIdx] : cols[0] || '';
    const rawPhone = phoneIdx !== -1 ? cols[phoneIdx] : cols[1] || '';
    const rawCourse = courseIdx !== -1 ? cols[courseIdx] : 'Pós-Graduação & MBA';
    const rawStatus = statusIdx !== -1 ? cols[statusIdx] : 'Ativo';
    const rawPolo = poloIdx !== -1 ? cols[poloIdx] : 'Polo Matriz';
    const rawMatricula = matriculaIdx !== -1 ? cols[matriculaIdx] : `EC-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawAssignee = assigneeIdx !== -1 ? cols[assigneeIdx] : 'Tatiane';
    const rawEmail = emailIdx !== -1 ? cols[emailIdx] : '';

    if (!rawName && !rawPhone) continue;

    const phoneInfo = cleanStudentPhone(rawPhone);
    const cleanKey = phoneInfo.cleanDigits || `unknown_${i}`;

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

    if (!seenPhones.has(cleanKey)) {
      seenPhones.add(cleanKey);
      parsedStudents.push({
        id: phoneInfo.waId || `ec_${cleanKey}`,
        waId: phoneInfo.waId || `wa-${cleanKey}`,
        cleanDigits: phoneInfo.cleanDigits,
        name: rawName || `Aluno EduControl (${phoneInfo.formattedPhone})`,
        phone: phoneInfo.formattedPhone || rawPhone,
        course: rawCourse || 'Gestão Educacional',
        academicStatus,
        polo: rawPolo || 'Matriz São Paulo',
        matricula: rawMatricula,
        assignee: rawAssignee || 'Gabriel Carvalho',
        email: rawEmail,
        department: academicStatus === 'Certificado' || academicStatus === 'Veterano'
          ? 'Secretaria Acadêmica'
          : 'Comercial',
        financialStatus: academicStatus === 'Inadimplente' ? 'Mensalidade Pendente' : 'Adimplente (Asaas OK)',
        origin: 'EduControl Base',
        importedAt: new Date().toISOString()
      });
    }
  }

  return parsedStudents;
}

// Base Pré-Carregada Oficial de Alunos Reconhecidos (Olavo Bilac / Grupo EstudeMais)
export const INITIAL_EDUCONTROL_STUDENTS = [
  {
    id: 'wa-5511987654321',
    waId: 'wa-5511987654321',
    cleanDigits: '5511987654321',
    name: 'Lucas Mendes',
    phone: '+55 (11) 98765-4321',
    course: 'MBA em Gestão Escolar e Inovação',
    academicStatus: 'Ativo',
    polo: 'Polo Campinas',
    matricula: 'EC-2024-8841',
    assignee: 'Gabriel Carvalho',
    department: 'Secretaria Acadêmica',
    email: 'lucas.mendes@escolaexemplo.com.br',
    financialStatus: 'Adimplente (Split Asaas OK)',
    progress: '78%',
    avgGrade: '9.4',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'wa-5519971234567',
    waId: 'wa-5519971234567',
    cleanDigits: '5519971234567',
    name: 'Juliana Rocha',
    phone: '+55 (19) 97123-4567',
    course: 'Pós em Neuropsicopedagogia Clínica',
    academicStatus: 'Certificado',
    polo: 'Polo São Paulo Matriz',
    matricula: 'EC-2023-4109',
    assignee: 'Tatiane',
    department: 'Secretaria Acadêmica',
    email: 'juliana.rocha@clinica.med.br',
    financialStatus: 'Quadro Concluído • Diploma Emitido',
    progress: '100%',
    avgGrade: '9.8',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'wa-5521998881122',
    waId: 'wa-5521998881122',
    cleanDigits: '5521998881122',
    name: 'Carlos Eduardo',
    phone: '+55 (21) 99888-1122',
    course: 'Formação Pedagógica em História',
    academicStatus: 'Veterano',
    polo: 'Polo Rio de Janeiro',
    matricula: 'EC-2022-1205',
    assignee: 'Luiz Augusto',
    department: 'Coordenação Pedagógica',
    email: 'carlos.edu@colegioestudante.com.br',
    financialStatus: 'Adimplente (Contrato Renovado)',
    progress: '85%',
    avgGrade: '8.7',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'wa-5541988776655',
    waId: 'wa-5541988776655',
    cleanDigits: '5541988776655',
    name: 'Mariana Silveira',
    phone: '+55 (41) 98877-6655',
    course: 'Licenciatura em Pedagogia',
    academicStatus: 'Ativo',
    polo: 'Polo Curitiba',
    matricula: 'EC-2024-9120',
    assignee: 'Gabriel Carvalho',
    department: 'Secretaria Acadêmica',
    email: 'mariana.silveira@pedagogia.edu.br',
    financialStatus: 'Adimplente',
    progress: '45%',
    avgGrade: '9.1',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'wa-5531991238899',
    waId: 'wa-5531991238899',
    cleanDigits: '5531991238899',
    name: 'Roberto Albuquerque',
    phone: '+55 (31) 99123-8899',
    course: 'MBA em Docência no Ensino Superior',
    academicStatus: 'Certificado',
    polo: 'Polo Belo Horizonte',
    matricula: 'EC-2023-7762',
    assignee: 'Tatiane',
    department: 'Secretaria Acadêmica',
    email: 'roberto.alb@universidade.com.br',
    financialStatus: 'Certificado Emitido e Registrado MEC',
    progress: '100%',
    avgGrade: '9.6',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'wa-5571992345566',
    waId: 'wa-5571992345566',
    cleanDigits: '5571992345566',
    name: 'Fernanda Souza',
    phone: '+55 (71) 99234-5566',
    course: 'Pós em Direito Educacional e Regulação MEC',
    academicStatus: 'Veterano',
    polo: 'Polo Salvador',
    matricula: 'EC-2022-3341',
    assignee: 'Luiz Augusto',
    department: 'Coordenação Pedagógica',
    email: 'fernanda.souza@adv.oab.org.br',
    financialStatus: 'Adimplente',
    progress: '92%',
    avgGrade: '9.0',
    origin: 'EduControl Matriz',
    importedAt: '2026-10-15T00:00:00Z'
  }
];
