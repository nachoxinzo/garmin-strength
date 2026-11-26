'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Trophy,
  Swords,
  TrendingUp,
  UserPlus,
  Search,
  Check,
  X,
  Clock,
  Flame,
  Award,
  ArrowRight,
  Shield,
  Dumbbell,
  Share2
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
  compareExerciseWithFriend
} from '@/lib/social-service';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';

interface SocialDashboardProps {
  onOpenAuth: () => void;
}

export default function SocialDashboard({ onOpenAuth }: SocialDashboardProps) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [challenges, setChallenges] = useState<GymChallenge[]>([]);
  const [activeTab, setActiveTab] = useState<'challenges' | 'compare' | 'friends'>('challenges');

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
  const [compareExercise, setCompareExercise] = useState<string>('bench_press_barbell');
  const [comparisonData, setComparisonData] = useState<{ userLogs: any[]; friendLogs: any[] } | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const profile = await getCurrentUserProfile();
    setCurrentUser(profile);
    if (profile) {
      const friends = await getFriendships();
      setFriendships(friends);
      const chs = await getChallenges();
      setChallenges(chs);
      const accepted = friends.filter(f => f.status === 'accepted');
      if (accepted.length > 0 && !compareFriendId) {
        setCompareFriendId(accepted[0].friend.id);
      }
    }
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

  // Cargar comparativa cuando cambie amigo o ejercicio
  useEffect(() => {
    async function fetchCompare() {
      if (!compareFriendId || !compareExercise) return;
      const ex = EXERCISE_CATALOG.find(e => e.id === compareExercise);
      if (!ex) return;
      const data = await compareExerciseWithFriend(ex.name, compareFriendId);
      setComparisonData(data);
    }
    fetchCompare();
  }, [compareFriendId, compareExercise]);

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
      <div className="flex border-b border-border/80 gap-6 text-sm font-semibold overflow-x-auto">
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
          <span>Gráfica Cara a Cara</span>
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

      {/* CONTENIDO 2: COMPARADOR CARA A CARA */}
      {activeTab === 'compare' && (
        <div className="bg-card rounded-xl border border-border/80 p-5 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Seleccionar Compañero
              </label>
              <select
                value={compareFriendId}
                onChange={e => setCompareFriendId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                {acceptedFriends.map(f => (
                  <option key={f.friend.id} value={f.friend.id}>
                    {f.friend.display_name} (@{f.friend.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ejercicio a Comparar
              </label>
              <select
                value={compareExercise}
                onChange={e => setCompareExercise(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-base sm:text-sm bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                {EXERCISE_CATALOG.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Gráfica Comparativa */}
          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                  <span>Tú ({currentUser.display_name})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span>Amigo</span>
                </div>
              </div>
            </div>

            {!comparisonData || (comparisonData.userLogs.length === 0 && comparisonData.friendLogs.length === 0) ? (
              <div className="h-48 rounded-xl bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs p-4 text-center">
                <Dumbbell className="w-8 h-8 mb-2 text-muted-foreground/50" />
                <span>No hay registros suficientes registrados en la nube para este ejercicio aún.</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Entrenad y guardad vuestros registros en Supabase para ver la comparativa.</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/25">
                    <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">Tus Registros</div>
                    <div className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1 tabular-nums">
                      {comparisonData.userLogs.length} series
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Registros de tu Amigo</div>
                    <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1 tabular-nums">
                      {comparisonData.friendLogs.length} series
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
