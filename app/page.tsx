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
  Activity,
  Award,
  Box,
  Calendar,
  Link2,
  Trophy,
  Play,
  Menu,
  StickyNote,
  AlertTriangle,
  BookOpen,
  LayoutDashboard,
  Inbox,
  Users
} from 'lucide-react';
import { InteractiveGuideModal, GuideTargetAction } from '@/components/InteractiveGuideModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  deleteLocalTemplate,
  downloadLocalBackupJson,
  loadLocalTemplates,
  saveLocalTemplate,
  saveLocalTemplatesBatch,
} from '@/lib/backup-utils';
import { EXERCISE_CATALOG, CatalogExercise } from '@/lib/exercise-catalog';
import { EnrichedExpertExercise } from '@/lib/expert-gym-guide';
import { downloadAppleWatchCalendarIcs, formatAppleWatchNotesText } from '@/lib/apple-watch-export';
import { calculateBarbellPlates } from '@/lib/plate-calculator';
import { ExerciseNoteRecord, loadExerciseNotes, saveExerciseNote } from '@/lib/exercise-notes';
import { getTodayWeekKey, loadWeeklyPlan } from '@/lib/weekly-planner';
import { WeeklyPlanModal } from '@/components/WeeklyPlanModal';
import {
  computeProgressiveOverload,
  EffortRating,
  ExerciseProgressRecord,
  loadProgressionHistory,
  recordSingleExerciseCompletion,
  recordWorkoutCompletion
} from '@/lib/progressive-overload-engine';
import { StrengthRoutine, WorkoutExerciseBlock, GarminAccountStatus } from '@/lib/types';
import { parseHevyCSV, ParsedHevyWorkout } from '@/lib/hevy-csv-parser';
import { decodeCompactRoutine, encodeRoutineToShareUrl } from '@/lib/share-utils';
import {
  applyWeightModeToRoutine,
  createShortShareLink,
  getUnreadReceivedCount,
  sendRoutineToFriend,
  WeightAdaptMode,
} from '@/lib/routine-sharing-service';
import ProgressDashboard from '@/components/ProgressDashboard';
import { SummaryTab } from '@/components/SummaryTab';
import SocialDashboard from '@/components/SocialDashboard';
import { GymExerciseGuide } from '@/components/GymExerciseGuide';
import { Exercise3DModal } from '@/components/Exercise3DModal';
import { LiveTrackerTab } from '@/components/LiveTrackerTab';
import AuthModal from '@/components/AuthModal';
import GarminAuthModal from '@/components/GarminAuthModal';
import ExerciseSwapModal from '@/components/ExerciseSwapModal';
import WorkoutGeneratorModal from '@/components/WorkoutGeneratorModal';
import { Friendship, UserProfile, getCurrentUserProfile, getFriendships } from '@/lib/social-service';
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
  const [currentMainTab, setCurrentMainTab] = useState<'summary' | 'studio' | 'live' | 'progress' | 'social'>('studio');
  const [studioSubTab, setStudioSubTab] = useState<'editor' | 'guide'>('editor');
  const [routine, setRoutine] = useState<StrengthRoutine>(DEFAULT_ROUTINE);
  const [accountStatus, setAccountStatus] = useState<GarminAccountStatus | null>(null);
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
  const [active3DExercise, setActive3DExercise] = useState<CatalogExercise | null>(null);
  const [exerciseEffortMap, setExerciseEffortMap] = useState<Record<string, EffortRating>>({});
  const [exerciseRecordMap, setExerciseRecordMap] = useState<Record<string, ExerciseProgressRecord>>({});
  const [isWeeklyPlanOpen, setIsWeeklyPlanOpen] = useState(false);
  const [todayPlannedRoutine, setTodayPlannedRoutine] = useState<StrengthRoutine | null>(null);
  const [exerciseNotesMap, setExerciseNotesMap] = useState<Record<string, ExerciseNoteRecord>>({});
  const [openNoteBlockId, setOpenNoteBlockId] = useState<string | null>(null);

  useEffect(() => {
    const history = loadProgressionHistory();
    setExerciseRecordMap(history);
    const initialMap: Record<string, EffortRating> = {};
    Object.values(history).forEach((rec) => {
      initialMap[rec.exerciseId] = rec.effort;
    });
    setExerciseEffortMap(initialMap);

    setExerciseNotesMap(loadExerciseNotes());
    const plan = loadWeeklyPlan();
    const todayPlan = plan[getTodayWeekKey()];
    if (todayPlan) setTodayPlannedRoutine(todayPlan);
  }, []);

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

  // Selección múltiple para sincronización / guardado por lotes
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isBatchSavingToApp, setIsBatchSavingToApp] = useState(false);
  const [savedHevyIds, setSavedHevyIds] = useState<string[]>([]);

  // Modal para compartir con Amigos / Apple Watch
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'link' | 'friend'>('link');
  const [shortShareResult, setShortShareResult] = useState<{
    url: string;
    shareCode: string | null;
    note?: string;
  } | null>(null);
  const [isGeneratingShortLink, setIsGeneratingShortLink] = useState(false);
  const [shareFriends, setShareFriends] = useState<Friendship[]>([]);
  const [selectedFriendRecipientId, setSelectedFriendRecipientId] = useState('');
  const [shareFriendMessage, setShareFriendMessage] = useState('');
  const [isSendingToFriend, setIsSendingToFriend] = useState(false);
  const [shareFriendFeedback, setShareFriendFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [unreadSharesCount, setUnreadSharesCount] = useState(0);
  const [incomingSharedRoutine, setIncomingSharedRoutine] = useState<StrengthRoutine | null>(null);
  const [incomingWeightMode, setIncomingWeightMode] = useState<WeightAdaptMode>('keep');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAppleNotes, setCopiedAppleNotes] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileLoadToolsOpen, setIsMobileLoadToolsOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<StrengthRoutine[]>([]);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Supabase Cloud Routines
  const [cloudRoutines, setCloudRoutines] = useState<StrengthRoutine[]>([]);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isCloudRoutinesModalOpen, setIsCloudRoutinesModalOpen] = useState(false);
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar estado de Garmin y rutina guardada al inicio
  useEffect(() => {
    setLocalTemplates(loadLocalTemplates());
    let hasLegacyGarminMigration = false;
    try {
      hasLegacyGarminMigration = Boolean(localStorage.getItem('garmin_oauth_tokens'));
    } catch {
      // ignore
    }
    if (!hasLegacyGarminMigration) {
      checkGarminStatus();
    }
    const available = isSupabaseConfigured();
    setIsSupabaseAvailable(available);

    let authSubscription: any = null;
    if (available && supabase) {
      loadCloudRoutines();
      loadUserProfile();

      // Mostrar feedback claro si el usuario vuelve desde un enlace de confirmación de Supabase
      if (typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        const combinedAuthParams = `${hash}&${search}`;
        if (
          combinedAuthParams.includes('error_code=otp_expired') ||
          combinedAuthParams.includes('error=access_denied') ||
          combinedAuthParams.includes('error_description=')
        ) {
          setStatusMessage({
            type: 'error',
            text: 'El enlace de confirmación ha caducado o ya fue utilizado. Abre "Cuenta" para iniciar sesión o reenviar el correo de verificación.',
          });
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else if (hash.includes('type=signup') && hash.includes('access_token=')) {
          setStatusMessage({
            type: 'success',
            text: '¡Correo confirmado y sesión iniciada correctamente!',
          });
        }
      }

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

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        const importedFlag = params.get('imported');
        const compactImport = params.get('import');

        if (compactImport) {
          const decoded = decodeCompactRoutine(compactImport);
          if (decoded) {
            setIncomingWeightMode('keep');
            setIncomingSharedRoutine(decoded);
          }
          window.history.replaceState(null, '', window.location.pathname);
        } else if (tabParam === 'live') {
          setCurrentMainTab('live');
          if (importedFlag === '1') {
            setStatusMessage({
              type: 'success',
              text: '¡Rutina compartida guardada y lista para entrenar En Vivo!',
            });
          }
          window.history.replaceState(null, '', window.location.pathname);
        } else if (importedFlag === '1') {
          setStatusMessage({
            type: 'success',
            text: '¡Rutina compartida guardada en tu app y cargada en el Diseñador!',
          });
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      // Migración única de seguridad: mover secretos legados a cookies HttpOnly y limpiar localStorage
      if (localStorage.getItem('hevy_api_configured') === 'true') {
        setIsHevyKeySaved(true);
      }
      const legacyHevyKey = localStorage.getItem('hevy_api_key');
      if (legacyHevyKey && legacyHevyKey.trim()) {
        localStorage.removeItem('hevy_api_key');
        fetch('/api/hevy/routines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: legacyHevyKey.trim() }),
        })
          .then((r) => {
            if (r.ok) {
              localStorage.setItem('hevy_api_configured', 'true');
              setIsHevyKeySaved(true);
            }
          })
          .catch(() => {});
      }

      const legacyGarminTokens = localStorage.getItem('garmin_oauth_tokens');
      if (legacyGarminTokens) {
        const parsedTokens = JSON.parse(legacyGarminTokens);
        localStorage.removeItem('garmin_oauth_tokens');
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

  const loadUserProfile = async () => {
    try {
      const profile = await getCurrentUserProfile();
      setCurrentUser(profile);

      // Migración y limpieza automática de secretos legados en Supabase user_metadata
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        const cloudHevyKey = user?.user_metadata?.hevy_api_key;
        const cloudGarminTokens = user?.user_metadata?.garmin_tokens;

        if (cloudHevyKey && typeof cloudHevyKey === 'string' && cloudHevyKey.trim()) {
          await fetch('/api/hevy/routines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: cloudHevyKey.trim() }),
          }).catch(() => {});
          try {
            localStorage.setItem('hevy_api_configured', 'true');
          } catch {}
          setIsHevyKeySaved(true);
        }

        if (cloudGarminTokens && cloudGarminTokens.oauth1 && cloudGarminTokens.oauth2) {
          await checkGarminStatus(cloudGarminTokens);
        }

        if (cloudHevyKey || cloudGarminTokens) {
          supabase.auth
            .updateUser({ data: { hevy_api_key: null, garmin_tokens: null } })
            .catch(() => {});
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

  const checkGarminStatus = async (legacyMigrationTokens?: any) => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/garmin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          legacyMigrationTokens ? { garminTokens: legacyMigrationTokens } : {}
        )
      });
      const data = await res.json();
      setAccountStatus(data);
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

  const handleAddExpertExercise = (item: EnrichedExpertExercise) => {
    const newBlock: WorkoutExerciseBlock = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exercise: item.catalogExercise,
      sets: item.recommendedSets,
      reps: item.defaultRepsNumber,
      weightKg: 20,
      restSeconds: item.recommendedRestSeconds
    };
    setRoutine(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    setStatusMessage({
      type: 'success',
      text: `"${item.catalogExercise.name}" añadido a tu sesión (${item.recommendedSets}×${item.defaultRepsNumber} reps · ${item.recommendedRestSeconds}s descanso).`
    });
  };

  const handleApplyProgressiveOverload = (fallbackEffort: EffortRating = 'optimal') => {
    if (routine.blocks.length === 0) return;
    const { updatedRoutine, changes } = computeProgressiveOverload(routine, fallbackEffort);
    setRoutine(updatedRoutine);

    const preview = changes
      .slice(0, 2)
      .map(c => `${c.exerciseName}: ${c.summary}`)
      .join(' | ');
    const extraCount = changes.length > 2 ? ` (+${changes.length - 2} más)` : '';

    setStatusMessage({
      type: 'success',
      text:
        changes.length > 0
          ? `Sobrecarga progresiva aplicada (${changes.length} ejercicios): ${preview}${extraCount}`
          : 'Rutina revisada: las cargas actuales se mantienen para consolidar técnica.'
    });
  };

  const handleLogCompletedInStudio = (effort: EffortRating) => {
    if (routine.blocks.length === 0) return;
    const updatedHistory = recordWorkoutCompletion(routine, effort);
    setExerciseRecordMap(updatedHistory);
    setStatusMessage({
      type: 'success',
      text: `Entreno registrado como "${effort === 'easy' ? 'Fácil' : effort === 'optimal' ? 'Óptimo' : 'Al límite'}". Pulsa "Progresión Auto" cuando quieras subir el nivel de la próxima sesión.`
    });
  };

  const toggleSupersetWithNext = (index: number) => {
    setRoutine(prev => {
      if (index < 0 || index >= prev.blocks.length - 1) return prev;
      const blocks = [...prev.blocks];
      const current = blocks[index];
      const next = blocks[index + 1];

      if (current.supersetGroupId && current.supersetGroupId === next.supersetGroupId) {
        blocks[index] = { ...current, supersetGroupId: undefined };
        blocks[index + 1] = { ...next, supersetGroupId: undefined };
      } else {
        const groupId = current.supersetGroupId || `ss-${Date.now()}`;
        blocks[index] = { ...current, supersetGroupId: groupId };
        blocks[index + 1] = { ...next, supersetGroupId: groupId };
      }
      return { ...prev, blocks };
    });
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

    if (!accountStatus?.authenticated) {
      setIsGarminAuthModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine })
      });

      const data = await res.json();

      if (!res.ok) {
        if (String(data.error || '').toLowerCase().includes('sesión activa de garmin')) {
          setIsGarminAuthModalOpen(true);
        }
        throw new Error(data.error || 'Error al sincronizar con Garmin');
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
      const res = await fetch('/api/hevy/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToUse || undefined })
      });
      const data = await res.json();

      if (!res.ok) {
        if (!keyToUse) {
          setIsEditingHevyKey(true);
        }
        throw new Error(data.error || 'Error al consultar rutinas en Hevy');
      }

      if (keyToUse) {
        try {
          localStorage.setItem('hevy_api_configured', 'true');
          localStorage.removeItem('hevy_api_key');
        } catch {
          // ignore
        }
        setHevyApiKey('');
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

  // Auto-cargar rutinas de Hevy al abrir el modal si ya hay clave o cookie guardada
  useEffect(() => {
    if (
      isHevyModalOpen &&
      hevyTab === 'api' &&
      (hevyApiKey.trim() || isHevyKeySaved) &&
      !isEditingHevyKey &&
      hevyApiRoutines.length === 0 &&
      !isLoadingHevyApi
    ) {
      fetchHevyRoutines(hevyApiKey.trim() || undefined);
    }
    if (isHevyModalOpen) {
      setSavedHevyIds([]);
    }
  }, [isHevyModalOpen, hevyTab, isHevyKeySaved, isEditingHevyKey]);

  // Lista unificada de rutinas guardadas (Nube + Plantillas locales, sin duplicar por nombre)
  const allSavedRoutines = React.useMemo(() => {
    const map = new Map<string, StrengthRoutine>();
    for (const r of cloudRoutines) {
      if (r?.blocks?.length) {
        map.set(r.name.trim().toLowerCase(), r);
      }
    }
    for (const t of localTemplates) {
      if (t?.blocks?.length) {
        const key = t.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, t);
      }
    }
    return Array.from(map.values());
  }, [cloudRoutines, localTemplates]);

  const saveHevyRoutinesToApp = async (routinesToSave: StrengthRoutine[]) => {
    const valid = routinesToSave.filter((r) => r && r.blocks.length > 0);
    if (valid.length === 0) return { localCount: 0, cloudCount: 0 };

    const updatedTemplates = saveLocalTemplatesBatch(valid);
    setLocalTemplates(updatedTemplates);

    let cloudCount = 0;
    if (isSupabaseAvailable && currentUser) {
      for (const r of valid) {
        const ok = await saveRoutineToSupabase(r);
        if (ok) cloudCount++;
      }
      await loadCloudRoutines();
    }
    return { localCount: valid.length, cloudCount };
  };

  const handleSaveSingleHevyRoutine = async (itemId: string, importedRoutine: StrengthRoutine) => {
    const res = await saveHevyRoutinesToApp([importedRoutine]);
    setSavedHevyIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
    setStatusMessage({
      type: 'success',
      text:
        res.cloudCount > 0
          ? `Rutina "${importedRoutine.name}" guardada en la App y en tu nube. Ya puedes usarla en Entreno en Vivo.`
          : `Rutina "${importedRoutine.name}" guardada en la App (Plantillas). Ya puedes usarla en Entreno en Vivo.`,
    });
  };

  const handleStartHevyRoutineLive = async (importedRoutine: StrengthRoutine) => {
    await saveHevyRoutinesToApp([importedRoutine]);
    setRoutine(importedRoutine);
    setIsHevyModalOpen(false);
    setCurrentMainTab('live');
    setStatusMessage({
      type: 'success',
      text: `Rutina "${importedRoutine.name}" guardada y cargada en Entreno en Vivo.`,
    });
  };

  const handleBatchSaveHevyToApp = async () => {
    if (selectedRoutineIds.length === 0) return;
    setIsBatchSavingToApp(true);
    setHevyError(null);
    try {
      const routinesToSave: StrengthRoutine[] = [];
      currentList.forEach((item) => {
        if (selectedRoutineIds.includes(item.id) && item.routine) {
          routinesToSave.push(item.routine);
        }
      });
      if (routinesToSave.length === 0) return;

      const res = await saveHevyRoutinesToApp(routinesToSave);
      if (routine.blocks.length === 0) {
        setRoutine(routinesToSave[0]);
      }
      setIsHevyModalOpen(false);
      setSelectedRoutineIds([]);
      setStatusMessage({
        type: 'success',
        text:
          res.cloudCount > 0
            ? `¡${res.localCount} rutinas de Hevy guardadas en la App y en tu nube! Disponibles en Plantillas y Entreno en Vivo.`
            : `¡${res.localCount} rutinas de Hevy guardadas en la App! Ya están disponibles en Plantillas y Entreno en Vivo.`,
      });
    } catch (err: any) {
      setHevyError(err?.message || 'No se pudieron guardar las rutinas seleccionadas.');
    } finally {
      setIsBatchSavingToApp(false);
    }
  };

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
        body: JSON.stringify({ routines: routinesToSync })
      });

      const data = await res.json();

      if (!res.ok) {
        if (String(data.error || '').toLowerCase().includes('sesión activa de garmin')) {
          setIsGarminAuthModalOpen(true);
        }
        throw new Error(data.error || 'Error durante la sincronización múltiple');
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
  const displayedShareUrl = shortShareResult?.url || shareUrl;

  useEffect(() => {
    if (!currentUser) {
      setUnreadSharesCount(0);
      return;
    }
    getUnreadReceivedCount().then(setUnreadSharesCount).catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (!isShareModalOpen) return;
    setShareFriendFeedback(null);
    setCopiedLink(false);

    if (routine && routine.blocks.length > 0) {
      setIsGeneratingShortLink(true);
      createShortShareLink(routine, currentUser?.display_name)
        .then((res) => setShortShareResult({ url: res.url, shareCode: res.shareCode, note: res.note }))
        .finally(() => setIsGeneratingShortLink(false));
    } else {
      setShortShareResult(null);
    }

    if (currentUser) {
      getFriendships().then((list) => {
        const accepted = list.filter((f) => f.status === 'accepted');
        setShareFriends(accepted);
        if (accepted.length > 0 && !selectedFriendRecipientId) {
          setSelectedFriendRecipientId(accepted[0].friend.id);
        }
      });
    } else {
      setShareFriends([]);
    }
  }, [isShareModalOpen]);

  const handleCopyShareLink = () => {
    if (!displayedShareUrl) return;
    navigator.clipboard.writeText(displayedShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendToFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendRecipientId || routine.blocks.length === 0) return;
    setIsSendingToFriend(true);
    setShareFriendFeedback(null);
    try {
      const res = await sendRoutineToFriend({
        recipientId: selectedFriendRecipientId,
        routine,
        message: shareFriendMessage,
      });
      setShareFriendFeedback({ ok: res.success, text: res.message });
      if (res.success) {
        setShareFriendMessage('');
      }
    } finally {
      setIsSendingToFriend(false);
    }
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
    <div className="min-h-screen pb-12 ambient-canvas text-foreground overflow-x-hidden">
      {/* Barra de Navegación Superior Ejecutiva (Linear / Vercel Style) */}
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border/80 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs shrink-0 transition-transform duration-150 hover:scale-[1.03] overflow-hidden ring-1 ring-slate-800/80">
              <img src="/icon.svg" alt="IronSync" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground tracking-tight text-base sm:text-[17px] truncate">
                  IronSync
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border/80 shrink-0">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden xs:block sm:block">
                Strength Architecture &amp; Garmin Sync
              </p>
            </div>
          </div>

          {/* Barra de Herramientas Ejecutiva (>= 1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {isSupabaseAvailable && (
              <button
                onClick={() => setIsCloudRoutinesModalOpen(true)}
                className="saas-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 text-xs font-medium shadow-2xs"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rutinas</span>
                <span className="px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold tabular-nums">
                  {cloudRoutines.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsGuideModalOpen(true)}
              className="saas-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 text-xs font-medium shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Guía</span>
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="saas-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 text-xs font-medium shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Compartir</span>
            </button>

            <button
              onClick={() => setIsHevyModalOpen(true)}
              className="saas-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 text-xs font-medium shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>Hevy</span>
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Botón de Perfil de Atleta */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={`saas-btn inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg text-xs font-medium border shadow-2xs ${
                currentUser
                  ? 'bg-card hover:bg-accent text-foreground border-border/90'
                  : 'bg-muted/60 hover:bg-accent text-foreground border-border/80'
              }`}
            >
              {currentUser ? (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate max-w-[110px]">
                {currentUser ? currentUser.display_name : 'Cuenta'}
              </span>
            </button>

            {/* Estado / Botón de Cuenta Garmin Connect */}
            {accountStatus?.authenticated ? (
              <button
                onClick={() => setIsGarminAuthModalOpen(true)}
                className="saas-btn flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-semibold"
                title="Cuenta Garmin Connect vinculada (clic para gestionar)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[115px]">{accountStatus.displayName || 'Garmin'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsGarminAuthModalOpen(true)}
                className="saas-btn btn-glow-blue flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs font-semibold"
                title="Conectar cuenta de Garmin Connect"
              >
                <Watch className="w-3.5 h-3.5" />
                <span>Conectar Garmin</span>
              </button>
            )}

            <ThemeToggle />

            <button
              onClick={() => checkGarminStatus()}
              disabled={isCheckingStatus}
              title="Comprobar estado de conexión"
              className="saas-btn min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent border border-border/80"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Barra Móvil y Tablet (< 1024px): Tema + Guía + Estado Garmin + Menú Cajón */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              aria-label="Abrir guía interactiva"
              className="min-h-[42px] px-2.5 py-1.5 rounded-lg bg-card hover:bg-accent border border-border/80 text-foreground text-xs font-medium inline-flex items-center gap-1 shadow-2xs transition-all active:scale-[0.98]"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden xs:inline">Guía</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGarminAuthModalOpen(true)}
              className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-all active:scale-[0.98] ${
                accountStatus?.authenticated
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                  : 'bg-primary border-primary text-primary-foreground shadow-xs'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  accountStatus?.authenticated ? 'bg-emerald-500 animate-pulse' : 'bg-white'
                }`}
              />
              <span>{accountStatus?.authenticated ? 'Garmin' : 'Conectar'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg bg-card hover:bg-accent border border-border/80 text-foreground shadow-2xs transition-all active:scale-[0.98]"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Cajón Lateral Móvil y Tablet (Drawer Off-Canvas < 1024px) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-80 max-w-[85vw] bg-card h-full shadow-2xl border-l border-border/60 p-6 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Menú Principal</div>
                    <div className="text-[11px] text-muted-foreground">Conexiones y Utilidades</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 flex items-center justify-between text-sm font-semibold text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>{currentUser ? currentUser.display_name : 'Iniciar Sesión'}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>

                {isSupabaseAvailable && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsCloudRoutinesModalOpen(true);
                    }}
                    className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-between text-sm font-semibold text-emerald-900 dark:text-emerald-200"
                  >
                    <span className="flex items-center gap-3">
                      <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Mis Rutinas (Nube)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 text-xs font-bold tabular-nums">
                      {cloudRoutines.length}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsHevyModalOpen(true);
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 flex items-center justify-between text-sm font-semibold text-orange-900 dark:text-orange-200"
                >
                  <span className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span>Importar desde Hevy</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsShareModalOpen(true);
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 flex items-center justify-between text-sm font-semibold text-indigo-900 dark:text-indigo-200"
                >
                  <span className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Compartir / Apple Watch</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsGuideModalOpen(true);
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 flex items-center justify-between text-sm font-semibold text-blue-900 dark:text-blue-200"
                >
                  <span className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Guía Interactiva</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    downloadLocalBackupJson();
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-card hover:bg-muted/50 border border-border/60 flex items-center justify-between text-sm font-semibold text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exportar Backup (.json)</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    checkGarminStatus();
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-card hover:bg-muted/50 border border-border/60 flex items-center justify-between text-sm font-semibold text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <RefreshCw className={`w-4 h-4 text-blue-600 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    <span>Comprobar Garmin Connect</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.dispatchEvent(new CustomEvent('ironsync:open-install-guide'));
                  }}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-card hover:bg-muted/50 border border-border/60 flex items-center justify-between text-sm font-semibold text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Instalar App (iPhone / Android)</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 text-xs text-muted-foreground text-center">
              Garmin Connect &bull; Fénix 8 &bull; Apple Watch
            </div>
          </div>
        </div>
      )}

      {/* Sub-barra de Navegación Segmentada (Segmented Control) */}
      <div className="bg-background/85 backdrop-blur-md border-b border-border/80 sticky top-15 sm:top-16 z-20">
        <div className="max-w-5xl mx-auto px-2 sm:px-6 py-2 flex items-center justify-between gap-3">
          <nav className="grid grid-cols-5 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-muted/80 border border-border/70 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCurrentMainTab('summary')}
              className={`saas-btn min-h-[42px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-1 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                currentMainTab === 'summary'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${currentMainTab === 'summary' ? 'text-blue-600' : ''}`} />
              <span>Resumen</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('studio')}
              className={`saas-btn min-h-[42px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-1 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                currentMainTab === 'studio'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <Dumbbell className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${currentMainTab === 'studio' ? 'text-blue-600' : ''}`} />
              <span>Rutinas</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('live')}
              className={`saas-btn min-h-[42px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-1 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                currentMainTab === 'live'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <Play className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${currentMainTab === 'live' ? 'text-emerald-600' : ''}`} />
              <span className="sm:hidden">En Vivo</span>
              <span className="hidden sm:inline">Entreno en Vivo</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('progress')}
              className={`saas-btn min-h-[42px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-1 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                currentMainTab === 'progress'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <TrendingUp className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${currentMainTab === 'progress' ? 'text-blue-600' : ''}`} />
              <span className="sm:hidden">Ejercicios</span>
              <span className="hidden sm:inline">Ejercicios &amp; Datos</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('social')}
              className={`saas-btn min-h-[42px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-1 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap relative ${
                currentMainTab === 'social'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <Swords className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${currentMainTab === 'social' ? 'text-indigo-600' : ''}`} />
              <span className="sm:hidden">Retos</span>
              <span className="hidden sm:inline">Amigos &amp; Retos</span>
              {unreadSharesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-bold tabular-nums">
                  {unreadSharesCount}
                </span>
              )}
            </button>
          </nav>

          <div className="text-xs text-muted-foreground hidden xl:flex items-center gap-2 shrink-0 tabular-nums">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border/80 shadow-2xs font-medium">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>{routine.blocks.length} ej. &middot; {totalSets} series &middot; ~{estimatedMinutes}m</span>
            </span>
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
                ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                : 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
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

        {currentMainTab === 'summary' ? (
          <SummaryTab onNavigateToLive={() => setCurrentMainTab('live')} />
        ) : currentMainTab === 'live' ? (
          <LiveTrackerTab
            routine={routine}
            savedRoutines={allSavedRoutines}
            onSelectSavedRoutine={(selected) => {
              setRoutine(selected);
              setStatusMessage({
                type: 'success',
                text: `Rutina "${selected.name}" lista para entrenar en vivo.`,
              });
            }}
            onOpenHevyImport={() => setIsHevyModalOpen(true)}
            onOpenCatalog={() => {
              setCurrentMainTab('studio');
              setIsSelectorOpen(true);
            }}
            onWorkoutSaved={(updatedHistory, summaryText) => {
              setExerciseRecordMap(updatedHistory);
              setStatusMessage({ type: 'success', text: summaryText });
            }}
            onApplyNextProgression={() => handleApplyProgressiveOverload('optimal')}
            onUpdateRestSeconds={(blockId, restSeconds) => {
              setRoutine((prev) => ({
                ...prev,
                blocks: prev.blocks.map((b) =>
                  blockId === 'ALL' || b.id === blockId ? { ...b, restSeconds } : b
                ),
              }));
            }}
            onSwapLiveExercise={(blockId, alternativeExercise, newWeightKg) => {
              setRoutine((prev) => ({
                ...prev,
                blocks: prev.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        exercise: alternativeExercise,
                        weightKg: newWeightKg,
                        suggestedWeightKg: newWeightKg,
                      }
                    : b
                ),
              }));
            }}
          />
        ) : currentMainTab === 'progress' ? (
          <ProgressDashboard />
        ) : currentMainTab === 'social' ? (
          <SocialDashboard
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onUnreadSharesChange={setUnreadSharesCount}
            onImportReceivedRoutine={async (importedRoutine, goLive) => {
              await saveHevyRoutinesToApp([importedRoutine]);
              setRoutine(importedRoutine);
              setCurrentMainTab(goLive ? 'live' : 'studio');
              setStatusMessage({
                type: 'success',
                text: goLive
                  ? `Rutina "${importedRoutine.name}" guardada y lista en Entreno en Vivo.`
                  : `Rutina "${importedRoutine.name}" guardada en la App y abierta en el Diseñador.`,
              });
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Sub-navegación de Rutinas: Diseñador vs Top Gimnasio */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Herramientas de rutina"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/80 border border-border/70 w-full sm:w-auto"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={studioSubTab === 'editor'}
                  onClick={() => setStudioSubTab('editor')}
                  className={`saas-btn min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    studioSubTab === 'editor'
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground border border-transparent'
                  }`}
                >
                  <Dumbbell className={`w-3.5 h-3.5 ${studioSubTab === 'editor' ? 'text-blue-600' : ''}`} />
                  <span>Mi Rutina</span>
                  {routine.blocks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                      {routine.blocks.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={studioSubTab === 'guide'}
                  onClick={() => setStudioSubTab('guide')}
                  className={`saas-btn min-h-[40px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    studioSubTab === 'guide'
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground border border-transparent'
                  }`}
                >
                  <Award className={`w-3.5 h-3.5 ${studioSubTab === 'guide' ? 'text-amber-600' : ''}`} />
                  <span>Top Gimnasio</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    S-Tier
                  </span>
                </button>
              </div>
              {studioSubTab === 'guide' && (
                <button
                  type="button"
                  onClick={() => setStudioSubTab('editor')}
                  className="saas-btn min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Volver a Mi Rutina ({routine.blocks.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {studioSubTab === 'guide' ? (
              <GymExerciseGuide
                onAddToRoutine={handleAddExpertExercise}
                currentRoutineExerciseIds={routine.blocks.map(b => b.exercise.id)}
              />
            ) : (
              <>

        {/* Panel Superior Ejecutivo: Título de Rutina, Métricas y Acciones Rápidas */}
        <section className="bg-card rounded-xl border border-border/80 p-5 sm:p-7 saas-card">
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div className="w-full lg:max-w-sm lg:flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Nombre en el Reloj
                    </label>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {routine.name.length}/16 car.
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={16}
                    value={routine.name}
                    onChange={e => setRoutine({ ...routine, name: e.target.value })}
                    className="w-full text-lg sm:text-xl font-semibold text-foreground bg-muted/45 hover:bg-muted/70 focus:bg-card border border-border/80 rounded-lg px-3.5 py-2.5 transition-all duration-150 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Ej: Push Dia 1 F8"
                  />
                </div>

                {/* Acciones principales de ejecución y envío (antes en barra flotante) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    disabled={routine.blocks.length === 0}
                    title="Compartir con un amigo o Apple Watch"
                    className="saas-btn min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-500/30 shadow-2xs disabled:opacity-50"
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Compartir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentMainTab('live')}
                    disabled={routine.blocks.length === 0}
                    className="saas-btn min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>En Vivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncToGarmin}
                    disabled={isSyncing || routine.blocks.length === 0}
                    className="saas-btn btn-glow-blue min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-3.5 h-3.5 shrink-0" />
                        <span>Enviar a Garmin</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadFit}
                    disabled={isDownloading || routine.blocks.length === 0}
                    title="Descargar archivo .FIT para Garmin"
                    className="saas-btn min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-accent text-foreground text-xs font-semibold border border-border/80 disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 text-muted-foreground ${isDownloading ? 'animate-bounce' : ''}`} />
                    <span>.FIT</span>
                  </button>
                </div>
              </div>

              {/* Acciones de Sesión con Jerarquía Ejecutiva */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsGeneratorModalOpen(true)}
                  className="saas-btn min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Generador IA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWeeklyPlanOpen(true)}
                  className="saas-btn min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Plan Semanal</span>
                </button>

                {todayPlannedRoutine && (
                  <button
                    type="button"
                    onClick={() => {
                      setRoutine(todayPlannedRoutine);
                      setStatusMessage({
                        type: 'success',
                        text: `Sesión de hoy cargada: "${todayPlannedRoutine.name}".`,
                      });
                    }}
                    className="saas-btn min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/15 text-blue-700 border border-blue-500/25"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hoy: {todayPlannedRoutine.name}</span>
                  </button>
                )}

                <button
                  onClick={() => setIsHevyModalOpen(true)}
                  className="saas-btn min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cargar Hevy</span>
                </button>
                <button
                  onClick={handleSaveToCloud}
                  disabled={isCloudSaving || routine.blocks.length === 0}
                  className="saas-btn min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 shadow-2xs disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isCloudSaving ? 'Guardando...' : 'Guardar Nube'}</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTemplatesOpen((v) => !v)}
                    className="saas-btn min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-card hover:bg-accent text-foreground border border-border/80 shadow-2xs"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Plantillas ({localTemplates.length})</span>
                  </button>
                  {isTemplatesOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-xl bg-card border border-border/80 shadow-xl p-3 z-30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Plantillas Locales</span>
                        <button
                          type="button"
                          disabled={routine.blocks.length === 0}
                          onClick={() => {
                            const updated = saveLocalTemplate(routine);
                            setLocalTemplates(updated);
                            setStatusMessage({
                              type: 'success',
                              text: `Plantilla "${routine.name}" guardada en el dispositivo.`,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-semibold"
                        >
                          + Guardar actual
                        </button>
                      </div>
                      {localTemplates.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2">
                          Guarda aquí tus rutinas favoritas para cargarlas con 1 clic sin conexión.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {localTemplates.map((tpl) => (
                            <div
                              key={tpl.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/60 text-xs"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setRoutine(tpl);
                                  setIsTemplatesOpen(false);
                                  setStatusMessage({
                                    type: 'success',
                                    text: `Plantilla "${tpl.name}" cargada.`,
                                  });
                                }}
                                className="flex-1 text-left font-semibold text-foreground truncate hover:text-blue-600"
                              >
                                {tpl.name} ({tpl.blocks.length} ej.)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRoutine(tpl);
                                  setIsTemplatesOpen(false);
                                  setCurrentMainTab('live');
                                  setStatusMessage({
                                    type: 'success',
                                    text: `Plantilla "${tpl.name}" lista en Entreno en Vivo.`,
                                  });
                                }}
                                title="Entrenar en vivo"
                                className="p-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setLocalTemplates(deleteLocalTemplate(tpl.id))}
                                aria-label="Eliminar plantilla"
                                className="p-1 text-muted-foreground hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {routine.blocks.length > 0 && (
                  <button
                    onClick={resetToNewRoutine}
                    className="saas-btn min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Adaptación de Cargas / Factor Amigo (Plegable en móvil, visible en escritorio) */}
            <div className="pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsMobileLoadToolsOpen((o) => !o)}
                className="sm:hidden w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs font-semibold text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ajustar cargas y progresión</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isMobileLoadToolsOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`${isMobileLoadToolsOpen ? 'flex mt-3' : 'hidden sm:flex'} flex-wrap items-center gap-2`}>
                <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-1">
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
                title="Escalar todas las cargas al 85%"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                85%
              </button>
              <button
                onClick={() => scaleRoutineWeights(0.75)}
                title="Ajustar al 75%"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                75%
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(5)}
                title="Añadir +5kg a todos los ejercicios"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                +5 kg
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(-5)}
                title="Restar -5kg a todos los ejercicios"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              >
                -5 kg
              </button>

              {routine.blocks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => handleLogCompletedInStudio('optimal')}
                    title="Registrar sesión completada hoy para calcular la próxima progresión"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Registrar Hecho</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyProgressiveOverload('optimal')}
                    title="Ajusta automáticamente pesos, series, repeticiones y descansos según tu historial"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Progresión Auto</span>
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Estadísticas de la Sesión (3 columnas ejecutivas) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-6 pt-6 border-t border-border/70">
            <div className="bg-muted/35 rounded-xl p-3.5 sm:p-4 border border-border/70">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground font-medium">
                <span>Ejercicios</span>
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums mt-1.5 tracking-tight">
                {routine.blocks.length}
              </div>
            </div>

            <div className="bg-muted/35 rounded-xl p-3.5 sm:p-4 border border-border/70">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground font-medium">
                <span>Series</span>
                <Repeat className="w-4 h-4 text-indigo-600 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums mt-1.5 tracking-tight">
                {totalSets}
              </div>
            </div>

            <div className="bg-muted/35 rounded-xl p-3.5 sm:p-4 border border-border/70">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground font-medium">
                <span>Duración Est.</span>
                <Timer className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums mt-1.5 tracking-tight">
                ~{estimatedMinutes}m
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
            <div className="bg-card rounded-2xl border border-dashed border-border/80 p-10 sm:p-12 text-center saas-card">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/70 flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-xs">
                <Dumbbell className="w-7 h-7" />
              </div>
              <p className="text-lg font-bold text-foreground tracking-tight">No hay ejercicios en la rutina</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                Añade ejercicios del catálogo oficial de Garmin, diseña una sesión con el Asistente IA o explora los mejores ejercicios en Top Gimnasio.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setIsGeneratorModalOpen(true)}
                  className="saas-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-500/25 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generador Inteligente</span>
                </button>
                <button
                  onClick={() => setIsHevyModalOpen(true)}
                  className="saas-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-300 text-xs font-semibold hover:bg-orange-500/25 shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar desde Hevy</span>
                </button>
                <button
                  onClick={() => setStudioSubTab('guide')}
                  className="saas-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/25 shadow-xs"
                >
                  <Award className="w-4 h-4" />
                  <span>Top Gimnasio</span>
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
              {routine.blocks.map((block, index) => {
                const nextBlock = routine.blocks[index + 1];
                const prevBlock = routine.blocks[index - 1];
                const isInSuperset = Boolean(
                  block.supersetGroupId &&
                    ((nextBlock && nextBlock.supersetGroupId === block.supersetGroupId) ||
                      (prevBlock && prevBlock.supersetGroupId === block.supersetGroupId))
                );
                const isLinkedToNext = Boolean(
                  block.supersetGroupId && nextBlock && nextBlock.supersetGroupId === block.supersetGroupId
                );
                const record = exerciseRecordMap[block.exercise.id];
                const plateBreakdown =
                  block.exercise.equipment === 'Barra'
                    ? calculateBarbellPlates(block.weightKg, 20)
                    : null;

                return (
                <div
                  key={block.id}
                  className={`bg-card rounded-2xl border p-6 saas-card saas-card-interactive ${
                    isInSuperset
                      ? 'border-indigo-300 border-l-4 border-l-indigo-600'
                      : 'border-border/60 hover:border-blue-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/30 tabular-nums shadow-2xs">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-base sm:text-lg leading-snug">
                          {block.exercise.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            title={`ID Garmin: ${block.exercise.garminName}`}
                            className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                          >
                            {block.exercise.muscleGroup}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {block.exercise.equipment}
                          </span>
                          {isInSuperset && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                              <Link2 className="w-3 h-3" />
                              <span>Superserie</span>
                            </span>
                          )}
                          {record?.bestEstimated1RM ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 tabular-nums">
                              <Trophy className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>PR: {record.bestWeightKg}kg &bull; 1RM: {record.bestEstimated1RM}kg</span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Acciones de bloque */}
                    <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground shrink-0">
                      {index < routine.blocks.length - 1 && (
                        <button
                          type="button"
                          onClick={() => toggleSupersetWithNext(index)}
                          title={isLinkedToNext ? 'Desvincular superserie' : 'Enlazar en superserie con el siguiente ejercicio'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
                            isLinkedToNext
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-muted/40 hover:bg-indigo-500/15 text-muted-foreground hover:text-indigo-700 dark:hover:text-indigo-300 border-border/60'
                          }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">{isLinkedToNext ? 'Enlazado' : 'Superserie'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActive3DExercise(block.exercise)}
                        title="Ver demostración biomecánica 3D"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                      >
                        <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="hidden sm:inline">3D</span>
                      </button>

                      <button
                        onClick={() => {
                          setSwappingBlockIndex(index);
                          setIsSwapModalOpen(true);
                        }}
                        title="Máquina ocupada: Cambiar por ejercicio similar"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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

                  {/* Registro de dificultad individual + Nota Técnica / Alerta Articular (F4) */}
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Dificultad:
                        </span>
                        <div className="flex items-center gap-1">
                          {(
                            [
                              { id: 'easy', label: 'Fácil', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                              { id: 'optimal', label: 'Óptimo', activeClass: 'bg-blue-600 text-white border-blue-600' },
                              { id: 'hard', label: 'Al límite', activeClass: 'bg-amber-600 text-white border-amber-600' }
                            ] as const
                          ).map((opt) => {
                            const isSelected = exerciseEffortMap[block.exercise.id] === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const updatedHistory = recordSingleExerciseCompletion(block, opt.id);
                                  setExerciseRecordMap(updatedHistory);
                                  setExerciseEffortMap(prev => ({ ...prev, [block.exercise.id]: opt.id }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                                  isSelected
                                    ? opt.activeClass
                                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenNoteBlockId((curr) => (curr === block.id ? null : block.id))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                          exerciseNotesMap[block.exercise.id]?.hasJointDiscomfort
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : exerciseNotesMap[block.exercise.id]?.setupNote
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                        }`}
                      >
                        {exerciseNotesMap[block.exercise.id]?.hasJointDiscomfort ? (
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                        ) : (
                          <StickyNote className="w-3 h-3" />
                        )}
                        <span>
                          {exerciseNotesMap[block.exercise.id]?.hasJointDiscomfort
                            ? 'Alerta Articular'
                            : exerciseNotesMap[block.exercise.id]?.setupNote
                            ? 'Nota guardada'
                            : 'Nota / Ajuste'}
                        </span>
                      </button>
                    </div>

                    {openNoteBlockId === block.id && (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2.5 animate-in fade-in duration-150">
                        <input
                          type="text"
                          value={exerciseNotesMap[block.exercise.id]?.setupNote || ''}
                          onChange={(e) => {
                            const updated = saveExerciseNote(
                              block.exercise.id,
                              e.target.value,
                              Boolean(exerciseNotesMap[block.exercise.id]?.hasJointDiscomfort)
                            );
                            setExerciseNotesMap(updated);
                          }}
                          placeholder="Ej: Asiento al 4, agarre medio, controlar 3s bajada..."
                          className="w-full px-3 py-2 text-xs bg-card border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(exerciseNotesMap[block.exercise.id]?.hasJointDiscomfort)}
                            onChange={(e) => {
                              const updated = saveExerciseNote(
                                block.exercise.id,
                                exerciseNotesMap[block.exercise.id]?.setupNote || '',
                                e.target.checked
                              );
                              setExerciseNotesMap(updated);
                            }}
                            className="w-4 h-4 rounded border-border text-rose-600"
                          />
                          <span>Me produce molestia articular (la IA lo evitará automáticamente)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Calculadora automática de discos para barra olímpica (P1) */}
                  {plateBreakdown && (
                    <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold text-muted-foreground">
                        Discos por lado (barra {plateBreakdown.barWeightKg}kg):
                      </span>
                      {plateBreakdown.perSide.length === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">
                          Solo barra vacía
                        </span>
                      ) : (
                        plateBreakdown.perSide.map((p) => (
                          <span
                            key={p.weightKg}
                            className={`px-2 py-0.5 rounded-md font-bold tabular-nums shadow-2xs ${p.colorClass}`}
                          >
                            {p.weightKg}kg &times;{p.count}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </section>
              </>
            )}
          </div>
        )}
      </main>

      {/* --- MODAL COMPARTIR RUTINA (ENLACE CORTO + AMIGOS + APPLE WATCH) --- */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-card text-foreground rounded-2xl border border-border/80 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Cabecera */}
            <div className="p-5 sm:p-6 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base sm:text-lg">Compartir Rutina</h3>
                  <p className="text-xs text-muted-foreground">Envíala por enlace corto, WhatsApp o directo a un amigo</p>
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

            {/* Pestañas Enlace vs Enviar a Amigo */}
            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl border border-border/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShareModalTab('link')}
                  className={`min-h-[38px] rounded-lg inline-flex items-center justify-center gap-1.5 transition-all ${
                    shareModalTab === 'link'
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Enlace &amp; WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareModalTab('friend')}
                  className={`min-h-[38px] rounded-lg inline-flex items-center justify-center gap-1.5 transition-all ${
                    shareModalTab === 'friend'
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Enviar a un Amigo</span>
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-5 sm:p-6 space-y-4 text-sm overflow-y-auto">
              {shareModalTab === 'link' ? (
                <>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {shortShareResult?.shareCode ? 'Enlace corto para guardar / entrenar' : 'Enlace directo compacto'}
                      </span>
                      {shortShareResult?.shareCode && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold">
                          Código: {shortShareResult.shareCode}
                        </span>
                      )}
                    </div>

                    {routine.blocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Añade al menos un ejercicio a la rutina actual para generar un enlace compartible.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={isGeneratingShortLink ? 'Generando enlace...' : displayedShareUrl}
                            className="w-full min-h-[40px] text-xs font-mono bg-background border border-border/80 rounded-lg px-3 py-2 text-foreground truncate select-all outline-none"
                          />
                          <button
                            type="button"
                            disabled={isGeneratingShortLink}
                            onClick={handleCopyShareLink}
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
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
                        {shortShareResult?.note && (
                          <p className="text-[11px] text-muted-foreground">{shortShareResult.note}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Botones de acción rápida */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`¡Hola! Te comparto mi rutina "${routine.name}" en IronSync para guardarla o entrenar juntos: ${displayedShareUrl}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[42px] py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <span>Enviar por WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={displayedShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[42px] py-2.5 px-3 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <span>Abrir Vista Previa</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Opciones directas Apple Watch Serie 4 */}
                  <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs">
                        <Watch className="w-4 h-4 text-blue-400" />
                        <span>Cargar en Apple Watch (Serie 4 / watchOS)</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                        3 métodos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <a
                        href={`${shareUrl}&watch=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                      >
                        <Watch className="w-3.5 h-3.5 shrink-0" />
                        <span>Modo Reloj OLED</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => downloadAppleWatchCalendarIcs(routine)}
                        className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Calendario (.ics)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formatAppleWatchNotesText(routine));
                          setCopiedAppleNotes(true);
                          setTimeout(() => setCopiedAppleNotes(false), 2500);
                        }}
                        className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedAppleNotes ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Notas / Watch</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>Modo Reloj OLED:</strong> si le envías el enlace por WhatsApp/iMessage y lo toca desde su Apple Watch Serie 4, se abre adaptado a su pantalla OLED con botón gigante de serie y descanso.
                    </p>
                  </div>
                </>
              ) : !currentUser ? (
                <div className="bg-muted/30 border border-border/70 rounded-xl p-6 text-center space-y-3">
                  <Users className="w-9 h-9 text-indigo-500 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Inicia sesión para enviar a amigos</h4>
                    <p className="text-xs text-muted-foreground">
                      Conecta tu cuenta para enviar rutinas directo a la bandeja de entrada de tus amigos en IronSync.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsShareModalOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                  >
                    Abrir Cuenta / Iniciar Sesión
                  </button>
                </div>
              ) : shareFriends.length === 0 ? (
                <div className="bg-muted/30 border border-border/70 rounded-xl p-6 text-center space-y-3">
                  <Users className="w-9 h-9 text-muted-foreground/60 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">Aún no tienes amigos agregados</h4>
                    <p className="text-xs text-muted-foreground">
                      Agrega primero a tu compañero en la pestaña Amigos &amp; Retos con su código de atleta ({currentUser.friend_code}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsShareModalOpen(false);
                      setCurrentMainTab('social');
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    Ir a Amigos &amp; Retos
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendToFriendSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Rutina a enviar:</span>
                    <strong className="text-foreground">
                      {routine.name} ({routine.blocks.length} ej.)
                    </strong>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                      Elige destinatario
                    </label>
                    <select
                      required
                      value={selectedFriendRecipientId}
                      onChange={(e) => setSelectedFriendRecipientId(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground border border-border/80 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/25"
                    >
                      {shareFriends.map((f) => (
                        <option key={f.friend.id} value={f.friend.id}>
                          {f.friend.display_name} (@{f.friend.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                      Nota opcional para tu amigo
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      value={shareFriendMessage}
                      onChange={(e) => setShareFriendMessage(e.target.value)}
                      placeholder="Ej: Prueba esta de pierna hoy, baja peso si vas justo"
                      className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/25"
                    />
                  </div>

                  {shareFriendFeedback && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-medium ${
                        shareFriendFeedback.ok
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      {shareFriendFeedback.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingToFriend || routine.blocks.length === 0 || !selectedFriendRecipientId}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Inbox className="w-4 h-4" />
                    <span>{isSendingToFriend ? 'Enviando...' : 'Enviar Rutina a su Bandeja'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL VISTA PREVIA DE RUTINA COMPARTIDA (?import=...) --- */}
      {incomingSharedRoutine && (() => {
        const adaptedIncoming = applyWeightModeToRoutine(incomingSharedRoutine, incomingWeightMode);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-card text-foreground rounded-2xl border border-border/80 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
              <div className="p-5 border-b border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Rutina compartida contigo
                  </span>
                  <h3 className="font-bold text-foreground text-lg mt-0.5">{adaptedIncoming.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIncomingSharedRoutine(null)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Cargas:</span>
                  {(
                    [
                      { id: 'keep', label: 'Originales (100%)' },
                      { id: 'zero', label: '0 kg' },
                      { id: 'scale85', label: '85%' },
                      { id: 'scale75', label: '75%' },
                    ] as { id: WeightAdaptMode; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIncomingWeightMode(opt.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        incomingWeightMode === opt.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden bg-muted/20">
                  {adaptedIncoming.blocks.map((b, idx) => (
                    <div key={b.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate pr-2">
                        {idx + 1}. {b.exercise.name}
                      </span>
                      <span className="font-mono text-muted-foreground shrink-0 tabular-nums">
                        {b.sets}&times;{b.reps} &bull; {b.weightKg} kg
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await saveHevyRoutinesToApp([adaptedIncoming]);
                      setRoutine(adaptedIncoming);
                      setIncomingSharedRoutine(null);
                      setCurrentMainTab('live');
                      setStatusMessage({
                        type: 'success',
                        text: `Rutina "${adaptedIncoming.name}" guardada y lista en Entreno en Vivo.`,
                      });
                    }}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4" />
                    <span>Guardar y En Vivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await saveHevyRoutinesToApp([adaptedIncoming]);
                      setRoutine(adaptedIncoming);
                      setIncomingSharedRoutine(null);
                      setCurrentMainTab('studio');
                      setStatusMessage({
                        type: 'success',
                        text: `Rutina "${adaptedIncoming.name}" guardada en tu app y abierta en el Diseñador.`,
                      });
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar y Editar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setRoutine(r);
                          setIsCloudRoutinesModalOpen(false);
                          setCurrentMainTab('live');
                          setStatusMessage({
                            type: 'success',
                            text: `Rutina "${r.name}" lista en Entreno en Vivo.`,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-95"
                      >
                        <Play className="w-3 h-3" />
                        <span>En Vivo</span>
                      </button>
                      <button
                        onClick={() => {
                          setRoutine(r);
                          setIsCloudRoutinesModalOpen(false);
                          setStatusMessage({
                            type: 'success',
                            text: `Rutina "${r.name}" cargada en el editor.`
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteCloudRoutine(r.id, r.name)}
                        className="p-2 text-muted-foreground hover:text-rose-600 rounded-lg border border-border/60 hover:bg-rose-500/10 transition-colors"
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
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hevyError}</span>
                </div>
              )}

              {/* PESTAÑA 1: API */}
              {hevyTab === 'api' && (
                <div className="space-y-4">
                  {isHevyKeySaved && !isEditingHevyKey ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                            API Key de Hevy guardada permanentemente
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            Sesión cifrada en cookie segura del servidor (sin exposición en navegador)
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
                          const isAlreadySaved = savedHevyIds.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all duration-200 ${
                                isSelected ? 'bg-blue-500/15' : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => toggleSelectRoutine(r.id)}
                                  className="text-muted-foreground hover:text-blue-600 transition-colors p-1 shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/50" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground text-sm truncate">{r.title}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    {r.exerciseCount} ejercicios · {r.totalSets} series
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-9 sm:pl-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleHevyRoutine(r.id, r.routine)}
                                  title="Guardar rutina en la aplicación"
                                  className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isAlreadySaved
                                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-card hover:bg-muted text-foreground border-border/70'
                                  }`}
                                >
                                  {isAlreadySaved ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  )}
                                  <span>{isAlreadySaved ? 'Guardada' : 'Guardar'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartHevyRoutineLive(r.routine)}
                                  title="Guardar e iniciar Entreno en Vivo"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all active:scale-95"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>En Vivo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyHevyRoutine(r.routine)}
                                  title="Abrir en el Diseñador"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-semibold border border-border/70 transition-all"
                                >
                                  <span>Editar</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                    className="border-2 border-dashed border-border hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-muted/20 hover:bg-blue-500/10 transition-all duration-200"
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
                          const isAlreadySaved = savedHevyIds.includes(w.id);
                          return (
                            <div
                              key={w.id}
                              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all duration-200 ${
                                isSelected ? 'bg-blue-500/15' : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  onClick={() => toggleSelectRoutine(w.id)}
                                  className="text-muted-foreground hover:text-blue-600 transition-colors p-1 shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-muted-foreground/50" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground text-sm truncate">{w.name}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    Fecha: {w.date} · {w.exerciseCount} ejercicios ({w.totalSets} series)
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-9 sm:pl-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleHevyRoutine(w.id, w.routine)}
                                  title="Guardar rutina en la aplicación"
                                  className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isAlreadySaved
                                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-card hover:bg-muted text-foreground border-border/70'
                                  }`}
                                >
                                  {isAlreadySaved ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  )}
                                  <span>{isAlreadySaved ? 'Guardada' : 'Guardar'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartHevyRoutineLive(w.routine)}
                                  title="Guardar e iniciar Entreno en Vivo"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all active:scale-95"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>En Vivo</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyHevyRoutine(w.routine)}
                                  title="Abrir en el Diseñador"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground text-xs font-semibold border border-border/70 transition-all"
                                >
                                  <span>Editar</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Barra Inferior del Modal con Guardar en App + Sincronización Múltiple */}
            {selectedRoutineIds.length > 0 && (
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 animate-in slide-in-from-bottom-2 duration-150">
                <div>
                  <span className="text-sm font-semibold block">
                    {selectedRoutineIds.length} {selectedRoutineIds.length === 1 ? 'rutina seleccionada' : 'rutinas seleccionadas'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Guárdalas en la app para entrenar en vivo o envíalas a Garmin Connect
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBatchSaveHevyToApp}
                    disabled={isBatchSavingToApp || isBatchSyncing}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Save className={`w-4 h-4 ${isBatchSavingToApp ? 'animate-pulse' : ''}`} />
                    <span>
                      {isBatchSavingToApp
                        ? 'Guardando...'
                        : `Guardar ${selectedRoutineIds.length} en la App`}
                    </span>
                  </button>

                  <button
                    onClick={handleBatchSyncToGarmin}
                    disabled={isBatchSyncing || isBatchSavingToApp}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBatchSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4" />
                        <span>Enviar {selectedRoutineIds.length} a Garmin</span>
                      </>
                    )}
                  </button>
                </div>
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
          setStatusMessage({
            type: 'success',
            text: `¡Cuenta Garmin Connect (${data.displayName || 'Fénix 8'}) vinculada de forma segura!`
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }}
        onDisconnect={() => {
          setAccountStatus({ authenticated: false });
          fetch('/api/garmin/logout', { method: 'POST' }).catch(() => {});
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

      {/* Visor 3D Biomecánico de Ejercicios */}
      <Exercise3DModal
        exercise={active3DExercise}
        onClose={() => setActive3DExercise(null)}
      />

      {/* Planificador Semanal de Mesociclo (F1) */}
      <WeeklyPlanModal
        isOpen={isWeeklyPlanOpen}
        onClose={() => {
          setIsWeeklyPlanOpen(false);
          const plan = loadWeeklyPlan();
          setTodayPlannedRoutine(plan[getTodayWeekKey()] || null);
        }}
        currentRoutine={routine}
        onLoadRoutine={(loaded) => {
          setRoutine(loaded);
          setStatusMessage({
            type: 'success',
            text: `Rutina del plan semanal cargada: "${loaded.name}".`,
          });
        }}
      />

      {/* Guía Interactiva Completa */}
      <InteractiveGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        onNavigate={(target: GuideTargetAction) => {
          if (target === 'builder') {
            setCurrentMainTab('studio');
            setStudioSubTab('editor');
          } else if (target === 'live') setCurrentMainTab('live');
          else if (target === 'progress') setCurrentMainTab('progress');
          else if (target === 'social') setCurrentMainTab('social');
          else if (target === 'generator') {
            setCurrentMainTab('studio');
            setIsGeneratorModalOpen(true);
          } else if (target === 'weekly_plan') {
            setCurrentMainTab('studio');
            setIsWeeklyPlanOpen(true);
          } else if (target === 'garmin_auth') {
            setIsGarminAuthModalOpen(true);
          }
        }}
      />
    </div>
  );
}
