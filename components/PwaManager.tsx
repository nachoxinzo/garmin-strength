'use client';

import React, { useEffect, useState } from 'react';
import {
  Compass,
  Download,
  PlusSquare,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Detección específica de iOS (Safari no dispara beforeinstallprompt)
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSInApp, setIsIOSInApp] = useState(false);
  const [isIOSOtherBrowser, setIsIOSOtherBrowser] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [manualInstallOpen, setManualInstallOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 4000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Registrar Service Worker para soporte offline y PWA instalable
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('No se pudo registrar el Service Worker PWA:', err);
      });
    }

    const ua = navigator.userAgent || '';
    const params = new URLSearchParams(window.location.search);
    const previewIOS = params.get('ios_install_preview') === '1';

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const detectedIOS =
      previewIOS ||
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(detectedIOS);

    if (detectedIOS) {
      setIsIOSInApp(
        /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Twitter|LinkedInApp|GSA\//i.test(ua)
      );
      setIsIOSOtherBrowser(/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua));
    }

    const wasDismissed = sessionStorage.getItem('pwa_install_dismissed') === 'true';
    if (wasDismissed && !previewIOS) setDismissed(true);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleOpenGuide = () => {
      setDismissed(false);
      setManualInstallOpen(true);
      setShowIOSSteps(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('ironsync:open-install-guide', handleOpenGuide);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('ironsync:open-install-guide', handleOpenGuide);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setManualInstallOpen(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setManualInstallOpen(false);
    setShowIOSSteps(false);
    try {
      sessionStorage.setItem('pwa_install_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const showAndroidPrompt = Boolean(installPrompt && !isStandalone && !dismissed && !isOffline);
  const showIOSBanner = Boolean(
    !installPrompt &&
      !isStandalone &&
      !isOffline &&
      ((isIOS && !dismissed) || manualInstallOpen)
  );

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-sm bg-amber-50 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-700 rounded-xl p-3.5 shadow-lg flex items-center gap-2.5 text-xs text-amber-950 dark:text-amber-100 animate-in fade-in duration-200">
          <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Modo Gimnasio Offline:</strong> sin cobertura; tus rutinas y series siguen guardándose en el dispositivo.
          </span>
        </div>
      )}

      {!isOffline && justReconnected && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-xs bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 shadow-lg flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-100 animate-in fade-in duration-200">
          <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Conexión recuperada.</span>
        </div>
      )}

      {showAndroidPrompt && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-sm bg-card border border-border/80 rounded-xl p-4 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
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
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
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
      )}

      {showIOSBanner && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-sm bg-card border border-border/80 rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              {isIOSInApp ? <Compass className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">
                {isIOSInApp ? 'Ábrela en Safari para instalar' : 'Instalar IronSync en iPhone'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                {isIOSInApp
                  ? 'Desde WhatsApp o apps integradas iPhone oculta la instalación. Pulsa el icono de Safari abajo a la derecha y luego Compartir -> Añadir a pantalla de inicio.'
                  : 'iPhone no muestra botón automático: añádela como app desde el menú Compartir.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar aviso de instalación"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!isIOSInApp && (
            <div className="space-y-2.5">
              {!showIOSSteps ? (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIOSSteps(true)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <Share className="w-3.5 h-3.5" />
                    <span>Ver pasos</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/50 border border-border/70 p-3 space-y-2 text-xs text-foreground">
                  <div className="flex items-center gap-2.5">
                    <Share className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>1. Pulsa el botón <strong>Compartir</strong> en la barra del navegador.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <PlusSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>2. Selecciona <strong>«Añadir a pantalla de inicio»</strong>.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>3. Pulsa <strong>«Añadir»</strong> arriba a la derecha.</span>
                  </div>
                  {isIOSOtherBrowser && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 pt-1 border-t border-border/50">
                      Si no ves la opción en este navegador, ábrelo en <strong>Safari</strong>.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
