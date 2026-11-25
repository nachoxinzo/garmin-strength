import { StrengthRoutine } from './types';

const LOCAL_TEMPLATES_KEY = 'ironsync_local_templates_v1';

const BACKUP_KEYS = [
  'garmin_strength_current_routine',
  'garmin_strength_weekly_plan_v1',
  'garmin_strength_progression_v1',
  'garmin_strength_exercise_notes_v1',
  'garmin_strength_my_gym_v1',
  'garmin_strength_wellness_v1',
  'hevy_raw_csv_cache',
  LOCAL_TEMPLATES_KEY,
];

export function loadLocalTemplates(): StrengthRoutine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalTemplate(routine: StrengthRoutine): StrengthRoutine[] {
  const existing = loadLocalTemplates();
  const cleanName = routine.name.trim() || 'Plantilla';
  const entry: StrengthRoutine = {
    ...routine,
    id: `tpl-${Date.now()}`,
    name: cleanName,
  };
  const filtered = existing.filter(
    (t) => t.name.toLowerCase() !== cleanName.toLowerCase()
  );
  const next = [entry, ...filtered].slice(0, 12);
  try {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function deleteLocalTemplate(id: string): StrengthRoutine[] {
  const next = loadLocalTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function downloadLocalBackupJson(): void {
  if (typeof window === 'undefined') return;
  const data: Record<string, string | null> = {};
  for (const key of BACKUP_KEYS) {
    data[key] = localStorage.getItem(key);
  }
  const blob = new Blob(
    [
      JSON.stringify(
        {
          app: 'IronSync',
          exportedAt: new Date().toISOString(),
          data,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ironsync-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
