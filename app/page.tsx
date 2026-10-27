'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dumbbell,
  Watch,
  CloudUpload,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  FolderOpen,
  Save,
  Key,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
  CheckSquare,
  Square,
  Share2,
  Check,
  Smartphone,
  TrendingUp,
  Cloud,
  Sparkles,
  Swords,
  User,
  Shuffle,
  X,
  Minus,
  Layers,
  Repeat,
  Timer,
  SlidersHorizontal,
  Activity
} from 'lucide-react';
import { EXERCISE_CATALOG, CatalogExercise } from '@/lib/exercise-catalog';
import { StrengthRoutine, WorkoutExerciseBlock, GarminAccountStatus } from '@/lib/types';
import { parseHevyCSV, ParsedHevyWorkout } from '@/lib/hevy-csv-parser';
import { encodeRoutineToShareUrl } from '@/lib/share-utils';
import ProgressDashboard from '@/components/ProgressDashboard';
import SocialDashboard from '@/components/SocialDashboard';
import AuthModal from '@/components/AuthModal';
import GarminAuthModal from '@/components/GarminAuthModal';
import ExerciseSwapModal from '@/components/ExerciseSwapModal';
import WorkoutGeneratorModal from '@/components/WorkoutGeneratorModal';
import { UserProfile, getCurrentUserProfile } from '@/lib/social-service';
import {
  supabase,
  isSupabaseConfigured,
  getRoutinesFromSupabase,
  saveRoutineToSupabase,
  deleteRoutineFromSupabase
} from '@/lib/supabase';

const DEFAULT_ROUTINE: StrengthRoutine = {
  id: 'nueva-sesion',
  name: 'Nueva Sesión',
  warmupSeconds: 0,
  cooldownSeconds: 0,
  blocks: []
};

