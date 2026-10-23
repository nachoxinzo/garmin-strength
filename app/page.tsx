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
  TrendingUp
} from 'lucide-react';
import { EXERCISE_CATALOG, CatalogExercise } from '@/lib/exercise-catalog';
import { StrengthRoutine, WorkoutExerciseBlock, GarminAccountStatus } from '@/lib/types';
import { parseHevyCSV, ParsedHevyWorkout } from '@/lib/hevy-csv-parser';
import { encodeRoutineToShareUrl } from '@/lib/share-utils';
import ProgressDashboard from '@/components/ProgressDashboard';

const DEFAULT_ROUTINE: StrengthRoutine = {
  id: 'routine-push-1',
  name: 'Push Dia 1 F8',
  warmupSeconds: 300,
  cooldownSeconds: 180,
  blocks: [
    {
      id: 'b-1',
      exercise: EXERCISE_CATALOG[0],
      sets: 3,
      reps: 8,
      weightKg: 80,
      restSeconds: 90
    },
    {
      id: 'b-2',
      exercise: EXERCISE_CATALOG[3],
      sets: 3,
      reps: 10,
      weightKg: 28,
      restSeconds: 90
    },
    {
      id: 'b-3',
      exercise: EXERCISE_CATALOG[18],
      sets: 3,
      reps: 8,
      weightKg: 50,
      restSeconds: 90
    },
    {
      id: 'b-4',
      exercise: EXERCISE_CATALOG[21],
      sets: 4,
      reps: 12,
      weightKg: 12,
      restSeconds: 60
    },
    {
      id: 'b-5',
      exercise: EXERCISE_CATALOG[5],
      sets: 3,
      reps: 10,
      weightKg: 0,
      restSeconds: 75
    }
  ]
};

const PRESETS: Record<string, StrengthRoutine> = {
  push: DEFAULT_ROUTINE,
  pull: {
    id: 'preset-pull',
    name: 'Pull Dia 2 F8',
    warmupSeconds: 300,
    cooldownSeconds: 180,
    blocks: [
      {
        id: 'p-1',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'deadlift_barbell') || EXERCISE_CATALOG[6],
        sets: 3,
        reps: 6,
        weightKg: 120,
        restSeconds: 150
      },
      {
        id: 'p-2',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'pull_up') || EXERCISE_CATALOG[8],
        sets: 4,
        reps: 8,
        weightKg: 0,
        restSeconds: 90
      },
      {
        id: 'p-3',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'dumbbell_row') || EXERCISE_CATALOG[10],
        sets: 3,
        reps: 10,
        weightKg: 32,
        restSeconds: 75
      },
      {
        id: 'p-4',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'face_pull') || EXERCISE_CATALOG[11],
        sets: 3,
        reps: 15,
        weightKg: 25,
        restSeconds: 60
      },
      {
        id: 'p-5',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'biceps_curl_barbell') || EXERCISE_CATALOG[22],
        sets: 3,
        reps: 10,
        weightKg: 35,
        restSeconds: 75
      }
    ]
  },
  legs: {
    id: 'preset-legs',
    name: 'Pierna Dia 3 F8',
    warmupSeconds: 360,
    cooldownSeconds: 180,
    blocks: [
      {
        id: 'l-1',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'squat_back_barbell') || EXERCISE_CATALOG[12],
        sets: 4,
        reps: 8,
        weightKg: 100,
        restSeconds: 120
      },
      {
        id: 'l-2',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'leg_press') || EXERCISE_CATALOG[14],
        sets: 3,
        reps: 12,
        weightKg: 180,
        restSeconds: 90
      },
      {
        id: 'l-3',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'deadlift_straight_leg') || EXERCISE_CATALOG[7],
        sets: 3,
        reps: 10,
        weightKg: 80,
        restSeconds: 90
      },
      {
        id: 'l-4',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'calf_raise_standing') || EXERCISE_CATALOG[16],
        sets: 4,
        reps: 15,
        weightKg: 60,
        restSeconds: 60
      },
      {
        id: 'l-5',
        exercise: EXERCISE_CATALOG.find(e => e.id === 'plank') || EXERCISE_CATALOG[26],
        sets: 3,
        reps: 45,
        weightKg: 0,
        restSeconds: 60
      }
    ]
  }
};

