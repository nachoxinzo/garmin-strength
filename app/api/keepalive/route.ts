import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Endpoint ligero de keep-alive para mantener activo el proyecto gratuito de Supabase
 * ejecutando una consulta mínima sobre la tabla `routines`.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
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
