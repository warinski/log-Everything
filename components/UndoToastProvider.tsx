'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Undo2, X, Loader2 } from 'lucide-react';

interface UndoToastOptions {
  message: string;
  onUndo: () => Promise<void> | void;
  durationMs?: number;
}

interface UndoToastContextValue {
  showUndoToast: (options: UndoToastOptions) => void;
  dismissToast: () => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function useUndoToast() {
  const ctx = useContext(UndoToastContext);
  if (!ctx) {
    throw new Error('useUndoToast must be used within UndoToastProvider');
  }
  return ctx;
}

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<UndoToastOptions | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
    setIsUndoing(false);
  }, []);

  const showUndoToast = useCallback(
    (options: UndoToastOptions) => {
      clearTimer();
      setIsUndoing(false);
      setToast(options);

      const duration = options.durationMs ?? 8000;
      timerRef.current = setTimeout(() => {
        setToast(null);
      }, duration);
    },
    []
  );

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleUndoClick = async () => {
    if (!toast || isUndoing) return;
    clearTimer();
    try {
      setIsUndoing(true);
      await toast.onUndo();
      setToast(null);
    } catch (err) {
      console.error('Undo action failed:', err);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <UndoToastContext.Provider value={{ showUndoToast, dismissToast }}>
      {children}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-gray-900 text-white rounded-2xl shadow-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3"
        >
          <span className="text-xs sm:text-sm font-medium text-gray-100 leading-snug">
            {toast.message}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleUndoClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isUndoing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Undo2 className="w-3.5 h-3.5" />
              )}
              {isUndoing ? 'Undoing...' : 'Undo'}
            </button>

            <button
              type="button"
              disabled={isUndoing}
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </UndoToastContext.Provider>
  );
}