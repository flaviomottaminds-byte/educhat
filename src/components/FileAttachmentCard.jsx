import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File as FileIcon,
  Download,
  ExternalLink,
  Eye
} from 'lucide-react';
import {
  getFileCategory,
  getFileExtension,
  formatFileSize,
  openDocument,
  downloadDocument,
  resolvePublicMediaUrl
} from '../lib/attachmentParser';

export default function FileAttachmentCard({ attachment, isOutgoing = false }) {
  if (!attachment || typeof attachment !== 'object') return null;

  const rawUrl = attachment.url || attachment.dataUrl || attachment.storagePath || attachment.path || attachment.mediaUrl;
  const resolvedUrl = resolvePublicMediaUrl(rawUrl, 'chat-attachments');
  const name = attachment.name || attachment.fileName || attachment.filename || 'Arquivo Anexo';
  const rawType = (attachment.type || attachment.mimetype || attachment.mimeType || '').toLowerCase().trim();
  const category = getFileCategory(name, rawType);
  const ext = getFileExtension(name).toUpperCase() || (rawType.includes('pdf') ? 'PDF' : 'ARQ');
  const formattedSize = formatFileSize(attachment.size);
  const hasUrl = Boolean(resolvedUrl);

  const safeAttachment = {
    ...attachment,
    name,
    type: rawType,
    url: resolvedUrl,
    dataUrl: resolvedUrl || attachment.dataUrl
  };

  // Paleta de cores e ícones conforme a categoria do documento
  const categoryConfig = {
    pdf: {
      icon: FileText,
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-200 dark:border-rose-500/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
      buttonBg: 'hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300',
    },
    spreadsheet: {
      icon: FileSpreadsheet,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-200 dark:border-emerald-500/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
      buttonBg: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    },
    document: {
      icon: FileText,
      bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      borderColor: 'border-blue-200 dark:border-blue-500/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
      buttonBg: 'hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    },
    presentation: {
      icon: FileText,
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200 dark:border-amber-500/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
      buttonBg: 'hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    },
    archive: {
      icon: FileArchive,
      bgColor: 'bg-purple-50 dark:bg-purple-950/40',
      borderColor: 'border-purple-200 dark:border-purple-500/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
      buttonBg: 'hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    },
    other: {
      icon: FileIcon,
      bgColor: 'bg-slate-50 dark:bg-slate-800/40',
      borderColor: 'border-slate-200 dark:border-slate-700/50',
      iconColor: 'text-slate-600 dark:text-slate-400',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
      buttonBg: 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300',
    }
  };

  const config = categoryConfig[category] || categoryConfig.other;
  const IconComponent = config.icon;

  const handleCardClick = () => {
    if (hasUrl) {
      openDocument(safeAttachment);
    }
  };

  const handleDownloadClick = (e) => {
    e.stopPropagation();
    downloadDocument(safeAttachment);
  };

  const handleOpenClick = (e) => {
    e.stopPropagation();
    openDocument(safeAttachment);
  };

  return (
    <div
      onClick={handleCardClick}
      title={hasUrl ? `Clique para visualizar ou baixar "${name}"` : name}
      className={`group/card w-full max-w-sm rounded-xl border p-3 my-1.5 transition-all shadow-xs ${
        config.bgColor
      } ${config.borderColor} ${
        hasUrl ? 'cursor-pointer hover:shadow-md hover:border-brand-500/50' : 'cursor-default'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Ícone Estilizado com Badge da Extensão */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-lg bg-white dark:bg-chatCard flex items-center justify-center shadow-xs border border-black/5 dark:border-white/5">
            <IconComponent size={22} className={config.iconColor} />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 text-[8.5px] font-bold px-1 py-0.2 rounded shadow-2xs ${config.badgeBg}`}
          >
            {ext}
          </span>
        </div>

        {/* Informações do Arquivo */}
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-chatTextTitle dark:text-white truncate leading-snug group-hover/card:text-brand-600 dark:group-hover/card:text-brand-400 transition"
            title={name}
          >
            {name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-chatTextMuted">
            {formattedSize && <span>{formattedSize}</span>}
            {formattedSize && <span>•</span>}
            <span className="uppercase text-[10px] font-medium tracking-wider opacity-80">
              {ext}
            </span>
          </div>
        </div>

        {/* Botão de Download Rápido */}
        {hasUrl && (
          <button
            type="button"
            onClick={handleDownloadClick}
            title="Baixar arquivo diretamente"
            className="shrink-0 p-2 rounded-lg bg-white dark:bg-chatCard hover:bg-brand-50 dark:hover:bg-brand-950/40 text-chatTextMuted hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-chatBorder transition shadow-2xs cursor-pointer"
          >
            <Download size={15} />
          </button>
        )}
      </div>

      {/* Barra de Ações Rápidas no Rodapé do Card */}
      {hasUrl && (
        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={handleOpenClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${config.buttonBg}`}
          >
            <Eye size={13} />
            <span>Visualizar</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${config.buttonBg}`}
          >
            <Download size={13} />
            <span>Baixar ({ext})</span>
          </button>
        </div>
      )}
    </div>
  );
}
