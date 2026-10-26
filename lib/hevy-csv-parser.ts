import { mapHevyToGarminCatalog } from './hevy-mapper';
import { StrengthRoutine, WorkoutExerciseBlock } from './types';

export interface ParsedHevyWorkout {
  id: string;
  name: string;
  date: string;
  exerciseCount: number;
  totalSets: number;
  routine: StrengthRoutine;
}

interface RawSetEntry {
  setType: string;
  reps: number;
  weightKg: number;
}

export function parseHevyCSV(csvContent: string): ParsedHevyWorkout[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detectar delimitador automáticamente (coma o punto y coma)
  const headerLine = lines[0];
  const delimiter =
    (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';

  // Parse header
  const headers = parseCSVLine(headerLine, delimiter).map((h) => h.trim().toLowerCase());
  const titleIdx = headers.findIndex((h) => h === 'title' || h === 'titulo' || h === 'título');
  const startTimeIdx = headers.findIndex((h) => h === 'start_time' || h === 'fecha_inicio' || h === 'date');
  const exerciseTitleIdx = headers.findIndex(
    (h) => h === 'exercise_title' || h === 'ejercicio' || h === 'exercise'
  );
  const setTypeIdx = headers.findIndex((h) => h === 'set_type' || h === 'tipo_serie' || h === 'type');
  const weightKgIdx = headers.findIndex((h) => h === 'weight_kg' || h === 'peso_kg' || h === 'weight');
  const weightLbsIdx = headers.findIndex((h) => h === 'weight_lbs' || h === 'peso_lbs');
  const repsIdx = headers.findIndex((h) => h === 'reps' || h === 'repeticiones');

  if (exerciseTitleIdx === -1) {
    throw new Error('El archivo CSV no contiene la columna obligatoria "exercise_title" de Hevy.');
  }

  // Agrupar filas por entrenamiento (Workout ID = title + startTime)
  const workoutsMap = new Map<
    string,
    {
      title: string;
      startTime: string;
      exercises: Map<string, RawSetEntry[]>;
    }
  >();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length <= exerciseTitleIdx) continue;

    const title =
      titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx].trim() : 'Entrenamiento Hevy';
    const startTime =
      startTimeIdx !== -1 && cols[startTimeIdx] ? cols[startTimeIdx].trim() : '';
    const exerciseTitle = cols[exerciseTitleIdx]?.trim();
    if (!exerciseTitle) continue;

    const setType =
      setTypeIdx !== -1 && cols[setTypeIdx]
        ? cols[setTypeIdx].trim().toLowerCase()
        : 'normal';

    let weightKg = 0;
    if (weightKgIdx !== -1 && cols[weightKgIdx]) {
      weightKg = parseFloat(cols[weightKgIdx].replace(',', '.')) || 0;
    } else if (weightLbsIdx !== -1 && cols[weightLbsIdx]) {
      const lbs = parseFloat(cols[weightLbsIdx].replace(',', '.')) || 0;
      weightKg = Math.round(lbs * 0.45359237 * 100) / 100;
    }

    const reps =
      repsIdx !== -1 && cols[repsIdx] ? parseInt(cols[repsIdx], 10) || 10 : 10;

    // Clave única por sesión (Título + Fecha/Hora exacta de inicio de esa sesión)
    const workoutKey = `${title}_${startTime || i}`;

    if (!workoutsMap.has(workoutKey)) {
      workoutsMap.set(workoutKey, {
        title,
        startTime,
        exercises: new Map()
      });
    }

    const currentWorkout = workoutsMap.get(workoutKey)!;
    if (!currentWorkout.exercises.has(exerciseTitle)) {
      currentWorkout.exercises.set(exerciseTitle, []);
    }

    currentWorkout.exercises.get(exerciseTitle)!.push({
      setType,
      reps,
      weightKg
    });
  }

  // Convertir cada workout agrupado en una StrengthRoutine compatible con Garmin
  const result: ParsedHevyWorkout[] = [];

  workoutsMap.forEach((wData, key) => {
    const blocks: WorkoutExerciseBlock[] = [];
    let exIdx = 0;

    wData.exercises.forEach((rawSets, exTitle) => {
      const garminExercise = mapHevyToGarminCatalog(exTitle);

      // Filtrar series de calentamiento para obtener las series efectivas de trabajo
      const workingSets = rawSets.filter((s) => s.setType !== 'warmup');
      const effectiveSets = workingSets.length > 0 ? workingSets : rawSets;

      const avgReps =
        effectiveSets.length > 0
          ? Math.max(
              1,
              Math.round(
                effectiveSets.reduce((acc, s) => acc + (s.reps || 10), 0) /
                  effectiveSets.length
              )
            )
          : 10;

      const maxWeight =
        effectiveSets.length > 0
          ? Math.max(0, ...effectiveSets.map((s) => s.weightKg || 0))
          : 0;

      blocks.push({
        id: `hevy-csv-${exIdx++}-${Date.now()}`,
        exercise: garminExercise,
        sets: Math.max(1, effectiveSets.length),
        reps: avgReps,
        weightKg: Math.round(maxWeight * 100) / 100,
        suggestedWeightKg:
          maxWeight > 0 ? Math.round((maxWeight + 2.5) * 100) / 100 : undefined,
        restSeconds: 90
      });
    });

    const safeName = (wData.title || 'Hevy Workout').slice(0, 28);

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

// Parser para líneas CSV respetando comillas y delimitador configurable
function parseCSVLine(text: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.replace(/^"|"$/g, '').trim());
  return result;
}
