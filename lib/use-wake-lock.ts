'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hook para mantener la pantalla del móvil encendida durante el entrenamiento
 * usando la Screen Wake Lock API (con re-adquisición automática al volver a la pestaña).
 */
export function useWakeLock(enabled: boolean) {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    setIsSupported(supported);
    if (!supported || !enabled) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
        setIsActive(true);
        lock.addEventListener('release', () => {
          setIsActive(false);
        });
      } catch {
        setIsActive(false);
      }
    };

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  return { isActive, isSupported };
}
