import { NextResponse } from 'next/server';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(EXERCISE_CATALOG);
}