export default function WorkoutStudioPage() {
  const [currentMainTab, setCurrentMainTab] = useState<'studio' | 'progress'>('studio');
  const [routine, setRoutine] = useState<StrengthRoutine>(DEFAULT_ROUTINE);
  const [accountStatus, setAccountStatus] = useState<GarminAccountStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selector modal de ejercicios
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Todos');

  // Modal de importación de HEVY
  const [isHevyModalOpen, setIsHevyModalOpen] = useState(false);
  const [hevyTab, setHevyTab] = useState<'api' | 'csv'>('api');
  const [hevyApiKey, setHevyApiKey] = useState('');
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar estado de Garmin y rutina guardada al inicio
  useEffect(() => {
    checkGarminStatus();
    try {
      const saved = localStorage.getItem('garmin_strength_current_routine');
      if (saved) {
        setRoutine(JSON.parse(saved));
      }
      const savedHevyKey = localStorage.getItem('hevy_api_key');
      if (savedHevyKey) {
        setHevyApiKey(savedHevyKey);
      }
    } catch (e) {
      // ignore
    }
  }, []);

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

  const checkGarminStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/garmin/status');
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

  const loadPreset = (presetKey: string) => {
    if (PRESETS[presetKey]) {
      setRoutine(PRESETS[presetKey]);
      setStatusMessage({
        type: 'success',
        text: `Plantilla "${PRESETS[presetKey].name}" cargada con éxito.`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
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
        throw new Error(data.error || 'Error al sincronizar con Garmin');
      }

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
  const fetchHevyRoutines = async () => {
    if (!hevyApiKey.trim()) {
      setHevyError('Introduce tu API Key de Hevy.');
      return;
    }

    setIsLoadingHevyApi(true);
    setHevyError(null);
    setSelectedRoutineIds([]);

    try {
      localStorage.setItem('hevy_api_key', hevyApiKey.trim());
      const res = await fetch(`/api/hevy/routines?apiKey=${encodeURIComponent(hevyApiKey.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al consultar rutinas en Hevy');
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
    <div className="min-h-screen pb-24">
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Dumbbell className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 tracking-tight text-base sm:text-lg">
                  Garmin Strength Studio
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <Watch className="w-3 h-3 text-slate-600" />
                  Fénix 8
                </span>
              </div>
              <p className="text-xs text-slate-500">Planificador de entrenamientos nativos</p>
            </div>
          </div>

          {/* Botón Importar Hevy & Compartir & Estado de Garmin Connect */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Compartir</span>
            </button>

            <button
              onClick={() => setIsHevyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" />
              <span>Importar Hevy</span>
            </button>

            {accountStatus?.authenticated ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden md:inline">Conectado:</span>
                <span className="font-semibold truncate max-w-[120px]">{accountStatus.displayName || accountStatus.username}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Sesión no detectada</span>
              </div>
            )}

            <button
              onClick={checkGarminStatus}
              disabled={isCheckingStatus}
              title="Comprobar estado de conexión"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all duration-150 active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Sub-barra de Navegación de Pestañas (Mobile-First & SaaS B2B) */}
      <div className="bg-white border-b border-slate-200/90 shadow-[0_1px_2px_0_rgba(15,23,42,0.02)] sticky top-16 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentMainTab('studio')}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                currentMainTab === 'studio'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Diseñador de Rutinas</span>
            </button>

            <button
              onClick={() => setCurrentMainTab('progress')}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                currentMainTab === 'progress'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Progreso & Métricas</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Hevy
              </span>
            </button>
          </nav>

          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            Garmin Connect &bull; Fénix 8
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* Banner de Mensajes de Estado */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 transition-all duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-medium opacity-70 hover:opacity-100"
            >
              Cerrar
            </button>
          </div>
        )}

        {currentMainTab === 'progress' ? (
          <ProgressDashboard />
        ) : (
          <>

        {/* Panel Superior: Título de Rutina, Métricas y Acciones Rápidas */}
        <section className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 mb-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Nombre de la Sesión en el Reloj (Máx 16 car.)
              </label>
              <input
                type="text"
                maxLength={16}
                value={routine.name}
                onChange={e => setRoutine({ ...routine, name: e.target.value })}
                className="w-full text-xl sm:text-2xl font-bold text-slate-900 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 transition-all outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Ej: Push Dia 1 F8"
              />
            </div>

            {/* Plantillas Rápidas */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium mr-1">Plantillas rápidas:</span>
              <button
                onClick={() => loadPreset('push')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]"
              >
                Push (Torso)
              </button>
              <button
                onClick={() => loadPreset('pull')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]"
              >
                Pull (Espalda)
              </button>
              <button
                onClick={() => loadPreset('legs')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]"
              >
                Pierna & Core
              </button>
            </div>

            {/* Adaptación de Cargas / Factor Amigo */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 lg:border-t-0 lg:pt-0">
              <span className="text-xs text-slate-500 font-medium mr-1">Adaptar cargas:</span>
              <button
                onClick={() => scaleRoutineWeights(1.0)}
                title="Restablecer al 100% de los pesos de Hevy"
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95"
              >
                100% Hevy
              </button>
              <button
                onClick={() => scaleRoutineWeights(0.85)}
                title="Ajustar al 85% para un compañero"
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition-all active:scale-95"
              >
                85% (Amigo)
              </button>
              <button
                onClick={() => scaleRoutineWeights(0.75)}
                title="Ajustar al 75%"
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition-all active:scale-95"
              >
                75%
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(5)}
                title="Añadir +5kg a todos los ejercicios"
                className="px-2 py-1 text-xs font-semibold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-all active:scale-95"
              >
                +5kg
              </button>
              <button
                onClick={() => adjustAllWeightsDelta(-5)}
                title="Restar -5kg a todos los ejercicios"
                className="px-2 py-1 text-xs font-semibold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 transition-all active:scale-95"
              >
                -5kg
              </button>
            </div>
          </div>

          {/* Estadísticas de la Sesión */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200/60">
              <div className="text-xs text-slate-500 font-medium">Ejercicios</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                {routine.blocks.length}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200/60">
              <div className="text-xs text-slate-500 font-medium">Series Totales</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                {totalSets}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200/60">
              <div className="text-xs text-slate-500 font-medium">Tiempo Estimado</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                ~{estimatedMinutes} min
              </div>
            </div>
          </div>

          {/* Configuración de Calentamiento y Enfriamiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
            <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-slate-700">Calentamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={30}
                  value={routine.warmupSeconds}
                  onChange={e => setRoutine({ ...routine, warmupSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-18 px-2 py-1 text-center font-mono font-semibold bg-white border border-slate-200 rounded text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">seg ({Math.round(routine.warmupSeconds / 60)}m)</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-slate-700">Enfriamiento</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={30}
                  value={routine.cooldownSeconds}
                  onChange={e => setRoutine({ ...routine, cooldownSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-18 px-2 py-1 text-center font-mono font-semibold bg-white border border-slate-200 rounded text-slate-800"
                />
                <span className="text-xs text-slate-500 font-medium">seg ({Math.round(routine.cooldownSeconds / 60)}m)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Lista de Ejercicios */}
        <section className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-slate-800 tracking-tight">
              Estructura de Ejercicios ({routine.blocks.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHevyModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98]"
              >
                <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                Desde Hevy
              </button>

              <button
                onClick={() => setIsSelectorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Añadir Ejercicio
              </button>
            </div>
          </div>

          {routine.blocks.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <Dumbbell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-medium text-slate-700">No hay ejercicios en la rutina</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Puedes añadir ejercicios manualmente o importar tus entrenamientos directamente desde Hevy.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setIsHevyModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold hover:bg-orange-100"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Importar desde Hevy
                </button>
                <button
                  onClick={() => setIsSelectorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Explorar Catálogo Garmin
                </button>
              </div>
            </div>
          ) : (
            routine.blocks.map((block, index) => (
              <div
                key={block.id}
                className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] transition-all hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base sm:text-lg">
                        {block.exercise.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                          {block.exercise.muscleGroup}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {block.exercise.garminName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de bloque */}
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => moveBlock(index, 'up')}
                      disabled={index === 0}
                      title="Mover arriba"
                      className="p-1.5 rounded-lg hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveBlock(index, 'down')}
                      disabled={index === routine.blocks.length - 1}
                      title="Mover abajo"
                      className="p-1.5 rounded-lg hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateBlock(index)}
                      title="Duplicar ejercicio"
                      className="p-1.5 rounded-lg hover:text-slate-800 hover:bg-slate-100"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeBlock(index)}
                      title="Eliminar ejercicio"
                      className="p-1.5 rounded-lg hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Parámetros de la serie (Series, Reps, Peso, Descanso) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                  {/* Series */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Series
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateBlock(index, { sets: Math.max(1, block.sets - 1) })}
                        className="w-8 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={block.sets}
                        onChange={e => updateBlock(index, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full text-center font-bold text-slate-900 bg-transparent text-base tabular-nums"
                      />
                      <button
                        onClick={() => updateBlock(index, { sets: block.sets + 1 })}
                        className="w-8 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Repeticiones */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Reps objetivo
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateBlock(index, { reps: Math.max(1, block.reps - 1) })}
                        className="w-8 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={block.reps}
                        onChange={e => updateBlock(index, { reps: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full text-center font-bold text-slate-900 bg-transparent text-base tabular-nums"
                      />
                      <button
                        onClick={() => updateBlock(index, { reps: block.reps + 1 })}
                        className="w-8 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Carga / Peso en kg con sugerencia de Hevy y ajuste ágil */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold uppercase text-slate-500">
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
                        className="w-7 h-8 rounded bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-100 active:scale-95 text-[10px]"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => updateBlock(index, { weightKg: Math.max(0, block.weightKg - 2.5) })}
                        title="-2.5 kg"
                        className="w-7 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        value={block.weightKg}
                        onChange={e => updateBlock(index, { weightKg: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full text-center font-bold text-slate-900 bg-transparent text-base tabular-nums"
                      />
                      <button
                        onClick={() => updateBlock(index, { weightKg: block.weightKg + 2.5 })}
                        title="+2.5 kg"
                        className="w-7 h-8 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 text-xs"
                      >
                        +
                      </button>
                      <button
                        onClick={() => updateBlock(index, { weightKg: block.weightKg + 5 })}
                        title="+5 kg"
                        className="w-7 h-8 rounded bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-100 active:scale-95 text-[10px]"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Descanso posterior */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Descanso
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={15}
                        min={0}
                        value={block.restSeconds}
                        onChange={e => updateBlock(index, { restSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full text-center font-bold text-slate-900 bg-white border border-slate-200 rounded px-2 py-1 text-base tabular-nums"
                      />
                      <span className="text-xs text-slate-500 font-medium">s</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Botón flotante inferior de acción */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-3.5 px-4 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="hidden sm:block">
              <span className="text-xs text-slate-500 font-medium block">
                Sesión: <strong className="text-slate-800">{routine.name}</strong>
              </span>
              <span className="text-xs text-slate-400">
                {totalSets} series · ~{estimatedMinutes} min
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Botón Compartir / Apple Watch */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                disabled={routine.blocks.length === 0}
                title="Compartir con un amigo o Apple Watch"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold border border-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                <Share2 className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Compartir</span>
              </button>

              {/* Botón Exportar FIT */}
              <button
                onClick={handleDownloadFit}
                disabled={isDownloading || routine.blocks.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold border border-slate-200 transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">Descargar</span> .FIT
              </button>

              {/* Botón Sincronizar Garmin Connect */}
              <button
                onClick={handleSyncToGarmin}
                disabled={isSyncing || routine.blocks.length === 0}
                className="flex-2 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">Compartir Rutina</h3>
                  <p className="text-xs text-slate-500">Para entrenar juntos con Apple Watch o móvil</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 space-y-4 text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Enlace directo a la sesión
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 truncate select-all outline-none"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-1.5"
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
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`¡Hola! Te comparto la rutina de hoy (${routine.name}) para entrenar juntos: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <span>Enviar por WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <span>Probar Modo Live</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Explicación Apple Watch */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Watch className="w-4 h-4 text-blue-600" />
                  <span>¿Cómo lo sigue tu amigo con su Apple Watch?</span>
                </div>
                <p className="text-slate-600">
                  1. <strong>En el móvil (Modo Gym Live)</strong>: Al abrir el enlace, tendrá una pantalla táctil para el gimnasio con series, repeticiones y temporizador sonoro/vibratorio de descanso sincronizado.
                </p>
                <p className="text-slate-600">
                  2. <strong>En su Apple Watch Serie 4</strong>: Puede activar el entreno nativo de <em>&quot;Fuerza Tradicional&quot;</em> para registrar pulsaciones y calorías mientras sigue las series en el móvil, o si tiene <strong>Hevy</strong> en el Apple Watch, importar la rutina directamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL HEVY (API + CSV) --- */}
      {isHevyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                  H
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Importar Entrenamientos de Hevy</h3>
                  <p className="text-xs text-slate-500">Selecciona una o varias rutinas para enviarlas a tu Fénix 8</p>
                </div>
              </div>
              <button
                onClick={() => setIsHevyModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Selector de Pestañas (API vs CSV) */}
            <div className="flex border-b border-slate-100 bg-slate-50/70 p-2 gap-2">
              <button
                onClick={() => setHevyTab('api')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  hevyTab === 'api'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Key className="w-4 h-4" />
                Vía Hevy API (Automática)
              </button>

              <button
                onClick={() => setHevyTab('csv')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  hevyTab === 'csv'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Vía Archivo CSV (Gratis)
              </button>
            </div>

            {/* Contenido de la pestaña */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {hevyError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hevyError}</span>
                </div>
              )}

              {/* PESTAÑA 1: API */}
              {hevyTab === 'api' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                    <p className="font-semibold text-slate-800">¿Cómo obtener tu clave de Hevy?</p>
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
                    <p>2. Genera o copia tu Developer API Key y pégala a continuación.</p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Pega aquí tu Hevy API Key..."
                      value={hevyApiKey}
                      onChange={e => setHevyApiKey(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      onClick={fetchHevyRoutines}
                      disabled={isLoadingHevyApi}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isLoadingHevyApi ? 'Buscando...' : 'Buscar Rutinas'}
                    </button>
                  </div>

                  {/* Listado de Rutinas de la API */}
                  {hevyApiRoutines.length > 0 && (
                    <div className="space-y-2 mt-4 pt-2">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">
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

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                        {hevyApiRoutines.map(r => {
                          const isSelected = selectedRoutineIds.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              className={`p-3.5 flex items-center justify-between transition-all ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleSelectRoutine(r.id)}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-semibold text-slate-900 text-sm">{r.title}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {r.exerciseCount} ejercicios · {r.totalSets} series
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => applyHevyRoutine(r.routine)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
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
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-slate-800">Exportar desde la app móvil de Hevy:</p>
                    <p>1. Abre Hevy en tu teléfono y ve a tu <strong>Perfil</strong>.</p>
                    <p>2. Toca en el engranaje de <strong>Ajustes</strong> $\rightarrow$ <strong>Export & Import Data</strong>.</p>
                    <p>3. Pulsa <strong>Export Workouts (CSV)</strong> y sube el archivo descargado aquí.</p>
                  </div>

                  {/* Zona de Drop / Input de archivo */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Haz clic para seleccionar tu archivo CSV de Hevy
                    </p>
                    <p className="text-xs text-slate-400 mt-1">workouts.csv exportado desde la app</p>
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
                        <span className="text-xs font-semibold uppercase text-slate-500">
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

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                        {hevyCsvWorkouts.slice(0, 20).map(w => {
                          const isSelected = selectedRoutineIds.includes(w.id);
                          return (
                            <div
                              key={w.id}
                              className={`p-3.5 flex items-center justify-between transition-all ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleSelectRoutine(w.id)}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-semibold text-slate-900 text-sm">{w.name}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Fecha: {w.date} · {w.exerciseCount} ejercicios ({w.totalSets} series)
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => applyHevyRoutine(w.routine)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Catálogo Oficial de Ejercicios Garmin</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mapeados directamente a los identificadores del sensor de fuerza de Garmin
                </p>
              </div>
              <button
                onClick={() => setIsSelectorOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros de Grupo Muscular */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por ejercicio o músculo (ej. banca, sentadilla, dominadas)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {muscleGroups.map(group => (
                  <button
                    key={group}
                    onClick={() => setSelectedMuscle(group)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedMuscle === group
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista Scrollable de Ejercicios */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {filteredCatalog.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No se encontraron ejercicios que coincidan con la búsqueda.
                </div>
              ) : (
                filteredCatalog.map(exercise => (
                  <div
                    key={exercise.id}
                    onClick={() => addExercise(exercise)}
                    className="py-3 px-3 rounded-xl hover:bg-blue-50/60 cursor-pointer flex items-center justify-between gap-4 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600">
                        {exercise.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {exercise.muscleGroup}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {exercise.garminName}
                        </span>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 text-slate-700 text-xs font-semibold transition-all shrink-0">
                      + Añadir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
