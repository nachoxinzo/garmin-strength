import { StrengthRoutine } from './types';

/**
 * Codifica una rutina en un formato Base64 seguro para URLs
 */
export function encodeRoutineToShareUrl(routine: StrengthRoutine): string {
  try {
    const jsonStr = JSON.stringify(routine);
    // Codificación segura UTF-8 para Base64
    const base64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return encodeURIComponent(base64);
  } catch (err) {
    console.error('Error encoding routine:', err);
    return '';
  }
}

/**
 * Decodifica una rutina a partir del parámetro de URL
 */
export function decodeRoutineFromShareUrl(encoded: string): StrengthRoutine | null {
  try {
    const rawBase64 = decodeURIComponent(encoded);
    const jsonStr = decodeURIComponent(Array.prototype.map.call(atob(rawBase64), (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonStr) as StrengthRoutine;
  } catch (err) {
    console.error('Error decoding routine:', err);
    return null;
  }
}
