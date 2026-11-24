'use client';

import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface CardExpandModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function CardExpandModal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
}: CardExpandModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-white border border-blue-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-blue-100 flex items-center justify-between gap-4 shrink-0 bg-white">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close expanded card"
            title="Close (Esc)"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expanded Card Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-blue-50/20">
          {children}
        </div>
      </div>
    </div>
  );
}