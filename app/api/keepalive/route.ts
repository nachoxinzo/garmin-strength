import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function timingSafeBearerMatch(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${expectedSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Endpoint ligero de keep-alive para mantener activo el proyecto gratuito de Supabase.
 * En producción exige CRON_SECRET obligatorio.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no configurado en producción.' },
      { status: 500 }
    );
  }

  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (!timingSafeBearerMatch(authHeader, cronSecret)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json(
      {
        ok: false,
        status: 'unconfigured',
        message: 'Variables de entorno de Supabase no configuradas.',
        checkedAt,
      },
      { status: 200 }
    );
  }

  try {
    const { data, error } = await supabase.from('routines').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          status: 'error',
          error: error.message,
          checkedAt,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: 'active',
      rowsSeen: data?.length ?? 0,
      checkedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        status: 'unreachable',
        error: err?.message || 'No se pudo conectar con Supabase',
        checkedAt,
      },
      { status: 503 }
    );
  }
}
