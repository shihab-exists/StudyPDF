import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckIcon, InfoIcon, WarnIcon, XIcon } from './Doodles';

type Kind = 'ok' | 'error' | 'info';
interface Toast { id: number; kind: Kind; msg: string }

const ToastCtx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-3 items-end" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind} flex items-start gap-2`}>
            <span className="mt-0.5 shrink-0">
              {t.kind === 'ok' ? <CheckIcon size={20} color="#0d6b4e" /> : t.kind === 'error' ? <WarnIcon size={20} /> : <InfoIcon size={20} color="#b07800" />}
            </span>
            <span className="flex-1">{t.msg}</span>
            <button className="opacity-50 hover:opacity-100" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
              <XIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
