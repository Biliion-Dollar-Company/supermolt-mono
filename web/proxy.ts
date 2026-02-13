import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest): NextResponse {
  // Redirect www to non-www to prevent CORS issues with RSC fetches
  const host = req.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const url = req.nextUrl.clone();
    url.host = host.replace('www.', '');
    url.protocol = 'https';
    return NextResponse.redirect(url, 308);
  }

  if (req.nextUrl.pathname.startsWith('/tidewave')) {
    return NextResponse.rewrite(new URL('/api/tidewave', req.url));
  }

  return NextResponse.next();
}
