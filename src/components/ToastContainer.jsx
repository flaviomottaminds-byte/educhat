import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToasts } from '../lib/toast';

export default function ToastContainer() {
  const { toasts, dismiss } = useToasts();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0">
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';
        const isWarning = t.type === 'warning';

        const bgClass = isError
          ? 'bg-red-600 text-white shadow-red-900/20 border-red-700'
          : isSuccess
          ? 'bg-emerald-600 text-white shadow-emerald-900/20 border-emerald-700'
          : isWarning
          ? 'bg-amber-600 text-white shadow-amber-900/20 border-amber-700'
          : 'bg-slate-800 text-white shadow-black/20 border-slate-700';

        const Icon = isError
          ? AlertCircle
          : isSuccess
          ? CheckCircle
          : isWarning
          ? AlertTriangle
          : Info;

        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl transition-all duration-200 transform translate-y-0 ${bgClass}`}
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm font-medium leading-snug break-words">
              {t.message}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="p-1 rounded-lg hover:bg-black/20 transition shrink-0 ml-1 opacity-80 hover:opacity-100"
              title="Fechar notificação"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
