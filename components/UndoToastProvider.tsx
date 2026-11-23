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

const DEFAULT_DURATION_MS = 8000;

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<UndoToastOptions | null>(null);
  const [toastKey, setToastKey] = useState(0);
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

  const showUndoToast = useCallback((options: UndoToastOptions) => {
    clearTimer();
    setIsUndoing(false);
    setToast(options);
    setToastKey((prev) => prev + 1);

    const duration = options.durationMs ?? DEFAULT_DURATION_MS;
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

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

  const durationMs = toast?.durationMs ?? DEFAULT_DURATION_MS;

  return (
    <UndoToastContext.Provider value={{ showUndoToast, dismissToast }}>
      {children}

      {toast && (
        <div
          key={toastKey}
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3"
        >
          {/* Timer indicator encircling the rounded rectangle perimeter */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full rounded-2xl overflow-visible"
          >
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx="15"
              ry="15"
              pathLength={100}
              fill="none"
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="2"
            />
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx="15"
              ry="15"
              pathLength={100}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="100"
              strokeDashoffset={0}
              style={{
                animation: `undo-perimeter-drain ${durationMs}ms linear forwards`,
                animationPlayState: isUndoing ? 'paused' : 'running',
              }}
            />
          </svg>

          <span className="relative z-10 text-xs sm:text-sm font-medium text-gray-100 leading-snug">
            {toast.message}
          </span>

          <div className="relative z-10 flex items-center gap-1.5 shrink-0">
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

          <style jsx>{`
            @keyframes undo-perimeter-drain {
              from {
                stroke-dashoffset: 0;
              }
              to {
                stroke-dashoffset: 100;
              }
            }
          `}</style>
        </div>
      )}
    </UndoToastContext.Provider>
  );
}