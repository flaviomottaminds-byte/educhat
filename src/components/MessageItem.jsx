import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  Sparkles,
  Edit2,
  Calendar,
  UserPlus,
  Trash2,
  Reply,
  Forward,
  Download,
  CheckCheck,
  Check,
  Info,
  Play,
  Pause,
  AlertCircle,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import { getSaoPauloTime } from '../lib/timezone';
import { extractAttachmentFromText, openDocument, downloadDocument, resolvePublicMediaUrl } from '../lib/attachmentParser';
import { processAudioSource, playDecodedAudioBuffer, resolvePublicAudioUrl } from '../lib/audioStreamHelper';
import FileAttachmentCard from './FileAttachmentCard';
import { extractReadByList } from './MessageReadInfoModal';

// Helper para renderizar texto com links clicáveis
function FormattedMessageText({ text }) {
  if (!text) return null;
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
  if (!m) return { cleanText: '', isAudio: false, isOnlyAudioPlaceholder: false, isImage: false, isFile: false, attachment: null };

  const rawText = m.text || '';
  let extractedAttachment = m.attachment || null;

  const { attachment: parsedFromText, cleanText: sanitizedText } = extractAttachmentFromText(rawText);
  if (!extractedAttachment && parsedFromText) {
    extractedAttachment = parsedFromText;
  }

  let attachment = null;
  if (extractedAttachment && typeof extractedAttachment === 'object') {
    const rawName = extractedAttachment.name || extractedAttachment.fileName || extractedAttachment.filename || 'Arquivo';
    const rawType = (
      extractedAttachment.type ||
      extractedAttachment.mimetype ||
      extractedAttachment.mimeType ||
      m.mimetype ||
      m.mime_type ||
      ''
    ).toLowerCase().trim();

    const rawUrl =
      extractedAttachment.url ||
      extractedAttachment.dataUrl ||
      extractedAttachment.storagePath ||
      extractedAttachment.path ||
      extractedAttachment.mediaUrl ||
      m.mediaUrl ||
      m.media_url ||
      '';

    const resolvedUrl = resolvePublicMediaUrl(rawUrl, rawType.startsWith('audio/') ? 'chat-audios' : 'chat-attachments');

    attachment = {
      ...extractedAttachment,
      name: rawName,
      type: rawType,
      url: resolvedUrl || rawUrl,
      dataUrl: resolvedUrl || extractedAttachment.dataUrl || rawUrl,
      size: extractedAttachment.size || ''
    };
  }

  const mimeType = (
    attachment?.type ||
    m.mimetype ||
    m.mime_type ||
    m.mimeType ||
    ''
  ).toLowerCase().trim();

  const isImageMime = mimeType.startsWith('image/');
  const isImageExt = !mimeType && attachment?.name && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(attachment.name);
  const isImage = Boolean((isImageMime || isImageExt || m.isImage || m.is_image) && !mimeType.startsWith('audio/') && !mimeType.includes('pdf'));

  const isAudioMime = mimeType.startsWith('audio/');
  const isAudioExt = !mimeType && attachment?.name && /\.(webm|ogg|mp3|wav|m4a|opus|aac)$/i.test(attachment.name);
  const isAudioFlag = Boolean(m.isAudio || m.is_audio || m.duration);
  const isStrictAudio = !isImage && (isAudioMime || (isAudioFlag && (isAudioExt || !attachment)));

  const isVideoMime = mimeType.startsWith('video/');
  const isVideoExt = !mimeType && attachment?.name && /\.(mp4|mov|avi|webm|mkv)$/i.test(attachment.name);
  const isVideo = Boolean((isVideoMime || isVideoExt || m.isVideo || m.is_video || attachment?.isVideo) && !isImage && !isStrictAudio);

  const isFile = Boolean(attachment && !isImage && !isStrictAudio && !isVideo);

  const cleanText = sanitizedText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
    .replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '')
    .replace(/\[ÁUDIO_TRANSCRIÇÃO:[\s\S]*?\]/gi, '')
    .trim();

  const isOnlyAudioPlaceholder = isStrictAudio && (!cleanText || cleanText === '🎙️ Mensagem de voz' || cleanText === 'Mensagem de voz');

  const rawAudioUrl = attachment?.url || attachment?.dataUrl || m.audioUrl || m.audio_url || m.mediaUrl || m.media_url || null;
  const audioUrl = isStrictAudio ? resolvePublicAudioUrl(rawAudioUrl) : null;

  let duration = m.duration || attachment?.duration || '0:14';
  if (typeof duration === 'number') {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    duration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return {
    cleanText,
    isAudio: isStrictAudio,
    isOnlyAudioPlaceholder,
    isImage,
    isVideo,
    isFile,
    attachment,
    audioUrl,
    duration,
    transcription: m.transcription || m.audio_transcription || null
  };
}

