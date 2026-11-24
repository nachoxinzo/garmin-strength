import { NextResponse } from 'next/server';
import { EXERCISE_CATALOG, EquipmentType } from '@/lib/exercise-catalog';
import {
  DEFAULT_GYM_PROFILE,
  generateSmartLocalRoutine,
  MyGymProfile,
} from '@/lib/smart-workout-engine';
import { WorkoutExerciseBlock } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(`smart-gen:${clientIp}`, 20, 10 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        { error: `Límite de generaciones alcanzado. Espera ${rate.resetSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return NextResponse.json(
        { error: 'Describe qué entrenamiento quieres generar.' },
        { status: 400 }
      );
    }

    const prompt = body.prompt.trim().slice(0, 600);
    const gymProfile: MyGymProfile = {
      availableEquipment: Array.isArray(body.gymProfile?.availableEquipment) && body.gymProfile.availableEquipment.length > 0
        ? (body.gymProfile.availableEquipment as EquipmentType[])
        : DEFAULT_GYM_PROFILE.availableEquipment,
      avoidLowerBackFatigue: Boolean(body.gymProfile?.avoidLowerBackFatigue),
      gymName: String(body.gymProfile?.gymName || DEFAULT_GYM_PROFILE.gymName),
    };
    const durationMinutes = ([45, 60, 75, 90].includes(body.durationMinutes) ? body.durationMinutes : 60) as 45 | 60 | 75 | 90;
    const goal = (['hypertrophy', 'strength', 'powerbuilding'].includes(body.goal) ? body.goal : 'hypertrophy') as 'hypertrophy' | 'strength' | 'powerbuilding';
    const knownWeights: Record<string, number> =
      body.knownWeights && typeof body.knownWeights === 'object' ? body.knownWeights : {};
    const wellness = body.wellness && typeof body.wellness === 'object' ? body.wellness : null;
    const weeklyMuscleDeficits = Array.isArray(body.weeklyMuscleDeficits)
      ? body.weeklyMuscleDeficits
      : [];
    const deloadMode = Boolean(body.deloadMode);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      const localResult = generateSmartLocalRoutine({
        prompt,
        gymProfile,
        durationMinutes,
        goal,
        knownWeights,
        wellness,
        weeklyMuscleDeficits,
        deloadMode,
      });
      return NextResponse.json(localResult);
    }

    // Filtrar catálogo al equipamiento disponible del usuario para el prompt de Gemini
    const availableSet = new Set(gymProfile.availableEquipment);
    const allowedCatalog = EXERCISE_CATALOG.filter((ex) => availableSet.has(ex.equipment));
    const catalogSummary = allowedCatalog
      .map((ex) => `${ex.id} | ${ex.name} (${ex.muscleGroup}, ${ex.equipment}, Tier ${ex.tier})`)
      .join('\n');

    const systemInstruction = `Eres un entrenador experto en fuerza e hipertrofia y biomecánica de gimnasio.
Debes diseñar una rutina optimizada para Garmin Fénix 8 eligiendo EXCLUSIVAMENTE IDs exactos de la lista PERMITIDA.
Restricciones del gimnasio del usuario ("${gymProfile.gymName}"):
- Equipamiento permitido: ${gymProfile.availableEquipment.join(', ')}
- Evitar fatiga lumbar: ${gymProfile.avoidLowerBackFatigue ? 'SÍ' : 'NO'}
- Objetivo: ${goal}
- Duración objetivo: ${durationMinutes} minutos
- Cargas conocidas del usuario (ID -> kg): ${JSON.stringify(knownWeights)}
- Principios científicos obligatorios:
  1) Hipertrofia mediada por estiramiento: incluye al menos 1 ejercicio con máxima tensión en estiramiento (ej. press inclinado mancuernas, extensión tríceps overhead, curl inclinado, curl femoral sentado).
  2) Ratio Estímulo-Fatiga (SFR): máximo 2 compuestos axiales pesados por sesión; ordena Tier 1 primero y aislamientos al final.
  3) Descansos basados en evidencia: >=150s en compuestos Tier 1, 60-90s en aislamientos Tier 3.
  4) Déficits semanales actuales del atleta: ${weeklyMuscleDeficits.length > 0 ? weeklyMuscleDeficits.join(', ') : 'ninguno'}.
  5) Modo Descarga (Deload): ${deloadMode ? 'ACTIVO (-40% series, RIR 3, mantener peso)' : 'NO'}.
