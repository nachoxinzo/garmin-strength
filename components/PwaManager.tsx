'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Registrar Service Worker para soporte offline y PWA instalable
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('No se pudo registrar el Service Worker PWA:', err);
      });
    }

    const wasDismissed = sessionStorage.getItem('pwa_install_dismissed') === 'true';
    if (wasDismissed) setDismissed(true);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!installPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-sm bg-card border border-border/80 rounded-xl p-4 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">Instalar App en tu Móvil</p>
        <p className="text-[11px] text-muted-foreground truncate">
          Acceso directo, pantalla completa y modo gimnasio.
        </p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar</span>
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar aviso de instalación"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
