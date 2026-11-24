import { NextResponse } from 'next/server';
import { loginToGarminAccount, resumeGarminMfaLogin } from '@/lib/garmin-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(`garmin-auth:${clientIp}`, 10, 15 * 60 * 1000);
    if (!rate.success) {
      return NextResponse.json(
        {
          authenticated: false,
          error: `Demasiados intentos de inicio de sesión. Espera ${rate.resetSeconds} segundos.`,
        },
        { status: 429, headers: { 'Retry-After': String(rate.resetSeconds) } }
      );
    }

    const body = await req.json();
    const { email, password, mfaCode, mfaState } = body;

    if (mfaCode) {
      const mfaResult = await resumeGarminMfaLogin(mfaCode, mfaState);
      return NextResponse.json(mfaResult);
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Introduce el correo electrónico y la contraseña de tu cuenta de Garmin Connect.' },
        { status: 400 }
      );
    }

    const result = await loginToGarminAccount(email, password);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en login de Garmin:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error:
          error?.message ||
          'No se pudo iniciar sesión en Garmin Connect. Verifica tu correo y contraseña.'
      },
      { status: 401 }
    );
  }
}
