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
