import { GarminWellnessSnapshot } from './types';

const WELLNESS_STORAGE_KEY = 'garmin_strength_wellness_v1';

export function saveGarminWellnessSnapshot(snapshot: GarminWellnessSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELLNESS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
}

export function loadGarminWellnessSnapshot(): GarminWellnessSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WELLNESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GarminWellnessSnapshot;
    if (!parsed || typeof parsed.readinessIndex !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