export default function WorkoutStudioPage() {
  const [currentMainTab, setCurrentMainTab] = useState<'studio' | 'progress' | 'social'>('studio');
  const [routine, setRoutine] = useState<StrengthRoutine>(DEFAULT_ROUTINE);
  const [accountStatus, setAccountStatus] = useState<GarminAccountStatus | null>(null);
  const [garminTokens, setGarminTokens] = useState<any>(null);
  const [isGarminAuthModalOpen, setIsGarminAuthModalOpen] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Perfil de Usuario y Social
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Modales de Generador Científico y Sustitución
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swappingBlockIndex, setSwappingBlockIndex] = useState<number | null>(null);

  // Selector modal de ejercicios
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Todos');

  // Modal de importación de HEVY
  const [isHevyModalOpen, setIsHevyModalOpen] = useState(false);
  const [hevyTab, setHevyTab] = useState<'api' | 'csv'>('api');
  const [hevyApiKey, setHevyApiKey] = useState('');
  const [isHevyKeySaved, setIsHevyKeySaved] = useState(false);
  const [isEditingHevyKey, setIsEditingHevyKey] = useState(false);
  const [isLoadingHevyApi, setIsLoadingHevyApi] = useState(false);
  const [hevyApiRoutines, setHevyApiRoutines] = useState<any[]>([]);
  const [hevyCsvWorkouts, setHevyCsvWorkouts] = useState<ParsedHevyWorkout[]>([]);
  const [hevyError, setHevyError] = useState<string | null>(null);

  // Selección múltiple para sincronización por lotes
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  // Modal para compartir con Apple Watch / Amigo
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Supabase Cloud Routines
  const [cloudRoutines, setCloudRoutines] = useState<StrengthRoutine[]>([]);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isCloudRoutinesModalOpen, setIsCloudRoutinesModalOpen] = useState(false);
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar estado de Garmin y rutina guardada al inicio
  useEffect(() => {
    checkGarminStatus();
    const available = isSupabaseConfigured();
    setIsSupabaseAvailable(available);

    let authSubscription: any = null;
    if (available && supabase) {
      loadCloudRoutines();
      loadUserProfile();

      // Escuchar cambios de autenticación en tiempo real
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await loadUserProfile();
          await loadCloudRoutines();
        } else {
          setCurrentUser(null);
        }
      });
      authSubscription = data.subscription;
    }

    try {
      const saved = localStorage.getItem('garmin_strength_current_routine');
      if (saved) {
        setRoutine(JSON.parse(saved));
      }
      const savedHevyKey = localStorage.getItem('hevy_api_key');
      if (savedHevyKey && savedHevyKey.trim()) {
        setHevyApiKey(savedHevyKey.trim());
        setIsHevyKeySaved(true);
      }
      const savedGarminTokens = localStorage.getItem('garmin_oauth_tokens');
      if (savedGarminTokens) {
        const parsedTokens = JSON.parse(savedGarminTokens);
        setGarminTokens(parsedTokens);
        checkGarminStatus(parsedTokens);
      }
    } catch (e) {
      // ignore
    }

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const persistGarminTokens = (tokens: any) => {
    if (!tokens) return;
    setGarminTokens(tokens);
    try {
      localStorage.setItem('garmin_oauth_tokens', JSON.stringify(tokens));
    } catch {
      // ignore
    }
    if (supabase) {
      supabase.auth.updateUser({ data: { garmin_tokens: tokens } }).catch(() => {});
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await getCurrentUserProfile();
      setCurrentUser(profile);

      // Si el usuario tiene guardada su Hevy API Key o Tokens de Garmin en su cuenta de Supabase, sincronizarlos automáticamente
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        const cloudHevyKey = user?.user_metadata?.hevy_api_key;
        if (cloudHevyKey && typeof cloudHevyKey === 'string' && cloudHevyKey.trim()) {
          setHevyApiKey(cloudHevyKey.trim());
          setIsHevyKeySaved(true);
          try {
            localStorage.setItem('hevy_api_key', cloudHevyKey.trim());
          } catch {
            // ignore
          }
        }

        const cloudGarminTokens = user?.user_metadata?.garmin_tokens;
        if (cloudGarminTokens && cloudGarminTokens.oauth1 && cloudGarminTokens.oauth2) {
          setGarminTokens(cloudGarminTokens);
          try {
            localStorage.setItem('garmin_oauth_tokens', JSON.stringify(cloudGarminTokens));
          } catch {
            // ignore
          }
          checkGarminStatus(cloudGarminTokens);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSwapExercise = (alternativeExercise: CatalogExercise, newWeightKg: number) => {
    if (swappingBlockIndex === null) return;
    setRoutine(prev => {
      const newBlocks = [...prev.blocks];
      const targetBlock = newBlocks[swappingBlockIndex];
      newBlocks[swappingBlockIndex] = {
        ...targetBlock,
        exercise: alternativeExercise,
        weightKg: newWeightKg,
        suggestedWeightKg: newWeightKg
      };
      return { ...prev, blocks: newBlocks };
    });
    setIsSwapModalOpen(false);
    setSwappingBlockIndex(null);
    setStatusMessage({
      type: 'success',
      text: `Ejercicio cambiado a "${alternativeExercise.name}".`
    });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const loadCloudRoutines = async () => {
    try {
      const data = await getRoutinesFromSupabase();
      setCloudRoutines(data);
    } catch (e) {
      console.warn('Error al cargar rutinas de Supabase:', e);
    }
  };

  const handleSaveToCloud = async () => {
    if (!isSupabaseAvailable) {
      setStatusMessage({
        type: 'error',
        text: 'Supabase no está configurado aún. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.'
      });
      return;
    }
    if (routine.blocks.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Añade ejercicios a la rutina antes de guardarla.'
      });
      return;
    }

    setIsCloudSaving(true);
    try {
      const ok = await saveRoutineToSupabase(routine);
      if (ok) {
        setStatusMessage({
          type: 'success',
          text: `¡Rutina "${routine.name}" guardada en la nube con éxito!`
        });
        await loadCloudRoutines();
      } else {
        setStatusMessage({
          type: 'error',
          text: 'No se pudo guardar la rutina en Supabase.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al conectar con Supabase'
      });
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleDeleteCloudRoutine = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar "${name}" de Supabase?`)) return;
    try {
      const ok = await deleteRoutineFromSupabase(id);
      if (ok) {
        setCloudRoutines(prev => prev.filter(r => r.id !== id));
        setStatusMessage({
          type: 'success',
          text: `Rutina "${name}" eliminada de la nube.`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al eliminar rutina de Supabase'
      });
    }
  };

  // Guardar en localStorage cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem('garmin_strength_current_routine', JSON.stringify(routine));
    } catch (e) {
      // ignore
    }
  }, [routine]);

  // Limpiar selección al cambiar de pestaña en Hevy
  useEffect(() => {
    setSelectedRoutineIds([]);
  }, [hevyTab]);

  const checkGarminStatus = async (overrideTokens?: any) => {
    setIsCheckingStatus(true);
    try {
      const tokensToSend = overrideTokens !== undefined ? overrideTokens : garminTokens;
      const res = await fetch('/api/garmin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garminTokens: tokensToSend })
      });
      const data = await res.json();
      setAccountStatus(data);
      if (data?.authenticated && data?.tokens) {
        persistGarminTokens(data.tokens);
      }
    } catch (err) {
      console.error(err);
      setAccountStatus({ authenticated: false });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Cálculos estadísticos de la sesión
  const totalSets = routine.blocks.reduce((acc, b) => acc + b.sets, 0);
  const totalTimeSeconds =
    routine.warmupSeconds +
    routine.cooldownSeconds +
    routine.blocks.reduce((acc, b) => {
      const workTime = b.sets * (b.reps * 4);
      const restTime = b.sets * b.restSeconds;
      return acc + workTime + restTime;
    }, 0);
  const estimatedMinutes = Math.round(totalTimeSeconds / 60);

  // Acciones en la rutina
  const updateBlock = (index: number, updates: Partial<WorkoutExerciseBlock>) => {
    setRoutine(prev => {
      const newBlocks = [...prev.blocks];
      newBlocks[index] = { ...newBlocks[index], ...updates };
      return { ...prev, blocks: newBlocks };
    });
  };

  const removeBlock = (index: number) => {
    setRoutine(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index)
    }));
  };

  const duplicateBlock = (index: number) => {
    setRoutine(prev => {
      const target = prev.blocks[index];
      const clone: WorkoutExerciseBlock = {
        ...target,
        id: `b-${Date.now()}`
      };
      const newBlocks = [...prev.blocks];
      newBlocks.splice(index + 1, 0, clone);
      return { ...prev, blocks: newBlocks };
    });
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    setRoutine(prev => {
      const newBlocks = [...prev.blocks];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newBlocks.length) return prev;
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[targetIndex];
      newBlocks[targetIndex] = temp;
      return { ...prev, blocks: newBlocks };
    });
  };

  const addExercise = (exercise: CatalogExercise) => {
    const newBlock: WorkoutExerciseBlock = {
      id: `b-${Date.now()}`,
      exercise,
      sets: 3,
      reps: 10,
      weightKg: 20,
      restSeconds: 90
    };
    setRoutine(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    setIsSelectorOpen(false);
  };

  const resetToNewRoutine = () => {
    if (routine.blocks.length > 0 && !window.confirm('¿Deseas vaciar la sesión actual para empezar una nueva?')) {
      return;
    }
    setRoutine(DEFAULT_ROUTINE);
    setStatusMessage({
      type: 'success',
      text: 'Sesión en blanco iniciada.'
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Escalado global de cargas (ej: para adaptar al compañero o variar intensidad)
  const scaleRoutineWeights = (factor: number) => {
    setRoutine(prev => {
      const newBlocks = prev.blocks.map(b => {
        const base = b.suggestedWeightKg !== undefined ? b.suggestedWeightKg : b.weightKg;
        if (base <= 0) return b;
        const scaled = Math.max(0, Math.round((base * factor) / 2.5) * 2.5);
        return { ...b, weightKg: scaled };
      });
      return { ...prev, blocks: newBlocks };
    });
    setStatusMessage({
      type: 'success',
      text: `Pesos ajustados al ${Math.round(factor * 100)}% de la carga de Hevy.`
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const adjustAllWeightsDelta = (deltaKg: number) => {
    setRoutine(prev => {
      const newBlocks = prev.blocks.map(b => {
        if (b.weightKg <= 0 && deltaKg < 0) return b;
        const newWeight = Math.max(0, b.weightKg + deltaKg);
        return { ...b, weightKg: newWeight };
      });
      return { ...prev, blocks: newBlocks };
    });
    setStatusMessage({
      type: 'success',
      text: `Todos los pesos ajustados ${deltaKg > 0 ? '+' : ''}${deltaKg} kg.`
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Sincronización Inalámbrica con Garmin Connect (Sesión actual)
  const handleSyncToGarmin = async () => {
    if (routine.blocks.length === 0) {
      setStatusMessage({ type: 'error', text: 'Añade al menos un ejercicio a la rutina.' });
      return;
    }

    if (!accountStatus?.authenticated && !garminTokens) {
      setIsGarminAuthModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine, garminTokens })
      });

      const data = await res.json();

      if (!res.ok) {
        if (String(data.error || '').toLowerCase().includes('sesión activa de garmin')) {
          setIsGarminAuthModalOpen(true);
        }
        throw new Error(data.error || 'Error al sincronizar con Garmin');
      }

      if (data.tokens) {
        persistGarminTokens(data.tokens);
      }
      setAccountStatus(prev => ({ ...prev, authenticated: true }));

      setStatusMessage({
        type: 'success',
        text: `¡Entrenamiento "${data.workoutName}" enviado! ID #${data.workoutId}. Tu Fénix 8 lo descargará al sincronizar.`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error de conexión con Garmin Connect.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Descarga de archivo binario .FIT
  const handleDownloadFit = async () => {
    if (routine.blocks.length === 0) {
      setStatusMessage({ type: 'error', text: 'Añade al menos un ejercicio a la rutina.' });
      return;
    }

    setIsDownloading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/garmin/download-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al generar binario');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${routine.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.fit`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatusMessage({
        type: 'success',
        text: `Archivo .FIT descargado con éxito. Puedes copiarlo a GARMIN/NEWFILES si deseas conexión USB.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al compilar el archivo FIT.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // --- HEVY: Obtener rutinas de la API ---
  const fetchHevyRoutines = async (overrideKey?: string) => {
    const keyToUse = (overrideKey !== undefined ? overrideKey : hevyApiKey).trim();

    setIsLoadingHevyApi(true);
    setHevyError(null);
    setSelectedRoutineIds([]);

    try {
      if (keyToUse) {
        try {
          localStorage.setItem('hevy_api_key', keyToUse);
        } catch {
          // ignore
        }
        // Guardar también en la cuenta de Supabase del usuario para no volver a pedirla en ningún dispositivo
        if (supabase) {
          supabase.auth.updateUser({ data: { hevy_api_key: keyToUse } }).catch(() => {});
        }
      }

      const query = keyToUse ? `?apiKey=${encodeURIComponent(keyToUse)}` : '';
      const res = await fetch(`/api/hevy/routines${query}`);
      const data = await res.json();

      if (!res.ok) {
        if (!keyToUse) {
          setIsEditingHevyKey(true);
        }
        throw new Error(data.error || 'Error al consultar rutinas en Hevy');
      }

      if (keyToUse) {
        setIsHevyKeySaved(true);
        setIsEditingHevyKey(false);
      }
      setHevyApiRoutines(data.routines || []);
      if (data.routines?.length === 0) {
        setHevyError('No se encontraron rutinas en tu cuenta de Hevy.');
      }
    } catch (err: any) {
      setHevyError(err.message || 'Error al conectar con la API de Hevy');
    } finally {
      setIsLoadingHevyApi(false);
    }
  };

  // Auto-cargar rutinas de Hevy al abrir el modal si ya hay clave guardada
  useEffect(() => {
    if (isHevyModalOpen && hevyTab === 'api' && hevyApiKey.trim() && hevyApiRoutines.length === 0 && !isLoadingHevyApi) {
      fetchHevyRoutines(hevyApiKey.trim());
    }
  }, [isHevyModalOpen, hevyTab]);

  // --- HEVY: Procesar archivo CSV subido ---
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const parsed = parseHevyCSV(text);
        if (parsed.length === 0) {
          setHevyError('No se detectaron entrenamientos válidos en el CSV de Hevy.');
        } else {
          setHevyCsvWorkouts(parsed);
          setSelectedRoutineIds([]);
          setHevyError(null);
          try {
            localStorage.setItem('hevy_raw_csv_cache', text);
          } catch (e) {
            // ignore
          }
        }
      } catch (err: any) {
        setHevyError(err.message || 'Error al procesar el archivo CSV.');
      }
    };
    reader.readAsText(file);
  };

  // Aplicar rutina individual al editor
  const applyHevyRoutine = (importedRoutine: StrengthRoutine) => {
    setRoutine(importedRoutine);
    setIsHevyModalOpen(false);
    setStatusMessage({
      type: 'success',
      text: `¡Rutina "${importedRoutine.name}" de Hevy cargada en el editor! Lista para editar o sincronizar.`
    });
  };

  // --- LÓGICA DE SELECCIÓN MÚLTIPLE ---
  const currentList = hevyTab === 'api' ? hevyApiRoutines : hevyCsvWorkouts;

  const toggleSelectRoutine = (id: string) => {
    setSelectedRoutineIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRoutineIds.length === currentList.length) {
      setSelectedRoutineIds([]);
    } else {
      setSelectedRoutineIds(currentList.map(item => item.id));
    }
  };

  // --- SINCRONIZACIÓN POR LOTES (VARIAS RUTINAS A LA VEZ A GARMIN) ---
  const handleBatchSyncToGarmin = async () => {
    if (selectedRoutineIds.length === 0) return;

    setIsBatchSyncing(true);
    setHevyError(null);

    // Obtener las rutinas completas a partir de los IDs seleccionados
    const routinesToSync: StrengthRoutine[] = [];
    currentList.forEach(item => {
      if (selectedRoutineIds.includes(item.id)) {
        routinesToSync.push(item.routine);
      }
    });

    try {
      const res = await fetch('/api/garmin/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routines: routinesToSync, garminTokens })
      });

      const data = await res.json();

      if (!res.ok) {
        if (String(data.error || '').toLowerCase().includes('sesión activa de garmin')) {
          setIsGarminAuthModalOpen(true);
        }
        throw new Error(data.error || 'Error durante la sincronización múltiple');
      }

      if (data.tokens) {
        persistGarminTokens(data.tokens);
      }

      setIsHevyModalOpen(false);
      setSelectedRoutineIds([]);

      const names = data.results.filter((r: any) => r.success).map((r: any) => `"${r.workoutName}"`).join(', ');

      setStatusMessage({
        type: 'success',
        text: `¡${data.totalSuccess} rutinas de Hevy enviadas a tu Garmin Connect! (${names}). El Fénix 8 las descargará en la próxima sincronización.`
      });
    } catch (err: any) {
      setHevyError(err.message || 'Error al enviar las rutinas a Garmin Connect.');
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Enlace compartible de la rutina actual
  const [currentOrigin, setCurrentOrigin] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  const shareUrl = routine ? `${currentOrigin}/live?data=${encodeRoutineToShareUrl(routine)}` : '';

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filtro del catálogo
  const filteredCatalog = EXERCISE_CATALOG.filter(ex => {
    const matchesSearch =
      ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = selectedMuscle === 'Todos' || ex.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const muscleGroups = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

  return (
    <div className="min-h-screen pb-28 bg-background text-foreground">
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Dumbbell className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground tracking-tight text-base sm:text-lg truncate">
                  Garmin Strength Studio
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60 shrink-0">
                  <Watch className="w-3 h-3 text-blue-600" />
                  Fénix 8
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">Planificador de entrenamientos nativos</p>
            </div>
          </div>

          {/* Botones de Acción Global & Estado de Garmin Connect */}
          <div className="flex items-center gap-2 shrink-0">
            {isSupabaseAvailable && (
              <button
                onClick={() => setIsCloudRoutinesModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Mis Rutinas</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-bold tabular-nums">
                  {cloudRoutines.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Compartir</span>
            </button>

            <button
              onClick={() => setIsHevyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/80 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">Importar Hevy</span>
            </button>

            {/* Botón de Perfil de Atleta */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
                currentUser
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 shadow-xs'
                  : 'bg-muted/70 hover:bg-muted text-foreground border border-border/60'
              }`}
            >
              {currentUser ? (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate max-w-[110px]">
                {currentUser ? currentUser.display_name : 'Iniciar Sesión'}
              </span>
            </button>

            {/* Estado / Botón de Cuenta Garmin Connect */}
            {accountStatus?.authenticated ? (
              <button
                onClick={() => setIsGarminAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                title="Cuenta Garmin Connect vinculada (clic para gestionar)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden lg:inline">Garmin:</span>
                <span className="font-semibold truncate max-w-[110px]">{accountStatus.displayName || 'Fénix 8'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsGarminAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                title="Conectar cuenta de Garmin Connect"
              >
                <Watch className="w-3.5 h-3.5" />
                <span>Conectar Garmin</span>
              </button>
            )}

            <button
              onClick={() => checkGarminStatus()}
              disabled={isCheckingStatus}
              title="Comprobar estado de conexión"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Sub-barra de Navegación de Pestañas */}
      <div className="bg-card border-b border-border/60 shadow-xs sticky top-16 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <nav className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <button
              onClick={() => setCurrentMainTab('studio')}
              className={`flex items-center gap-2 py-3.5 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                currentMainTab === 'studio'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Diseñador de Rutinas</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('progress')}
              className={`flex items-center gap-2 py-3.5 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                currentMainTab === 'progress'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Progreso & Métricas</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('social')}
              className={`flex items-center gap-2 py-3.5 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                currentMainTab === 'social'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>Amigos & Retos</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Duelos
              </span>
            </button>
          </nav>

          <div className="text-xs text-muted-foreground font-mono hidden md:flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Garmin Connect &bull; Fénix 8</span>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Banner de Mensajes de Estado */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm transition-all duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/90 border-rose-200 text-rose-950'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm font-medium">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {currentMainTab === 'progress' ? (
          <ProgressDashboard />
        ) : currentMainTab === 'social' ? (
          <SocialDashboard onOpenAuth={() => setIsAuthModalOpen(true)} />
        ) : (
          <>

        {/* Panel Superior: Título de Rutina, Métricas y Acciones Rápidas */}
        <section className="bg-card rounded-2xl border border-border/60 p-6 sm:p-8 shadow-sm transition-all duration-200">
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Nombre de la Sesión en el Reloj (Máx 16 car.)
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={routine.name}
                  onChange={e => setRoutine({ ...routine, name: e.target.value })}
                  className="w-full text-xl sm:text-2xl font-semibold text-foreground bg-muted/40 hover:bg-muted/60 focus:bg-card border border-border/60 rounded-xl px-4 py-3 transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Ej: Push Dia 1 F8"
                />
              </div>

              {/* Acciones de Sesión */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setIsGeneratorModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Generador Científico</span>
                </button>

                <button
                  onClick={() => setIsHevyModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/80 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                  <span>Cargar de Hevy</span>
                </button>
                <button
                  onClick={handleSaveToCloud}
                  disabled={isCloudSaving || routine.blocks.length === 0}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isCloudSaving ? 'Guardando...' : 'Guardar en Supabase'}</span>
                </button>
                {routine.blocks.length > 0 && (
                  <button
                    onClick={resetToNewRoutine}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-muted/60 hover:bg-rose-50 hover:text-rose-700 text-muted-foreground border border-border/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar sesión</span>
                  </button>
                )}
              </div>
            </div>

            {/* Adaptación de Cargas / Factor Amigo */}
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/60">
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Adaptar cargas:</span>
              </div>
              <button
                onClick={() => scaleRoutineWeights(1.0)}
                title="Restablecer al 100% de los pesos de Hevy"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                100% Hevy
              </button>
              <button
                onClick={() => scaleRoutineWeights(0.85)}
                title="Ajustar al 85% para un compañero"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                85% (Amigo)
              </button>
              <button
                onClick={() => scaleRoutineWeights(0.75)}
                title="Ajustar al 75%"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                75%
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(5)}
                title="Añadir +5kg a todos los ejercicios"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/70 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                +5 kg
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(-5)}
                title="Restar -5kg a todos los ejercicios"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                -5 kg
              </button>
            </div>
          </div>

          {/* Estadísticas de la Sesión */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/60">
            <div className="bg-muted/30 hover:bg-muted/50 rounded-xl p-4 sm:p-5 border border-border/60 transition-all duration-200">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Ejercicios</span>
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
                {routine.blocks.length}
              </div>
            </div>

            <div className="bg-muted/30 hover:bg-muted/50 rounded-xl p-4 sm:p-5 border border-border/60 transition-all duration-200">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Series Totales</span>
                <Repeat className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
                {totalSets}
              </div>
            </div>

            <div className="bg-muted/30 hover:bg-muted/50 rounded-xl p-4 sm:p-5 border border-border/60 transition-all duration-200">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Tiempo Estimado</span>
                <Timer className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
                ~{estimatedMinutes} min
              </div>
            </div>
          </div>

          {/* Configuración de Calentamiento y Enfriamiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/60 text-sm">
            <div className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 p-4 rounded-xl border border-border/60 transition-all duration-200">
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-foreground">Calentamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={30}
                  value={routine.warmupSeconds}
                  onChange={e => setRoutine({ ...routine, warmupSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 px-2.5 py-1.5 text-center font-mono font-semibold bg-card border border-border/60 rounded-lg text-foreground tabular-nums"
                />
                <span className="text-xs text-muted-foreground font-medium">seg ({Math.round(routine.warmupSeconds / 60)}m)</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-muted/30 hover:bg-muted/50 p-4 rounded-xl border border-border/60 transition-all duration-200">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-foreground">Enfriamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={30}
                  value={routine.cooldownSeconds}
                  onChange={e => setRoutine({ ...routine, cooldownSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 px-2.5 py-1.5 text-center font-mono font-semibold bg-card border border-border/60 rounded-lg text-foreground tabular-nums"
                />
                <span className="text-xs text-muted-foreground font-medium">seg ({Math.round(routine.cooldownSeconds / 60)}m)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Lista de Ejercicios */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                Estructura de Ejercicios ({routine.blocks.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Configura series, repeticiones, peso objetivo y descansos para tu reloj Garmin
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsHevyModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card hover:bg-muted/50 text-foreground border border-border/60 text-xs sm:text-sm font-semibold shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                <span>Desde Hevy</span>
              </button>

              <button
                onClick={() => setIsSelectorOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Ejercicio</span>
              </button>
            </div>
          </div>

          {routine.blocks.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <Dumbbell className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-foreground">No hay ejercicios en la rutina</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Añade ejercicios del catálogo oficial de Garmin, genera una sesión científica o importa tus entrenamientos desde Hevy.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setIsGeneratorModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generador Científico</span>
                </button>
                <button
                  onClick={() => setIsHevyModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar desde Hevy</span>
                </button>
                <button
                  onClick={() => setIsSelectorOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Explorar Catálogo Garmin</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {routine.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-xl bg-muted text-foreground font-semibold text-xs flex items-center justify-center shrink-0 border border-border/60 tabular-nums">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold text-foreground text-base sm:text-lg">
                          {block.exercise.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                            {block.exercise.muscleGroup}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {block.exercise.garminName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones de bloque */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <button
                        onClick={() => {
                          setSwappingBlockIndex(index);
                          setIsSwapModalOpen(true);
                        }}
                        title="Máquina ocupada: Cambiar por ejercicio similar"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Sustituir</span>
                      </button>

                      <button
                        onClick={() => moveBlock(index, 'up')}
                        disabled={index === 0}
                        title="Mover arriba"
                        className="p-2 rounded-lg hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveBlock(index, 'down')}
                        disabled={index === routine.blocks.length - 1}
                        title="Mover abajo"
                        className="p-2 rounded-lg hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => duplicateBlock(index)}
                        title="Duplicar ejercicio"
                        className="p-2 rounded-lg hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeBlock(index)}
                        title="Eliminar ejercicio"
                        className="p-2 rounded-lg hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Parámetros de la serie (Series, Reps, Peso, Descanso) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/60">
                    {/* Series */}
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Series
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateBlock(index, { sets: Math.max(1, block.sets - 1) })}
                          className="w-9 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Reducir series"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={block.sets}
                          onChange={e => updateBlock(index, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full text-center font-semibold text-foreground bg-transparent text-base tabular-nums"
                        />
                        <button
                          onClick={() => updateBlock(index, { sets: block.sets + 1 })}
                          className="w-9 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Aumentar series"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Repeticiones */}
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Reps objetivo
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateBlock(index, { reps: Math.max(1, block.reps - 1) })}
                          className="w-9 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Reducir repeticiones"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={block.reps}
                          onChange={e => updateBlock(index, { reps: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full text-center font-semibold text-foreground bg-transparent text-base tabular-nums"
                        />
                        <button
                          onClick={() => updateBlock(index, { reps: block.reps + 1 })}
                          className="w-9 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Aumentar repeticiones"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Carga / Peso en kg con sugerencia de Hevy y ajuste ágil */}
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Carga (kg)
                        </label>
                        {block.suggestedWeightKg !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-orange-700 font-bold bg-orange-100/80 px-1.5 py-0.5 rounded border border-orange-200">
                              Hevy: {block.suggestedWeightKg}k
                            </span>
                            {block.weightKg !== block.suggestedWeightKg && (
                              <button
                                onClick={() => updateBlock(index, { weightKg: block.suggestedWeightKg })}
                                title={`Restablecer al peso de Hevy (${block.suggestedWeightKg} kg)`}
                                className="text-[10px] text-blue-600 hover:underline font-semibold"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateBlock(index, { weightKg: Math.max(0, block.weightKg - 5) })}
                          title="-5 kg"
                          className="w-8 h-9 rounded-lg bg-card border border-border/60 text-muted-foreground font-semibold hover:text-foreground hover:bg-muted/50 transition-all duration-200 active:scale-95 text-[10px]"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => updateBlock(index, { weightKg: Math.max(0, block.weightKg - 2.5) })}
                          title="-2.5 kg"
                          className="w-8 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Restar 2.5 kg"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          step={0.5}
                          min={0}
                          value={block.weightKg}
                          onChange={e => updateBlock(index, { weightKg: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-full text-center font-semibold text-foreground bg-transparent text-base tabular-nums"
                        />
                        <button
                          onClick={() => updateBlock(index, { weightKg: block.weightKg + 2.5 })}
                          title="+2.5 kg"
                          className="w-8 h-9 rounded-lg bg-card border border-border/60 text-foreground flex items-center justify-center hover:bg-muted/50 transition-all duration-200 active:scale-95"
                          aria-label="Sumar 2.5 kg"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => updateBlock(index, { weightKg: block.weightKg + 5 })}
                          title="+5 kg"
                          className="w-8 h-9 rounded-lg bg-card border border-border/60 text-muted-foreground font-semibold hover:text-foreground hover:bg-muted/50 transition-all duration-200 active:scale-95 text-[10px]"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    {/* Descanso posterior */}
                    <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Descanso
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step={15}
                          min={0}
                          value={block.restSeconds}
                          onChange={e => updateBlock(index, { restSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-semibold text-foreground bg-card border border-border/60 rounded-lg px-2 py-1.5 text-base tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground font-medium">s</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Botón flotante inferior de acción */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-md border-t border-border/60 py-3.5 px-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <span className="text-xs text-muted-foreground font-medium block">
                Sesión: <strong className="text-foreground">{routine.name}</strong>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalSets} series · ~{estimatedMinutes} min
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Botón Compartir / Apple Watch */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                disabled={routine.blocks.length === 0}
                title="Compartir con un amigo o Apple Watch"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold border border-indigo-200/80 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                <Share2 className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Compartir</span>
              </button>

              {/* Botón Exportar FIT */}
              <button
                onClick={handleDownloadFit}
                disabled={isDownloading || routine.blocks.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted/70 hover:bg-muted text-foreground text-sm font-semibold border border-border/60 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">Descargar</span> .FIT
              </button>

              {/* Botón Sincronizar Garmin Connect */}
              <button
                onClick={handleSyncToGarmin}
                disabled={isSyncing || routine.blocks.length === 0}
                className="flex-2 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sincronizando con Fénix 8...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Enviar a mi Garmin Fénix 8</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </main>

      {/* --- MODAL COMPARTIR RUTINA / APPLE WATCH --- */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base sm:text-lg">Compartir Rutina</h3>
                  <p className="text-xs text-muted-foreground">Para entrenar juntos con Apple Watch o móvil</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enlace directo a la sesión
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full text-xs font-mono bg-card border border-border/60 rounded-lg px-3 py-2 text-foreground truncate select-all outline-none"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 shrink-0 active:scale-95 flex items-center gap-1.5"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Botones de acción rápida */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`¡Hola! Te comparto la rutina de hoy (${routine.name}) para entrenar juntos: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 text-center"
                >
                  <span>Enviar por WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 text-center"
                >
                  <span>Probar Modo Live</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Explicación Apple Watch */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2 font-semibold text-blue-950">
                  <Watch className="w-4 h-4 text-blue-600" />
                  <span>¿Cómo lo sigue tu amigo con su Apple Watch?</span>
                </div>
                <p className="text-muted-foreground">
                  1. <strong className="text-foreground">En el móvil (Modo Gym Live)</strong>: Al abrir el enlace, tendrá una pantalla táctil para el gimnasio con series, repeticiones y temporizador sonoro/vibratorio de descanso sincronizado.
                </p>
                <p className="text-muted-foreground">
                  2. <strong className="text-foreground">En su Apple Watch Serie 4</strong>: Puede activar el entreno nativo de <em>&quot;Fuerza Tradicional&quot;</em> para registrar pulsaciones y calorías mientras sigue las series en el móvil, o si tiene <strong className="text-foreground">Hevy</strong> en el Apple Watch, importar la rutina directamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL MIS RUTINAS EN LA NUBE (SUPABASE) --- */}
      {isCloudRoutinesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base">Mis Rutinas en la Nube</h3>
                  <p className="text-xs text-muted-foreground">Guardadas permanentemente en tu base de datos Supabase</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloudRoutinesModalOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 p-2 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {cloudRoutines.length === 0 ? (
                <div className="text-center py-8">
                  <Cloud className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No hay rutinas guardadas en Supabase</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Diseña tu rutina o cárgala de Hevy y pulsa el botón &quot;Guardar en Supabase&quot;.
                  </p>
                </div>
              ) : (
                cloudRoutines.map(r => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 flex items-center justify-between gap-3 transition-all duration-200"
                  >
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{r.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {r.blocks.length} ejercicios &bull; {r.blocks.reduce((acc, b) => acc + b.sets, 0)} series
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRoutine(r);
                          setIsCloudRoutinesModalOpen(false);
                          setStatusMessage({
                            type: 'success',
                            text: `Rutina "${r.name}" cargada en el editor.`
                          });
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                      >
                        Cargar
                      </button>
                      <button
                        onClick={() => handleDeleteCloudRoutine(r.id, r.name)}
                        className="p-2 text-muted-foreground hover:text-rose-600 rounded-lg border border-border/60 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border/60 flex justify-end">
              <button
                onClick={() => setIsCloudRoutinesModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-card border border-border/60 hover:bg-muted/50 text-foreground transition-all duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL HEVY (API + CSV) --- */}
      {isHevyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">Importar Entrenamientos de Hevy</h3>
                  <p className="text-xs text-muted-foreground">Selecciona una o varias rutinas para enviarlas a tu Fénix 8</p>
                </div>
              </div>
              <button
                onClick={() => setIsHevyModalOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Pestañas (API vs CSV) */}
            <div className="flex border-b border-border/60 bg-muted/40 p-2 gap-2">
              <button
                onClick={() => setHevyTab('api')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  hevyTab === 'api'
                    ? 'bg-card text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Key className="w-4 h-4" />
                Vía Hevy API (Automática)
              </button>

              <button
                onClick={() => setHevyTab('csv')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  hevyTab === 'csv'
                    ? 'bg-card text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Vía Archivo CSV (Gratis)
              </button>
            </div>

            {/* Contenido de la pestaña */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {hevyError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hevyError}</span>
                </div>
              )}

              {/* PESTAÑA 1: API */}
              {hevyTab === 'api' && (
                <div className="space-y-4">
                  {isHevyKeySaved && !isEditingHevyKey ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-950">
                            API Key de Hevy guardada permanentemente
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Clave activa ({hevyApiKey ? `••••${hevyApiKey.slice(-4)}` : 'Configurada'}) sincronizada en tu navegador y cuenta
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchHevyRoutines()}
                          disabled={isLoadingHevyApi}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHevyApi ? 'animate-spin' : ''}`} />
                          <span>{isLoadingHevyApi ? 'Actualizando...' : 'Actualizar rutinas'}</span>
                        </button>
                        <button
                          onClick={() => setIsEditingHevyKey(true)}
                          className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/60 text-xs font-semibold transition-all"
                        >
                          Cambiar clave
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 text-xs text-muted-foreground space-y-2">
                        <p className="font-semibold text-foreground">¿Cómo obtener tu clave de Hevy? (Solo se pide una vez)</p>
                        <p>
                          1. Inicia sesión en{' '}
                          <a
                            href="https://hevy.com/settings?developer"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline font-medium inline-flex items-center gap-0.5"
                          >
                            hevy.com/settings?developer <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                        <p>2. Genera o copia tu Developer API Key y pégala a continuación. Se guardará en tu perfil para no volver a pedirla.</p>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Pega aquí tu Hevy API Key..."
                          value={hevyApiKey}
                          onChange={e => setHevyApiKey(e.target.value)}
                          className="flex-1 bg-card border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <button
                          onClick={() => fetchHevyRoutines()}
                          disabled={isLoadingHevyApi}
                          className="px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shrink-0 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
                        >
                          {isLoadingHevyApi ? 'Guardando...' : 'Guardar y Cargar'}
                        </button>
                        {isHevyKeySaved && (
                          <button
                            onClick={() => setIsEditingHevyKey(false)}
                            className="px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold shrink-0"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Listado de Rutinas de la API */}
                  {hevyApiRoutines.length > 0 && (
                    <div className="space-y-2 mt-4 pt-2">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Rutinas en tu cuenta ({hevyApiRoutines.length})
                        </span>
                        <button
                          onClick={toggleSelectAll}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {selectedRoutineIds.length === hevyApiRoutines.length
                            ? 'Deseleccionar todas'
                            : 'Seleccionar todas'}
                        </button>
                      </div>

                      <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden bg-card max-h-72 overflow-y-auto">
                        {hevyApiRoutines.map(r => {
                          const isSelected = selectedRoutineIds.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              className={`p-4 flex items-center justify-between transition-all duration-200 ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleSelectRoutine(r.id)}
                                  className="text-muted-foreground hover:text-blue-600 transition-colors p-1"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/50" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-semibold text-foreground text-sm">{r.title}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    {r.exerciseCount} ejercicios · {r.totalSets} series
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => applyHevyRoutine(r.routine)}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 border border-border/60"
                              >
                                <span>Cargar</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 2: CSV */}
              {hevyTab === 'csv' && (
                <div className="space-y-4">
                  <div className="bg-muted/30 border border-border/60 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-semibold text-foreground">Exportar desde la app móvil de Hevy:</p>
                    <p>1. Abre Hevy en tu teléfono y ve a tu <strong className="text-foreground">Perfil</strong>.</p>
                    <p>2. Toca en el engranaje de <strong className="text-foreground">Ajustes</strong> y entra en <strong className="text-foreground">Export & Import Data</strong>.</p>
                    <p>3. Pulsa <strong className="text-foreground">Export Workouts (CSV)</strong> y sube el archivo descargado aquí.</p>
                  </div>

                  {/* Zona de Drop / Input de archivo */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-muted/20 hover:bg-blue-50/30 transition-all duration-200"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      Haz clic para seleccionar tu archivo CSV de Hevy
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">workouts.csv exportado desde la app</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCsvFileUpload}
                      accept=".csv,text/csv"
                      className="hidden"
                    />
                  </div>

                  {/* Entrenamientos parseados del CSV */}
                  {hevyCsvWorkouts.length > 0 && (
                    <div className="space-y-2 mt-4 pt-2">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Entrenamientos detectados ({hevyCsvWorkouts.length})
                        </span>
                        <button
                          onClick={toggleSelectAll}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {selectedRoutineIds.length === hevyCsvWorkouts.length
                            ? 'Deseleccionar todas'
                            : 'Seleccionar todas'}
                        </button>
                      </div>

                      <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden bg-card max-h-72 overflow-y-auto">
                        {hevyCsvWorkouts.slice(0, 20).map(w => {
                          const isSelected = selectedRoutineIds.includes(w.id);
                          return (
                            <div
                              key={w.id}
                              className={`p-4 flex items-center justify-between transition-all duration-200 ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleSelectRoutine(w.id)}
                                  className="text-muted-foreground hover:text-blue-600 transition-colors p-1"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/50" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-semibold text-foreground text-sm">{w.name}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    Fecha: {w.date} · {w.exerciseCount} ejercicios ({w.totalSets} series)
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => applyHevyRoutine(w.routine)}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 border border-border/60"
                              >
                                <span>Cargar</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Barra Inferior del Modal con Botón de Sincronización Múltiple */}
            {selectedRoutineIds.length > 0 && (
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-t border-slate-800 animate-in slide-in-from-bottom-2 duration-150">
                <div>
                  <span className="text-sm font-semibold block">
                    {selectedRoutineIds.length} {selectedRoutineIds.length === 1 ? 'rutina seleccionada' : 'rutinas seleccionadas'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Se compilarán y subirán a Garmin Connect juntas
                  </span>
                </div>

                <button
                  onClick={handleBatchSyncToGarmin}
                  disabled={isBatchSyncing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 shrink-0"
                >
                  {isBatchSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sincronizando {selectedRoutineIds.length} rutinas...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Sincronizar {selectedRoutineIds.length} a Garmin Fénix 8</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL / SELECTOR DE EJERCICIOS GARMIN */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-card rounded-2xl border border-border/60 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-lg">Catálogo Oficial de Ejercicios Garmin</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mapeados directamente a los identificadores del sensor de fuerza de Garmin
                </p>
              </div>
              <button
                onClick={() => setIsSelectorOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros de Grupo Muscular */}
            <div className="p-4 bg-muted/30 border-b border-border/60 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por ejercicio o músculo (ej. banca, sentadilla, dominadas)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-card border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {muscleGroups.map(group => (
                  <button
                    key={group}
                    onClick={() => setSelectedMuscle(group)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      selectedMuscle === group
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-card text-muted-foreground border border-border/60 hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista Scrollable de Ejercicios */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/60">
              {filteredCatalog.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No se encontraron ejercicios que coincidan con la búsqueda.
                </div>
              ) : (
                filteredCatalog.map(exercise => (
                  <div
                    key={exercise.id}
                    onClick={() => addExercise(exercise)}
                    className="py-3.5 px-4 rounded-xl hover:bg-muted/50 cursor-pointer flex items-center justify-between gap-4 transition-all duration-200 group"
                  >
                    <div>
                      <div className="font-semibold text-foreground text-sm group-hover:text-blue-600 transition-colors">
                        {exercise.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {exercise.muscleGroup}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {exercise.garminName}
                        </span>
                      </div>
                    </div>
                    <button className="px-3.5 py-1.5 rounded-lg bg-card border border-border/60 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 text-foreground text-xs font-semibold transition-all duration-200 shrink-0 inline-flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE AUTENTICACIÓN / PERFIL --- */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthChange={loadUserProfile}
      />

      {/* --- MODAL DE CONEXIÓN GARMIN CONNECT --- */}
      <GarminAuthModal
        isOpen={isGarminAuthModalOpen}
        onClose={() => setIsGarminAuthModalOpen(false)}
        accountStatus={accountStatus}
        onAuthSuccess={data => {
          setAccountStatus({
            authenticated: true,
            displayName: data.displayName,
            username: data.username
          });
          if (data.tokens) {
            persistGarminTokens(data.tokens);
          }
          setStatusMessage({
            type: 'success',
            text: `¡Cuenta Garmin Connect (${data.displayName || 'Fénix 8'}) vinculada y guardada permanentemente!`
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }}
        onDisconnect={() => {
          setAccountStatus({ authenticated: false });
          setGarminTokens(null);
          try {
            localStorage.removeItem('garmin_oauth_tokens');
          } catch {
            // ignore
          }
        }}
      />

      {/* --- MODAL GENERADOR CIENTÍFICO DE RUTINAS --- */}
      <WorkoutGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        onRoutineGenerated={newRoutine => {
          setRoutine(newRoutine);
          setStatusMessage({
            type: 'success',
            text: `¡Rutina "${newRoutine.name}" generada según evidencia científica cargada en el editor!`
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }}
      />

      {/* --- MODAL SUSTITUCIÓN DE EJERCICIO (MÁQUINA OCUPADA) --- */}
      {isSwapModalOpen && swappingBlockIndex !== null && routine.blocks[swappingBlockIndex] && (
        <ExerciseSwapModal
          isOpen={isSwapModalOpen}
          currentExercise={routine.blocks[swappingBlockIndex].exercise}
          currentWeightKg={routine.blocks[swappingBlockIndex].weightKg}
          onClose={() => {
            setIsSwapModalOpen(false);
            setSwappingBlockIndex(null);
          }}
          onSelectAlternative={handleSwapExercise}
        />
      )}
    </div>
  );
}
