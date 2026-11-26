'use client';

import React, { useState } from 'react';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Key,
  Mail,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/lib/social-service';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onAuthChange: () => void;
}

function translateAuthError(err: unknown): { message: string; isEmailNotConfirmed?: boolean } {
  const rawMessage = String((err as { message?: string })?.message || '');
  const code = String((err as { code?: string })?.code || '');
  const combined = `${rawMessage} ${code}`.toLowerCase();

  if (/failed to fetch|networkerror|load failed|fetch/i.test(rawMessage)) {
    return {
      message:
        'No se pudo conectar con el servidor de Supabase. Es posible que el proyecto esté pausado o sin conexión; mientras tanto tus rutinas y progreso siguen guardándose en modo local.',
    };
  }
  if (combined.includes('email not confirmed') || combined.includes('email_not_confirmed')) {
    return {
      isEmailNotConfirmed: true,
      message:
        'Tu cuenta existe, pero aún no has confirmado el correo electrónico. Revisa tu bandeja de entrada (y Spam) y pulsa el último enlace de verificación.',
    };
  }
  if (combined.includes('invalid login credentials') || combined.includes('invalid_credentials')) {
    return {
      message:
        'Correo o contraseña incorrectos. Revisa tus datos o, si te registraste hace poco, comprueba que hayas confirmado tu correo.',
    };
  }
  if (combined.includes('user already registered') || combined.includes('user_already_exists')) {
    return {
      message:
        "Ya existe una cuenta con ese correo. Cambia a la pestaña 'Entrar' para iniciar sesión.",
    };
  }
  if (combined.includes('rate limit') || combined.includes('over_email_send_rate_limit')) {
    return {
      message:
        'Has solicitado demasiados correos seguidos. Espera unos minutos antes de volver a intentarlo.',
    };
  }
  if (combined.includes('password') || combined.includes('weak_password')) {
    return {
      message:
        'La contraseña no cumple los requisitos mínimos de seguridad (al menos 10 caracteres).',
    };
  }

  return {
    message: rawMessage || 'Error en la autenticación',
  };
}

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onAuthChange,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingConfirmationEmail(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMessage('Supabase no está configurado');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRedirectTo =
      typeof window !== 'undefined' ? window.location.origin : undefined;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        setPendingConfirmationEmail(null);
        setSuccessMessage('¡Sesión iniciada con éxito!');
        await onAuthChange();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        if (!username.trim()) throw new Error('Elige un nombre de usuario');
        const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (cleanUser.length < 2) {
          throw new Error('Elige un nombre de usuario válido (letras, números o _)');
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo,
            data: {
              username: cleanUser,
              display_name: displayName.trim() || cleanUser,
            },
          },
        });
        if (error) throw error;

        if (
          data?.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          setErrorMessage(
            "Ya existe una cuenta registrada con este correo. Cambia a 'Entrar' para iniciar sesión."
          );
          return;
        }

        if (data?.user && !data?.session) {
          setPendingConfirmationEmail(cleanEmail);
          setSuccessMessage(
            `Cuenta registrada para ${cleanEmail}. Revisa tu correo (y la carpeta de Spam) y pulsa el enlace de verificación antes de iniciar sesión. No vuelvas a registrarte porque anularías el primer enlace.`
          );
          return;
        }

        if (data?.session) {
          setPendingConfirmationEmail(null);
          setSuccessMessage('¡Cuenta creada y sesión iniciada con éxito!');
          await onAuthChange();
          setTimeout(() => {
            onClose();
          }, 800);
        }
      }
    } catch (err: unknown) {
      const translated = translateAuthError(err);
      if (translated.isEmailNotConfirmed && cleanEmail) {
        setPendingConfirmationEmail(cleanEmail);
      }
      setErrorMessage(translated.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!supabase || !pendingConfirmationEmail) return;
    setIsResending(true);
    setErrorMessage(null);
    try {
      const emailRedirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setSuccessMessage(
        `Hemos reenviado el correo de verificación a ${pendingConfirmationEmail}. Revisa tu bandeja de entrada y Spam.`
      );
    } catch (err: unknown) {
      setErrorMessage(translateAuthError(err).message);
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onAuthChange();
    onClose();
  };

  const copyFriendCode = () => {
    if (!currentUser) return;
    navigator.clipboard.writeText(currentUser.friend_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card text-foreground rounded-2xl border border-border/80 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">
                {currentUser
                  ? 'Tu Perfil de Atleta'
                  : mode === 'login'
                  ? 'Iniciar Sesión'
                  : 'Crear Cuenta'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {currentUser
                  ? 'Gestiona tu cuenta y código de amigo'
                  : 'Guarda tus rutinas en la nube y compite con amigos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Si ya está logueado */}
        {currentUser ? (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground font-semibold uppercase">Nombre</div>
                <div className="font-bold text-foreground text-base">{currentUser.display_name}</div>
                <div className="text-xs text-muted-foreground font-mono">@{currentUser.username}</div>
              </div>

              <div className="pt-3 border-t border-border/60">
                <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">
                  Tu Código de Amigo
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/30">
                    {currentUser.friend_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyFriendCode}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent text-foreground border border-border/60 transition-colors"
                    title="Copiar código para compartir"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Comparte este código para que tus amigos te agreguen y os retéis.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Tabs Login vs Register */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`min-h-[38px] py-2 rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-card text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`min-h-[38px] py-2 rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-card text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Registrarse
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {pendingConfirmationEmail && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-blue-800 dark:text-blue-200">
                  ¿No recibiste el correo o caducó?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                    <span>{isResending ? 'Enviando...' : 'Reenviar correo de confirmación'}</span>
                  </button>
                  {mode === 'register' && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-muted hover:bg-accent text-foreground border border-border/60 text-xs font-semibold"
                    >
                      Ir a Entrar
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-3">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ej: Nacho"
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1">
                      Nombre de Usuario (sin espacios)
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: nacho_fit"
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 10 : 6}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Mínimo 10 caracteres' : 'Tu contraseña'}
                    className="w-full min-h-[42px] pl-9 pr-10 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 min-h-[42px] mt-2"
              >
                {isLoading ? (
                  <span>Procesando...</span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Iniciar Sesión</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Crear Mi Cuenta</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
