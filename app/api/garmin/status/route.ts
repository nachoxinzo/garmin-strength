import { NextResponse } from 'next/server';
import { getGarminStatus } from '@/lib/garmin-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getGarminStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const status = await getGarminStatus(body.garminTokens || null);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
