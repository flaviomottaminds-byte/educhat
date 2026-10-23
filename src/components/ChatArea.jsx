import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Sparkles,
  Hash,
  Lock,
  Smile,
  Mic,
  FileText,
  X,
  Download,
  Image as ImageIcon,
  HelpCircle,
  Bot,
  Trash2,
  Edit2,
  Calendar,
  UserPlus,
  Play,
  Pause,
  Smartphone,
  UserCheck,
  Headphones,
  PhoneCall,
  Reply,
  ChevronDown,
  Check,
  GraduationCap,
  Award,
  BookOpen,
  Volume2,
  UserMinus,
  AlertCircle,
  RotateCcw,
  Info,
  Forward,
  CheckCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { hasFullPortfolioAccess, isChatAssignedToUser, canUserViewChat, matchesDepartment, getChatAssignedToId, normalizeName } from '../lib/portfolioAccess';
import { getSaoPauloTime } from '../lib/timezone';
import { matchStudentByPhone } from '../lib/eduControl';
import { formatLastSeen } from '../lib/presence';
import StudentDossierModal from './StudentDossierModal';
import FileAttachmentCard from './FileAttachmentCard';
import ForwardMessageModal from './ForwardMessageModal';
import MessageReadInfoModal from './MessageReadInfoModal';
import MessageItem from './MessageItem';
import { extractAttachmentFromText, openDocument, downloadDocument, resolvePublicMediaUrl } from '../lib/attachmentParser';
import { processAudioSource, playDecodedAudioBuffer, getSupportedAudioMimeType, resolvePublicAudioUrl } from '../lib/audioStreamHelper';
import { toast } from '../lib/toast';

