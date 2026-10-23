const fs = require('fs');
const path = require('path');
const { Encoder, Decoder, Stream, Profile } = require('@garmin/fitsdk');

// Catálogo de Ejercicios de Referencia rápida (IDs oficiales del FIT SDK)
const EXERCISE_MAP = {
  bench_press_barbell: { category: 0, exerciseName: 1, label: 'Press Banca con Barra' },
  squat_barbell: { category: 28, exerciseName: 6, label: 'Sentadilla Trasera con Barra' },
  deadlift_barbell: { category: 8, exerciseName: 0, label: 'Peso Muerto con Barra' },
  shoulder_press_barbell: { category: 24, exerciseName: 4, label: 'Press Militar de Hombros' },
  row_cable_seated: { category: 23, exerciseName: 1, label: 'Remo en Polea' },
  pull_up: { category: 21, exerciseName: 0, label: 'Dominadas' },
  biceps_curl_barbell: { category: 7, exerciseName: 3, label: 'Curl de Bíceps con Barra' },
  triceps_cable_pushdown: { category: 30, exerciseName: 4, label: 'Extensión de Tríceps en Polea' }
};

/**
 * Genera un archivo binario .FIT de entrenamiento de fuerza nativo compatible con Garmin Fénix 8
 */
function createStrengthWorkoutFit(options = {}) {
  const workoutName = (options.name || 'Fuerza Test F8').slice(0, 16);
  const outputFile = options.outputFile || path.join(__dirname, 'Fuerza_Test_F8.fit');

  const encoder = new Encoder();

  // 1. Cabecera FILE_ID (Obligatoria)
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'workout',
    manufacturer: 'development',
    product: 0,
    serialNumber: Math.floor(Math.random() * 1000000) + 100000,
    timeCreated: new Date()
  });

  // Definición de las fases del entrenamiento
  const workoutDefinition = [
    // Calentamiento
    {
      type: 'warmup',
      name: 'Calentamiento',
      durationSeconds: 300 // 5 min
    },
    // Ejercicio 1: Press de Banca (3 series x 8 reps @ 80kg con 90s descanso)
    {
      type: 'exercise',
      exerciseKey: 'bench_press_barbell',
      sets: 3,
      reps: 8,
      weightKg: 80.0,
      restSeconds: 90
    },
    // Ejercicio 2: Sentadilla con Barra (3 series x 10 reps @ 100kg con 120s descanso)
    {
      type: 'exercise',
      exerciseKey: 'squat_barbell',
      sets: 3,
      reps: 10,
      weightKg: 100.0,
      restSeconds: 120
    },
    // Enfriamiento
    {
      type: 'cooldown',
      name: 'Estiramientos',
      durationSeconds: 180 // 3 min
    }
  ];

  // Aplanar la rutina a una lista secuencial de pasos para Garmin
  const steps = [];

  for (const block of workoutDefinition) {
    if (block.type === 'warmup') {
      steps.push({
        stepName: block.name.slice(0, 16),
        intensity: 'warmup',
        durationType: 'time',
        durationValue: block.durationSeconds * 1000 // ms
      });
    } else if (block.type === 'cooldown') {
      steps.push({
        stepName: block.name.slice(0, 16),
        intensity: 'cooldown',
        durationType: 'time',
        durationValue: block.durationSeconds * 1000 // ms
      });
    } else if (block.type === 'exercise') {
      const exerciseInfo = EXERCISE_MAP[block.exerciseKey];
      for (let s = 1; s <= block.sets; s++) {
        // Paso activo de la serie
        steps.push({
          stepName: `S${s} ${block.reps}r ${block.weightKg}k`.slice(0, 16),
          intensity: 'active',
          durationType: 'reps',
          durationValue: block.reps,
          exerciseCategory: exerciseInfo.category,
          exerciseName: exerciseInfo.exerciseName,
          exerciseWeight: block.weightKg
        });

        // Paso de descanso posterior a la serie
        steps.push({
          stepName: `Descanso S${s}`.slice(0, 16),
          intensity: 'rest',
          durationType: 'time',
          durationValue: block.restSeconds * 1000 // ms
        });
      }
    }
  }

  // 2. Mensaje WORKOUT
  encoder.onMesg(Profile.MesgNum.WORKOUT, {
    wktName: workoutName,
    sport: 'training',
    subSport: 'strengthTraining',
    numValidSteps: steps.length
  });

  // 3. Mensajes WORKOUT_STEP
  steps.forEach((step, index) => {
    const stepMessage = {
      messageIndex: index,
      wktStepName: step.stepName,
      durationType: step.durationType,
      durationValue: step.durationValue,
      targetType: 'open',
      targetValue: 0,
      intensity: step.intensity
    };

    if (step.intensity === 'active') {
      stepMessage.exerciseCategory = step.exerciseCategory;
      stepMessage.exerciseName = step.exerciseName;
      if (step.exerciseWeight !== undefined) {
        stepMessage.exerciseWeight = step.exerciseWeight;
      }
    }

    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, stepMessage);
  });

  // Cerrar y generar el Uint8Array
  const fitBytes = encoder.close();
  fs.writeFileSync(outputFile, fitBytes);

  console.log(`\n✅ Archivo .FIT generado con éxito:`);
  console.log(`   Ruta: ${outputFile}`);
  console.log(`   Tamaño: ${fitBytes.length} bytes`);
  console.log(`   Pasos totales de la sesión: ${steps.length}`);

  // Auto-verificación mediante decodificador
  const stream = Stream.fromByteArray(fitBytes);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read();

  if (errors.length > 0) {
    console.error('⚠️ Advertencias durante la verificación del archivo:', errors);
  } else {
    console.log(`   Verificación FIT: 100% Válido (0 errores de integridad).`);
  }

  return outputFile;
}

// Ejecutar si se invoca directamente
if (require.main === module) {
  createStrengthWorkoutFit();
}

module.exports = { createStrengthWorkoutFit, EXERCISE_MAP };
