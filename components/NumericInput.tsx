'use client';

import React, { useEffect, useState } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (nextValue: number) => void;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Input numérico controlado que evita el bug de ceros a la izquierda ("012")
 * permitiendo vaciar el campo libremente mientras se edita.
 */
export function NumericInput({
  value,
  onChange,
  allowDecimal = false,
  min = 0,
  max,
  placeholder = '0',
  ariaLabel,
  className = '',
}: NumericInputProps) {
  const [draft, setDraft] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value === 0) {
      setDraft('');
    } else {
      const text = String(value);
      setDraft(text);
      const inputEl = e.currentTarget;
      requestAnimationFrame(() => {
        try {
          inputEl.select();
        } catch {
          // ignore selection errors on unsupported inputs
        }
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/,/g, '.');
    raw = allowDecimal ? raw.replace(/[^0-9.]/g, '') : raw.replace(/[^0-9]/g, '');

    if (allowDecimal) {
      const firstDot = raw.indexOf('.');
      if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
      }
    }

    // Eliminar ceros iniciales redundantes ("012" -> "12"), conservando "0.5" o "0"
    raw = raw.replace(/^0+(\d)/, '$1');
    if (!allowDecimal && raw.length > 1) {
      raw = raw.replace(/^0+/, '') || '0';
    }

    setDraft(raw);

    if (raw === '' || raw === '.') {
      onChange(min);
      return;
    }

    const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = draft.replace(/,/g, '.');
    const parsed = allowDecimal ? parseFloat(normalized) : parseInt(normalized, 10);
    const finalVal = Number.isNaN(parsed)
      ? min
      : Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    onChange(finalVal);
    setDraft(String(finalVal));
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`text-base sm:text-sm tabular-nums ${className}`}
    />
  );
}
