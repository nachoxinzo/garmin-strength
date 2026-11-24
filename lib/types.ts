import { CatalogExercise } from './exercise-catalog';

export interface WorkoutExerciseBlock {
  id: string;
  exercise: CatalogExercise;
  sets: number;
  reps: number;
  weightKg: number;
  suggestedWeightKg?: number; // Peso sugerido original de Hevy
  restSeconds: number;
  supersetGroupId?: string; // Agrupa ejercicios consecutivos en superserie/biserie
}

export interface StrengthRoutine {
  id: string;
  name: string;
  warmupSeconds: number;
  cooldownSeconds: number;
  blocks: WorkoutExerciseBlock[];
}

export interface GarminAccountStatus {
  authenticated: boolean;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
}
