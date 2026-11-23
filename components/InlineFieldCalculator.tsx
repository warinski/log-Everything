'use client';

import { useState, useMemo } from 'react';
import { Delete, Check, X } from 'lucide-react';
import { evaluateMathExpression } from '@/lib/math/safeExpression';

interface InlineFieldCalculatorProps {
  fieldLabel: string;
  initialValue?: any;
  isCurrency?: boolean;
  onApply: (resultValue: number, expressionUsed: string) => void;
  onClose: () => void;
}

const KEYPAD_ROWS: string[][] = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '(', '+'],
];

export default function InlineFieldCalculator({
  fieldLabel,
  initialValue,
  isCurrency = false,
  onApply,
  onClose,
}: InlineFieldCalculatorProps) {
  const [expression, setExpression] = useState<string>(() => {
    if (initialValue === undefined || initialValue === null || initialValue === '') {
      return '';
    }
    return String(initialValue);
  });

  const evaluated = useMemo(() => evaluateMathExpression(expression), [expression]);

  const appendToken = (token: string) => {
    setExpression((prev) => `${prev}${token}`);
  };

  const handleBackspace = () => {
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setExpression('');
  };

  const handleApply = () => {
    if (evaluated === null) return;
    const normalized = isCurrency ? Math.round(evaluated * 100) / 100 : evaluated;
    onApply(normalized, expression.trim());
    onClose();
  };

  const formatPreview = (val: number) => {
    if (isCurrency) {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return String(val);
  };

  return (
    <div className="mt-2 p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide truncate">
          Calculator — {fieldLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
          aria-label="Close calculator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expression input + live preview */}
      <div className="flex items-center justify-between gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2">
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === '=') {
              e.preventDefault();
              handleApply();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="e.g. 120 + 45.50 * 2"
          style={{ fontSize: '15px' }}
          className="w-full bg-transparent text-gray-900 focus:outline-none font-mono"
          autoFocus
        />
        <span className="text-xs font-semibold text-gray-600 shrink-0 whitespace-nowrap pl-2 border-l border-gray-100">
          {evaluated !== null ? `= ${formatPreview(evaluated)}` : expression.trim() ? '= ?' : ''}
        </span>
      </div>

      {/* Compact keypad */}
      <div className="grid grid-cols-4 gap-1.5">
        {KEYPAD_ROWS.flat().map((key) => {
          const isOp = ['/', '*', '-', '+'].includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => appendToken(key)}
              className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isOp
                  ? 'bg-blue-100/80 hover:bg-blue-200/80 text-blue-800'
                  : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200'
              }`}
            >
              {key}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => appendToken(')')}
          className="h-8 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 cursor-pointer"
        >
          )
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-8 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 flex items-center justify-center cursor-pointer"
          aria-label="Backspace"
        >
          <Delete className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="h-8 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-red-600 border border-gray-200 cursor-pointer"
        >
          C
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={evaluated === null}
          className="h-8 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center gap-1 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" /> Apply
        </button>
      </div>
    </div>
  );
}