import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-chatBackground text-center select-none min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-sm border border-amber-200 dark:border-amber-800/40">
            <AlertTriangle size={28} />
          </div>

          <h3 className="text-base font-bold text-chatTextTitle mb-1.5">
            {this.props.title || 'Ocorreu um erro ao carregar este chat.'}
          </h3>

          <p className="text-xs text-chatTextMuted max-w-md mb-5 leading-relaxed">
            {this.props.description || 'Detectamos uma inconsistência temporária nos dados desta conversa. Clique abaixo para restabelecer a interface com segurança.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Recarregar Conversa</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 bg-slate-200 dark:bg-chatPanel hover:bg-slate-300 dark:hover:bg-chatPanel/70 text-chatTextTitle text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Atualizar Página
            </button>
          </div>

          {this.state.error && (
            <details className="mt-5 text-left max-w-lg w-full p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300 font-mono">
              <summary className="font-bold cursor-pointer select-none text-rose-900 dark:text-rose-200 hover:underline">
                Detalhes técnicos do erro ({String(this.state.error?.name || 'Error')})
              </summary>
              <div className="mt-2 text-[10.5px] leading-relaxed whitespace-pre-wrap break-all overflow-auto max-h-48">
                <p className="font-semibold text-rose-950 dark:text-rose-100">{String(this.state.error?.message || this.state.error)}</p>
                {this.state.error?.stack && (
                  <p className="mt-1 opacity-80 text-[10px]">{String(this.state.error.stack)}</p>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
