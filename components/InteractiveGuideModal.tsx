'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Calendar,
  ChevronDown,
  ChevronUp,
  Cloud,
  Dumbbell,
  HelpCircle,
  Play,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Watch,
  X,
} from 'lucide-react';

export type GuideTargetAction =
  | 'builder'
  | 'live'
  | 'progress'
  | 'social'
  | 'generator'
  | 'weekly_plan'
  | 'garmin_auth';

interface InteractiveGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (target: GuideTargetAction) => void;
}

interface GuideModule {
  id: string;
  title: string;
  shortTitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  steps: string[];
  proTip: string;
  actionLabel: string;
  actionTarget: GuideTargetAction;
  keywords: string;
}

const GUIDE_MODULES: GuideModule[] = [
  {
    id: 'designer',
    title: 'Diseñador de Rutinas & Generador Científico (IA)',
    shortTitle: 'Diseñador e IA',
    badge: 'Paso 1 de 7',
    icon: Sparkles,
    summary:
      'Crea tus propias rutinas bloque a bloque o deja que el Generador Científico diseñe una sesión a medida usando solo las máquinas y pesas disponibles en tu gimnasio.',
    steps: [
      'Pulsa "Generador Científico" para describir qué quieres entrenar hoy (ej. "Pecho y espalda en 60 min") o configurar tu perfil en "Mi Gimnasio".',
      'Usa los botones de adaptación rápida (100% Hevy, 85% Amigo, 75%, +5 kg, -5 kg) para escalar todos los pesos al instante.',
      'Agrupa ejercicios seguidos en superserie o descarga el archivo .FIT / envíalo directo a tu reloj Garmin.',
    ],
    proTip:
      'Si marcas "Evitar fatiga lumbar" en Mi Gimnasio, el generador sustituye peso muerto y sentadilla libre por variantes estables en máquina.',
    actionLabel: 'Abrir Generador IA',
    actionTarget: 'generator',
    keywords: 'rutina generador ia barra mancuernas superserie fit hevy gimnasio',
  },
  {
    id: 'weekly',
    title: 'Planificador Semanal (Mesociclo)',
    shortTitle: 'Planificador',
    badge: 'Paso 2 de 7',
    icon: Calendar,
    summary:
      'Organiza toda tu semana de entrenamiento eligiendo exactamente de 2 a 6 días concretos en los que vas al gimnasio, tu división y duración.',
    steps: [
      'Abre "Plan Semanal" y marca los días exactos de la semana (ej. Lunes, Miércoles, Jueves y Sábado).',
      'Elige división (Automática, Torso/Pierna, Push/Pull/Legs o Full Body), objetivo y duración (45–90 min).',
      'Si te surge un imprevisto, usa el botón de intercambiar para mover la sesión de un día a otro o regenera solo un día suelto.',
    ],
    proTip:
      'Al activar "Adaptar al equipamiento de Mi Gimnasio", todas las sesiones de la semana usan únicamente tu material disponible y tus cargas conocidas.',
    actionLabel: 'Abrir Plan Semanal',
    actionTarget: 'weekly_plan',
    keywords: 'semana dias lunes martes torso pierna ppl mesociclo calendario mover',
  },
  {
    id: 'live',
    title: 'Entreno en Vivo & Progresión Automática',
    shortTitle: 'Entreno en Vivo',
    badge: 'Paso 3 de 7',
    icon: Play,
    summary:
      'Registra cada serie en tiempo real desde el móvil con temporizador de descanso sonoro, detección de récords (PR) y análisis objetivo al terminar.',
    steps: [
      'Entra en "Entreno en Vivo" con tu rutina cargada y pulsa "Iniciar Sesión".',
      'Marca cada serie completada para lanzar automáticamente el cronómetro de descanso y detectar si batiste récord de peso o volumen.',
      'Al finalizar, revisa el Análisis Objetivo Post-Sesión con cumplimiento, tonelaje, densidad y contexto de Garmin.',
    ],
    proTip:
      'Con "Progresión Auto" activada, la app guarda tu rendimiento y sugiere subidas graduales de carga en tu próxima sesión.',
    actionLabel: 'Ir a Entreno en Vivo',
    actionTarget: 'live',
    keywords: 'vivo cronometro descanso series pr record progresion feedback sonido',
  },
  {
    id: 'viewer3d',
    title: 'Visor Biomecánico 3D Interactivo',
    shortTitle: 'Visor 3D',
    badge: 'Paso 4 de 7',
    icon: Box,
    summary:
      'Consulta la técnica correcta de cualquier ejercicio en un modelo 3D interactivo que puedes girar 360° con el dedo o el ratón.',
    steps: [
      'Pulsa el botón 3D junto a cualquier ejercicio en el Diseñador o en Entreno en Vivo.',
      'Arrastra sobre el visor para rotar la cámara 360° y revisar la posición de espalda, pies, barra y codos.',
      'Alterna entre velocidad 0.5x y 1x o activa el resaltado azul del grupo muscular trabajado.',
    ],
    proTip:
      'Usa la velocidad 0.5x en cámara lenta para revisar la fase excéntrica (bajada) en sentadilla, press de banca y peso muerto.',
    actionLabel: 'Ver ejercicios en Diseñador',
    actionTarget: 'builder',
    keywords: '3d animacion tecnica postura biomecanica musculo camara rotar',
  },
  {
    id: 'garmin',
    title: 'Garmin Connect: Reloj, Multideporte, Sueño y HRV',
    shortTitle: 'Garmin y Salud',
    badge: 'Paso 5 de 7',
    icon: Watch,
    summary:
      'Conecta tu cuenta de Garmin (incluida verificación MFA) para enviar entrenamientos de fuerza al reloj y leer tu sueño, recuperación y resto de deportes.',
    steps: [
      'Pulsa "Conectar Garmin" arriba a la derecha e inicia sesión con tu cuenta de Garmin Connect.',
      'Desde el Diseñador pulsa "Enviar a mi Garmin" para mandar la rutina directa al reloj.',
      'En "Progreso & Métricas", pulsa "Sincronizar Garmin" para traer tu sueño, HRV, Body Battery y actividades (Running, Ciclismo, Natación...).',
    ],
    proTip:
      'Cuando sincronizas Garmin, el Generador IA adapta automáticamente las series y descansos si dormiste poco o acumulaste fatiga de piernas corriendo.',
    actionLabel: 'Conectar / Ver Garmin',
    actionTarget: 'garmin_auth',
    keywords: 'garmin reloj fenix sueno hrv body battery readiness running ciclismo natacion mfa',
  },
  {
    id: 'progress',
    title: 'Progreso, Métricas y Tendencias',
    shortTitle: 'Progreso',
    badge: 'Paso 6 de 7',
    icon: TrendingUp,
    summary:
      'Analiza tu evolución real con gráficos de tonelaje semanal, mapa de consistencia de 84 días, balance muscular y regresión lineal por ejercicio.',
    steps: [
      'Importa tu archivo workouts.csv de Hevy o sincroniza tu cuenta de Garmin en la pestaña "Progreso & Métricas".',
      'Revisa la Tendencia de Tonelaje Semanal y el Mapa de Consistencia (Fuerza en azul, Garmin cardio en verde, doble sesión en índigo).',
      'Elige cualquier ejercicio y filtra por 1M, 3M, 6M o Todo para ver su línea de tendencia y alertas de meseta.',
    ],
    proTip:
      'La línea verde discontinua en la gráfica muestra tu tendencia matemática real; si detecta 3 sesiones sin avance, te avisará de meseta.',
    actionLabel: 'Ir a Progreso & Métricas',
    actionTarget: 'progress',
    keywords: 'progreso graficas tendencias tonelaje consistencia heatmap meseta csv hevy 1rm',
  },
  {
    id: 'cloud',
    title: 'Nube (Supabase), Compartir y Amigos',
    shortTitle: 'Nube y Amigos',
    badge: 'Paso 7 de 7',
    icon: Users,
    summary:
      'Guarda tus rutinas en la nube, compártelas por enlace o con usuarios de Apple Watch, y compite con amigos en retos semanales.',
    steps: [
      'Inicia sesión arriba en "Iniciar Sesión" para sincronizar tus rutinas y perfil entre móvil y ordenador.',
      'Usa "Compartir" para copiar un enlace directo de tu rutina o exportarla en texto limpio.',
      'Entra en "Amigos & Retos" para añadir compañeros, comparar volumen y lanzar duelos.',
    ],
    proTip:
      'Aunque estés sin conexión o en modo local, IronSync guarda automáticamente todo en tu dispositivo para que nunca pierdas una sesión.',
    actionLabel: 'Ir a Amigos & Retos',
    actionTarget: 'social',
    keywords: 'nube supabase amigos retos compartir apple watch enlace cuenta login',
  },
];

