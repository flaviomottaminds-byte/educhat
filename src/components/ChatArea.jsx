import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  UserMinus
} from 'lucide-react';
import { hasFullPortfolioAccess, isChatAssignedToUser, canUserViewChat, matchesDepartment } from '../lib/portfolioAccess';
import { getSaoPauloTime } from '../lib/timezone';
import { matchStudentByPhone } from '../lib/eduControl';
import { formatLastSeen } from '../lib/presence';
import StudentDossierModal from './StudentDossierModal';
import FileAttachmentCard from './FileAttachmentCard';
import { extractAttachmentFromText, openDocument, downloadDocument } from '../lib/attachmentParser';
import { processAudioSource, playDecodedAudioBuffer } from '../lib/audioStreamHelper';

// Helper para renderizar texto com links clicáveis (Item 6)
function FormattedMessageText({ text }) {
  if (!text) return null;
  // Remove comentários de controle interno e tags de anexo/áudio que não devem ser expostas como texto bruto
  const cleanText = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
    .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
    .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
    .trim();

  if (!cleanText) return null;

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = cleanText.split(urlRegex);

  return (
    <p className="leading-relaxed whitespace-pre-wrap text-[13.5px]">
      {parts.map((part, i) => {
        if (part && part.match(urlRegex)) {
          const href = part.startsWith('http://') || part.startsWith('https://') ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 break-all font-semibold transition"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
  );
}

// Helper para interceptar tags [ARQUIVO_ANEXO], metadados de áudio e sanitizar o texto da mensagem
function parseMessageContent(m) {
  if (!m) return { cleanText: '', isAudio: false, isOnlyAudioPlaceholder: true };

  const rawText = m.text || '';
  let extractedAttachment = m.attachment || null;

  // 1. Extração robusta de [ARQUIVO_ANEXO:{...}]
  const { attachment: parsedFromText, cleanText: sanitizedText } = extractAttachmentFromText(rawText);
  if (!extractedAttachment && parsedFromText) {
    extractedAttachment = parsedFromText;
  }

  let extractedAudioUrl = m.audioUrl || (extractedAttachment?.type?.startsWith('audio/') ? extractedAttachment.dataUrl : null);
  let isAudio = Boolean(m.isAudio || extractedAudioUrl);
  let duration = m.duration || extractedAttachment?.duration || null;
  let transcription = m.audioTranscription || null;

  if (extractedAttachment) {
    const isAudioType =
      extractedAttachment.type?.startsWith('audio/') ||
      extractedAttachment.isAudio ||
      extractedAttachment.name?.toLowerCase().includes('audio') ||
      /\.(ogg|opus|mp3|wav|webm|m4a)$/i.test(extractedAttachment.name || '');

    if (isAudioType) {
      isAudio = true;
      if (!extractedAudioUrl) {
        extractedAudioUrl = extractedAttachment.dataUrl || extractedAttachment.url || extractedAttachment.base64;
      }
      if (extractedAttachment.duration && !duration) {
        duration = extractedAttachment.duration;
      }
    }
  }

  // 2. Intercepta comentários de controle de áudio
  if (rawText.includes('<!-- AUDIO_URL:')) {
    const match = rawText.match(/<!-- AUDIO_URL:([\s\S]+?) -->/);
    if (match && !extractedAudioUrl) {
      extractedAudioUrl = match[1].trim();
      isAudio = true;
    }
  }

  if (rawText.includes('<!-- DURATION:')) {
    const match = rawText.match(/<!-- DURATION:([\s\S]+?) -->/);
    if (match && !duration) {
      duration = match[1].trim();
    }
  }

  if (rawText.includes('[ÁUDIO_TRANSCRIÇÃO:')) {
    const match = rawText.match(/\[ÁUDIO_TRANSCRIÇÃO:\s*"([\s\S]+?)"\]/) || rawText.match(/\[ÁUDIO_TRANSCRIÇÃO:\s*([\s\S]+?)\]/);
    if (match) {
      transcription = match[1].replace(/^["']|["']$/g, '');
    }
  }

  // 3. Limpa tags e metadados de controle do texto de exibição
  let cleanText = sanitizedText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
    .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
    .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
    .trim();

  // 4. Se o texto tiver indicador de áudio
  if (
    cleanText.includes('🎙️ [Áudio recebido via WhatsApp]') ||
    (cleanText.includes('🎙️') && (cleanText.includes('Áudio') || cleanText.includes('Mensagem de voz'))) ||
    cleanText.toLowerCase().includes('áudio recebido via whatsapp') ||
    rawText.includes('<!-- IS_AUDIO:true -->')
  ) {
    isAudio = true;
    if (!duration) {
      const durMatch = cleanText.match(/\((\d{1,2}:\d{2})\)/);
      if (durMatch) duration = durMatch[1];
    }
  }

  // Verifica se o texto restante é apenas o placeholder de áudio
  const isOnlyAudioPlaceholder =
    !cleanText ||
    cleanText === '🎙️ [Áudio recebido via WhatsApp]' ||
    /^🎙️\s*(Mensagem de voz|Áudio)\s*(\(\d{1,2}:\d{2}\))?$/i.test(cleanText.trim());

  return {
    cleanText,
    isOnlyAudioPlaceholder,
    attachment: extractedAttachment,
    audioUrl: extractedAudioUrl,
    isAudio: isAudio || Boolean(extractedAudioUrl),
    duration: duration || '0:14',
    transcription
  };
}

// Player interativo e de alta fidelidade para áudios do WhatsApp com suporte a codecs Opus/OGG e WebM
function AudioMessagePlayer({ audioUrl, duration = '0:14', transcription, isOutgoing = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  const webAudioHandleRef = useRef(null);

  // Converte fluxos (Base64, Data URLs ou HTTPS) em Blobs estáveis e detecta MIME / codecs exatos
  const audioSource = React.useMemo(() => {
    return processAudioSource(audioUrl);
  }, [audioUrl]);

  // Libera a URL do Blob criada quando o componente desmontar ou audioUrl mudar
  useEffect(() => {
    return () => {
      if (audioSource?.blobUrl && audioSource.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(audioSource.blobUrl);
        } catch {}
      }
      if (webAudioHandleRef.current) {
        try {
          webAudioHandleRef.current.stop();
        } catch {}
      }
    };
  }, [audioSource]);

  // Recarrega o elemento <audio> nativo quando a fonte ou blob mudar
  useEffect(() => {
    if (audioRef.current && audioSource.blobUrl) {
      try {
        audioRef.current.load();
        setAudioError(false);
      } catch (err) {
        console.warn('Erro ao carregar fontes de áudio no elemento <audio>:', err);
      }
    }
  }, [audioSource.blobUrl]);

  // Duração em segundos calculada
  const parsedDurationSec = React.useMemo(() => {
    if (typeof duration === 'number') return duration;
    if (typeof duration === 'string' && duration.includes(':')) {
      const [m, s] = duration.split(':').map(Number);
      return (m || 0) * 60 + (s || 14);
    }
    return 14;
  }, [duration]);

  const stopWebAudio = () => {
    if (webAudioHandleRef.current) {
      try {
        webAudioHandleRef.current.stop();
      } catch {}
      webAudioHandleRef.current = null;
    }
  };

  // Fallback acústico limpo de voz real: Web Audio PCM ou síntese de fala
  const triggerFallbackPlay = async () => {
    setIsPlaying(true);
    setProgress(0);

    // 1. Tenta decodificar o fluxo PCM real via Web Audio API caso haja arrayBuffer
    if (audioSource.arrayBuffer) {
      try {
        stopWebAudio();
        const handle = await playDecodedAudioBuffer(audioSource.arrayBuffer, playbackRate, () => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime('0:00');
          webAudioHandleRef.current = null;
        });
        if (handle) {
          webAudioHandleRef.current = handle;
          return;
        }
      } catch (err) {
        console.warn('Fallback Web Audio PCM falhou:', err);
      }
    }

    // 2. Se há transcrição e suporte a SpeechSynthesis (fala a transcrição em voz pt-BR)
    if ('speechSynthesis' in window && transcription) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(transcription);
      utterance.lang = 'pt-BR';
      utterance.rate = playbackRate;

      utterance.onend = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime('0:00');
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime('0:00');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
    }
  };

  // Alterna Reprodução e Pausa com Priorização Nativa e Fallback Decodificado
  const togglePlay = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopWebAudio();
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    // 1. Tenta reproduzir pelo elemento nativo com <source> tags
    if (audioRef.current && audioSource.blobUrl && !audioError) {
      audioRef.current.playbackRate = playbackRate;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setAudioError(false);
        return;
      } catch (err) {
        console.warn('HTML5 Audio play falhou, recorrendo a Web Audio PCM:', err);
        setAudioError(true);
      }
    }

    // 2. Se elemento nativo falhar, aciona reprodução decodificada sem ruídos
    await triggerFallbackPlay();
  };

  // Atualização de progresso durante simulação/fala ou reprodução Web Audio
  useEffect(() => {
    let interval = null;
    if (isPlaying && (audioError || webAudioHandleRef.current || !audioRef.current)) {
      const stepMs = 200;
      const totalSteps = (parsedDurationSec * 1000) / (stepMs * playbackRate);
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + (100 / totalSteps);
          if (next >= 100) {
            setIsPlaying(false);
            setCurrentTime(duration);
            return 100;
          }
          const curSecs = Math.floor((next / 100) * parsedDurationSec);
          const mins = Math.floor(curSecs / 60);
          const secs = curSecs % 60;
          setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
          return next;
        });
      }, stepMs);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioError, parsedDurationSec, playbackRate, duration]);

  // Manipuladores de Eventos do Elemento <audio> Nativo
  const handleTimeUpdate = () => {
    if (audioRef.current && !webAudioHandleRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || parsedDurationSec || 1;
      setProgress((current / total) * 100);
      const mins = Math.floor(current / 60);
      const secs = Math.floor(current % 60);
      setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime('0:00');
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    setProgress(clickPercent * 100);

    if (audioRef.current && audioRef.current.duration && !audioError) {
      audioRef.current.currentTime = clickPercent * audioRef.current.duration;
    } else {
      const curSecs = Math.floor(clickPercent * parsedDurationSec);
      const mins = Math.floor(curSecs / 60);
      const secs = curSecs % 60;
      setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    }
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  return (
    <div className="space-y-1.5 max-w-sm sm:max-w-md my-1">
      {/* Elemento de Player de Áudio Nativo do Navegador (<audio controls ... />) */}
      {audioSource.blobUrl ? (
        <div className="w-full max-w-xs">
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            className="w-full max-w-xs my-1 rounded-lg block accent-emerald-600 dark:accent-emerald-400"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={() => {
              console.warn('HTML5 Audio elemento onError disparado');
              setAudioError(true);
            }}
          >
            {audioSource.mimeType && (
              <source src={audioSource.blobUrl} type={audioSource.mimeType} />
            )}
            <source src={audioSource.blobUrl} type="audio/ogg; codecs=opus" />
            <source src={audioSource.blobUrl} type="audio/ogg" />
            <source src={audioSource.blobUrl} type="audio/webm; codecs=opus" />
            <source src={audioSource.blobUrl} type="audio/webm" />
            <source src={audioSource.blobUrl} type="audio/mp4" />
            <source src={audioSource.blobUrl} type="audio/mpeg" />
            <source src={audioSource.blobUrl} />
          </audio>
        </div>
      ) : (
        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
          <span className="text-chatTextMuted">🎙️ Mensagem de voz WhatsApp</span>
          {transcription && (
            <button
              type="button"
              onClick={triggerFallbackPlay}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px]"
            >
              Ouvir Leitura
            </button>
          )}
        </div>
      )}

      {/* Card do Player Estilo WhatsApp com Barra de Ondas */}
      <div className={`p-2.5 rounded-2xl border transition-all ${
        isOutgoing
          ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/40'
          : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
      }`}>
        <div className="flex items-center gap-3">
          {/* Botão Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition"
            title={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          {/* Área de Barra de Onda Interativa (Waveform) */}
          <div className="flex-1 space-y-1">
            <div
              className="relative flex items-center gap-0.5 sm:gap-1 h-6 items-end cursor-pointer py-1"
              onClick={handleSeek}
              title="Clique em qualquer ponto para avançar ou retroceder o áudio"
            >
              {[35, 70, 45, 85, 55, 100, 40, 80, 60, 95, 50, 75, 90, 40, 65, 85, 50, 70, 95, 60, 40, 80, 55, 30].map((h, idx) => {
                const barPercent = (idx / 24) * 100;
                const isActive = progress >= barPercent;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all duration-75 ${
                      isActive
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-emerald-600/30 dark:bg-emerald-400/30 hover:bg-emerald-500/50'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>

            {/* Tempo e Metadados */}
            <div className="flex items-center justify-between text-[10px] opacity-75 font-medium">
              <span>{isPlaying ? currentTime : duration}</span>
              <div className="flex items-center gap-2">
                {/* Botão de Velocidade (1x / 1.5x / 2x) */}
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 hover:bg-emerald-600 hover:text-white transition font-bold text-[9px]"
                  title="Alterar velocidade de reprodução"
                >
                  {playbackRate}x
                </button>
                <span>Voz WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Botão de Download */}
          {audioSource.blobUrl && (
            <a
              href={audioSource.blobUrl}
              download={audioSource.mimeType?.includes('webm') ? 'audio_whatsapp.webm' : 'audio_whatsapp.ogg'}
              className="p-2 text-slate-500 hover:text-emerald-600 transition rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title="Baixar arquivo de áudio para o computador"
            >
              <Download size={15} />
            </a>
          )}
        </div>
      </div>

      {/* Transcrição Speech-to-Text */}
      {transcription && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <Headphones size={13} />
              <span>Transcrição Speech-to-Text:</span>
            </div>
            <button
              type="button"
              onClick={triggerFallbackPlay}
              className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-0.5"
              title="Ouvir leitura em voz alta"
            >
              <Volume2 size={11} /> Ouvir Leitura
            </button>
          </div>
          <p className="italic text-chatTextTitle leading-relaxed text-[11px]">
            "{transcription}"
          </p>
        </div>
      )}
    </div>
  );
}

export default function ChatArea({
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
  collaborators = [],
  eduControlStudents = []
}) {
  const [inputText, setInputText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [activeDelegateId, setActiveDelegateId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // Estado para Resposta / Quote (Item 5)
  const [isStudentDossierOpen, setIsStudentDossierOpen] = useState(false); // Dossiê Acadêmico EduControl

  // Estado do Seletor Interativo de Fila & Responsável (Item 1)
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const assignmentPopoverRef = useRef(null);
  
  // Estado para Gravação de Áudio Nativo com MediaRecorder (Item 2)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const isWhatsApp = chatMeta?.type === 'whatsapp';
  const isDM = chatMeta?.type === 'dm';
  const target = chatMeta?.data || {};
  const isBotChat = isDM && (target?.isBot || target?.id === 'u_ia_copilot');

  // Reconhecimento inteligente do aluno na base EduControl
  const matchedStudent = isWhatsApp
    ? matchStudentByPhone(target?.id || target?.phone, eduControlStudents)
    : null;

  const [selectedDept, setSelectedDept] = useState(target.department || 'Comercial');
  const [selectedAssignee, setSelectedAssignee] = useState(target.assignee || '');
  const [selectedCoAssignees, setSelectedCoAssignees] = useState(() => {
    const list = Array.isArray(target.assignees)
      ? target.assignees.filter((a) => a && a !== target.assignee)
      : [];
    return list;
  });
  const [selectedStatus, setSelectedStatus] = useState(target.status || 'carteira_ativa');

  useEffect(() => {
    if (target) {
      setSelectedDept(target.department || 'Comercial');
      setSelectedAssignee(target.assignee || '');
      setSelectedStatus(target.status || 'carteira_ativa');
      const list = Array.isArray(target.assignees)
        ? target.assignees.filter((a) => a && a !== target.assignee)
        : [];
      setSelectedCoAssignees(list);
    }
  }, [target.id, target.department, target.assignee, target.status, JSON.stringify(target.assignees)]);

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
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const result = [];
    const seenIds = new Set();
    const seenSignatures = new Map(); // key: "side:cleanBody:timestamp" -> index in result

    for (const m of messages) {
      if (!m) continue;

      // Se for mensagem de sistema, preserva
      if (m.senderId === 'system') {
        if (m.id) seenIds.add(m.id);
        result.push(m);
        continue;
      }

      // Deduplicação estrita por ID
      if (m.id && seenIds.has(m.id)) {
        continue;
      }

      const isMe =
        m.senderId === currentUser?.id ||
        m.senderId === 'u_matriz' ||
        Boolean(m.fromMe) ||
        (isWhatsApp && (m.senderId === 'u_ia_copilot' || m.senderId === 'bot' || (!m.fromStudent && m.senderId !== target?.id)));
      const cleanBody = (m.text || '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
        .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
        .trim();
      const timeStr = getSaoPauloTime(m.timestamp || m.created_at);
      const signature = `${isMe ? 'out' : 'in'}:${cleanBody}:${timeStr}`;

      if (cleanBody && seenSignatures.has(signature)) {
        const existingIdx = seenSignatures.get(signature);
        const existing = result[existingIdx];

        const existingIsOptimistic = String(existing.id || '').startsWith('m_') || String(existing.id || '').startsWith('opt_');
        const incomingIsReal = String(m.id || '').startsWith('wa_');

        const statusWeight = { failed: 0, sent: 1, delivered: 2, read: 3 };
        const existingWeight = statusWeight[existing.status] || 1;
        const incomingWeight = statusWeight[m.status] || (incomingIsReal ? 2 : 1);

        // Se a nova mensagem é do servidor ou tem status mais recente/confirmado, funde nela
        if (incomingIsReal || incomingWeight >= existingWeight || existingIsOptimistic) {
          result[existingIdx] = {
            ...existing,
            ...m,
            id: incomingIsReal ? m.id : existing.id,
            status: incomingWeight >= existingWeight ? (m.status || 'delivered') : existing.status,
            senderId: existing.senderId || m.senderId,
            senderName: existing.senderName || m.senderName,
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

    return result;
  }, [messages, currentUser?.id]);

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

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !pendingAttachment) return;

    const textToSend = inputText;
    const attachmentToSend = pendingAttachment;
    const replyingToSend = replyingTo;

    setInputText('');
    setPendingAttachment(null);
    setReplyingTo(null);

    onSendMessage(textToSend, attachmentToSend, {
      replyTo: replyingToSend ? { id: replyingToSend.id, senderName: replyingToSend.senderName, text: replyingToSend.text } : null
    });

    requestAnimationFrame(() => scrollToBottom(true));
  };

  // Iniciar Gravação de Áudio Nativa (Item 2)
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Seu navegador não possui suporte para captura de áudio.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
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

  // Finalizar e Enviar Gravação de Áudio Nativa (Item 2)
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

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        onSendMessage(
          `🎙️ Mensagem de voz (${formattedTime})`,
          {
            name: `audio_${Date.now()}.webm`,
            size: `${(blob.size / 1024).toFixed(1)} KB`,
            type: 'audio/webm',
            dataUrl: reader.result,
            duration: formattedTime
          },
          {
            replyTo: replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text } : null,
            isAudio: true,
            duration: formattedTime
          }
        );
        setReplyingTo(null);
      };
      reader.readAsDataURL(blob);

      try {
        recorder.stream.getTracks().forEach((track) => track.stop());
      } catch {}
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

  // Upload de arquivos (Item 8)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
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
  const isAssignedToMe = isChatAssignedToUser(target, currentUser);
  const hasAccessToChat = !isWhatsApp || canUserViewChat(target, currentUser);

  if (isWhatsApp && !hasAccessToChat) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center h-full bg-[#efeae2] dark:bg-chatBg p-8 text-center relative transition-colors">
        <div className="bg-white dark:bg-chatCard p-8 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-md shadow-sm space-y-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <Lock size={26} />
          </div>
          <h3 className="text-base font-bold text-chatTextTitle">Atendimento Fora da Sua Carteira</h3>
          <p className="text-xs text-chatTextMuted leading-relaxed">
            Esta conversa do WhatsApp está atribuída a <strong>{target?.assignee || 'outro consultor'}</strong> ({target?.department || 'Comercial'}).
            <br /><br />
            Por diretriz de privacidade e segurança da equipe comercial, você só possui acesso aos atendimentos sob sua responsabilidade direta.
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
        {uniqueMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#667781]">
            <div className="bg-white/85 dark:bg-chatCard/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200 dark:border-chatBorder max-w-sm shadow-sm space-y-2">
              <span className="text-4xl block">{target.avatar || '💬'}</span>
              <p className="text-sm font-bold text-chatTextTitle">
                {isBotChat
                  ? 'Assistente IA Institucional'
                  : isDM
                  ? `Conversa com ${target.name}`
                  : `Canal #${target.name}`}
              </p>
              <p className="text-xs text-[#667781] leading-relaxed">
                {isBotChat
                  ? 'Pergunte qualquer dúvida sobre regulação MEC, prazos, emissão de certificados, Asaas e procedimentos operacionais da faculdade.'
                  : 'As mensagens trocadas neste canal são corporativas e monitoradas pelo copiloto de IA.'}
              </p>
            </div>
          </div>
        ) : (
          uniqueMessages.map((m) => {
            if (m.senderId === 'system') {
              return (
                <div key={m.id} className="flex justify-center my-2 animate-in fade-in">
                  <div className="bg-slate-200/85 dark:bg-chatPanel/90 backdrop-blur-2xs text-[#54656f] dark:text-chatTextMuted text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-2xs max-w-lg text-center border border-slate-300/60 dark:border-chatBorder flex items-center gap-2">
                    <span className="leading-tight">
                      {m.text?.replace(/<!--[\s\S]*?-->/g, '').replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '').replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '').trim()}
                    </span>
                    <span className="text-[9.5px] opacity-75 font-mono shrink-0">{getSaoPauloTime(m.timestamp || m.created_at)}</span>
                  </div>
                </div>
              );
            }

            const isMe =
              m.senderId === currentUser?.id ||
              m.senderId === 'u_matriz' ||
              Boolean(m.fromMe) ||
              (isWhatsApp && (m.senderId === 'u_ia_copilot' || m.senderId === 'bot' || (!m.fromStudent && m.senderId !== target?.id)));
            const isBot = !isWhatsApp && (m.senderId === 'bot' || m.senderId === 'u_ia_copilot');

            return (
              <div
                key={m.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && !isDM && (
                  <span className="text-[11px] font-semibold text-[#008069] dark:text-[#00a884] ml-2 mb-0.5">
                    {m.senderName}
                  </span>
                )}

                <div className="relative max-w-lg md:max-w-xl">
                  {/* Balão da Mensagem - Estilo WhatsApp Oficial */}
                  <div
                    className={`px-3.5 py-2 text-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-all ${
                      isMe
                        ? 'bg-[#d9fdd3] dark:bg-chatBubbleUser text-[#111b21] dark:text-chatBubbleUserText rounded-lg rounded-tr-none'
                        : isBot
                        ? 'bg-[#fef9c3] dark:bg-purple-950/40 text-[#111b21] dark:text-purple-200 rounded-lg border border-yellow-300 dark:border-purple-500/40'
                        : 'bg-white dark:bg-chatBubbleOther text-[#111b21] dark:text-chatBubbleOtherText rounded-lg rounded-tl-none'
                    }`}
                  >
                    {/* Bloco de Citação no Balão (Item 5) */}
                    {m.replyTo && (
                      <div className="mb-2 p-2 bg-black/5 dark:bg-white/5 border-l-4 border-brand-600 dark:border-brand-500 rounded-r-lg text-xs">
                        <span className="font-bold text-brand-600 dark:text-brand-400 block text-[11px] mb-0.5">
                          {m.replyTo.senderName || 'Mensagem'}:
                        </span>
                        <p className="text-chatTextMuted truncate text-[11.5px] line-clamp-2">
                          {m.replyTo.text
                            ? m.replyTo.text.replace(/<!--[\s\S]*?-->/g, '').replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '').replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '').replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '').trim() || '🎙️ Mensagem de voz'
                            : (m.replyTo.attachment ? `[Arquivo] ${m.replyTo.attachment.name}` : 'Mensagem')}
                        </p>
                      </div>
                    )}

                    {/* Parse e renderização segura da mensagem (Áudio Nativo, Anexos, Texto) */}
                    {(() => {
                      const parsed = parseMessageContent(m);
                      const isImageAttachment = parsed.attachment?.type?.startsWith('image/') ||
                        /\.(png|jpe?g|gif|webp|svg)$/i.test(parsed.attachment?.name || '');
                      const isAudioAttachment = parsed.isAudio ||
                        parsed.attachment?.type?.startsWith('audio/') ||
                        parsed.attachment?.isAudio ||
                        /\.(ogg|opus|mp3|wav|webm|m4a)$/i.test(parsed.attachment?.name || '');

                      return (
                        <>
                          {/* 1. Imagem anexada */}
                          {parsed.attachment && isImageAttachment && (
                            <div className="mb-2">
                              <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-w-sm shadow-xs">
                                <img
                                  src={parsed.attachment.dataUrl || parsed.attachment.url}
                                  alt={parsed.attachment.name || 'Imagem'}
                                  className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
                                  onClick={() => openDocument(parsed.attachment)}
                                />
                                <div className="p-2 bg-black/5 dark:bg-white/5 flex items-center justify-between text-[11.5px]">
                                  <span className="truncate font-medium">{parsed.attachment.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => downloadDocument(parsed.attachment)}
                                    className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2 cursor-pointer"
                                  >
                                    <Download size={13} /> Baixar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 2. Arquivo/Documento anexado (PDF, DOCX, XLSX, etc.) */}
                          {parsed.attachment && !isImageAttachment && !isAudioAttachment && (
                            <FileAttachmentCard
                              attachment={parsed.attachment}
                              isOutgoing={isMe}
                            />
                          )}

                          {/* 3. Player de Áudio Nativo / Voz WhatsApp */}
                          {parsed.isAudio && (
                            <AudioMessagePlayer
                              audioUrl={parsed.audioUrl}
                              duration={parsed.duration}
                              transcription={parsed.transcription}
                              isOutgoing={isMe}
                            />
                          )}

                          {/* 4. Texto da mensagem (apenas se não for placeholder exclusivo de áudio) */}
                          {!parsed.isOnlyAudioPlaceholder && parsed.cleanText ? (
                            <FormattedMessageText text={parsed.cleanText} />
                          ) : null}
                        </>
                      );
                    })()}

                    {/* Botões Rápidos Interativos para URA / Menu de Triagem */}
                    {(m.isTriageMenu || m.text?.includes('1️⃣ Matrículas') || m.text?.includes('1️⃣ Secretaria')) && (
                      <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
                        <span className="text-[10px] font-bold text-chatTextMuted block">
                          ⚡ Escolha uma opção para direcionar o atendimento:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => onSendMessage('1')}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 font-semibold text-left transition"
                          >
                            1️⃣ Matrículas / Secretaria
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendMessage('2')}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30 font-semibold text-left transition"
                          >
                            2️⃣ Tutoria / Financeiro
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendMessage('3')}
                            className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-500/30 font-semibold text-left transition"
                          >
                            3️⃣ Financeiro / Ouvidoria
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendMessage('4')}
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30 font-semibold text-left transition"
                          >
                            4️⃣ Documentos / Novos Cursos
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Barra de Ações Rápidas do Kanban Criado no Chat (Editar, Agendar, Delegar, Excluir) */}
                    {m.taskId && (
                      <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 space-y-2">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="text-[10px] text-yellow-800 dark:text-yellow-300 font-semibold flex items-center gap-1">
                            <Sparkles size={11} className="text-yellow-600 animate-pulse" /> Demanda criada no Kanban
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onOpenTaskDetail && onOpenTaskDetail(m.taskId)}
                              className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 border border-brand-200 dark:border-brand-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                              title="Editar título, descrição ou prazo desta demanda"
                            >
                              <Edit2 size={10} />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveScheduleId(activeScheduleId === m.taskId ? null : m.taskId);
                                setActiveDelegateId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                              title="Agendar prazo para esta demanda"
                            >
                              <Calendar size={10} />
                              <span>Agendar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveDelegateId(activeDelegateId === m.taskId ? null : m.taskId);
                                setActiveScheduleId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                              title="Delegar para outro responsável caso direcionado errado"
                            >
                              <UserPlus size={10} />
                              <span>Delegar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteTaskFromMessage && onDeleteTaskFromMessage(m.taskId, m.id)}
                              className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                              title="Excluir este card do Kanban caso não seja necessário"
                            >
                              <Trash2 size={10} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>

                        {/* Popover Inline para Agendar Prazo (Item 3) */}
                        {activeScheduleId === m.taskId && (
                          <div className="p-2 bg-white/95 dark:bg-chatPanel rounded-lg border border-purple-300 dark:border-purple-500/40 shadow-xs space-y-1.5 animate-in fade-in">
                            <span className="text-[10px] font-bold text-purple-900 dark:text-purple-200 block">
                              📅 Escolha um Prazo de Agendamento:
                            </span>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onScheduleTask) onScheduleTask(m.taskId, 'Hoje às 17h');
                                  setActiveScheduleId(null);
                                }}
                                className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                              >
                                ⚡ Hoje às 17h
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onScheduleTask) onScheduleTask(m.taskId, 'Amanhã às 09h');
                                  setActiveScheduleId(null);
                                }}
                                className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                              >
                                🌅 Amanhã 09h
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onScheduleTask) onScheduleTask(m.taskId, 'Sexta-feira 18h');
                                  setActiveScheduleId(null);
                                }}
                                className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                              >
                                🗓️ Sexta 18h
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onScheduleTask) onScheduleTask(m.taskId, 'Em 48 horas');
                                  setActiveScheduleId(null);
                                }}
                                className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                              >
                                ⏳ Em 48 horas
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Popover Inline para Delegar Responsável (Item 5) */}
                        {activeDelegateId === m.taskId && (
                          <div className="p-2 bg-white/95 dark:bg-chatPanel rounded-lg border border-blue-300 dark:border-blue-500/40 shadow-xs space-y-1.5 animate-in fade-in">
                            <span className="text-[10px] font-bold text-blue-900 dark:text-blue-200 block">
                              👥 Redirecionar / Delegar para:
                            </span>
                            <select
                              onChange={(e) => {
                                if (e.target.value && onDelegateTask) {
                                  onDelegateTask(m.taskId, e.target.value);
                                  setActiveDelegateId(null);
                                }
                              }}
                              defaultValue=""
                              className="w-full text-xs bg-white dark:bg-chatCard text-chatTextTitle border border-slate-300 dark:border-chatBorder rounded p-1.5 font-semibold cursor-pointer"
                            >
                              <option value="" disabled>Selecione o novo colaborador...</option>
                              {collaborators.filter(c => !c.isBot).map(c => (
                                <option key={c.id} value={c.name}>
                                  {c.avatar} {c.name} ({c.department})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Confirmação de Leitura Dinâmica & Ação de Excluir */}
                    <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781] dark:text-chatTextMuted select-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteMessage) onDeleteMessage(m.id);
                        }}
                        title="Excluir mensagem da conversa e do Supabase"
                        className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                      <span>{getSaoPauloTime(m.timestamp || m.created_at)}</span>
                      {isMe && (
                        <span title={m.status === 'read' ? 'Lida' : m.status === 'delivered' ? 'Entregue' : 'Enviada'}>
                          {m.status === 'read' ? (
                            <span className="text-[#53bdeb] font-bold text-xs leading-none">✓✓</span>
                          ) : m.status === 'delivered' ? (
                            <span className="text-[#8696a0] font-bold text-xs leading-none">✓✓</span>
                          ) : (
                            <span className="text-[#8696a0] font-bold text-xs leading-none">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botões Hover: Responder, Gerar Card no Kanban e Excluir Mensagem */}
                  <div
                    className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 flex items-center gap-1 ${
                      isMe ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setReplyingTo(m)}
                      title="Responder a esta mensagem diretamente"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-white text-[10px] font-semibold shadow-md border border-slate-700/60 whitespace-nowrap hover:scale-105 transition"
                    >
                      <Reply size={11} className="text-blue-300" />
                      <span>Responder</span>
                    </button>

                    {!isBot && (
                      <button
                        type="button"
                        onClick={() => onCreateTaskFromMessage(m)}
                        title="Transformar esta mensagem em Tarefa no Kanban com IA"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-semibold shadow-md border border-purple-400/40 whitespace-nowrap hover:scale-105 transition"
                      >
                        <Sparkles size={11} className="text-yellow-300 animate-pulse" />
                        <span>Gerar Card</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteMessage && onDeleteMessage(m.id)}
                      title="Excluir mensagem da conversa e do Supabase"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-700/90 hover:bg-rose-800 text-white text-[10px] font-semibold shadow-md border border-rose-500/50 whitespace-nowrap hover:scale-105 transition"
                    >
                      <Trash2 size={11} className="text-rose-200" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
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
              onClick={() => setInputText((prev) => prev + ' 😊')}
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

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={pendingAttachment ? "Adicione uma legenda ou envie..." : replyingTo ? `Respondendo a ${replyingTo.senderName}...` : "Digite uma mensagem"}
              className="flex-1 bg-white dark:bg-chatInputBg text-chatTextTitle text-[14px] placeholder:text-[#54656f] dark:placeholder:text-chatTextMuted px-4 py-2.5 rounded-lg border-none focus:outline-none shadow-xs transition"
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
    </section>
  );
}
