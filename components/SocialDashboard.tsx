'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Trophy,
  Swords,
  TrendingUp,
  UserPlus,
  Search,
  Inbox,
  Play,
  Save,
  Trash2,
  Dumbbell,
  Share2,
  X
} from 'lucide-react';
import {
  UserProfile,
  Friendship,
  GymChallenge,
  getCurrentUserProfile,
  getFriendships,
  searchProfiles,
  sendFriendRequest,
  respondToFriendRequest,
  getChallenges,
  createChallenge,
  respondToChallenge,
  getFriendHeadToHeadComparison,
  FriendHeadToHeadData,
} from '@/lib/social-service';
import {
  applyWeightModeToRoutine,
  getReceivedRoutines,
  ReceivedRoutineShare,
  updateReceivedRoutineStatus,
  WeightAdaptMode,
} from '@/lib/routine-sharing-service';
import { StrengthRoutine } from '@/lib/types';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';

interface SocialDashboardProps {
  onOpenAuth: () => void;
  onImportReceivedRoutine?: (routine: StrengthRoutine, goLive: boolean) => Promise<void> | void;
  onUnreadSharesChange?: (count: number) => void;
}

export default function SocialDashboard({
  onOpenAuth,
  onImportReceivedRoutine,
  onUnreadSharesChange,
}: SocialDashboardProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [challenges, setChallenges] = useState<GymChallenge[]>([]);
  const [receivedShares, setReceivedShares] = useState<ReceivedRoutineShare[]>([]);
  const [shareWeightModes, setShareWeightModes] = useState<Record<string, WeightAdaptMode>>({});
  const [importCodeInput, setImportCodeInput] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'challenges' | 'compare' | 'friends'>('received');

  // Búsqueda de amigos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Crear Reto
  const [isCreateChallengeOpen, setIsCreateChallengeOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeMetric, setChallengeMetric] = useState<'max_weight' | 'estimated_1rm' | 'total_volume' | 'sessions_count'>('estimated_1rm');
  const [challengeExercise, setChallengeExercise] = useState('bench_press_barbell');
  const [challengeDuration, setChallengeDuration] = useState<number>(7);

  // Comparativa Cara a Cara
  const [compareFriendId, setCompareFriendId] = useState<string>('');
  const [compareRange, setCompareRange] = useState<7 | 30 | 90 | 'all'>('all');
  const [compareExerciseKey, setCompareExerciseKey] = useState<string>('');
  const [compareFilterMode, setCompareFilterMode] = useState<'all' | 'shared'>('all');
  const [compareSearch, setCompareSearch] = useState<string>('');
  const [headToHeadData, setHeadToHeadData] = useState<FriendHeadToHeadData | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const profile = await getCurrentUserProfile();
    setCurrentUser(profile);
    if (profile) {
      const [friends, chs, received] = await Promise.all([
        getFriendships(),
        getChallenges(),
        getReceivedRoutines(),
      ]);
      setFriendships(friends);
      setChallenges(chs);
      setReceivedShares(received);
      onUnreadSharesChange?.(received.filter((r) => r.status === 'unread').length);
      const accepted = friends.filter(f => f.status === 'accepted');
      if (accepted.length > 0 && !compareFriendId) {
        setCompareFriendId(accepted[0].friend.id);
      }
    }
  };

  const handleImportFriendRoutine = async (share: ReceivedRoutineShare, goLive: boolean) => {
    const mode = shareWeightModes[share.id] || 'keep';
    const adapted = applyWeightModeToRoutine(share.routine, mode);
    if (onImportReceivedRoutine) {
      await onImportReceivedRoutine(adapted, goLive);
    }
    await updateReceivedRoutineStatus(share.id, 'imported');
    await loadUserData();
  };

  const handleDismissFriendRoutine = async (shareId: string) => {
    await updateReceivedRoutineStatus(shareId, 'dismissed');
    await loadUserData();
  };

  const handleOpenCodeImport = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = importCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return;
    router.push(`/r/${cleaned}`);
  };

  // Buscar perfiles
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchFeedback(null);
    try {
      const results = await searchProfiles(searchQuery);
      setSearchResults(results.filter(r => r.id !== currentUser?.id));
      if (results.length === 0) {
        setSearchFeedback('No se encontraron atletas con ese nombre o código.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (receiverId: string) => {
    const res = await sendFriendRequest(receiverId);
    setSearchFeedback(res.message);
    if (res.success) {
      await loadUserData();
    }
  };

  const handleRespondFriend = async (friendshipId: string, accept: boolean) => {
    await respondToFriendRequest(friendshipId, accept);
    await loadUserData();
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId) return;

    const ex = EXERCISE_CATALOG.find(e => e.id === challengeExercise);
    const title = challengeTitle.trim() || `Duelo de ${ex?.name || 'Fuerza'}`;

    const ok = await createChallenge({
      opponent_id: selectedFriendId,
      title,
      metric: challengeMetric,
      exercise_title: ex?.name,
      durationDays: challengeDuration
    });

    if (ok) {
      setIsCreateChallengeOpen(false);
      setChallengeTitle('');
      await loadUserData();
    }
  };

  const handleRespondChallenge = async (id: string, accept: boolean) => {
    await respondToChallenge(id, accept);
    await loadUserData();
  };

  // Cargar comparativa completa cuando cambie amigo o rango temporal
  useEffect(() => {
    let active = true;
    async function fetchCompare() {
      if (!compareFriendId) return;
      setIsLoadingCompare(true);
      try {
        const data = await getFriendHeadToHeadComparison(compareFriendId, compareRange);
        if (!active) return;
        setHeadToHeadData(data);
        if (data && data.exercises.length > 0) {
          setCompareExerciseKey((prev) =>
            data.exercises.some((ex) => ex.exerciseKey === prev)
              ? prev
              : data.exercises[0].exerciseKey
          );
        } else {
          setCompareExerciseKey('');
        }
      } finally {
        if (active) setIsLoadingCompare(false);
      }
    }
    fetchCompare();
    return () => {
      active = false;
    };
  }, [compareFriendId, compareRange]);

  const acceptedFriends = friendships.filter(f => f.status === 'accepted');
  const pendingRequests = friendships.filter(f => f.status === 'pending' && !f.isSender);

  // Si no ha iniciado sesión
  if (!currentUser) {
    return (
      <div className="bg-card text-foreground rounded-2xl border border-border/80 p-8 sm:p-12 text-center saas-card max-w-xl mx-auto my-8 animate-in fade-in duration-150">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 border border-indigo-500/30 shadow-xs">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Compite y Entrena con tus Amigos</h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Crea tu perfil gratuito para conectar con tu compañero de gimnasio, retaros mutuamente en cargas o volumen y ver quién progresa más rápido en las gráficas comparativas.
        </p>
        <button
          onClick={onOpenAuth}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Iniciar Sesión / Crear Perfil</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Tarjeta de Atleta / Código de Amigo */}
      <div className="bg-card rounded-xl border border-border/80 p-4 sm:p-5 saas-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentUser.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-base">{currentUser.display_name}</span>
              <span className="text-xs text-muted-foreground font-mono">@{currentUser.username}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
              <span>Tu código de atleta:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/30">
                {currentUser.friend_code}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingRequests.length > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>{pendingRequests.length} solicitud pendiente</span>
            </div>
          )}

          <button
            onClick={() => setIsCreateChallengeOpen(true)}
            disabled={acceptedFriends.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[38px]"
          >
            <Swords className="w-4 h-4" />
            <span>Lanzar Reto</span>
          </button>
        </div>
      </div>

      {/* Sub-navegación Social */}
      <div className="flex border-b border-border/80 gap-5 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('received')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'received'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Rutinas Recibidas ({receivedShares.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('challenges')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'challenges'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Retos Activos ({challenges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('compare')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'compare'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Comparativa</span>
        </button>

        <button
          onClick={() => setActiveTab('friends')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'friends'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Amigos ({acceptedFriends.length})</span>
        </button>
      </div>

      {/* CONTENIDO 0: RUTINAS RECIBIDAS + IMPORTAR POR CÓDIGO */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/80 p-4 shadow-xs space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Importar rutina con código corto (/r/CODIGO)
            </h4>
            <form onSubmit={handleOpenCodeImport} className="flex gap-2">
              <input
                type="text"
                value={importCodeInput}
                onChange={(e) => setImportCodeInput(e.target.value.toUpperCase())}
                placeholder="Ej: A7K2P9X4"
                maxLength={16}
                className="flex-1 min-h-[42px] px-3 py-2 text-base sm:text-sm font-mono uppercase bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="submit"
                disabled={!importCodeInput.trim()}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Abrir código</span>
              </button>
            </form>
          </div>

          {receivedShares.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/80 p-8 text-center space-y-2">
              <Inbox className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <h4 className="font-bold text-foreground text-sm">Aún no has recibido rutinas de amigos</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Cuando un amigo comparta una rutina contigo desde &quot;Compartir → Enviar a un Amigo&quot;, aparecerá aquí lista para guardarla o entrenarla En Vivo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedShares.map((share) => {
                const selectedMode = shareWeightModes[share.id] || 'keep';
                const totalSets = share.routine.blocks.reduce((a, b) => a + b.sets, 0);
                return (
                  <div
                    key={share.id}
                    className="bg-card rounded-xl border border-border/80 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground text-sm">{share.routine.name}</h4>
                          {share.status === 'unread' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                              Nueva
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Enviada por{' '}
                          <strong className="text-foreground">
                            {share.sender?.display_name || 'Amigo'}
                          </strong>{' '}
                          &bull; {share.routine.blocks.length} ejercicios &bull; {totalSets} series
                        </p>
                        {share.message && (
                          <p className="text-xs text-foreground/85 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5 mt-2">
                            &ldquo;{share.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismissFriendRoutine(share.id)}
                        title="Descartar"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                        Cargas:
                      </span>
                      {(
                        [
                          { id: 'keep', label: '100%' },
                          { id: 'zero', label: '0 kg' },
                          { id: 'scale85', label: '85%' },
                          { id: 'scale75', label: '75%' },
                        ] as { id: WeightAdaptMode; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setShareWeightModes((prev) => ({ ...prev, [share.id]: opt.id }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            selectedMode === opt.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleImportFriendRoutine(share, true)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Guardar y En Vivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportFriendRoutine(share, false)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar y Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO 1: RETOS ("PICARSE") */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {challenges.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/80 p-8 text-center">
              <Swords className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <h4 className="font-bold text-foreground text-sm">No hay retos activos en este momento</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                Lanza un reto a tu amigo para ver quién sube más peso en press banca o quién mueve más volumen semanal.
              </p>
              <button
                onClick={() => setIsCreateChallengeOpen(true)}
                disabled={acceptedFriends.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <Swords className="w-4 h-4" />
                <span>{acceptedFriends.length === 0 ? 'Añade un amigo primero' : 'Crear Primer Reto'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map(ch => {
                const isCreator = ch.creator_id === currentUser.id;
                const opponentName = isCreator ? ch.opponent?.display_name : ch.creator?.display_name;
                return (
                  <div key={ch.id} className="bg-card rounded-xl border border-border/80 p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-sm">{ch.title}</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Contra <strong className="text-foreground">{opponentName}</strong> &bull; Termina el {ch.end_date}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ch.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border border-border/60'
                      }`}>
                        {ch.status === 'active' ? 'En Duelo' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border border-border/60">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Métrica en juego:</span>
                        <span className="font-semibold text-foreground">
                          {ch.metric === 'estimated_1rm' ? '1RM Estimado' : ch.metric === 'total_volume' ? 'Volumen Total' : 'Carga Máxima'}
                        </span>
                      </div>
                      {ch.exercise_title && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Ejercicio:</span>
                          <span className="font-semibold text-foreground">{ch.exercise_title}</span>
                        </div>
                      )}
                    </div>

                    {ch.status === 'pending' && !isCreator && (
                      <div className="flex gap-2 pt-2 border-t border-border/60">
                        <button
                          onClick={() => handleRespondChallenge(ch.id, true)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Aceptar Reto
                        </button>
                        <button
                          onClick={() => handleRespondChallenge(ch.id, false)}
                          className="px-3 py-1.5 bg-muted hover:bg-accent text-foreground border border-border/60 text-xs font-semibold rounded-lg"
                        >
                          Declinar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO 2: COMPARADOR CARA A CARA COMPLETO */}
      {activeTab === 'compare' && (() => {
        const selectedFriendProfile = acceptedFriends.find(
          (f) => f.friend.id === compareFriendId
        )?.friend;
        const friendLabel = selectedFriendProfile?.display_name || 'Amigo';
        const sharedCount = headToHeadData
          ? headToHeadData.exercises.filter((e) => e.isShared).length
          : 0;
        const selectedExerciseRow =
          headToHeadData?.exercises.find((e) => e.exerciseKey === compareExerciseKey) ||
          headToHeadData?.exercises[0] ||
          null;
        const filteredRows = (headToHeadData?.exercises || []).filter((row) => {
          if (compareFilterMode === 'shared' && !row.isShared) return false;
          if (
            compareSearch.trim() &&
            !row.exerciseTitle.toLowerCase().includes(compareSearch.trim().toLowerCase())
          ) {
            return false;
          }
          return true;
        });

        const ratioWidths = (a: number, b: number) => {
          const total = a + b;
          if (total <= 0) return { aPct: 50, bPct: 50 };
          return {
            aPct: Math.round((a / total) * 100),
            bPct: Math.round((b / total) * 100),
          };
        };

        return (
          <div className="bg-card rounded-xl border border-border/80 p-4 sm:p-5 shadow-xs space-y-5">
            {/* Controles superiores: Amigo y Rango temporal */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex-1 sm:max-w-xs">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Seleccionar Compañero
                </label>
                {acceptedFriends.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Añade y acepta un amigo primero en la pestaña Amigos.
                  </div>
                ) : (
                  <select
                    value={compareFriendId}
                    onChange={(e) => setCompareFriendId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  >
                    {acceptedFriends.map((f) => (
                      <option key={f.friend.id} value={f.friend.id}>
                        {f.friend.display_name} (@{f.friend.username})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Periodo
                </span>
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/70">
                  {(
                    [
                      { id: 7, label: '7d' },
                      { id: 30, label: '30d' },
                      { id: 90, label: '90d' },
                      { id: 'all', label: 'Todo' },
                    ] as const
                  ).map((rng) => (
                    <button
                      key={String(rng.id)}
                      type="button"
                      onClick={() => setCompareRange(rng.id)}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        compareRange === rng.id
                          ? 'bg-card text-foreground shadow-xs border border-border/80'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {rng.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Leyenda Tú vs Amigo */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
              <div className="flex items-center gap-4 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                  <span>Tú ({currentUser.display_name})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span>{friendLabel}</span>
                </div>
              </div>
              {headToHeadData && sharedCount > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 tabular-nums">
                  {sharedCount} ejercicios en común
                </span>
              )}
            </div>

            {isLoadingCompare ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 rounded-xl bg-muted/50 border border-border/50" />
                ))}
              </div>
            ) : !headToHeadData ||
              (headToHeadData.me.totalSets === 0 && headToHeadData.friend.totalSets === 0) ? (
              <div className="h-48 rounded-xl bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center">
                <Dumbbell className="w-8 h-8 mb-2 text-muted-foreground/50" />
                <span>No hay entrenamientos registrados en la nube en este periodo.</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Completa sesiones o sincroniza tus entrenamientos para comparar volumen, 1RM y marcas.
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {headToHeadData.me.totalSets > 0 && headToHeadData.friend.totalSets === 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                    <strong>{friendLabel}</strong> aún no muestra registros en la nube para este periodo (asegúrate de haber sincronizado entrenos y ejecutado la política SQL de lectura entre amigos en Supabase).
                  </div>
                )}

                {/* 4 Tarjetas Comparativas Globales */}
                {(() => {
                  const { me, friend } = headToHeadData;
                  const volW = ratioWidths(me.totalVolumeKg, friend.totalVolumeKg);
                  const rmW = ratioWidths(me.bestEstimated1RMKg, friend.bestEstimated1RMKg);
                  const maxW = ratioWidths(me.maxWeightKg, friend.maxWeightKg);
                  const sessW = ratioWidths(me.sessionsCount, friend.sessionsCount);
                  const volDiff = me.totalVolumeKg - friend.totalVolumeKg;

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Volumen Total */}
                      <div className="rounded-xl bg-muted/25 border border-border/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Volumen Total
                          </span>
                          <span className="text-[11px] font-bold tabular-nums text-foreground">
                            {volDiff === 0
                              ? 'Empate'
                              : volDiff > 0
                              ? `+${volDiff.toLocaleString()} kg tú`
                              : `+${Math.abs(volDiff).toLocaleString()} kg ${friendLabel}`}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 tabular-nums">
                          <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                            {me.totalVolumeKg.toLocaleString()} kg
                          </span>
                          <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                            {friend.totalVolumeKg.toLocaleString()} kg
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-blue-600 h-full" style={{ width: `${volW.aPct}%` }} />
                          <div className="bg-emerald-500 h-full" style={{ width: `${volW.bPct}%` }} />
                        </div>
                      </div>

                      {/* 1RM Máximo Estimado */}
                      <div className="rounded-xl bg-muted/25 border border-border/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            1RM Máximo (1 rep máx.)
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 tabular-nums">
                          <div className="min-w-0">
                            <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                              {me.bestEstimated1RMKg} kg
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {me.best1RMExercise}
                            </div>
                          </div>
                          <div className="text-right min-w-0">
                            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                              {friend.bestEstimated1RMKg} kg
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {friend.best1RMExercise}
                            </div>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-blue-600 h-full" style={{ width: `${rmW.aPct}%` }} />
                          <div className="bg-emerald-500 h-full" style={{ width: `${rmW.bPct}%` }} />
                        </div>
                      </div>

                      {/* Peso Máximo Levantado */}
                      <div className="rounded-xl bg-muted/25 border border-border/70 p-4 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Peso Máximo Levantado
                        </div>
                        <div className="flex items-baseline justify-between gap-2 tabular-nums">
                          <div className="min-w-0">
                            <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                              {me.maxWeightKg} kg
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {me.maxWeightExercise}
                            </div>
                          </div>
                          <div className="text-right min-w-0">
                            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                              {friend.maxWeightKg} kg
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {friend.maxWeightExercise}
                            </div>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-blue-600 h-full" style={{ width: `${maxW.aPct}%` }} />
                          <div className="bg-emerald-500 h-full" style={{ width: `${maxW.bPct}%` }} />
                        </div>
                      </div>

                      {/* Constancia y Trabajo */}
                      <div className="rounded-xl bg-muted/25 border border-border/70 p-4 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Constancia y Trabajo
                        </div>
                        <div className="flex items-baseline justify-between gap-2 tabular-nums text-xs">
                          <div>
                            <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                              {me.sessionsCount} ses. &bull; {me.totalSets} ser.
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Media: {me.avgVolumePerSessionKg.toLocaleString()} kg/ses.
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                              {friend.sessionsCount} ses. &bull; {friend.totalSets} ser.
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Media: {friend.avgVolumePerSessionKg.toLocaleString()} kg/ses.
                            </div>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-blue-600 h-full" style={{ width: `${sessW.aPct}%` }} />
                          <div className="bg-emerald-500 h-full" style={{ width: `${sessW.bPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Comparativa de Ejercicio en Detalle */}
                {selectedExerciseRow && (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Comparativa de Ejercicio en Detalle
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Peso máximo a 1 repetición (1RM), carga punta, mejor serie y tonelaje
                        </p>
                      </div>
                      <select
                        aria-label="Seleccionar ejercicio para comparar en detalle"
                        value={selectedExerciseRow.exerciseKey}
                        onChange={(e) => setCompareExerciseKey(e.target.value)}
                        className="w-full sm:w-72 min-h-[42px] px-3 py-2 text-base sm:text-xs font-semibold bg-background border border-border/80 rounded-lg text-foreground outline-none focus:ring-2 focus:ring-blue-500/25"
                      >
                        {headToHeadData.exercises.map((ex) => (
                          <option key={ex.exerciseKey} value={ex.exerciseKey}>
                            {ex.isShared ? `En común: ${ex.exerciseTitle}` : ex.exerciseTitle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs tabular-nums">
                      <div className="rounded-lg bg-card border border-border/70 p-3">
                        <div className="text-[11px] text-muted-foreground font-semibold">1RM (1 rep máx.)</div>
                        <div className="mt-1 font-bold text-blue-600 dark:text-blue-400">
                          Tú: {selectedExerciseRow.myStats.estimated1RMKg} kg
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {friendLabel}: {selectedExerciseRow.friendStats.estimated1RMKg} kg
                        </div>
                      </div>
                      <div className="rounded-lg bg-card border border-border/70 p-3">
                        <div className="text-[11px] text-muted-foreground font-semibold">Peso Máximo</div>
                        <div className="mt-1 font-bold text-blue-600 dark:text-blue-400">
                          Tú: {selectedExerciseRow.myStats.maxWeightKg} kg
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {friendLabel}: {selectedExerciseRow.friendStats.maxWeightKg} kg
                        </div>
                      </div>
                      <div className="rounded-lg bg-card border border-border/70 p-3">
                        <div className="text-[11px] text-muted-foreground font-semibold">Mejor Serie</div>
                        <div className="mt-1 font-bold text-blue-600 dark:text-blue-400">
                          {selectedExerciseRow.myStats.bestSetLabel}
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedExerciseRow.friendStats.bestSetLabel}
                        </div>
                      </div>
                      <div className="rounded-lg bg-card border border-border/70 p-3">
                        <div className="text-[11px] text-muted-foreground font-semibold">Volumen Ejercicio</div>
                        <div className="mt-1 font-bold text-blue-600 dark:text-blue-400">
                          {selectedExerciseRow.myStats.totalVolumeKg.toLocaleString()} kg
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedExerciseRow.friendStats.totalVolumeKg.toLocaleString()} kg
                        </div>
                      </div>
                      <div className="rounded-lg bg-card border border-border/70 p-3 col-span-2 sm:col-span-1">
                        <div className="text-[11px] text-muted-foreground font-semibold">Series / Reps</div>
                        <div className="mt-1 font-bold text-blue-600 dark:text-blue-400">
                          {selectedExerciseRow.myStats.totalSets}s &bull; {selectedExerciseRow.myStats.totalReps}r
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedExerciseRow.friendStats.totalSets}s &bull; {selectedExerciseRow.friendStats.totalReps}r
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla Comparativa por Ejercicios (Mobile-First sticky) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Desglose Comparativo por Ejercicios ({filteredRows.length})
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/70 text-xs">
                        <button
                          type="button"
                          onClick={() => setCompareFilterMode('all')}
                          className={`px-2.5 py-1 rounded-md font-semibold ${
                            compareFilterMode === 'all'
                              ? 'bg-card text-foreground shadow-2xs'
                              : 'text-muted-foreground'
                          }`}
                        >
                          Todos ({headToHeadData.exercises.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareFilterMode('shared')}
                          className={`px-2.5 py-1 rounded-md font-semibold ${
                            compareFilterMode === 'shared'
                              ? 'bg-card text-foreground shadow-2xs'
                              : 'text-muted-foreground'
                          }`}
                        >
                          Solo en común ({sharedCount})
                        </button>
                      </div>

                      <input
                        type="text"
                        value={compareSearch}
                        onChange={(e) => setCompareSearch(e.target.value)}
                        placeholder="Filtrar ejercicio..."
                        className="min-h-[38px] px-3 py-1.5 text-base sm:text-xs bg-background border border-border/80 rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2.5 px-3 font-bold sticky left-0 z-10 bg-muted/95 backdrop-blur-xs min-w-[175px]">
                            Ejercicio
                          </th>
                          <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                            1RM (Tú / {friendLabel})
                          </th>
                          <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                            Peso Máx.
                          </th>
                          <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                            Volumen Total
                          </th>
                          <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">
                            Series
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 tabular-nums">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              No hay ejercicios que coincidan con el filtro actual.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => (
                            <tr
                              key={row.exerciseKey}
                              onClick={() => setCompareExerciseKey(row.exerciseKey)}
                              className={`cursor-pointer transition-colors hover:bg-muted/35 ${
                                selectedExerciseRow?.exerciseKey === row.exerciseKey
                                  ? 'bg-blue-500/5'
                                  : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-semibold text-foreground sticky left-0 z-10 bg-card shadow-[2px_0_6px_-2px_rgba(15,23,42,0.08)]">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate max-w-[165px]">{row.exerciseTitle}</span>
                                  {row.isShared && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold shrink-0">
                                      Común
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                  {row.myStats.estimated1RMKg}
                                </span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {row.friendStats.estimated1RMKg}
                                </span>
                                <span className="text-muted-foreground ml-0.5">kg</span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {row.myStats.maxWeightKg}
                                </span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {row.friendStats.maxWeightKg}
                                </span>
                                <span className="text-muted-foreground ml-0.5">kg</span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {row.myStats.totalVolumeKg.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {row.friendStats.totalVolumeKg.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground ml-0.5">kg</span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                  {row.myStats.totalSets}
                                </span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {row.friendStats.totalSets}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* CONTENIDO 3: AMIGOS Y BÚSQUEDA */}
      {activeTab === 'friends' && (
        <div className="space-y-5">
          {/* Formulario de Búsqueda */}
          <div className="bg-card rounded-xl border border-border/80 p-4 shadow-xs">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Buscar Atletas por Código de Amigo o Usuario
            </h4>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ej: nacho_fit o código de 8 caracteres..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 text-base sm:text-sm bg-background text-foreground placeholder:text-muted-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="min-h-[42px] px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-lg transition-all"
              >
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {searchFeedback && (
              <div className="mt-2 text-xs text-muted-foreground font-medium">
                {searchFeedback}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="p-3 rounded-lg border border-border/70 bg-muted/35 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-foreground text-sm">{user.display_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">@{user.username}</div>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequest(user.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Añadir Amigo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solicitudes Pendientes */}
          {pendingRequests.length > 0 && (
            <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">Solicitudes de Amistad Recibidas</h4>
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-card p-3 rounded-lg border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-foreground text-sm">{req.friend.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{req.friend.username}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespondFriend(req.id, true)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleRespondFriend(req.id, false)}
                      className="px-2.5 py-1 bg-muted hover:bg-accent text-foreground border border-border/60 text-xs font-semibold rounded-md"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de Amigos Aceptados */}
          <div className="bg-card rounded-xl border border-border/80 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tus Amigos de Entrenamiento ({acceptedFriends.length})
            </h4>
            {acceptedFriends.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Aún no tienes amigos añadidos. Pídele a tu amigo su código de atleta o compártele el tuyo.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {acceptedFriends.map(f => (
                  <div key={f.friend.id} className="p-3 rounded-lg border border-border/70 bg-muted/35 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground text-sm">{f.friend.display_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">@{f.friend.username}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Conectado
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Crear Reto */}
      {isCreateChallengeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card text-foreground rounded-2xl border border-border/80 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/25 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Swords className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Crear Reto de Gimnasio</h3>
                  <p className="text-xs text-muted-foreground">Lanza un duelo directo a tu compañero</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateChallengeOpen(false)}
                aria-label="Cerrar"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground/80 mb-1">Rival a Retar</label>
                <select
                  required
                  value={selectedFriendId}
                  onChange={e => setSelectedFriendId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  <option value="">Selecciona un amigo...</option>
                  {acceptedFriends.map(f => (
                    <option key={f.friend.id} value={f.friend.id}>
                      {f.friend.display_name} (@{f.friend.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground/80 mb-1">Tipo de Competición</label>
                <select
                  value={challengeMetric}
                  onChange={e => setChallengeMetric(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  <option value="estimated_1rm">Duelo de 1RM (Fuerza Máxima)</option>
                  <option value="max_weight">Duelo de Peso Levantado</option>
                  <option value="total_volume">Duelo de Volumen Semanal (Tonelaje)</option>
                  <option value="sessions_count">Reto de Constancia (Sesiones hechas)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground/80 mb-1">Ejercicio en Disputa</label>
                <select
                  value={challengeExercise}
                  onChange={e => setChallengeExercise(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  {EXERCISE_CATALOG.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground/80 mb-1">Duración del Reto</label>
                <select
                  value={challengeDuration}
                  onChange={e => setChallengeDuration(parseInt(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background text-foreground border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  <option value={7}>7 días (1 semana)</option>
                  <option value={14}>14 días (2 semanas)</option>
                  <option value={30}>30 días (1 mes)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!selectedFriendId}
                className="w-full min-h-[42px] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 mt-2"
              >
                Lanzar Duelo
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
