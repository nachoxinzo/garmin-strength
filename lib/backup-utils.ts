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

function makeTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function saveLocalTemplate(routine: StrengthRoutine): StrengthRoutine[] {
  const existing = loadLocalTemplates();
  const cleanName = routine.name.trim() || 'Plantilla';
  const entry: StrengthRoutine = {
    ...routine,
    id: makeTemplateId(),
    name: cleanName,
  };
  const filtered = existing.filter(
    (t) => t.name.toLowerCase() !== cleanName.toLowerCase()
  );
  const next = [entry, ...filtered].slice(0, 30);
  try {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function saveLocalTemplatesBatch(routines: StrengthRoutine[]): StrengthRoutine[] {
  const valid = routines.filter((r) => r && Array.isArray(r.blocks) && r.blocks.length > 0);
  if (valid.length === 0) return loadLocalTemplates();

  const existing = loadLocalTemplates();
  const importedNames = new Set(
    valid.map((r) => (r.name.trim() || 'Plantilla').toLowerCase())
  );
  const keptExisting = existing.filter(
    (t) => !importedNames.has((t.name.trim() || 'Plantilla').toLowerCase())
  );

  const dedupedIncoming: StrengthRoutine[] = [];
  const seenIncoming = new Set<string>();
  for (const r of valid) {
    const cleanName = r.name.trim() || 'Plantilla';
    const key = cleanName.toLowerCase();
    if (seenIncoming.has(key)) continue;
    seenIncoming.add(key);
    dedupedIncoming.push({
      ...r,
      id: makeTemplateId(),
      name: cleanName,
    });
  }

  const next = [...dedupedIncoming, ...keptExisting].slice(0, 30);
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
