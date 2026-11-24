export interface ExerciseNoteRecord {
  exerciseId: string;
  setupNote: string; // ej. "Asiento al 4, agarre estrecho"
  hasJointDiscomfort: boolean;
  updatedAt: string;
}

const NOTES_STORAGE_KEY = 'garmin_strength_exercise_notes_v1';

export function loadExerciseNotes(): Record<string, ExerciseNoteRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ExerciseNoteRecord>;
  } catch {
    return {};
  }
}

export function saveExerciseNote(
  exerciseId: string,
  setupNote: string,
  hasJointDiscomfort: boolean
): Record<string, ExerciseNoteRecord> {
  const notes = loadExerciseNotes();
  notes[exerciseId] = {
    exerciseId,
    setupNote: setupNote.trim(),
    hasJointDiscomfort,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }
  return notes;
}

export function getDiscomfortExerciseIds(): string[] {
  const notes = loadExerciseNotes();
  return Object.values(notes)
    .filter((n) => n.hasJointDiscomfort)
    .map((n) => n.exerciseId);
}
