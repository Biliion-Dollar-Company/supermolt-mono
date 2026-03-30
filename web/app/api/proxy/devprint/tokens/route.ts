import { NextResponse } from 'next/server';

const DEVPRINT_API = 'https://devprint-v2-production.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${DEVPRINT_API}/api/tokens?limit=20`, {
      next: { revalidate: 5 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
