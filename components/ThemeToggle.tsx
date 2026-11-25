'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'ironsync_theme_v1';
const THEME_EVENT = 'ironsync-theme-change';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromDomOrStorage = () => {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      const prefersDark =
        saved === 'dark' ||
        (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    };

    syncFromDomOrStorage();
    window.addEventListener(THEME_EVENT, syncFromDomOrStorage);
    return () => window.removeEventListener(THEME_EVENT, syncFromDomOrStorage);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // ignore
    }
    setIsDark(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo Claro' : 'Modo Oscuro (Gimnasio)'}
      className="saas-btn min-h-[42px] min-w-[42px] lg:min-h-[38px] lg:min-w-[38px] flex items-center justify-center rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 shadow-2xs"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}
