import { NextResponse } from 'next/server';

const PIPELINE_API = process.env.PIPELINE_API_URL || 'https://api-gateway-production-0e26.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${PIPELINE_API}/api/pipeline/status`, {
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: true,
        data: { status: 'unknown', services: [] },
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      success: true,
      data: { status: 'offline', services: [] },
    });
  }
}