// Player de Áudio Nativo com Web Audio API Fallback
function AudioMessagePlayer({ audioUrl, duration = '0:14', transcription, isOutgoing = false, isInternal = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  const webAudioHandleRef = useRef(null);

  const resolvedAudioUrl = useMemo(() => {
    return resolvePublicAudioUrl(audioUrl);
  }, [audioUrl]);

  const audioSource = useMemo(() => {
    return processAudioSource(resolvedAudioUrl);
  }, [resolvedAudioUrl]);

  const audioPlaySrc = resolvedAudioUrl || audioSource.blobUrl;

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

  useEffect(() => {
    if (audioRef.current && audioPlaySrc) {
      try {
        audioRef.current.load();
        setAudioError(false);
      } catch (err) {
        console.warn('Erro ao carregar fontes de áudio no elemento <audio>:', err);
      }
    }
  }, [audioPlaySrc]);

  const parsedDurationSec = useMemo(() => {
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

  const triggerFallbackPlay = async () => {
    setIsPlaying(true);
    setProgress(0);

    const streamResult = await playDecodedAudioBuffer(
      audioPlaySrc,
      (currentSec, totalSec) => {
        const p = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;
        setProgress(Math.min(100, p));
        const mins = Math.floor(currentSec / 60);
        const secs = Math.floor(currentSec % 60);
        setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      },
      () => {
        setIsPlaying(false);
        setProgress(100);
        setTimeout(() => {
          setProgress(0);
          setCurrentTime('0:00');
        }, 300);
      }
    );

    if (streamResult.success) {
      webAudioHandleRef.current = streamResult;
      setAudioError(false);
      return;
    }

    if ('speechSynthesis' in window && transcription) {
      const utter = new SpeechSynthesisUtterance(transcription);
      utter.lang = 'pt-BR';
      utter.rate = playbackRate;
      utter.onend = () => {
        setIsPlaying(false);
        setProgress(100);
        setTimeout(() => setProgress(0), 300);
      };
      window.speechSynthesis.speak(utter);
      return;
    }

    setIsPlaying(false);
    setAudioError(true);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      triggerFallbackPlay();
      return;
    }

    if (isPlaying) {
      try {
        audio.pause();
      } catch {}
      stopWebAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      stopWebAudio();
      setAudioError(false);
      try {
        audio.playbackRate = playbackRate;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => triggerFallbackPlay());
        }
      } catch {
        triggerFallbackPlay();
      }
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const cur = audio.currentTime;
    const dur = audio.duration || parsedDurationSec;
    const percent = dur > 0 ? (cur / dur) * 100 : 0;
    setProgress(percent);
    const mins = Math.floor(cur / 60);
    const secs = Math.floor(cur % 60);
    setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
    setTimeout(() => {
      setProgress(0);
      setCurrentTime('0:00');
    }, 300);
  };

  const changeSpeed = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  return (
    <div className={`p-2.5 rounded-xl border max-w-sm transition-all select-none ${
      isOutgoing
        ? 'bg-[#d9fdd3] dark:bg-emerald-950/40 border-[#b2e7a9] dark:border-emerald-500/30 text-[#111b21] dark:text-emerald-100'
        : 'bg-white dark:bg-chatSidebar border-slate-200 dark:border-chatBorder text-chatTextTitle'
    }`}>
      {audioPlaySrc && (
        <audio
          ref={audioRef}
          src={audioPlaySrc}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={() => setAudioError(true)}
          className="hidden"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs transition hover:scale-105 active:scale-95 shrink-0 cursor-pointer ${
            isOutgoing
              ? 'bg-[#00a884] hover:bg-[#008f6f] text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        <div className="flex-1 space-y-1.5 min-w-0">
          <div
            className="h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPercent = (e.clientX - rect.left) / rect.width;
              if (audioRef.current && audioRef.current.duration) {
                audioRef.current.currentTime = clickPercent * audioRef.current.duration;
              }
            }}
          >
            <div
              className={`h-full transition-all duration-100 rounded-full ${
                isOutgoing ? 'bg-[#00a884]' : 'bg-emerald-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-chatTextMuted">
            <span>{isPlaying ? currentTime : duration}</span>
            <div className="flex items-center gap-1.5">
              {audioError && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-sans" title="Áudio reproduzido via PCM">
                  <RotateCcw size={10} /> PCM
                </span>
              )}
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                {isInternal ? 'Equipe' : 'WhatsApp'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={changeSpeed}
          className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 text-chatTextMuted hover:text-chatTextTitle transition cursor-pointer shrink-0"
          title="Alterar velocidade de reprodução"
        >
          {playbackRate}x
        </button>
      </div>

      {transcription && (
        <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 text-[11.5px] text-chatTextMuted italic flex items-start gap-1">
          <span className="shrink-0 text-xs">📝</span>
          <p className="line-clamp-2">{transcription}</p>
        </div>
      )}
    </div>
  );
}

// Extração dos nomes dos leitores para o Tooltip
function getReadByCollaboratorNames(readByList, collaborators, senderId) {
  if (!Array.isArray(readByList) || readByList.length === 0) return [];
  const collabs = Array.isArray(collaborators) ? collaborators : [];
  const senderIdClean = senderId ? String(senderId) : '';

  const names = [];
  readByList.forEach((rId) => {
    if (!rId || String(rId) === senderIdClean) return;
    const found = collabs.find(
      (c) => String(c.id) === String(rId) || String(c.user_id) === String(rId) || (c.email && c.email.toLowerCase() === String(rId).toLowerCase())
    );
    if (found?.name) {
      names.push(found.name);
    } else {
      names.push(`Colaborador (${rId})`);
    }
  });

  return names;
}

// Tooltip de confirmações de leitura
function MessageReadReceiptTooltip({ readBy = [], collaborators = [], senderId, isMe, onOpenDetails }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const safeReadBy = useMemo(() => {
    if (Array.isArray(readBy)) return readBy;
    if (typeof readBy === 'string') {
      try {
        const p = JSON.parse(readBy);
        if (Array.isArray(p)) return p;
      } catch {}
      return readBy.replace(/[{}]/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    }
    return [];
  }, [readBy]);

  const readersNames = useMemo(() => {
    return getReadByCollaboratorNames(safeReadBy, collaborators, senderId);
  }, [safeReadBy, collaborators, senderId]);

  const hasReaders = readersNames.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const tooltipText = hasReaders
    ? `Lido por ${readersNames.length} colaborador(es): ${readersNames.join(', ')}`
    : 'Ainda não visualizado por outros colaboradores';

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenDetails) {
            onOpenDetails();
          } else {
            setIsOpen((prev) => !prev);
          }
        }}
        title={`${tooltipText} • Clique para ver Dados da Mensagem`}
        className={`p-0.5 rounded transition flex items-center justify-center cursor-pointer ${
          hasReaders
            ? 'text-[#53bdeb] hover:text-blue-600 dark:text-[#53bdeb] hover:scale-115'
            : 'opacity-60 hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        aria-label="Dados e confirmações de leitura da mensagem"
      >
        <Info size={11} className={hasReaders ? 'stroke-[2.5]' : 'stroke-2'} />
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-1.5 z-50 w-56 p-2 rounded-lg bg-slate-900/95 dark:bg-chatPanel text-white text-[11px] shadow-xl border border-slate-700/80 backdrop-blur-sm animate-in fade-in zoom-in-95 ${
            isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700/60 font-semibold text-[11px] text-[#53bdeb]">
            <span>Visualizações ({readersNames.length})</span>
            <span className="text-[9px] text-slate-400">Canal Geral</span>
          </div>

          {hasReaders ? (
            <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {readersNames.map((name, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-slate-200">
                  <span className="text-emerald-400 text-[10px]">✓✓</span>
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 italic text-[10px]">
              Nenhum outro colaborador abriu esta mensagem ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente MessageItem memorizado com React.memo:
 * Impede que mensagens antigas do histórico sejam recalculadas e re-desenhadas a cada tecla digitada no input
 */
function MessageItemComponent({
  message,
  isMe,
  isBot,
  isDM,
  isChannel,
  isWhatsApp,
  collaborators = [],
  currentUser,
  readBy = [],
  onReply,
  onForward,
  onDeleteMessage,
  onCreateTaskFromMessage,
  onDeleteTaskFromMessage,
  onOpenTaskDetail,
  onScheduleTask,
  onDelegateTask,
  onOpenMessageInfo,
  onSendMessage
}) {
  const m = message;
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isDropdownOpen]);

  const normalizedReadBy = useMemo(() => {
    const listA = extractReadByList(m, {});
    const listB = Array.isArray(readBy) ? readBy : [];
    return Array.from(new Set([...listA, ...listB.map(String)]));
  }, [m, readBy]);

  const readersNames = useMemo(() => {
    return getReadByCollaboratorNames(normalizedReadBy, collaborators, m?.senderId || m?.sender_id);
  }, [normalizedReadBy, collaborators, m?.senderId, m?.sender_id]);

  // Isolamento de destinatário
  if (m.recipientId && m.recipientId !== currentUser?.id && m.senderId !== currentUser?.id) {
    return null;
  }
  if (m.recipient_id && m.recipient_id !== currentUser?.id && m.sender_id !== currentUser?.id) {
    return null;
  }

  const isSystemOrCopilot =
    m.senderId === 'system' ||
    m.sender_id === 'system' ||
    m.senderId === 'u_ia_copilot' ||
    m.sender_id === 'u_ia_copilot';

  const isDossier =
    m.isDossier === true ||
    m.senderId === 'u_ia_copilot' ||
    m.sender_id === 'u_ia_copilot' ||
    (typeof m.text === 'string' &&
      (m.text.includes('Dossiê do WhatsApp') || m.text.includes('Contexto consolidado da negociação')));

  // 1. BLOQUEIO ESTRITO: Dossiê NUNCA pode ser renderizado em canais públicos da equipe
  if (isChannel && isDossier) {
    return null;
  }

  // Renderização de Mensagens de Sistema ou Dossiê da IA
  if (isSystemOrCopilot) {
    if (isDossier) {
      return (
        <div className="flex justify-center my-3 w-full px-2 animate-in fade-in">
          <div className="w-full max-w-2xl bg-gradient-to-br from-purple-50/95 via-white to-indigo-50/95 dark:from-purple-950/40 dark:via-chatPanel dark:to-indigo-950/40 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-4 shadow-md text-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-purple-200/60 dark:border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  📋
                </div>
                <div>
                  <h4 className="font-bold text-purple-900 dark:text-purple-200 text-xs flex items-center gap-1.5">
                    Dossiê do WhatsApp • Nota Interna
                    <span className="text-[9.5px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                      IA Operacional
                    </span>
                  </h4>
                  <p className="text-[10px] text-purple-700/80 dark:text-purple-400">
                    Contexto consolidado da negociação e atendimento
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.hasKanban || (typeof m.text === 'string' && m.text.includes('cards no Kanban')) ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-600/30 flex items-center gap-1">
                    ✓ Cards no Kanban
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-100 dark:bg-chatSidebar text-slate-600 dark:text-chatTextMuted font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-chatBorder">
                    Apenas Chat (Sem Kanban)
                  </span>
                )}
                <span className="text-[10px] text-chatTextMuted font-mono">
                  {getSaoPauloTime(m.timestamp || m.created_at)}
                </span>
              </div>
            </div>

            <div className="text-chatTextBody leading-relaxed whitespace-pre-wrap font-sans text-xs">
              {typeof m.text === 'string'
                ? m.text
                    .replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '')
                    .trim()
                : ''}
            </div>

            <div className="pt-2 border-t border-purple-200/50 dark:border-purple-500/20 flex items-center justify-between text-[10.5px] text-purple-800/80 dark:text-purple-400">
              <span className="flex items-center gap-1 font-medium">
                🔒 Visível exclusivamente para a equipe interna (não enviado ao aluno)
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center my-2 animate-in fade-in">
        <div className="bg-slate-200/85 dark:bg-chatPanel/90 backdrop-blur-2xs text-[#54656f] dark:text-chatTextMuted text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-2xs max-w-lg text-center border border-slate-300/60 dark:border-chatBorder flex items-center gap-2">
          <span className="leading-tight">
            {typeof m.text === 'string'
              ? m.text.replace(/<!--[\s\S]*?-->/g, '').replace(/\[ARQUIVO_ANEXO:[\s\S]*?\]/gi, '').replace(/\[ARQUIVO_ANEXO:[^\]]*$/gi, '').trim()
              : ''}
          </span>
          <span className="text-[9.5px] opacity-75 font-mono shrink-0">{getSaoPauloTime(m.timestamp || m.created_at)}</span>
        </div>
      </div>
    );
  }

  const parsed = parseMessageContent(m);

  return (
    <div className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
      {!isMe && !isDM && (
        <span className="text-[11px] font-semibold text-[#008069] dark:text-[#00a884] ml-2 mb-0.5">
          {m.senderName}
        </span>
      )}

      <div className="relative max-w-lg md:max-w-xl">
        {/* Balão da Mensagem - Estilo WhatsApp Oficial */}
        <div
          className={`relative px-3.5 py-2 text-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-all ${
            isMe
              ? 'bg-[#d9fdd3] dark:bg-chatBubbleUser text-[#111b21] dark:text-chatBubbleUserText rounded-lg rounded-tr-none'
              : isBot
              ? 'bg-[#fef9c3] dark:bg-purple-950/40 text-[#111b21] dark:text-purple-200 rounded-lg border border-yellow-300 dark:border-purple-500/40'
              : 'bg-white dark:bg-chatBubbleOther text-[#111b21] dark:text-chatBubbleOtherText rounded-lg rounded-tl-none'
          }`}
        >
          {/* Menu Dropdown Estilo WhatsApp Web (Chevron no topo do balão) */}
          <div className="absolute top-1 right-1 z-20" ref={dropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen((prev) => !prev);
              }}
              className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-current flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-2xs"
              title="Menu da mensagem"
              aria-label="Menu de contexto da mensagem"
            >
              <ChevronDown size={13} />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white dark:bg-[#202c33] text-slate-800 dark:text-[#e9edef] shadow-xl border border-slate-200 dark:border-[#2a3942] py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {isChannel && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenMessageInfo && onOpenMessageInfo(m);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#111b21] transition text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCheck size={14} className="text-[#53bdeb]" />
                      <span>Dados da mensagem</span>
                    </span>
                    {readersNames.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 font-bold">
                        {readersNames.length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onReply && onReply(m);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#111b21] transition cursor-pointer"
                >
                  <Reply size={14} className="text-blue-500" />
                  <span>Responder</span>
                </button>
                {!isWhatsApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onForward && onForward(m);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#111b21] transition cursor-pointer"
                  >
                    <Forward size={14} className="text-emerald-500" />
                    <span>Encaminhar</span>
                  </button>
                )}
                {!isBot && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onCreateTaskFromMessage && onCreateTaskFromMessage(m);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#111b21] transition text-purple-600 dark:text-purple-400 font-medium cursor-pointer"
                  >
                    <Sparkles size={14} className="text-yellow-500" />
                    <span>Criar card no Kanban</span>
                  </button>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-[#2a3942]" />
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onDeleteMessage && onDeleteMessage(m.id);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Apagar mensagem</span>
                </button>
              </div>
            )}
          </div>
          {/* Identificação de Mensagem Encaminhada */}
          {(m.isForwarded || m.is_forwarded || (typeof m.text === 'string' && m.text.includes('<!-- FORWARDED'))) && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 pb-1 border-b border-black/5 dark:border-white/5 select-none">
              <Forward size={12} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="italic">Encaminhada</span>
              {(() => {
                let fwdFrom = m.forwardedFrom;
                if (!fwdFrom && typeof m.text === 'string') {
                  const match = m.text.match(/<!-- FORWARDED_FROM:([\s\S]+?) -->/);
                  if (match) {
                    try { fwdFrom = JSON.parse(match[1]); } catch { fwdFrom = match[1]; }
                  }
                }
                return fwdFrom ? (
                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                    • de {fwdFrom}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* Citação / Resposta a outra mensagem */}
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

          {/* 1. Imagem anexada */}
          {parsed.attachment && parsed.isImage && (
            <div className="mb-2">
              <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-w-sm shadow-xs">
                <img
                  src={parsed.attachment.url || parsed.attachment.dataUrl}
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

          {/* 1.1 Vídeo anexado */}
          {parsed.attachment && parsed.isVideo && (
            <div className="mb-2">
              <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-w-sm shadow-xs bg-black/90">
                <video
                  src={parsed.attachment.url || parsed.attachment.dataUrl}
                  controls
                  preload="metadata"
                  className="w-full max-h-72 object-contain"
                />
                <div className="p-2 bg-black/40 dark:bg-black/60 flex items-center justify-between text-[11.5px] text-white">
                  <span className="truncate font-medium">{parsed.attachment.name || 'Vídeo'}</span>
                  <button
                    type="button"
                    onClick={() => downloadDocument(parsed.attachment)}
                    className="text-brand-300 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2 cursor-pointer"
                  >
                    <Download size={13} /> Baixar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Arquivo/Documento anexado */}
          {parsed.attachment && parsed.isFile && (
            <FileAttachmentCard
              attachment={parsed.attachment}
              isOutgoing={isMe}
            />
          )}

          {/* 3. Player de Áudio Nativo */}
          {parsed.isAudio && parsed.audioUrl && !parsed.isImage && !parsed.isFile && (
            <AudioMessagePlayer
              audioUrl={parsed.audioUrl}
              duration={parsed.duration}
              transcription={parsed.transcription}
              isOutgoing={isMe}
              isInternal={!isWhatsApp}
            />
          )}

          {/* 4. Texto da mensagem */}
          {!parsed.isOnlyAudioPlaceholder && parsed.cleanText ? (
            <FormattedMessageText text={parsed.cleanText} />
          ) : null}

          {/* Botões Rápidos Interativos para URA / Triagem */}
          {(m.isTriageMenu || m.text?.includes('1️⃣ Matrículas') || m.text?.includes('1️⃣ Secretaria')) && (
            <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
              <span className="text-[10px] font-bold text-chatTextMuted block">
                ⚡ Escolha uma opção para direcionar o atendimento:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onSendMessage && onSendMessage('1')}
                  className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 font-semibold text-left transition"
                >
                  1️⃣ Matrículas / Secretaria
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage && onSendMessage('2')}
                  className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30 font-semibold text-left transition"
                >
                  2️⃣ Tutoria / Financeiro
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage && onSendMessage('3')}
                  className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-500/30 font-semibold text-left transition"
                >
                  3️⃣ Financeiro / Ouvidoria
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage && onSendMessage('4')}
                  className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30 font-semibold text-left transition"
                >
                  4️⃣ Documentos / Novos Cursos
                </button>
              </div>
            </div>
          )}

          {/* Barra de Ações Rápidas do Kanban Criado no Chat */}
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
                      setIsScheduling((prev) => !prev);
                      setIsDelegating(false);
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
                      setIsDelegating((prev) => !prev);
                      setIsScheduling(false);
                    }}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                    title="Delegar para outro responsável"
                  >
                    <UserPlus size={10} />
                    <span>Delegar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteTaskFromMessage && onDeleteTaskFromMessage(m.taskId, m.id)}
                    className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                    title="Excluir este card do Kanban"
                  >
                    <Trash2 size={10} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>

              {/* Popover Inline para Agendar Prazo */}
              {isScheduling && (
                <div className="p-2 bg-white/95 dark:bg-chatPanel rounded-lg border border-purple-300 dark:border-purple-500/40 shadow-xs space-y-1.5 animate-in fade-in">
                  <span className="text-[10px] font-bold text-purple-900 dark:text-purple-200 block">
                    📅 Escolha um Prazo de Agendamento:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleTask) onScheduleTask(m.taskId, 'Hoje às 17h');
                        setIsScheduling(false);
                      }}
                      className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                    >
                      ⚡ Hoje às 17h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleTask) onScheduleTask(m.taskId, 'Amanhã às 09h');
                        setIsScheduling(false);
                      }}
                      className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                    >
                      🌅 Amanhã 09h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleTask) onScheduleTask(m.taskId, 'Sexta-feira 18h');
                        setIsScheduling(false);
                      }}
                      className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                    >
                      🗓️ Sexta 18h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleTask) onScheduleTask(m.taskId, 'Em 48 horas');
                        setIsScheduling(false);
                      }}
                      className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-800 dark:text-purple-200 border border-purple-200 text-left font-semibold"
                    >
                      ⏳ Em 48 horas
                    </button>
                  </div>
                </div>
              )}

              {/* Popover Inline para Delegar Responsável */}
              {isDelegating && (
                <div className="p-2 bg-white/95 dark:bg-chatPanel rounded-lg border border-blue-300 dark:border-blue-500/40 shadow-xs space-y-1.5 animate-in fade-in">
                  <span className="text-[10px] font-bold text-blue-900 dark:text-blue-200 block">
                    👥 Redirecionar / Delegar para:
                  </span>
                  <select
                    onChange={(e) => {
                      if (e.target.value && onDelegateTask) {
                        onDelegateTask(m.taskId, e.target.value);
                        setIsDelegating(false);
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

          {/* Confirmação de Leitura Dinâmica & Ações */}
          <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#667781] dark:text-chatTextMuted select-none">
            {!isWhatsApp && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForward && onForward(m);
                }}
                title="Encaminhar mensagem"
                className="opacity-60 hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5 rounded transition cursor-pointer"
              >
                <Forward size={11} />
              </button>
            )}
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

            {/* Em Canais: Gatilho direto de 'Lida por' nos Checks / Badge com número de leituras */}
            {isChannel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMessageInfo && onOpenMessageInfo(m);
                }}
                title={
                  readersNames.length > 0
                    ? `Lida por ${readersNames.length} colaborador(es): ${readersNames.join(', ')} • Clique para ver Dados da Mensagem`
                    : 'Ainda não lida por outros colaboradores • Clique para ver Dados da Mensagem'
                }
                className={`inline-flex items-center gap-1 leading-none py-0.5 px-1.5 rounded-full transition cursor-pointer select-none active:scale-95 ${
                  readersNames.length > 0
                    ? 'bg-blue-500/15 dark:bg-blue-400/20 hover:bg-blue-500/25 text-[#53bdeb] border border-blue-400/40 shadow-2xs font-semibold'
                    : 'hover:bg-black/10 dark:hover:bg-white/10 text-[#8696a0]'
                }`}
              >
                {m.status === 'sending' ? (
                  <span className="text-slate-400 font-bold text-xs leading-none animate-pulse">🕒</span>
                ) : m.status === 'error' ? (
                  <span className="text-red-500 font-bold text-xs leading-none" title="Erro no envio">⚠️</span>
                ) : (
                  <>
                    <CheckCheck size={13} className={readersNames.length > 0 ? 'text-[#53bdeb]' : 'text-[#8696a0]'} />
                    {readersNames.length > 0 && (
                      <span className="text-[10px] font-bold text-[#53bdeb]">
                        {readersNames.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            ) : isMe ? (
              <span className="inline-flex items-center leading-none">
                {m.status === 'sending' ? (
                  <span className="text-slate-400 font-bold text-xs leading-none animate-pulse">🕒</span>
                ) : m.status === 'error' ? (
                  <span className="text-red-500 font-bold text-xs leading-none" title="Erro no envio">⚠️</span>
                ) : m.status === 'read' ? (
                  <span className="text-[#53bdeb] font-bold text-xs leading-none" title="Lida">✓✓</span>
                ) : m.status === 'delivered' ? (
                  <span className="text-[#8696a0] font-bold text-xs leading-none" title="Entregue">✓✓</span>
                ) : (
                  <span className="text-[#8696a0] font-bold text-xs leading-none" title="Enviada">✓</span>
                )}
              </span>
            ) : null}
          </div>
        </div>

        {/* Botões Hover: Responder, Gerar Card no Kanban e Excluir Mensagem */}
        <div
          className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 flex items-center gap-1 ${
            isMe ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
          }`}
        >
          {isChannel && (
            <button
              type="button"
              onClick={() => onOpenMessageInfo && onOpenMessageInfo(m)}
              title="Ver dados da mensagem (quem já leu no canal)"
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-white text-[10px] font-semibold shadow-md border border-slate-700/60 whitespace-nowrap hover:scale-105 transition cursor-pointer"
            >
              <CheckCheck size={12} className="text-[#53bdeb]" />
              <span>Dados da Mensagem{readersNames.length > 0 ? ` (${readersNames.length})` : ''}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onReply && onReply(m)}
            title="Responder a esta mensagem diretamente"
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-white text-[10px] font-semibold shadow-md border border-slate-700/60 whitespace-nowrap hover:scale-105 transition cursor-pointer"
          >
            <Reply size={11} className="text-blue-300" />
            <span>Responder</span>
          </button>

          {!isWhatsApp && (
            <button
              type="button"
              onClick={() => onForward && onForward(m)}
              title="Encaminhar esta mensagem"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-white text-[10px] font-semibold shadow-md border border-slate-700/60 whitespace-nowrap hover:scale-105 transition cursor-pointer"
            >
              <Forward size={11} className="text-emerald-400" />
              <span>Encaminhar</span>
            </button>
          )}

          {!isBot && (
            <button
              type="button"
              onClick={() => onCreateTaskFromMessage && onCreateTaskFromMessage(m)}
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
}

// Comparador personalizado para React.memo: evita re-render desnecessário
function areMessagePropsEqual(prevProps, nextProps) {
  if (
    prevProps.message === nextProps.message &&
    prevProps.readBy === nextProps.readBy &&
    prevProps.isMe === nextProps.isMe &&
    prevProps.isBot === nextProps.isBot &&
    prevProps.isDM === nextProps.isDM &&
    prevProps.isChannel === nextProps.isChannel &&
    prevProps.isWhatsApp === nextProps.isWhatsApp &&
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.collaborators === nextProps.collaborators
  ) {
    return true;
  }

  const pm = prevProps.message;
  const nm = nextProps.message;

  if (pm?.id !== nm?.id) return false;
  if (pm?.text !== nm?.text) return false;
  if (pm?.status !== nm?.status) return false;
  if (pm?.timestamp !== nm?.timestamp) return false;
  if (pm?.taskId !== nm?.taskId) return false;
  if (pm?.hasKanban !== nm?.hasKanban) return false;
  if (prevProps.isMe !== nextProps.isMe) return false;
  if (prevProps.isChannel !== nextProps.isChannel) return false;
  if (prevProps.isDM !== nextProps.isDM) return false;
  if (prevProps.isWhatsApp !== nextProps.isWhatsApp) return false;

  const pr = prevProps.readBy;
  const nr = nextProps.readBy;
  if (pr !== nr) {
    const prLen = Array.isArray(pr) ? pr.length : 0;
    const nrLen = Array.isArray(nr) ? nr.length : 0;
    if (prLen !== nrLen) return false;
  }

  return true;
}

export default memo(MessageItemComponent, areMessagePropsEqual);
