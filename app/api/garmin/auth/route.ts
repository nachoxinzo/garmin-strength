import { NextResponse } from 'next/server';
import { loginToGarminAccount, resumeGarminMfaLogin } from '@/lib/garmin-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
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