export default function ChatArea({
  activeChat,
  activeView,
  chatMeta, // { type: 'channel' | 'dm' | 'whatsapp', data: Channel | Collaborator | WhatsAppContact }
  messages,
  onSendMessage,
  onCreateTaskFromMessage,
  onDeleteTaskFromMessage,
  onDeleteMessage,
  onDeleteChat,
  onOpenTaskDetail,
  onScheduleTask,
  onDelegateTask,
  onSummarizeChat,
  onOpenWhatsAppDossier,
  onToggleWhatsAppAI,
  onUpdateChatAssignment,
  onRemoveCoAssignee,
  currentUser,
  realtimeStatus = 'connected',
  channels = [],
  collaborators = [],
  eduControlStudents = [],
  onForwardMessage
}) {
  const [inputText, setInputText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [activeDelegateId, setActiveDelegateId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // Estado para Resposta / Quote (Item 5)
  const [forwardingMessage, setForwardingMessage] = useState(null); // Estado para Encaminhamento de Mensagem
  const [isStudentDossierOpen, setIsStudentDossierOpen] = useState(false); // Dossiê Acadêmico EduControl
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState(null); // Modal WhatsApp de Dados da Mensagem (Lida por)

  // Estado do Seletor Interativo de Fila & Responsável (Item 1)
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const assignmentPopoverRef = useRef(null);
  
  // Estado para Gravação de Áudio Nativo com MediaRecorder (Item 2)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const recordedMimeTypeRef = useRef('');
  const recordedExtensionRef = useRef('webm');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-ajuste de altura do campo de digitação (expansível de 1 linha até max 120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const isWhatsApp = chatMeta?.type === 'whatsapp' || activeChat?.type === 'whatsapp';
  const isDM = chatMeta?.type === 'dm' || activeChat?.type === 'dm';
  const isChannel = chatMeta?.type === 'channel' || activeChat?.type === 'channel' || (!isWhatsApp && !isDM);
  const target = chatMeta?.data || {};
  const isBotChat = isDM && (target?.isBot || target?.id === 'u_ia_copilot');

  const isGeral = isChannel && (
    target?.id === 'c-geral' ||
    target?.id === 'geral' ||
    target?.name?.toLowerCase() === 'geral' ||
    activeChat?.id === 'c-geral' ||
    activeChat?.id === 'geral'
  );

  // 1. AUTO-FOCUS GLOBAL NA SELEÇÃO DE CONTATO/GRUPO (INTERNO E EXTERNO):
  // Sempre que o utilizador clicar no nome de um colega na aba "Equipe Interna" OU num aluno na aba "WhatsApp",
  // o sistema aciona .focus({ preventScroll: true }) diretamente no textarea da mensagem.
  useEffect(() => {
    const focusInput = () => {
      if (textareaRef.current) {
        try {
          textareaRef.current.focus({ preventScroll: true });
        } catch {
          textareaRef.current.focus();
        }
      }
    };

    // Foca imediatamente e também no próximo frame/tick para garantir após troca de rotas e render do DOM
    focusInput();
    const rafId = requestAnimationFrame(focusInput);
    const timerId = setTimeout(focusInput, 40);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [
    activeChat?.type,
    activeChat?.id,
    activeView,
    chatMeta?.type,
    chatMeta?.data?.id,
    target?.id,
    target?.phone
  ]);

  // 2. RECIBOS DE LEITURA (READ RECEIPTS) EM CANAIS E CONVERSAS 1-A-1:
  // Toda a vez que um utilizador visualizar ou focar na conversa aberta,
  // dá UPDATE nas mensagens recentes, fazendo push do currentUser.id para o array read_by (em canais)
  // ou marcando is_read = true e STATUS:read (em DMs)
  const [localReadByMap, setLocalReadByMap] = useState({});
  const markedReadIdsRef = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.id) return;

    const markRecentMessagesAsRead = () => {
      try {
        if (typeof document !== 'undefined' && document.hidden) return;
        const recent = Array.isArray(messages) ? messages.slice(-50) : [];
        const pendingMapUpdates = {};

        recent.forEach((m) => {
          if (!m || !m.id || m.senderId === 'system' || m.senderId === currentUser.id || String(m.id).startsWith('temp_')) return;

          if (isChannel) {
            // Em canais/grupos: adiciona currentUser.id ao read_by de forma 100% segura
            let currentList = [];
            const rawVal = localReadByMap?.[m.id] ?? (Array.isArray(m?.read_by) ? m.read_by : (Array.isArray(m?.readBy) ? m.readBy : null));
            if (Array.isArray(rawVal)) {
              currentList = [...rawVal];
            } else if (typeof rawVal === 'string') {
              try {
                const parsed = JSON.parse(rawVal);
                if (Array.isArray(parsed)) currentList = [...parsed];
                else currentList = rawVal.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
              } catch {
                currentList = rawVal.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
              }
            }

            const isAlreadyInList = Array.isArray(currentList) && currentList.includes(currentUser.id);
            if (!isAlreadyInList) {
              if (markedReadIdsRef.current?.has(m.id)) return;
              markedReadIdsRef.current?.add(m.id);

              const nextReadBy = Array.from(new Set([...(Array.isArray(currentList) ? currentList : []), currentUser.id]));
              pendingMapUpdates[m.id] = nextReadBy;

              supabase
                .from('messages')
                .update({ read_by: nextReadBy })
                .eq('id', m.id)
                .then(({ error }) => {
                  if (error && (error.code === '42703' || error.message?.includes('read_by'))) {
                    const rawText = m.text || '';
                    const cleanText = rawText.replace(/<!-- READ_BY:[\s\S]*?-->/g, '').trim();
                    const fallbackText = `${cleanText} <!-- READ_BY:${JSON.stringify(nextReadBy)} -->`;
                    supabase
                      .from('messages')
                      .update({ text: fallbackText })
                      .eq('id', m.id)
                      .catch(() => {});
                  }
                })
                .catch(() => {});
            }
          } else if (isDM) {
            // Em conversas 1 a 1: marca is_read = true e STATUS:read
            const isRead =
              m.is_read === true ||
              m.status === 'read' ||
              (typeof m.text === 'string' && m.text.includes('<!-- STATUS:read -->'));

            if (!isRead) {
              if (markedReadIdsRef.current?.has(m.id)) return;
              markedReadIdsRef.current?.add(m.id);

              const rawText = m.text || '';
              const newText = rawText.includes('<!-- STATUS:')
                ? rawText.replace(/<!-- STATUS:[^\s>]+ -->/g, '<!-- STATUS:read -->')
                : `${rawText}\n<!-- STATUS:read -->`;

              supabase
                .from('messages')
                .update({
                  text: newText,
                  recipient_id: currentUser.id,
                  is_read: true,
                  read_by: [currentUser.id]
                })
                .eq('id', m.id)
                .then(({ error }) => {
                  if (error) {
                    supabase
                      .from('messages')
                      .update({
                        text: newText,
                        recipient_id: currentUser.id
                      })
                      .eq('id', m.id)
                      .catch(() => {});
                  }
                })
                .catch(() => {});
            }
          }
        });

        // Atualiza o mapa de leitura local em lote único para evitar re-renders em cascata
        if (Object.keys(pendingMapUpdates).length > 0) {
          setLocalReadByMap((prev) => ({ ...(prev || {}), ...pendingMapUpdates }));
        }
      } catch (err) {
        console.warn('[markRecentMessagesAsRead] Erro não fatal:', err);
      }
    };

    // Debounce de 300ms para evitar chamadas contínuas durante digitação ou transições
    const readTimer = setTimeout(() => {
      markRecentMessagesAsRead();
    }, 300);

    const handleFocusOrVisible = () => {
      markRecentMessagesAsRead();
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      clearTimeout(readTimer);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [messages?.length, isGeral, isChannel, isDM, currentUser?.id]);

  // Reconhecimento inteligente do aluno na base EduControl
  const matchedStudent = isWhatsApp
    ? matchStudentByPhone(target?.id || target?.phone, eduControlStudents)
    : null;

  const [selectedDept, setSelectedDept] = useState(target?.department || 'Comercial');
  const [selectedAssignee, setSelectedAssignee] = useState(target?.assignee || '');
  const [selectedCoAssignees, setSelectedCoAssignees] = useState(() => {
    const list = Array.isArray(target?.assignees)
      ? target.assignees.filter((a) => a && a !== target?.assignee)
      : [];
    return list;
  });
  const [selectedStatus, setSelectedStatus] = useState(target?.status || 'carteira_ativa');

  useEffect(() => {
    if (target) {
      setSelectedDept(target?.department || 'Comercial');
      setSelectedAssignee(target?.assignee || '');
      setSelectedStatus(target?.status || 'carteira_ativa');
      const list = Array.isArray(target?.assignees)
        ? target.assignees.filter((a) => a && a !== target?.assignee)
        : [];
      setSelectedCoAssignees(list);
    }
  }, [target?.id, target?.department, target?.assignee, target?.status, JSON.stringify(target?.assignees || [])]);

  // Fechar popover de atribuição ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assignmentPopoverRef.current && !assignmentPopoverRef.current.contains(e.target)) {
        setIsAssignmentOpen(false);
      }
    };
    if (isAssignmentOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAssignmentOpen]);

  const handleSaveAssignment = () => {
    const targetChatId = target?.id || chatMeta?.data?.id || chatMeta?.id;
    if (onUpdateChatAssignment && targetChatId) {
      let statusLabel = 'Carteira Ativa';
      if (selectedStatus === 'lead_instagram') {
        statusLabel = 'Lead Instagram - Expansão';
      } else if (selectedStatus === 'veterano_retencao') {
        statusLabel = 'Aluno Veterano';
      } else if (selectedStatus === 'ura_inedito') {
        statusLabel = 'Triagem Inicial';
      } else if (selectedDept) {
        statusLabel = `Carteira • ${selectedDept}`;
      }

      const allAssignees = Array.from(new Set([selectedAssignee, ...selectedCoAssignees].filter(Boolean)));

      onUpdateChatAssignment(targetChatId, {
        department: selectedDept,
        assignee: selectedAssignee,
        assignees: allAssignees,
        status: selectedStatus || 'carteira_ativa',
        statusLabel
      });
    }
    setIsAssignmentOpen(false);
  };

  // 2. LIMPEZA NA INTERFACE (FRONTEND):
  // Garante mensagens únicas no chat, fundindo o estado da mensagem otimista com a confirmada pelo servidor
  const uniqueMessages = useMemo(() => {
    try {
      if (!Array.isArray(messages) || messages.length === 0) return [];

      const result = [];
      const seenIds = new Set();
      const seenSignatures = new Map(); // key: "side:cleanBody:timestamp" -> index in result

      for (const m of messages) {
        if (!m || typeof m !== 'object') continue;

        // Se for mensagem de sistema, preserva
        if (m.senderId === 'system' || m.sender_id === 'system') {
          if (m.id) seenIds.add(m.id);
          result.push(m);
          continue;
        }

        // Deduplicação estrita por ID
        if (m.id && seenIds.has(m.id)) {
          continue;
        }

        // Blindagem estrita de isolamento de mensagens (Prevenção de State Leakage entre DMs)
        if (isDM && target?.id) {
          const isFromMe = m.senderId === currentUser?.id || m.sender_id === currentUser?.id || m.senderId === 'u_matriz' || Boolean(m.fromMe);
          const isFromTarget = m.senderId === target.id || m.sender_id === target.id;
          const isToTarget = m.recipientId === target.id || m.recipient_id === target.id;
          if (!isFromMe && !isFromTarget && !isToTarget) {
            continue;
          }
        }

        // Blindagem estrita de isolamento para Canais Internos
        if (isChannel && target?.id) {
          const targetChId = String(target.id).replace(/^c-/, '').toLowerCase();
          const mCh = m.channel_id || m.channelId || m.chat_id || m.chatId;
          if (mCh) {
            const cleanMCh = String(mCh).replace(/^c-/, '').toLowerCase();
            if (cleanMCh !== targetChId && mCh !== target.id) {
              continue;
            }
          }
        }

        // Blindagem estrita de isolamento para WhatsApp
        if (isWhatsApp && target?.id) {
          const mCh = m.chat_id || m.chatId;
          if (mCh && String(mCh).startsWith('c-')) {
            continue;
          }
        }

        const isMe =
          m.senderId === currentUser?.id ||
          m.sender_id === currentUser?.id ||
          m.senderId === 'u_matriz' ||
          Boolean(m.fromMe) ||
          (isWhatsApp && (m.senderId === 'u_ia_copilot' || m.senderId === 'bot' || (!m.fromStudent && m.senderId !== target?.id)));
        const cleanBody = (typeof m.text === 'string' ? m.text : '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
          .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
          .trim();
        const timeStr = getSaoPauloTime(m.timestamp || m.created_at);
        const signature = `${isMe ? 'out' : 'in'}:${cleanBody}:${timeStr}`;

        if (cleanBody && seenSignatures.has(signature)) {
          const existingIdx = seenSignatures.get(signature);
          const existing = result[existingIdx];

          const existingIsOptimistic = String(existing?.id || '').startsWith('m_') || String(existing?.id || '').startsWith('opt_');
          const incomingIsReal = String(m.id || '').startsWith('wa_');

          const statusWeight = { failed: 0, sent: 1, delivered: 2, read: 3 };
          const existingWeight = statusWeight[existing?.status] || 1;
          const incomingWeight = statusWeight[m.status] || (incomingIsReal ? 2 : 1);

          // Se a nova mensagem é do servidor ou tem status mais recente/confirmado, funde nela
          if (incomingIsReal || incomingWeight >= existingWeight || existingIsOptimistic) {
            result[existingIdx] = {
              ...existing,
              ...m,
              id: incomingIsReal ? m.id : (existing?.id || m.id),
              status: incomingWeight >= existingWeight ? (m.status || 'delivered') : existing?.status,
              senderId: existing?.senderId || m.senderId,
              senderName: existing?.senderName || m.senderName,
            };
            if (m.id) seenIds.add(m.id);
          }
          continue;
        }

        if (m.id) seenIds.add(m.id);
        if (cleanBody) {
          seenSignatures.set(signature, result.length);
        }
        result.push(m);
      }

      result.sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestampRaw || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestampRaw || b.timestamp || 0).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeA - timeB;
        }
        return 0;
      });

      return result;
    } catch (err) {
      console.warn('[ChatArea] uniqueMessages fallback seguro:', err);
      return Array.isArray(messages) ? messages.filter(Boolean) : [];
    }
  }, [messages, currentUser?.id, isDM, isWhatsApp, target?.id]);

  const scrollToBottom = (instant = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
    const raf = requestAnimationFrame(() => scrollToBottom(true));
    return () => cancelAnimationFrame(raf);
  }, [uniqueMessages, uniqueMessages?.length, chatMeta?.data?.id || chatMeta?.id]);

  // Limpeza de recursos ao desmontar
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleReply = useCallback((m) => {
    setReplyingTo(m);
    requestAnimationFrame(() => {
      try {
        textareaRef.current?.focus({ preventScroll: true });
      } catch {
        textareaRef.current?.focus();
      }
    });
  }, []);

  const handleForward = useCallback((m) => {
    setForwardingMessage(m);
  }, []);

  const handleOpenMessageInfo = useCallback((m) => {
    setSelectedMessageForInfo(m);
  }, []);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !pendingAttachment) return;

    const textToSend = inputText;
    const attachmentToSend = pendingAttachment;
    const replyingToSend = replyingTo;

    // Zero-Freeze Optimistic UI: Limpa imediatamente o input e previews no mesmo frame
    setInputText('');
    setPendingAttachment(null);
    setReplyingTo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    requestAnimationFrame(() => {
      scrollToBottom(true);
      try {
        textareaRef.current?.focus({ preventScroll: true });
      } catch {
        textareaRef.current?.focus();
      }
    });

    // Disparo em background sem travar o event loop da digitação
    onSendMessage(textToSend, attachmentToSend, {
      replyTo: replyingToSend ? { id: replyingToSend.id, senderName: replyingToSend.senderName, text: replyingToSend.text } : null,
      isAudio: false,
      audioUrl: null,
      isDM,
      channelId: isDM ? null : (activeChat?.id || null),
      recipientId: isDM ? (target?.id || activeChat?.id || null) : null
    }).catch((err) => {
      console.error('[ChatArea] Erro no envio assíncrono:', err);
    });
  };

  // Iniciar Gravação de Áudio Nativa com Seleção Dinâmica Cross-Browser (Item 1)
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não possui suporte para captura de áudio.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // SELEÇÃO DINÂMICA CROSS-BROWSER:
      // Testa a ordem: 1. audio/mp4, 2. audio/mpeg, 3. audio/webm, 4. audio/ogg
      // Se nenhuma for suportada, inicializa o MediaRecorder sem o parâmetro mimeType
      const { mimeType: chosenMime, extension: chosenExt } = getSupportedAudioMimeType();
      recordedMimeTypeRef.current = chosenMime;
      recordedExtensionRef.current = chosenExt;

      let recorder;
      try {
        if (chosenMime) {
          recorder = new MediaRecorder(stream, { mimeType: chosenMime });
        } else {
          // Deixa o navegador assumir o seu formato padrão nativo
          recorder = new MediaRecorder(stream);
        }
      } catch (recErr) {
        console.warn('Erro ao instanciar MediaRecorder com opções, usando formato nativo do navegador:', recErr);
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Erro ao acessar microfone:', err);
      alert('Permissão de microfone necessária para gravar mensagem de voz.');
    }
  };

  // Finalizar e Enviar Gravação de Áudio com Fluxo Obrigatório Estrito (Item 1 e 2)
  // 1º Upload no Storage -> 2º Garantir retorno da URL pública -> 3º Insert na tabela. Se falhar, aborte!
  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;
    const durationSec = recordingDuration;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);

    recorder.onstop = async () => {
      try {
        if (!audioChunksRef.current || audioChunksRef.current.length === 0) {
          toast.error('Nenhum áudio foi capturado.');
          return;
        }

        // Identifica o MIME type real gravado pelo navegador
        const mimeType = recorder.mimeType || recordedMimeTypeRef.current || '';
        const cleanMime = mimeType ? mimeType.split(';')[0].trim() : '';

        // Determina a extensão de acordo com o MIME type real gravado
        let ext = recordedExtensionRef.current || 'mp4';
        if (cleanMime.includes('mp4')) ext = 'mp4';
        else if (cleanMime.includes('mpeg') || cleanMime.includes('mp3')) ext = 'mp3';
        else if (cleanMime.includes('webm')) ext = 'webm';
        else if (cleanMime.includes('ogg')) ext = 'ogg';

        const blob = cleanMime
          ? new Blob(audioChunksRef.current, { type: cleanMime })
          : new Blob(audioChunksRef.current);

        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const filePath = `internal/${fileName}`;

        // ETAPA 1: Upload obrigatório no Supabase Storage (bucket 'chat-audios')
        let uploadError = null;
        try {
          const uploadOptions = {
            cacheControl: '3600',
            upsert: true
          };
          if (cleanMime) {
            uploadOptions.contentType = cleanMime;
          }

          const { error } = await supabase.storage
            .from('chat-audios')
            .upload(filePath, blob, uploadOptions);
          uploadError = error;
        } catch (uploadErr) {
          uploadError = uploadErr;
        }

        if (uploadError) {
          console.error('[Audio Storage] Falha no upload:', uploadError);
          toast.error(`Falha ao enviar áudio para o servidor: ${uploadError.message || 'Erro no Storage'}. Envio cancelado.`);
          return; // ABORTA A OPERAÇÃO IMEDIATAMENTE!
        }

        // ETAPA 2: Garantir retorno da URL pública válida do Storage
        const { data: pubData } = supabase.storage
          .from('chat-audios')
          .getPublicUrl(filePath);

        const publicAudioUrl = pubData?.publicUrl;

        if (!publicAudioUrl || !publicAudioUrl.startsWith('http')) {
          console.error('[Audio Storage] Falha ao gerar URL pública:', pubData);
          toast.error('Não foi possível gerar a URL pública do áudio gravado. Envio cancelado.');
          return; // ABORTA A OPERAÇÃO!
        }

        // ETAPA 3: Insert na tabela messages via onSendMessage com a URL pública
        const attachment = {
          name: fileName,
          size: `${(blob.size / 1024).toFixed(1)} KB`,
          type: cleanMime,
          url: publicAudioUrl,
          dataUrl: publicAudioUrl, // Leve, sem strings Base64 gigantes
          storagePath: filePath,
          duration: formattedTime,
          isAudio: true,
          isImage: false
        };

        const sendResult = await onSendMessage(
          `🎙️ Mensagem de voz (${formattedTime})`,
          attachment,
          {
            replyTo: replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text } : null,
            isAudio: true,
            audioUrl: publicAudioUrl,
            duration: formattedTime,
            isDM,
            channelId: isDM ? null : (activeChat?.id || null),
            recipientId: isDM ? (target?.id || activeChat?.id || null) : null
          }
        );

        if (sendResult && sendResult.success === false) {
          console.error("Erro no Insert:", sendResult.error);
          return;
        }

        setReplyingTo(null);
      } finally {
        audioChunksRef.current = [];
        try {
          recorder.stream?.getTracks().forEach((track) => track.stop());
        } catch {}
      }
    };

    try {
      recorder.stop();
    } catch {}
  };

  // Cancelar Gravação de Áudio (Item 2)
  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
  };

  // Upload de arquivos (Item 8) com separação estrita de Imagens e Documentos
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
        dataUrl: reader.result,
        url: reader.result,
        isImage: isImage,
        isAudio: false
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    e.target.value = null;
  };

  // Tratamento do evento onPaste: permite colar links e texto puro imediatamente,
  // ou intercepta arquivos/mídias (ex: PrintScreen / Ctrl+V de imagem) para anexo
  const handlePaste = (e) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    const files = clipboard.files;
    const text = clipboard.getData('text') || clipboard.getData('text/plain');

    // 1. Prioridade para texto simples / links (Google Meet, URLs, mensagens de texto):
    // Se o clipboard contiver texto e não houver arquivos anexados, injeta o texto diretamente
    // no estado e posiciona o cursor adequadamente sem bloquear a colagem
    if (text && (!files || files.length === 0)) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? inputText.length;
        const end = textarea.selectionEnd ?? inputText.length;
        const before = inputText.slice(0, start);
        const after = inputText.slice(end);
        const newText = before + text + after;
        setInputText(newText);

        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const nextCursor = start + text.length;
            textareaRef.current.selectionStart = nextCursor;
            textareaRef.current.selectionEnd = nextCursor;
          }
        });
      } else {
        setInputText((prev) => prev + text);
      }
      return;
    }

    // 2. Se contiver arquivos/mídias (ex: colagem de captura de tela / screenshot):
    if (files && files.length > 0) {
      const file = files[0];
      if (file && (file.type || file.size > 0)) {
        e.preventDefault();
        const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
        const reader = new FileReader();
        reader.onload = () => {
          setPendingAttachment({
            name: file.name || (isImage ? 'imagem_colada.png' : 'arquivo_colado'),
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type || (isImage ? 'image/png' : 'application/octet-stream'),
            dataUrl: reader.result,
            url: reader.result,
            isImage: isImage,
            isAudio: false
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Helper para formatar nomes nos grupos
  const getShortName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts[0] === 'Ana' && parts.length > 1) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0];
  };

  // Membros reais vinculados a este canal específico
  const channelMembersText = !isDM && !isWhatsApp && (collaborators || []).length > 0
    ? target?.department === 'Todos'
      ? `Toda a equipe (${(collaborators || []).length} membros)`
      : (collaborators || [])
          .filter((c) => c && !c.isBot && (c.department === target?.department || c.roleType === 'diretor'))
          .map((c) => getShortName(c?.name || ''))
          .join(', ')
    : '';

  const isManager = hasFullPortfolioAccess(currentUser);
  const canView = !isWhatsApp || canUserViewChat(target, currentUser, collaborators);

  // 2. BLINDAGEM DE VISIBILIDADE DOS GRUPOS/CANAIS:
  // Se for canal da Equipe Interna e usuário for Comum, só pode ver #geral e o canal do seu próprio departamento
  if (isChannel && !isManager) {
    const userDept = (currentUser?.department || '').trim().toLowerCase();
    const chName = (target?.name || '').trim().toLowerCase();
    const chDept = (target?.department || '').trim().toLowerCase();
    const isChannelGeral = isGeral || chName === 'geral' || target?.id === 'c-geral' || chDept === 'todos';
    const isMyDept = userDept && (chDept === userDept || chName === userDept);

    if (!isChannelGeral && !isMyDept) {
      return (
        <section className="flex-1 flex flex-col items-center justify-center h-full bg-[#efeae2] dark:bg-chatBg p-8 text-center relative transition-colors">
          <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Lock size={26} />
            </div>
            <h3 className="text-base font-bold text-chatTextTitle">Canal Restrito ao Departamento</h3>
            <p className="text-xs text-chatTextMuted leading-relaxed">
              Você não possui permissão para visualizar as mensagens do canal <strong>#{target?.name || 'Canal'}</strong>.
              <br /><br />
              Por diretriz de privacidade e organização dos setores, seu acesso é restrito ao canal <strong>#geral</strong> e ao seu departamento (<strong>{currentUser?.department || 'Setor'}</strong>).
            </p>
          </div>
        </section>
      );
    }
  }

  if (isWhatsApp && !canView) {
    const isUnassigned = getChatAssignedToId(target, collaborators) === null;
    return (
      <section className="flex-1 flex flex-col items-center justify-center h-full bg-[#efeae2] dark:bg-chatBg p-8 text-center relative transition-colors">
        <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <Lock size={26} />
          </div>
          <h3 className="text-base font-bold text-chatTextTitle">Atendimento Fora da Sua Carteira</h3>
          <p className="text-xs text-chatTextMuted leading-relaxed">
            {isUnassigned
              ? 'Este atendimento pertence à Fila Geral (Triagem) e aguarda distribuição pela Gestão.'
              : <>Esta conversa do WhatsApp está atribuída a <strong>{target?.assignee || 'outro consultor'}</strong> ({target?.department || 'Comercial'}).</>}
            <br /><br />
            Por diretriz de privacidade e segurança da equipe, você só possui acesso aos atendimentos sob sua responsabilidade direta.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-chatBg relative transition-colors">
      {/* Header do Chat - Estilo Exato WhatsApp Web */}
      <div className="h-16 px-4 bg-chatPanel border-b border-chatBorder flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          {isWhatsApp ? (
            <div className="relative text-3xl shrink-0">
              <span>{target.avatar || '👤'}</span>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatPanel bg-emerald-500" />
            </div>
          ) : isDM ? (
            <div className="relative text-3xl shrink-0">
              <span>{target.avatar || '👤'}</span>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-chatPanel ${
                  target.online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                title={target.online ? 'Online' : target.lastSeen ? `Visto por último ${formatLastSeen(target.lastSeen)}` : 'Offline'}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white dark:bg-chatCard flex items-center justify-center text-brand-600 dark:text-brand-500 font-bold border border-slate-200 dark:border-chatBorder shadow-xs shrink-0">
              <Hash size={18} />
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-chatTextTitle font-semibold text-sm leading-tight flex items-center gap-2 truncate">
              <span className="truncate">{matchedStudent?.name || target.name}</span>
              {isWhatsApp ? (
                matchedStudent ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                    matchedStudent.academicStatus === 'Ativo'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : matchedStudent.academicStatus === 'Certificado'
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                      : matchedStudent.academicStatus === 'Veterano'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}>
                    <GraduationCap size={11} /> {matchedStudent.academicStatus} • {matchedStudent.course}
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                    <Smartphone size={10} /> WhatsApp Aluno
                  </span>
                )
              ) : isBotChat ? (
                <span className="text-[10px] bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-300 dark:border-purple-500/30 shrink-0">
                  <Bot size={11} /> IA 24h
                </span>
              ) : isDM ? (
                <span className="text-[10px] bg-slate-200/80 dark:bg-purple-500/20 text-[#54656f] dark:text-purple-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-300 dark:border-purple-500/30 shrink-0">
                  <Lock size={9} /> Privado
                </span>
              ) : null}
            </h2>
            {isWhatsApp ? (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#667781] dark:text-chatTextMuted mt-0.5">
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">
                  📱 {target.phone}
                </span>
                {matchedStudent && (
                  <>
                    {matchedStudent.cpf && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                        <span className="font-mono text-purple-700 dark:text-purple-300 font-medium shrink-0">
                          CPF: {matchedStudent.cpf}
                        </span>
                      </>
                    )}
                    <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                    <span className="text-purple-700 dark:text-purple-300 font-medium shrink-0">
                      📍 {matchedStudent.polo} ({matchedStudent.matricula})
                    </span>
                  </>
                )}
                <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>

                {/* Seletor Interativo de Fila & Responsável (Totalmente Clicável com Modal) */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept(target.department || 'Comercial');
                    setSelectedAssignee(target.assignee || '');
                    setSelectedStatus(target.status || 'carteira_ativa');
                    const coList = Array.isArray(target.assignees)
                      ? target.assignees.filter((a) => a && a !== target.assignee)
                      : [];
                    setSelectedCoAssignees(coList);
                    setIsAssignmentOpen(true);
                  }}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-chatCard hover:bg-brand-50 dark:hover:bg-brand-950/50 border border-slate-300 dark:border-chatBorder hover:border-brand-500 shadow-2xs hover:shadow-xs transition text-chatTextTitle cursor-pointer select-none shrink-0"
                  title="Clique para abrir o seletor de Fila e Consultor Responsável deste atendimento"
                >
                  <span className="text-[11px] leading-tight">
                    Fila: <strong className="text-brand-700 dark:text-brand-400 font-bold">{target.department || 'Comercial'}</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-[11px] leading-tight">
                    Resp: <strong className="font-bold text-chatTextTitle">
                      {target.assignee || 'Aguardando'}
                      {Array.isArray(target.assignees) && target.assignees.length > 1 && (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold ml-1">
                          (+{target.assignees.length - 1} co-resp)
                        </span>
                      )}
                    </strong>
                  </span>
                  <ChevronDown size={12} className="text-brand-600 dark:text-brand-400 group-hover:translate-y-0.5 transition-transform" />
                </button>

                {/* Botão de Retirada da Co-atribuição ("Sair do Atendimento") */}
                {isWhatsApp && Array.isArray(target.assignees) && target.assignees.length > 1 && isChatAssignedToUser(target, currentUser) && (
                  <button
                    type="button"
                    onClick={() => onRemoveCoAssignee && onRemoveCoAssignee(target.id, currentUser?.name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600 text-[10.5px] font-bold transition cursor-pointer shadow-2xs"
                    title="Retirar-se deste atendimento compartilhado, mantendo os outros responsáveis"
                  >
                    <UserMinus size={12} />
                    <span>Sair do Atendimento</span>
                  </button>
                )}

                <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                {realtimeStatus === 'connected' ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Tempo Real Ativo
                  </span>
                ) : realtimeStatus === 'connecting' ? (
                  <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    Conectando...
                  </span>
                ) : (
                  <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Reconectando
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#667781] dark:text-chatTextMuted flex items-center gap-2 truncate">
                <span className="truncate max-w-[280px] md:max-w-md">
                  {isBotChat
                    ? 'Base normativa MEC, Asaas, POPs e fluxos operacionais'
                    : isDM
                    ? target.online
                      ? 'online'
                      : target.lastSeen
                      ? `visto por último ${formatLastSeen(target.lastSeen)}`
                      : 'offline'
                    : channelMembersText || target.desc || 'Canal de comunicação'}
                </span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                {realtimeStatus === 'connected' ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Tempo Real Ativo
                  </span>
                ) : realtimeStatus === 'connecting' ? (
                  <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    Conectando...
                  </span>
                ) : (
                  <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Reconectando
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Botões de Inteligência e Ações */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Hand-off Toggle Humano vs IA no WhatsApp */}
          {isWhatsApp && (
            <button
              onClick={() => onToggleWhatsAppAI && onToggleWhatsAppAI(target.id)}
              title={target.aiActive ? "Clique para pausar a IA e assumir o atendimento humano" : "Clique para passar o atendimento para a IA"}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 shadow-2xs ${
                target.aiActive
                  ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
              }`}
            >
              {target.aiActive ? (
                <>
                  <Bot size={13} className="animate-pulse text-purple-600" />
                  <span className="hidden sm:inline">IA Ativa (Pausar)</span>
                  <span className="sm:hidden">IA</span>
                </>
              ) : (
                <>
                  <UserCheck size={13} className="text-emerald-600" />
                  <span className="hidden sm:inline">Atendimento Humano</span>
                  <span className="sm:hidden">Humano</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onOpenWhatsAppDossier}
            title="Importar e analisar histórico longo do WhatsApp com IA para gerar Dossiê e Cards"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-500/30 text-xs font-semibold shadow-xs transition"
          >
            <FileText size={14} className="text-brand-600 dark:text-brand-400" />
            <span className="hidden sm:inline">Dossiê WhatsApp</span>
            <span className="sm:hidden">Dossiê</span>
          </button>

          <button
            onClick={onSummarizeChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 hover:bg-slate-50 dark:hover:bg-purple-600/30 border border-slate-200 dark:border-purple-500/30 text-xs font-medium shadow-xs transition"
          >
            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">{isDM ? 'Resumir' : 'Resumo'}</span>
          </button>

          {matchedStudent && (
            <button
              onClick={() => setIsStudentDossierOpen(true)}
              title="Abrir Dossiê Acadêmico e Histórico do Aluno"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 text-purple-700 dark:text-purple-300 hover:from-purple-100 hover:to-indigo-100 border border-purple-200 dark:border-purple-500/30 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <GraduationCap size={14} className="text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Dossiê do Aluno</span>
              <span className="sm:hidden">Dossiê</span>
            </button>
          )}

          {onDeleteChat && (
            <button
              onClick={() => onDeleteChat(target?.id || chatMeta?.data?.id || chatMeta?.id)}
              title="Excluir histórico desta conversa permanentemente do EduChat e do Supabase"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Trash2 size={13} className="text-rose-600 dark:text-rose-400" />
              <span className="hidden sm:inline">Excluir Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Sticky de Reconhecimento Automático do Aluno */}
      {isWhatsApp && matchedStudent && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border-b border-purple-200 dark:border-purple-500/20 px-4 py-2 flex items-center justify-between text-xs text-purple-950 dark:text-purple-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold flex items-center gap-1.5 shrink-0 text-purple-700 dark:text-purple-300">
              <GraduationCap size={15} />
              Aluno Reconhecido na Base:
            </span>
            <span className="font-semibold truncate">
              {matchedStudent.name} {matchedStudent.cpf ? `(CPF: ${matchedStudent.cpf})` : ''} • <strong>{matchedStudent.course}</strong> • {matchedStudent.polo}
            </span>
            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              matchedStudent.academicStatus === 'Ativo'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : matchedStudent.academicStatus === 'Certificado'
                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200'
                : matchedStudent.academicStatus === 'Veterano'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
            }`}>
              {matchedStudent.academicStatus}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10.5px] text-purple-700 dark:text-purple-300 font-medium hidden md:inline">
              Resp: {matchedStudent.assignee} ({matchedStudent.department})
            </span>
            <button
              type="button"
              onClick={() => setIsStudentDossierOpen(true)}
              className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10.5px] font-bold transition cursor-pointer shadow-2xs"
            >
              Ver Ficha 360º
            </button>
          </div>
        </div>
      )}

      {/* Banner Sticky de Contexto de Triagem para WhatsApp */}
      {isWhatsApp && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold flex items-center gap-1 shrink-0">
              <Smartphone size={13} className="text-emerald-600" />
              Triagem & Carteira:
            </span>
            <span className="truncate">{target.triageContext || 'Atendimento WhatsApp oficial integrado ao EduChat.'}</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
            target.status === 'carteira_ativa'
              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
              : target.status === 'veterano_retencao'
              ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
              : target.status === 'lead_instagram'
              ? 'bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-950/60 dark:to-rose-950/60 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-500/30'
              : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
          }`}>
            {target.statusLabel || 'WhatsApp'}
          </span>
        </div>
      )}

      {/* Sugestões de Perguntas Rápidas ao conversar com a IA (Item 6) */}
      {isBotChat && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/30 border-b border-purple-200 dark:border-purple-500/30 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1 shrink-0">
            <HelpCircle size={13} /> Dúvidas frequentes:
          </span>
          <button
            onClick={() => onSendMessage('Qual o prazo do MEC para emissão de diplomas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            📜 Prazo MEC para Diplomas
          </button>
          <button
            onClick={() => onSendMessage('Como funciona o split de faturamento e retificação no Asaas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            💳 Split no Asaas
          </button>
          <button
            onClick={() => onSendMessage('Qual o procedimento POP para reposição de aulas e notas?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            📝 POP Reposição de Aulas
          </button>
          <button
            onClick={() => onSendMessage('Quem são os parceiros VIP e quais suas regras?')}
            className="px-2.5 py-1 bg-white dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full border border-purple-200 dark:border-purple-500/40 shrink-0 shadow-2xs font-medium transition"
          >
            👑 Polos VIP
          </button>
        </div>
      )}

      {/* Área de Mensagens com Textura Oficial do WhatsApp */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2.5 whatsapp-bg">
        {(uniqueMessages || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#667781]">
            <div className="bg-white/85 dark:bg-chatCard/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-sm shadow-sm space-y-2">
              <span className="text-4xl block">{target?.avatar || '💬'}</span>
              <p className="text-sm font-bold text-chatTextTitle">
                {isBotChat
                  ? 'Assistente IA Institucional'
                  : isDM
                  ? `Conversa com ${target?.name || 'Colega'}`
                  : `Canal #${target?.name || 'Geral'}`}
              </p>
              <p className="text-xs text-[#667781] leading-relaxed">
                {isBotChat
                  ? 'Pergunte qualquer dúvida sobre regulação MEC, prazos, emissão de certificados, Asaas e procedimentos operacionais da faculdade.'
                  : 'As mensagens trocadas neste canal são corporativas e monitoradas pelo copiloto de IA.'}
              </p>
            </div>
          </div>
        ) : (
          (uniqueMessages || []).map((m) => {
            if (!m || typeof m !== 'object') return null;
            const isMe = m.senderId === currentUser?.id || m.sender_id === currentUser?.id;
            const isBot = m.senderId === 'u_ia_copilot' || m.sender_id === 'u_ia_copilot';

            return (
              <MessageItem
                key={m.id || Math.random()}
                message={m}
                isMe={isMe}
                isBot={isBot}
                isDM={isDM}
                isChannel={isChannel}
                isWhatsApp={isWhatsApp}
                collaborators={collaborators}
                currentUser={currentUser}
                readBy={localReadByMap?.[m.id] ?? m.read_by ?? m.readBy ?? []}
                onReply={handleReply}
                onForward={handleForward}
                onDeleteMessage={onDeleteMessage}
                onCreateTaskFromMessage={onCreateTaskFromMessage}
                onDeleteTaskFromMessage={onDeleteTaskFromMessage}
                onOpenTaskDetail={onOpenTaskDetail}
                onScheduleTask={onScheduleTask}
                onDelegateTask={onDelegateTask}
                onOpenMessageInfo={handleOpenMessageInfo}
                onSendMessage={onSendMessage}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada / Digitação com Anexo, Citação e Áudio Nativo */}
      <div className="p-2.5 bg-[#f0f2f5] dark:bg-chatPanel border-t border-chatBorder">
        {/* Barra de Visualização da Mensagem Respondida (Quote Preview - Item 5) */}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-white dark:bg-chatCard border-l-4 border-brand-600 dark:border-brand-500 rounded-r-lg flex items-center justify-between text-xs shadow-xs animate-in fade-in slide-in-from-bottom-1">
            <div className="flex flex-col truncate pr-2">
              <span className="font-bold text-brand-600 dark:text-brand-400 text-[11px] flex items-center gap-1">
                <Reply size={12} /> Respondendo a {replyingTo.senderName || 'Mensagem'}:
              </span>
              <span className="text-chatTextMuted truncate text-[12px] mt-0.5">
                {replyingTo.attachment
                  ? (replyingTo.attachment.type?.startsWith('audio/') || replyingTo.attachment.isAudio
                      ? '🎙️ Mensagem de voz'
                      : `[Arquivo] ${replyingTo.attachment.name}`)
                  : (replyingTo.text?.replace(/<!--[\s\S]*?-->/g, '').replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '').replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '').replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '').trim() || '🎙️ Mensagem de voz')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-red-500 transition rounded-full shrink-0"
              title="Cancelar resposta"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Preview do arquivo pronto para envio (Item 8) */}
        {pendingAttachment && (
          <div className="mb-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-500/30 rounded-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 truncate">
              {pendingAttachment.type?.startsWith('image/') ? (
                <ImageIcon size={16} className="text-blue-500 shrink-0" />
              ) : (
                <FileText size={16} className="text-rose-500 shrink-0" />
              )}
              <span className="font-semibold text-brand-900 dark:text-brand-200 truncate">
                {pendingAttachment.name}
              </span>
              <span className="text-[10px] text-brand-700 dark:text-brand-400">
                ({pendingAttachment.size})
              </span>
            </div>
            <button
              onClick={() => setPendingAttachment(null)}
              className="p-1 text-slate-500 hover:text-red-500 transition rounded-full"
              title="Remover anexo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Sugestões Rápidas de IA */}
        <div className="mb-1.5 px-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#667781] dark:text-chatTextMuted flex items-center gap-1">
            <Sparkles size={11} className="text-brand-600 dark:text-brand-500" /> Ações rápidas:
          </span>
          <button
            onClick={() => setInputText('/tarefa ')}
            className="text-[10px] text-brand-600 dark:text-brand-500 hover:underline bg-white dark:bg-brand-500/10 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent font-medium shadow-2xs"
          >
            /tarefa [descrição]
          </button>
          <button
            onClick={() => onSendMessage(isDM ? `Oi ${target.name?.split(' ')[0]}, preciso que você verifique essa demanda` : '@IA listar pendências')}
            className="text-[10px] text-purple-700 dark:text-purple-400 hover:underline bg-white dark:bg-purple-500/10 px-2 py-0.5 rounded border border-slate-200 dark:border-transparent font-medium shadow-2xs"
          >
            {isDM ? `Cobrar ${target.name?.split(' ')[0]}` : '@IA listar pendências'}
          </button>
        </div>

        {/* Formulário de Envio ou Interface de Gravação de Voz Nativa (Item 2) */}
        {isRecording ? (
          <div className="flex items-center justify-between bg-white dark:bg-chatInputBg px-4 py-2.5 rounded-lg border border-rose-300 dark:border-rose-500/40 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse" />
              <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                {Math.floor(recordingDuration / 60)}:{recordingDuration % 60 < 10 ? '0' : ''}{recordingDuration % 60}
              </span>
              <span className="text-xs text-chatTextMuted hidden sm:inline">
                Gravando áudio de voz nativo...
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition"
                title="Descartar gravação"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                title="Concluir e enviar áudio"
              >
                <Send size={14} />
                <span>Enviar Áudio</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Input de arquivo invisível (Item 8) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
            />

            <button
              type="button"
              onClick={() => {
                setInputText((prev) => prev + ' 😊');
                try {
                  textareaRef.current?.focus({ preventScroll: true });
                } catch {
                  textareaRef.current?.focus();
                }
              }}
              className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-chatTextTitle transition rounded-full"
              title="Inserir Emoji"
            >
              <Smile size={22} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-[#54656f] dark:text-chatTextMuted hover:text-brand-600 transition rounded-full"
              title="Anexar documento ou imagem"
            >
              <Paperclip size={22} />
            </button>

            <textarea
              ref={textareaRef}
              autoFocus
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              onPaste={handlePaste}
              placeholder={pendingAttachment ? "Adicione uma legenda ou envie..." : replyingTo ? `Respondendo a ${replyingTo.senderName}...` : "Digite uma mensagem"}
              spellCheck={false}
              autoCorrect="off"
              autoComplete="off"
              autoCapitalize="off"
              data-gramm="false"
              className="flex-1 bg-white dark:bg-chatInputBg text-chatTextTitle text-[14px] placeholder:text-[#54656f] dark:placeholder:text-chatTextMuted px-4 py-2.5 rounded-lg border-none focus:outline-none shadow-xs transition resize-none max-h-32 min-h-[42px] leading-relaxed scrollbar-thin"
            />

            {inputText.trim() || pendingAttachment ? (
              <button
                type="submit"
                className="p-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-sm flex items-center justify-center transition"
                title="Enviar mensagem"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2 text-[#54656f] dark:text-chatTextMuted hover:text-brand-600 transition rounded-full"
                title="Gravar mensagem de voz nativa"
              >
                <Mic size={22} />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Modal de Dossiê Acadêmico 360º do Aluno EduControl */}
      <StudentDossierModal
        isOpen={isStudentDossierOpen}
        onClose={() => setIsStudentDossierOpen(false)}
        student={matchedStudent}
      />

      {/* Modal Interativo de Reatribuição de Fila & Consultor Responsável (Sticky Assignment) */}
      {isAssignmentOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setIsAssignmentOpen(false)}
        >
          <div
            className="bg-white dark:bg-chatPanel w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-chatBorder flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="p-4 sm:px-5 bg-gradient-to-r from-brand-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-yellow-300 border border-white/20">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm leading-tight text-white">
                      Reatribuir Fila & Consultor
                    </h3>
                    <span className="text-[9.5px] bg-white/20 px-2 py-0.2 rounded-full font-semibold border border-white/20">
                      Permanência Ativa
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 mt-0.5 truncate max-w-xs sm:max-w-md">
                    {matchedStudent?.name || target.name || 'Contato WhatsApp'} • {target.phone || ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignmentOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Informações Atuais */}
              <div className="p-3 bg-slate-50 dark:bg-chatCard rounded-xl border border-slate-200 dark:border-chatBorder grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-[10px] font-bold text-chatTextMuted uppercase block">Fila Atual</span>
                  <span className="font-bold text-brand-700 dark:text-brand-400 text-xs">{target.department || 'Comercial'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-chatTextMuted uppercase block">Consultor Atual</span>
                  <span className="font-bold text-chatTextTitle text-xs">{target.assignee || 'Aguardando Atribuição'}</span>
                </div>
              </div>

              {/* 1. Seleção de Fila / Departamento da Faculdade */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1.5">
                  1. Fila de Atendimento (Departamento da Faculdade):
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    const newDept = e.target.value;
                    setSelectedDept(newDept);
                    const deptCollab = (collaborators || []).find((c) => !c.isBot && matchesDepartment(c.department, newDept));
                    if (deptCollab) setSelectedAssignee(deptCollab.name);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium cursor-pointer"
                >
                  <option value="Comercial">🎯 Comercial (Matrículas & Vendas)</option>
                  <option value="Tutoria">🎓 Tutoria & Apoio Pedagógico</option>
                  <option value="Secretaria">📋 Secretaria Acadêmica & Documentos</option>
                  <option value="Pedagógico">👨‍🏫 Coordenação Pedagógica</option>
                  <option value="Expansão">🚀 Expansão & Parcerias de Polos</option>
                  <option value="Financeiro">💰 Financeiro & Boletos</option>
                  <option value="Marketing">👩‍🎨 Marketing & Comunicação</option>
                  <option value="Diretoria">👑 Diretoria & Gestão Executiva</option>
                </select>
              </div>

              {/* 2. Seleção de Consultor Responsável */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-chatTextMuted">
                    2. Consultor Responsável:
                  </label>
                  <span className="text-[10.5px] text-brand-600 dark:text-brand-400 font-bold">
                    {selectedAssignee ? `Selecionado: ${selectedAssignee}` : 'Fila Geral'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 dark:border-chatBorder rounded-xl bg-slate-50/50 dark:bg-chatSidebar/30">
                  {/* Opção Fila Geral */}
                  <button
                    type="button"
                    onClick={() => setSelectedAssignee('')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                      !selectedAssignee
                        ? 'border-brand-500 bg-brand-50/90 dark:bg-brand-950/60 shadow-xs ring-1 ring-brand-500'
                        : 'border-slate-200 dark:border-chatBorder bg-white dark:bg-chatCard hover:bg-slate-50 dark:hover:bg-chatPanel'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-chatSidebar flex items-center justify-center text-sm shrink-0">
                      👥
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-chatTextTitle text-xs truncate">Fila Geral</p>
                      <p className="text-[10px] text-chatTextMuted truncate">Sem atendente fixo</p>
                    </div>
                  </button>

                  {/* Lista Completa de Colaboradores / Consultores (Ordenados com prioridade para a fila selecionada) */}
                  {(collaborators || [])
                    .filter((c) => !c.isBot)
                    .sort((a, b) => {
                      const aMatch = matchesDepartment(a.department, selectedDept);
                      const bMatch = matchesDepartment(b.department, selectedDept);
                      if (aMatch && !bMatch) return -1;
                      if (!aMatch && bMatch) return 1;
                      return (a.name || '').localeCompare(b.name || '');
                    })
                    .map((collab) => {
                      const isSelected = selectedAssignee === collab.name;
                      const isDeptMatch = matchesDepartment(collab.department, selectedDept);
                      return (
                        <button
                          key={collab.id}
                          type="button"
                          onClick={() => {
                            setSelectedAssignee(collab.name);
                            if (collab.department) {
                              setSelectedDept(collab.department);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer relative ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50/90 dark:bg-brand-950/60 shadow-xs ring-1 ring-brand-500'
                              : isDeptMatch
                              ? 'border-brand-200 dark:border-brand-900/50 bg-white dark:bg-chatCard hover:bg-brand-50/40'
                              : 'border-slate-200 dark:border-chatBorder bg-white dark:bg-chatCard hover:bg-slate-50 dark:hover:bg-chatPanel opacity-90'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            {collab.name?.charAt(0) || 'U'}
                          </div>
                          <div className="truncate flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-chatTextTitle text-xs truncate">{collab.name}</p>
                              {isDeptMatch && (
                                <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 shrink-0">
                                  Fila
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-chatTextMuted truncate">{collab.department || collab.role}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 2.1 Co-atribuição Provisória de Múltiplos Usuários (Trabalho Cruzado entre Departamentos) */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <UserPlus size={13} className="text-purple-600 dark:text-purple-400" />
                    <span>Co-responsáveis Provisórios (Multi-departamental):</span>
                  </label>
                  <span className="text-[10.5px] font-bold text-purple-700 dark:text-purple-300">
                    {selectedCoAssignees.length > 0 ? `${selectedCoAssignees.length} co-responsável(is)` : 'Nenhum co-responsável'}
                  </span>
                </div>

                <p className="text-[10.5px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                  Permite que consultores de outros setores (ex: Secretaria + Comercial) acompanhem e respondam juntos neste mesmo atendimento. Qualquer um poderá se retirar a qualquer momento.
                </p>

                {/* Chips de Co-responsáveis selecionados */}
                {selectedCoAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCoAssignees.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-chatCard text-purple-800 dark:text-purple-300 font-bold text-xs border border-purple-300 dark:border-purple-700 shadow-2xs"
                      >
                        <span>👤 {name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCoAssignees((prev) => prev.filter((n) => n !== name))}
                          className="text-purple-500 hover:text-red-500 transition cursor-pointer"
                          title={`Remover ${name} da co-atribuição`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown para Adicionar Co-responsável de Qualquer Departamento */}
                <div className="flex gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !selectedCoAssignees.includes(val) && val !== selectedAssignee) {
                        setSelectedCoAssignees((prev) => [...prev, val]);
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-xs p-2 rounded-xl bg-white dark:bg-chatCard border border-purple-200 dark:border-purple-800/60 text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium cursor-pointer"
                  >
                    <option value="">➕ Adicionar consultor de outro setor como Co-responsável...</option>
                    {(collaborators || [])
                      .filter((c) => !c.isBot && c.name !== selectedAssignee && !selectedCoAssignees.includes(c.name))
                      .map((collab) => (
                        <option key={collab.id} value={collab.name}>
                          {collab.name} ({collab.department || 'Geral'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 3. Tipo de Carteira */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-chatTextMuted mb-1.5">
                  3. Tipo de Carteira:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-chatCard border border-slate-200 dark:border-chatBorder text-chatTextTitle focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium cursor-pointer"
                >
                  <option value="carteira_ativa">💼 Carteira Ativa (Permanência Contínua)</option>
                  <option value="lead_instagram">🎯 Lead Instagram - Expansão</option>
                  <option value="veterano_retencao">🎓 Aluno Veterano (Retenção)</option>
                  <option value="ura_inedito">🤖 Triagem URA (Autoatendimento)</option>
                </select>
              </div>

              {/* Banner de Permanência de Carteira (Sticky Assignment) */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Regra de Permanência de Carteira (Sticky Assignment):
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Ao salvar, a alteração é gravada imediatamente no Supabase e distribuída via Realtime para toda a equipe. Todas as próximas mensagens e rechamadas deste contato serão mantidas diretamente com o consultor selecionado.
                </p>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="p-4 bg-slate-50 dark:bg-chatSidebar border-t border-slate-200 dark:border-chatBorder flex items-center justify-between">
              <span className="text-[11px] text-chatTextMuted">
                {selectedAssignee ? `Atribuindo a ${selectedAssignee}` : 'Atribuindo para Fila Geral'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignmentOpen(false)}
                  className="px-4 py-2 text-xs text-chatTextMuted hover:text-chatTextTitle font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  Salvar e Atribuir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Encaminhamento de Mensagem */}
      {forwardingMessage && (
        <ForwardMessageModal
          isOpen={Boolean(forwardingMessage)}
          onClose={() => setForwardingMessage(null)}
          message={forwardingMessage}
          currentUser={currentUser}
          channels={channels}
          collaborators={collaborators}
          onConfirmForward={async (target) => {
            if (onForwardMessage) {
              await onForwardMessage(forwardingMessage, target);
            }
          }}
        />
      )}

      {/* Modal WhatsApp-Style de Dados da Mensagem (Quem já leu no Grupo) */}
      <MessageReadInfoModal
        isOpen={Boolean(selectedMessageForInfo)}
        onClose={() => setSelectedMessageForInfo(null)}
        message={selectedMessageForInfo}
        collaborators={collaborators}
        channelName={target?.name || activeChat?.name || 'geral'}
        localReadByMap={localReadByMap}
        currentUser={currentUser}
      />
    </section>
  );
}