${wellness ? `- Contexto Garmin (Multideporte, Sueño y Recuperación): Readiness ${wellness.readinessIndex}/100, Sueño ${wellness.sleep?.durationHours ?? 'N/D'}h, HRV ${wellness.recovery?.hrvLastNight ?? 'N/D'} ms, Body Battery ${wellness.recovery?.bodyBatteryCurrent ?? 'N/D'}, Fatiga piernas (48h) ${wellness.lowerBodyFatigue}, Fatiga tren superior (48h) ${wellness.upperBodyFatigue}, Minutos semanales por deporte ${JSON.stringify(wellness.weeklySportMinutes)}. Adapta volumen, RIR y selección si la recuperación es baja o hay fatiga acumulada.` : ''}

Responde ÚNICAMENTE con JSON válido con este esquema:
{
  "routineName": "string (máximo 16 caracteres)",
  "coachRationale": "string (explicación breve en español de la selección biomecánica y progresión)",
  "blocks": [
    {
      "exerciseId": "id exacto de la lista",
      "sets": number (2-6),
      "reps": number (4-20),
      "weightKg": number (0-300),
      "restSeconds": number (45-240)
    }
  ]
}

LISTA PERMITIDA DE EJERCICIOS:
${catalogSummary}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\nSOLICITUD DEL ATLETA: ${prompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const fallback = generateSmartLocalRoutine({
        prompt,
        gymProfile,
        durationMinutes,
        goal,
        knownWeights,
        wellness,
        weeklyMuscleDeficits,
        deloadMode,
      });
      return NextResponse.json(fallback);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      const fallback = generateSmartLocalRoutine({
        prompt,
        gymProfile,
        durationMinutes,
        goal,
        knownWeights,
        wellness,
        weeklyMuscleDeficits,
        deloadMode,
      });
      return NextResponse.json(fallback);
    }

    const parsedJson = JSON.parse(rawText);
    const catalogById = new Map(allowedCatalog.map((ex) => [ex.id, ex]));
    const validBlocks: WorkoutExerciseBlock[] = [];

    if (Array.isArray(parsedJson.blocks)) {
      for (let i = 0; i < parsedJson.blocks.length; i++) {
        const rawBlock = parsedJson.blocks[i];
        const catalogEx = catalogById.get(String(rawBlock?.exerciseId));
        if (!catalogEx) continue;

        const sets = Math.min(8, Math.max(1, Math.round(Number(rawBlock.sets) || 3)));
        const reps = Math.min(30, Math.max(1, Math.round(Number(rawBlock.reps) || 10)));
        const weightKg = Math.min(400, Math.max(0, Number(rawBlock.weightKg) || 0));
        const restSeconds = Math.min(300, Math.max(30, Math.round(Number(rawBlock.restSeconds) || 90)));

        validBlocks.push({
          id: `ai-${Date.now()}-${i}`,
          exercise: catalogEx,
          sets,
          reps,
          weightKg,
          suggestedWeightKg: knownWeights[catalogEx.id] || undefined,
          restSeconds,
        });
      }
    }

    if (validBlocks.length === 0) {
      const fallback = generateSmartLocalRoutine({
        prompt,
        gymProfile,
        durationMinutes,
        goal,
        knownWeights,
        wellness,
        weeklyMuscleDeficits,
        deloadMode,
      });
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      routine: {
        id: `ai-routine-${Date.now()}`,
        name: String(parsedJson.routineName || 'IA Coach').slice(0, 16),
        warmupSeconds: 300,
        cooldownSeconds: 180,
        blocks: validBlocks,
      },
      coachRationale: String(
        parsedJson.coachRationale ||
          'Rutina generada por IA adaptada al equipamiento disponible en tu gimnasio.'
      ),
      source: 'gemini',
    });
  } catch (err) {
    console.error('Error en /api/routines/smart-generate:', err);
    return NextResponse.json(
      { error: 'No se pudo generar la rutina inteligente en este momento.' },
      { status: 500 }
    );
  }
}
