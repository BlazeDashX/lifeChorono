'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
    error:   <XCircle     className="w-4 h-4 text-red-400 shrink-0"   />,
    info:    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0"  />,
  };

  const colors = {
    success: 'border-green-500/20 bg-green-500/5',
    error:   'border-red-500/20   bg-red-500/5',
    info:    'border-blue-500/20  bg-blue-500/5',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — bottom-center */}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center w-full max-w-sm px-4 pointer-events-none">

        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl 
                        border backdrop-blur-md shadow-card
                        animate-fade-up pointer-events-auto
                        ${colors[t.type]}`}
            style={{ background: 'rgba(15,15,26,0.95)' }}
          >
            {icons[t.type]}
            <p className="text-sm text-text-primary flex-1">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);