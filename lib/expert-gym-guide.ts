import { CatalogExercise, EquipmentType, EXERCISE_CATALOG, MuscleGroup } from './exercise-catalog';

export type ExpertTier = 'S' | 'A';

export interface ExpertExerciseTip {
  exerciseId: string;
  tier: ExpertTier;
  machineLabel: string; // Nombre exacto de la máquina o estación en el gimnasio
  primaryFocus: string; // Submúsculo principal trabajado
  biomechanicalReason: string; // Por qué es de los mejores según ciencia/biomecánica
  executionCues: string[]; // 2-3 claves técnicas de ejecución
  recommendedSets: number;
  recommendedReps: string; // ej. "8-12"
  defaultRepsNumber: number; // Valor numérico por defecto al añadir a rutina
  recommendedRestSeconds: number;
}

export interface EnrichedExpertExercise extends ExpertExerciseTip {
  catalogExercise: CatalogExercise;
}

const EXPERT_TIPS_DATA: ExpertExerciseTip[] = [
  // ==========================================
  // PECHO
  // ==========================================
  {
    exerciseId: 'bench_press_incline_dumbbell',
    tier: 'S',
    machineLabel: 'Banco Inclinado (30°) + Mancuernas',
    primaryFocus: 'Pectoral Superior (Haz Clavicular)',
    biomechanicalReason:
      'La inclinación de 30° alinea perfectamente las fibras claviculares con el vector de fuerza, y las mancuernas permiten mayor convergencia y estiramiento profundo que la barra.',
    executionCues: [
      'Ajusta el banco a 30° (no a 45° para evitar exceso de deltoides anterior).',
      'Desciende controlando 2-3 segundos hasta notar estiramiento en la axila.',
      'Empuja en arco suave convergiendo hacia el centro sin chocar las mancuernas.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'incline_chest_press_machine',
    tier: 'S',
    machineLabel: 'Máquina Inclinada / Multipower (Smith)',
    primaryFocus: 'Pectoral Superior y Medio',
    biomechanicalReason:
      'Al eliminar la necesidad de estabilizar la carga, permite aplicar el 100% del esfuerzo neural al pectoral y llegar al fallo mecánico con total seguridad.',
    executionCues: [
      'Retrae y deprime las escápulas contra el respaldo antes de iniciar.',
      'Mantén los codos a ~45° respecto al torso (nunca abiertos a 90°).',
      'Pausa de 1 segundo en el punto de máximo estiramiento.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'pec_deck_machine',
    tier: 'S',
    machineLabel: 'Máquina Peck Deck / Contractora',
    primaryFocus: 'Pectoral Medio (Aducción Horizontal)',
    biomechanicalReason:
      'Ofrece tensión mecánica constante durante todo el rango de movimiento, especialmente en la fase final de acortamiento donde los presses libres pierden resistencia.',
    executionCues: [
      'Ajusta el asiento para que los agarres queden a la altura de la línea media del pecho.',
      'Piensa en juntar los bíceps hacia el centro, no solo las manos.',
      'Controla el retorno sin dejar que los hombros se adelanten.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'cable_crossover_chest',
    tier: 'A',
    machineLabel: 'Cruce de Poleas (Doble Polea)',
    primaryFocus: 'Pectoral Esternal e Inferior',
    biomechanicalReason:
      'Las poleas mantienen el vector de resistencia perpendicular al brazo durante todo el recorrido, generando tensión continua desde el estiramiento hasta la contracción pico.',
    executionCues: [
      'Da un paso al frente para estabilizar el torso y saca pecho.',
      'Mantén una ligera flexión fija en los codos durante toda la serie.',
      'Cruza ligeramente las manos al final para maximizar la aducción.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 75
  },
  {
    exerciseId: 'bench_press_barbell',
    tier: 'A',
    machineLabel: 'Banco Plano + Rack de Barra',
    primaryFocus: 'Pectoral Global (Fuerza Base)',
    biomechanicalReason:
      'Estándar de oro para la sobrecarga progresiva en empuje horizontal; permite mover las mayores cargas absolutas estimulando alta tensión mecánica.',
    executionCues: [
      'Fija los pies al suelo (leg drive) y mantén un ligero arco lumbar natural.',
      'Baja la barra a la altura del esternón inferior/pezones.',
      'Empuja de forma explosiva manteniendo las muñecas neutras.'
    ],
    recommendedSets: 4,
    recommendedReps: '5-8',
    defaultRepsNumber: 6,
    recommendedRestSeconds: 150
  },
  {
    exerciseId: 'dips_chest',
    tier: 'A',
    machineLabel: 'Estación de Fondos / Paralelas',
    primaryFocus: 'Pectoral Inferior y Esternal',
    biomechanicalReason:
      'Ejercicio en cadena cinética cerrada que permite un estiramiento profundo del pectoral inferior bajo carga corporal o lastrada.',
    executionCues: [
      'Inclina el torso unos 25-30° hacia adelante y lleva las rodillas ligeramente atrás.',
      'Deja que los codos se abran ligeramente en lugar de pegarlos al cuerpo.',
      'Baja hasta que el hombro quede ligeramente por debajo del codo.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },

  // ==========================================
  // ESPALDA
  // ==========================================
  {
    exerciseId: 'lat_pulldown_wide',
    tier: 'S',
    machineLabel: 'Torre de Polea Alta (Jalón)',
    primaryFocus: 'Dorsal Ancho (Amplitud)',
    biomechanicalReason:
      'Permite ajustar el peso con precisión milimétrica y fija la pelvis mediante los rodillos, aislando la tracción vertical del dorsal mejor que las dominadas si te fatigas rápido.',
    executionCues: [
      'Usa un agarre ligeramente superior al ancho de hombros.',
      'Inicia el movimiento deprimiendo los hombros antes de doblar los codos.',
      'Lleva la barra hacia la parte superior del pecho sin balancearte atrás.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'seated_cable_row',
    tier: 'S',
    machineLabel: 'Polea Baja (Remo Gironda / Triángulo)',
    primaryFocus: 'Espalda Media, Romboides y Dorsal',
    biomechanicalReason:
      'Aporta tensión constante en tracción horizontal. La posición sentada y el apoyo de pies permiten trabajar la retracción escapular con control total.',
    executionCues: [
      'Permite que las escápulas se estiren hacia adelante en cada repetición sin curvar la lumbar.',
      'Tracciona llevando los codos cerca del cuerpo hacia la zona del ombligo.',
      'Mantén 1 segundo la contracción atrás juntando los omóplatos.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'chest_supported_dumbbell_row',
    tier: 'S',
    machineLabel: 'Banco Inclinado (Apoyo en Pecho) + Mancuernas',
    primaryFocus: 'Trapecio Medio, Romboides y Dorsal',
    biomechanicalReason:
      'Al apoyar el pecho en el banco, eliminas por completo el estrés y fatiga de los erectores espinales, dirigiendo el 100% del estímulo a la musculatura alta de la espalda.',
    executionCues: [
      'Coloca el banco a 30-45° y apoya el esternón cómodamente.',
      'Tira de las mancuernas hacia las caderas para dorsal o a 45° para espalda alta.',
      'Evita encoger los hombros hacia las orejas.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'machine_row',
    tier: 'S',
    machineLabel: 'Máquina de Remo Convergente (Hammer / Placas)',
    primaryFocus: 'Dorsal Ancho y Espalda Media',
    biomechanicalReason:
      'El soporte pectoral integrado y la trayectoria convergente guiada ofrecen máxima estabilidad para cargas elevadas y series intensas.',
    executionCues: [
      'Ajusta el asiento para que los agarres alineen con la parte baja del pecho.',
      'Sujeta el torso firme contra la almohadilla sin separarlo al tirar.',
      'Extiende por completo los brazos al volver para aprovechar la fase excéntrica.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'pull_up',
    tier: 'A',
    machineLabel: 'Barra de Dominadas / Jaula',
    primaryFocus: 'Dorsal Ancho y Redondo Mayor',
    biomechanicalReason:
      'Patrón compuesto de tracción vertical de cadena cerrada que exige máxima coordinación neuromuscular y potencia relativa.',
    executionCues: [
      'Arranca desde extensión completa (dead hang) sin impulso de piernas.',
      'Saca el pecho hacia la barra en la parte alta del recorrido.',
      'Controla la bajada durante al menos 2 segundos.'
    ],
    recommendedSets: 3,
    recommendedReps: '6-10',
    defaultRepsNumber: 8,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'straight_arm_pulldown',
    tier: 'A',
    machineLabel: 'Polea Alta (Barra Recta o Cuerda)',
    primaryFocus: 'Dorsal Ancho (Aislamiento sin Bíceps)',
    biomechanicalReason:
      'Único ejercicio multiarticular-aislado de extensión de hombro sin flexión de codo, evitando que el bíceps limite la fatiga del dorsal.',
    executionCues: [
      'Inclina el torso unos 30° y mantén los brazos casi rectos (codos bloqueados suavemente).',
      'Empuja la barra en arco hacia tus muslos pensando en llevar las axilas hacia atrás.',
      'Sube lento sintiendo el estiramiento completo arriba.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },

  // ==========================================
  // PIERNAS
  // ==========================================
  {
    exerciseId: 'hack_squat_machine',
    tier: 'S',
    machineLabel: 'Máquina Hack Squat (Sentadilla Hack)',
    primaryFocus: 'Cuádriceps (Vasto Lateral y Medial)',
    biomechanicalReason:
      'El rey de las máquinas para cuádriceps: el respaldo fijo elimina la limitación lumbar y permite máxima flexión de rodilla profunda con sobrecarga brutal.',
    executionCues: [
      'Coloca los pies en la parte baja de la plataforma para maximizar el recorrido de rodilla.',
      'Desciende profundo manteniendo la espalda baja y glúteos pegados al respaldo.',
      'Empuja el carro hacia arriba a través de todo el pie.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 150
  },
  {
    exerciseId: 'leg_press',
    tier: 'S',
    machineLabel: 'Prensa Inclinada 45° / Horizontal',
    primaryFocus: 'Cuádriceps y Glúteo Mayor',
    biomechanicalReason:
      'Máxima estabilidad para mover grandes kilajes sin fatiga del sistema nervioso central ni compresión de columna vertebral.',
    executionCues: [
      'No despegues el sacro ni la zona lumbar del asiento al bajar (detente justo antes).',
      'Alinea las rodillas con las puntas de los pies sin que colapsen hacia adentro.',
      'Evita bloquear por completo las rodillas al extender.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'seated_leg_curl_machine',
    tier: 'S',
    machineLabel: 'Máquina Curl Femoral Sentado',
    primaryFocus: 'Isquiosurales (Hipertrofia en Estiramiento)',
    biomechanicalReason:
      'Estudios comparativos demuestran mayor hipertrofia que el curl tumbado porque la cadera flexionada coloca a los isquios en mayor longitud inicial.',
    executionCues: [
      'Fija firmemente la almohadilla sobre los muslos para que no se eleven al flexionar.',
      'Flexiona de forma explosiva hasta el máximo rango posible.',
      'Retorna en 2-3 segundos resistiendo la subida.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 90
  },
  {
    exerciseId: 'leg_extension_machine',
    tier: 'S',
    machineLabel: 'Máquina Extensión de Cuádriceps',
    primaryFocus: 'Cuádriceps (Recto Femoral)',
    biomechanicalReason:
      'Al no haber extensión simultánea de cadera, es el único ejercicio que entrena eficazmente el recto femoral en todo su rango de acortamiento.',
    executionCues: [
      'Alinea el eje de rotación de tu rodilla con el eje mecánico de la máquina.',
      'Sujeta las asas laterales firmemente para fijar la cadera al asiento.',
      'Aguanta 1 segundo arriba con máxima contracción.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 75
  },
  {
    exerciseId: 'hip_thrust_barbell',
    tier: 'S',
    machineLabel: 'Estación Hip Thrust / Barra + Banco',
    primaryFocus: 'Glúteo Mayor',
    biomechanicalReason:
      'Genera la mayor activación electromiográfica del glúteo mayor gracias al pico de resistencia en la extensión completa de cadera.',
    executionCues: [
      'Apoya la parte inferior de las escápulas en el banco y mira al frente (mentón recogido).',
      'En la parte alta, las tibias deben quedar verticales a 90°.',
      'Realiza una retroversión pélvica al final apretando fuerte los glúteos 1 segundo.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'romanian_deadlift_dumbbell',
    tier: 'S',
    machineLabel: 'Mancuernas (Peso Muerto Rumano)',
    primaryFocus: 'Isquiosurales y Glúteos (Bisagra de Cadera)',
    biomechanicalReason:
      'Trabaja la cadena posterior bajo máxima tensión en estiramiento; las mancuernas permiten ajustar el centro de gravedad pegado al cuerpo.',
    executionCues: [
      'Inicia empujando la cadera hacia atrás como queriendo cerrar una puerta con el glúteo.',
      'Mantén las rodillas semiflexionadas pero fijas y la espalda totalmente neutra.',
      'Desciende solo hasta donde tu cadera deje de retroceder (mitad de tibia aprox.).'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'squat_back_barbell',
    tier: 'A',
    machineLabel: 'Jaula de Potencia + Barra',
    primaryFocus: 'Cuádriceps, Glúteos y Core',
    biomechanicalReason:
      'El patrón de sentadilla libre más completo para fuerza global del tren inferior y densidad ósea.',
    executionCues: [
      'Toma aire profundo hacia el abdomen (bracing) antes de cada repetición.',
      'Desciende rompiendo el paralelo mientras las rodillas siguen la línea de los dedos.',
      'Sube empujando el suelo y manteniendo el pecho alto.'
    ],
    recommendedSets: 4,
    recommendedReps: '5-8',
    defaultRepsNumber: 6,
    recommendedRestSeconds: 180
  },
  {
    exerciseId: 'calf_raise_standing',
    tier: 'S',
    machineLabel: 'Máquina de Gemelos de Pie / Multipower',
    primaryFocus: 'Gastrocnemio',
    biomechanicalReason:
      'Con la rodilla extendida se reclutan al máximo las dos cabezas del gastrocnemio, a diferencia del gemelo sentado que prioriza el sóleo.',
    executionCues: [
      'Pausa obligatoria de 2 segundos abajo en máximo estiramiento para anular el rebote del tendón de Aquiles.',
      'Sube todo lo posible sobre la punta del dedo gordo.',
      'Mantén las rodillas extendidas sin doblarlas en el empuje.'
    ],
    recommendedSets: 4,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 60
  },

  // ==========================================
  // HOMBROS
  // ==========================================
  {
    exerciseId: 'lateral_raise_cable',
    tier: 'S',
    machineLabel: 'Polea Baja (A una mano)',
    primaryFocus: 'Deltoides Lateral / Medio',
    biomechanicalReason:
      'Superior a la mancuerna en la fase inicial: coloca la polea a la altura de la muñeca/muslo para tener máxima tensión justo donde el deltoides lateral está más estirado.',
    executionCues: [
      'Colócate de lado a la polea pasando el cable por delante o detrás del cuerpo.',
      'Eleva el brazo en el plano escapular (~30° adelantado) pensando en alejar la mano de la pared.',
      'No encojas el trapecio superior.'
    ],
    recommendedSets: 4,
    recommendedReps: '12-15',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'lateral_raise_machine',
    tier: 'S',
    machineLabel: 'Máquina de Elevaciones Laterales',
    primaryFocus: 'Deltoides Lateral / Medio',
    biomechanicalReason:
      'Ofrece una curva de resistencia uniforme gracias a la leva de la máquina y elimina el balanceo del torso, ideal para series intensas y drop sets.',
    executionCues: [
      'Ajusta el asiento para que la almohadilla empuje justo por encima del codo.',
      'Empuja con los codos hacia los lados, manteniendo los hombros bajos.',
      'Controla la bajada sin dejar caer las placas.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'shoulder_press_machine',
    tier: 'S',
    machineLabel: 'Máquina Press de Hombros Sentado',
    primaryFocus: 'Deltoides Anterior y Medio',
    biomechanicalReason:
      'El respaldo vertical brinda estabilidad absoluta para progresar con cargas altas en empuje vertical sin riesgo de hiperextensión lumbar.',
    executionCues: [
      'Ajusta el asiento para que los agarres queden a la altura de tus orejas/hombros.',
      'Mantén los codos ligeramente por delante del plano del torso.',
      'Empuja hasta casi bloquear arriba sin perder tensión.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'dumbbell_shoulder_press',
    tier: 'A',
    machineLabel: 'Banco Vertical (75-80°) + Mancuernas',
    primaryFocus: 'Deltoides Anterior y Estabilizadores',
    biomechanicalReason:
      'Mayor libertad articular que la barra fija; permite rotar naturalmente las muñecas y trabajar en el plano escapular protegiendo el hombro.',
    executionCues: [
      'Coloca el respaldo un punto por debajo de 90° (aprox. 75-80°).',
      'Baja las mancuernas hasta rozar la altura de los hombros/orejas.',
      'Aprieta el abdomen para no despegar la espalda baja del banco.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 120
  },
  {
    exerciseId: 'rear_delt_fly_machine',
    tier: 'S',
    machineLabel: 'Máquina Peck Deck Inverso (Pájaros)',
    primaryFocus: 'Deltoides Posterior',
    biomechanicalReason:
      'La forma más estable y reproducible de aislar la porción posterior del deltoides con tensión continua en todo el arco.',
    executionCues: [
      'Usa el agarre neutro o prono con los brazos casi estirados.',
      'Barre hacia atrás manteniendo los omóplatos relativamente quietos (no remes con la espalda).',
      'Detente cuando el brazo esté alineado con el torso.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'face_pull',
    tier: 'A',
    machineLabel: 'Polea Alta con Cuerda',
    primaryFocus: 'Deltoides Posterior y Rotadores Externos',
    biomechanicalReason:
      'Combina abducción horizontal y rotación externa, siendo clave tanto para la estética 3D del hombro como para prevenir pinzamientos.',
    executionCues: [
      'Coloca la polea a la altura de la cara y tira de la cuerda separando las manos hacia las orejas.',
      'Termina con los nudillos apuntando hacia atrás (pose de doble bíceps).',
      'Controla cada repetición sin usar peso excesivo.'
    ],
    recommendedSets: 3,
    recommendedReps: '15-20',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },

  // ==========================================
  // BRAZOS (BÍCEPS Y TRÍCEPS)
  // ==========================================
  {
    exerciseId: 'incline_dumbbell_curl',
    tier: 'S',
    machineLabel: 'Banco Inclinado (45-60°) + Mancuernas',
    primaryFocus: 'Bíceps (Cabeza Larga en Estiramiento)',
    biomechanicalReason:
      'Al llevar los brazos por detrás del torso, la cabeza larga del bíceps se estira al máximo bajo carga, generando un estímulo hipertrófico superior.',
    executionCues: [
      'Deja colgar los brazos perpendiculares al suelo manteniendo los codos fijos atrás.',
      'Supina (gira la palma hacia arriba) al subir y aprieta fuerte arriba.',
      'Evita adelantar el codo al iniciar la flexión.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 75
  },
  {
    exerciseId: 'preacher_curl_ez_bar',
    tier: 'S',
    machineLabel: 'Banco Scott + Barra Z',
    primaryFocus: 'Bíceps Braquial (Torque Inicial)',
    biomechanicalReason:
      'Anula por completo el impulso del torso y sitúa la mayor resistencia en el primer tercio de la flexión, logrando máxima tensión en estiramiento.',
    executionCues: [
      'Apoya la parte posterior de los brazos firme contra la almohadilla sin levantar los codos.',
      'Desciende controladamente hasta casi extender el brazo sin hiperextender.',
      'La barra Z alivia la tensión en muñecas y antebrazos.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 75
  },
  {
    exerciseId: 'cable_biceps_curl',
    tier: 'S',
    machineLabel: 'Polea Baja (Barra Recta / Z)',
    primaryFocus: 'Bíceps (Tensión Constante)',
    biomechanicalReason:
      'A diferencia del peso libre, el cable mantiene la tensión muscular intacta tanto en el punto inferior como en la contracción máxima superior.',
    executionCues: [
      'Da un pequeño paso atrás para que haya tensión desde el grado cero.',
      'Mantén los codos pegados a los costados.',
      'Baja en 2-3 segundos sin soltar el peso de golpe.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'hammer_curl_dumbbell',
    tier: 'A',
    machineLabel: 'Mancuernas (Agarre Neutro)',
    primaryFocus: 'Braquial Anterior y Braquiorradial',
    biomechanicalReason:
      'El agarre neutro potencia la activación del músculo braquial (situado bajo el bíceps), empujando al bíceps hacia afuera y dando mayor grosor al brazo.',
    executionCues: [
      'Mantén las palmas mirándose entre sí durante todo el recorrido.',
      'Evita balancear la espalda o los hombros.',
      'Controla la bajada hasta la extensión total.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-12',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'triceps_overhead_cable',
    tier: 'S',
    machineLabel: 'Polea (Extensión sobre la Cabeza con Cuerda)',
    primaryFocus: 'Tríceps (Cabeza Larga)',
    biomechanicalReason:
      'La flexión del hombro por encima de la cabeza coloca a la cabeza larga del tríceps en estiramiento máximo, logrando hasta un ~40% más de hipertrofia que solo empujes hacia abajo.',
    executionCues: [
      'Inclínate ligeramente hacia adelante y fija los codos apuntando hacia arriba/adelante.',
      'Deja que las manos bajen detrás de la nuca sintiendo el estiramiento completo.',
      'Extiende por completo los codos apretando el tríceps.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 75
  },
  {
    exerciseId: 'triceps_pushdown_cable',
    tier: 'S',
    machineLabel: 'Polea Alta (Barra V o Cuerda)',
    primaryFocus: 'Tríceps (Cabezas Lateral y Medial)',
    biomechanicalReason:
      'Estabilidad total para las cabezas lateral y medial, sin estrés articular en los codos y con una curva de resistencia muy amigable.',
    executionCues: [
      'Fija los codos a los lados del torso sin moverlos hacia adelante o atrás.',
      'Extiende completamente hacia abajo bloqueando el codo un instante.',
      'Sube solo hasta que el antebrazo toque el bíceps (90-110°).'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 60
  },

  // ==========================================
  // CORE
  // ==========================================
  {
    exerciseId: 'cable_crunch',
    tier: 'S',
    machineLabel: 'Polea Alta con Cuerda (De Rodillas)',
    primaryFocus: 'Recto Abdominal (Sobrecarga Progresiva)',
    biomechanicalReason:
      'A diferencia de los abdominales en el suelo, permite añadir peso progresivamente en la polea para hipertrofiar realmente la pared abdominal.',
    executionCues: [
      'Fija la cadera: no te sientes sobre los talones al bajar; dobla solo la columna vertebral.',
      'Sujeta la cuerda junto a las sienes y lleva los codos hacia los muslos redondeando la espalda.',
      'Exhala todo el aire al contraer abajo.'
    ],
    recommendedSets: 3,
    recommendedReps: '12-15',
    defaultRepsNumber: 15,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'hanging_leg_raise',
    tier: 'S',
    machineLabel: 'Barra Fija o Soportes de Antebrazo',
    primaryFocus: 'Recto Abdominal Inferior y Flexores',
    biomechanicalReason:
      'Exige flexión pélvica real contra la gravedad, logrando una de las mayores activaciones del recto abdominal.',
    executionCues: [
      'No te limites a subir las piernas a 90°: debes enrollar la pelvis hacia arriba apuntando al techo.',
      'Evita el balanceo controlando la bajada de las piernas.',
      'Si cuesta recto, hazlo elevando rodillas al pecho con retroversión pélvica.'
    ],
    recommendedSets: 3,
    recommendedReps: '10-15',
    defaultRepsNumber: 12,
    recommendedRestSeconds: 60
  },
  {
    exerciseId: 'ab_wheel_rollout',
    tier: 'A',
    machineLabel: 'Rueda Abdominal (Ab Wheel)',
    primaryFocus: 'Core Profundo (Anti-Extensión)',
    biomechanicalReason:
      'Genera altísima tensión en todo el cinturón abdominal y serratos protegiendo la columna mediante control anti-extensión.',
    executionCues: [
      'Mantén el glúteo apretado y retroversión pélvica durante todo el movimiento.',
      'No dejes que la espalda baja se arquee al estirarte.',
      'Regresa tirando desde el abdomen, no solo con los brazos.'
    ],
    recommendedSets: 3,
    recommendedReps: '8-12',
    defaultRepsNumber: 10,
    recommendedRestSeconds: 60
  }
];

const catalogMap = new Map<string, CatalogExercise>(
  EXERCISE_CATALOG.map((ex) => [ex.id, ex])
);

/**
 * Devuelve todos los ejercicios recomendados por el experto en fitness y gimnasio,
 * enriquecidos con su objeto oficial del catálogo Garmin.
 */
export function getExpertGymExercises(): EnrichedExpertExercise[] {
  const result: EnrichedExpertExercise[] = [];
  for (const tip of EXPERT_TIPS_DATA) {
    const catalogExercise = catalogMap.get(tip.exerciseId);
    if (catalogExercise) {
      result.push({
        ...tip,
        catalogExercise,
      });
    }
  }
  return result;
}

export const EXPERT_MUSCLE_GROUPS: ('Todos' | MuscleGroup)[] = [
  'Todos',
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Brazos',
  'Core'
];

export const EXPERT_EQUIPMENT_FILTERS: ('Todas' | EquipmentType)[] = [
  'Todas',
  'Máquina',
  'Polea',
  'Barra',
  'Mancuernas',
  'Peso Corporal'
];
