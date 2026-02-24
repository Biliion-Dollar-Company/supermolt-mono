import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const scannerId = req.nextUrl.searchParams.get('scannerId');
  if (!scannerId) {
    return NextResponse.json({ calls: [] });
  }

  try {
    const res = await fetch(`${API_URL}/api/calls/scanner/${scannerId}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ calls: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ calls: [] });
  }
}
