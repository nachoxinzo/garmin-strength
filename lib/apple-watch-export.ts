import { StrengthRoutine } from './types';

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcsDateUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Genera un texto checklist optimizado para pegar en Apple Notes o Recordatorios
 * (ambas apps nativas sincronizadas automáticamente en el Apple Watch Series 4).
 */
export function formatAppleWatchNotesText(routine: StrengthRoutine): string {
  const lines: string[] = [
    `RUTINA: ${routine.name}`,
    `Ejercicios: ${routine.blocks.length} | Series totales: ${routine.blocks.reduce((a, b) => a + b.sets, 0)}`,
    '',
  ];

  routine.blocks.forEach((b, idx) => {
    const weightPart = b.weightKg > 0 ? ` @ ${b.weightKg} kg` : ' (Peso Corporal)';
    lines.push(
      `${idx + 1}. [ ] ${b.exercise.name} — ${b.sets}x${b.reps}${weightPart} (Descanso ${b.restSeconds}s)`
    );
  });

  return lines.join('\n');
}

/**
 * Genera y descarga un evento .ICS de Calendario Apple con la rutina completa.
 * Al abrirlo en iPhone se añade al Calendario y aparece automáticamente en el Apple Watch Series 4
 * sin depender de conexión en el gimnasio.
 */
export function downloadAppleWatchCalendarIcs(routine: StrengthRoutine): void {
  const start = new Date();
  const estimatedMinutes = Math.max(
    25,
    Math.round(
      (routine.warmupSeconds +
        routine.cooldownSeconds +
        routine.blocks.reduce((acc, b) => acc + b.sets * (45 + b.restSeconds), 0)) /
        60
    )
  );
  const end = new Date(start.getTime() + estimatedMinutes * 60 * 1000);

  const summary = `Entreno: ${routine.name}`;
  const descriptionRaw = formatAppleWatchNotesText(routine);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Garmin Strength Studio//Apple Watch Companion//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:strength-${routine.id}-${Date.now()}@garmin-strength`,
    `DTSTAMP:${formatIcsDateUtc(new Date())}`,
    `DTSTART:${formatIcsDateUtc(start)}`,
    `DTEND:${formatIcsDateUtc(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descriptionRaw)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${routine.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_AppleWatch.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
