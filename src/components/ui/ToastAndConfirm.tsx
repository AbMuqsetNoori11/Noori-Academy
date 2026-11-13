import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useI18n } from '../../i18n';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface UiFeedbackContextValue {
  toast: (message: string, type?: ToastItem['type']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const UiFeedbackContext = createContext<UiFeedbackContextValue | null>(null);

export const UiFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOptions; resolve: (val: boolean) => void } | null>(null);

  const toast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ opts, resolve });
    });
  }, []);

  const handleConfirmChoice = (val: boolean) => {
    if (confirmState) {
      confirmState.resolve(val);
      setConfirmState(null);
    }
  };

  return (
    <UiFeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toastr-style notification stack */}
      <div className="fixed bottom-4 end-4 z-[90] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm text-slate-800 transition-all"
          >
            {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {item.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
            {item.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
            {item.type === 'info' && <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
              aria-label={t('dismissNotification')}
              className="text-slate-400 hover:text-slate-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* SweetAlert2-style Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${confirmState.opts.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">{confirmState.opts.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{confirmState.opts.message}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {confirmState.opts.cancelLabel || t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmState.opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {confirmState.opts.confirmLabel || t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiFeedbackContext.Provider>
  );
};

export function useFeedback(): UiFeedbackContextValue {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside UiFeedbackProvider');
  return ctx;
}