const FAQS = [
  {
    q: '¿Qué pasa si no tengo reloj Garmin o no quiero conectar mi cuenta?',
    a: 'Puedes usar toda la aplicación sin conectar Garmin: diseñar rutinas, usar el Generador Científico, entrenar en vivo, ver el Visor 3D, descargar archivos .FIT manuales e importar tu CSV de Hevy.',
  },
  {
    q: '¿Mis rutinas se pierden si cierro el navegador sin iniciar sesión?',
    a: 'No. Todo se guarda automáticamente en el almacenamiento local del navegador. Iniciar sesión en la nube solo es necesario si quieres sincronizar entre varios dispositivos o usar Amigos y Retos.',
  },
  {
    q: '¿Cómo tiene en cuenta el entrenador si salí a correr o dormí mal?',
    a: 'Al pulsar "Sincronizar Garmin" en Progreso & Métricas, la app lee tu sueño, HRV, Body Battery y actividades de los últimos 14 días. Ese contexto se pasa automáticamente al Generador IA y al feedback post-sesión.',
  },
];

export function InteractiveGuideModal({
  isOpen,
  onClose,
  onNavigate,
}: InteractiveGuideModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GUIDE_MODULES;
    return GUIDE_MODULES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.keywords.includes(q)
    );
  }, [search]);

  if (!isOpen) return null;

  const activeModule =
    filteredModules[selectedIdx] || filteredModules[0] || GUIDE_MODULES[0];
  const activePos = filteredModules.findIndex((m) => m.id === activeModule.id);
  const ActiveIcon = activeModule.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card rounded-2xl border border-border/60 w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border/60 flex items-start justify-between gap-4 bg-muted/20">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-bold">
              <BookOpen className="w-3 h-3" />
              <span>Guía Interactiva de IronSync</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Todas las Funcionalidades Paso a Paso
            </h2>
            <p className="text-xs text-muted-foreground">
              Explora cada módulo, busca cualquier herramienta o salta directamente a probarla.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía interactiva"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIdx(0);
              }}
              placeholder="Buscar función (ej. 3D, Garmin, sueño, plan semanal, Hevy...)"
              className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-border/60 bg-muted/30 focus:bg-card text-base sm:text-xs text-foreground outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Selector horizontal de módulos */}
          {filteredModules.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {filteredModules.map((mod, idx) => {
                  const Icon = mod.icon;
                  const isActive = mod.id === activeModule.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-card text-muted-foreground border-border/60 hover:border-blue-300 hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{mod.shortTitle}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tarjeta del módulo activo */}
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center shrink-0">
                      <ActiveIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                        {activeModule.badge}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        {activeModule.title}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate(activeModule.actionTarget);
                    }}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition-all active:scale-[0.98]"
                  >
                    <span>{activeModule.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                  {activeModule.summary}
                </p>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cómo usarlo paso a paso
                  </div>
                  <div className="space-y-2">
                    {activeModule.steps.map((step, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card border border-border/60 text-xs text-foreground leading-relaxed"
                      >
                        <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3 flex items-start gap-2 text-xs text-emerald-900">
                  <Activity className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Consejo Pro:</strong> {activeModule.proTip}
                  </span>
                </div>

                {/* Navegación del tour */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <button
                    type="button"
                    disabled={activePos <= 0}
                    onClick={() => setSelectedIdx(Math.max(0, activePos - 1))}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-muted"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activePos + 1} / {filteredModules.length}
                  </span>
                  <button
                    type="button"
                    disabled={activePos >= filteredModules.length - 1}
                    onClick={() =>
                      setSelectedIdx(Math.min(filteredModules.length - 1, activePos + 1))
                    }
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-semibold text-foreground disabled:opacity-40 hover:bg-muted"
                  >
                    <span>Siguiente</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
              No se encontraron funcionalidades para &ldquo;{search}&rdquo;. Prueba con otro término.
            </div>
          )}

          {/* Preguntas Frecuentes */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Preguntas Frecuentes</span>
            </div>
            <div className="space-y-2">
              {FAQS.map((faq, idx) => {
                const open = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/60 bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(open ? null : idx)}
                      className="w-full min-h-[42px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-bold text-foreground hover:bg-muted/40"
                    >
                      <span>{faq.q}</span>
                      {open ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {open && (
                      <div className="px-3.5 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
