'use client';

import React, { useState } from 'react';
import { Watch, CheckCircle2, AlertCircle, Lock, Mail, KeyRound, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { GarminAccountStatus } from '@/lib/types';

interface GarminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountStatus: GarminAccountStatus | null;
  onAuthSuccess: (data: {
    authenticated: boolean;
    displayName?: string;
    username?: string;
    tokens?: any;
  }) => void;
  onDisconnect: () => void;
}

export default function GarminAuthModal({
  isOpen,
  onClose,
  accountStatus,
  onAuthSuccess,
  onDisconnect
}: GarminAuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaState, setMfaState] = useState<any>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReconnectForm, setShowReconnectForm] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = requiresMfa
        ? { mfaCode: mfaCode.trim(), mfaState }
        : { email: email.trim(), password };

      const res = await fetch('/api/garmin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión en Garmin Connect');
      }

      if (data.requiresMfa) {
        setRequiresMfa(true);
        setMfaState(data.mfaState);
        setIsLoading(false);
        return;
      }

      onAuthSuccess({
        authenticated: true,
        displayName: data.displayName,
        username: data.username,
        tokens: data.tokens
      });
      setShowReconnectForm(false);
      setPassword('');
      setMfaCode('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con Garmin Connect');
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = Boolean(accountStatus?.authenticated && !showReconnectForm);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Cuenta Garmin Connect</h3>
              <p className="text-xs text-muted-foreground">Sincronización directa con Garmin Fénix 8</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Sesión Activa y Guardada
                    </span>
                  </div>
                  <p className="font-bold text-foreground text-sm truncate mt-0.5">
                    {accountStatus?.displayName || 'Garmin Connect'}
                  </p>
                  {accountStatus?.username && (
                    <p className="text-xs text-muted-foreground truncate">{accountStatus.username}</p>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/70 text-xs text-muted-foreground flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Tus tokens OAuth de Garmin están sincronizados en tu cuenta para que no tengas que volver a iniciar sesión al enviar entrenamientos al reloj.
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconnectForm(true)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-muted hover:bg-accent text-foreground border border-border/60 text-xs font-semibold transition-all"
                >
                  Cambiar o reconectar cuenta
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all"
                >
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {!requiresMfa ? (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Introduce tus credenciales de <strong className="text-foreground">Garmin Connect</strong>. Se generará un token seguro que quedará guardado en tu cuenta para enviar tus rutinas al <strong className="text-foreground">Fénix 8</strong> con un clic.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                      Email de Garmin Connect
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className="w-full min-h-[42px] bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                      Contraseña de Garmin
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[42px] bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-900 dark:text-blue-200">
                    Garmin ha enviado un código de verificación de seguridad (2FA) a tu correo o teléfono.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                      Código de verificación (MFA)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="Ej: 123456"
                        className="w-full min-h-[42px] bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                {showReconnectForm && (
                  <button
                    type="button"
                    onClick={() => setShowReconnectForm(false)}
                    className="min-h-[42px] px-4 py-2.5 rounded-xl bg-muted hover:bg-accent text-foreground border border-border/60 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Conectando con Garmin...</span>
                    </>
                  ) : (
                    <>
                      <Watch className="w-4 h-4" />
                      <span>{requiresMfa ? 'Verificar código' : 'Vincular y Guardar Cuenta Garmin'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
