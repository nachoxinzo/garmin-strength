import { matchHevyExerciseToGarmin } from './hevy-mapper';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

export interface ParsedHevyWorkout {
  id: string;
  name: string;
  date: string;
  exerciseCount: number;
  totalSets: number;
  routine: StrengthRoutine;
}

export function parseHevyCSV(csvContent: string): ParsedHevyWorkout[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('title');
  const startTimeIdx = headers.indexOf('start_time');
  const exerciseTitleIdx = headers.indexOf('exercise_title');
  const setTypeIdx = headers.indexOf('set_type');
  const weightIdx = headers.indexOf('weight_kg');
  const repsIdx = headers.indexOf('reps');

  if (exerciseTitleIdx === -1) {
    throw new Error('El archivo CSV no contiene la columna obligatoria "exercise_title" de Hevy.');
  }

  // Agrupar filas por entrenamiento (Workout ID = title + startTime)
  const workoutsMap = new Map<string, {
    title: string;
    startTime: string;
    exercises: Map<string, { sets: number; reps: number[]; weights: number[] }>;
  }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= exerciseTitleIdx) continue;

    const title = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx].trim() : 'Entrenamiento Hevy';
    const startTime = startTimeIdx !== -1 && cols[startTimeIdx] ? cols[startTimeIdx].trim() : '';
    const exerciseTitle = cols[exerciseTitleIdx]?.trim();
    if (!exerciseTitle) continue;

    const setType = setTypeIdx !== -1 ? cols[setTypeIdx]?.trim().toLowerCase() : 'normal';
    // Ignorar calentamientos si se desea, o contarlos como series de trabajo
    const weight = weightIdx !== -1 ? parseFloat(cols[weightIdx]) || 0 : 0;
    const reps = repsIdx !== -1 ? parseInt(cols[repsIdx]) || 10 : 10;

    const workoutKey = `${title}_${startTime.slice(0, 10)}`;

    if (!workoutsMap.has(workoutKey)) {
      workoutsMap.set(workoutKey, {
        title,
        startTime,
        exercises: new Map()
      });
    }

    const currentWorkout = workoutsMap.get(workoutKey)!;
    if (!currentWorkout.exercises.has(exerciseTitle)) {
      currentWorkout.exercises.set(exerciseTitle, {
        sets: 0,
        reps: [],
        weights: []
      });
    }

    const exData = currentWorkout.exercises.get(exerciseTitle)!;
    exData.sets += 1;
    exData.reps.push(reps);
    exData.weights.push(weight);
  }

  // Convertir cada workout agrupado en una StrengthRoutine compatible con Garmin
  const result: ParsedHevyWorkout[] = [];

  workoutsMap.forEach((wData, key) => {
    const blocks: WorkoutExerciseBlock[] = [];

    wData.exercises.forEach((exData, exTitle) => {
      const garminExercise = matchHevyExerciseToGarmin(exTitle);
      
      // Calcular promedio o valor más frecuente de reps y peso
      const avgReps = exData.reps.length > 0 
        ? Math.round(exData.reps.reduce((a, b) => a + b, 0) / exData.reps.length) 
        : 10;
      const maxWeight = exData.weights.length > 0 ? Math.max(...exData.weights) : 0;

      blocks.push({
        id: `hevy-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        exercise: garminExercise,
        sets: Math.max(1, exData.sets),
        reps: avgReps,
        weightKg: maxWeight,
        suggestedWeightKg: maxWeight,
        restSeconds: 90
      });
    });

    const safeName = (wData.title || 'Hevy Workout').slice(0, 16);

    const routine: StrengthRoutine = {
      id: `hevy-${key}`,
      name: safeName,
      warmupSeconds: 300,
      cooldownSeconds: 180,
      blocks
    };

    result.push({
      id: key,
      name: wData.title,
      date: wData.startTime ? wData.startTime.slice(0, 10) : 'Sin fecha',
      exerciseCount: blocks.length,
      totalSets: blocks.reduce((acc, b) => acc + b.sets, 0),
      routine
    });
  });

  return result;
}

// Parser simple para líneas CSV respetando comillas
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.replace(/^"|"$/g, '').trim());
  return result;
}
