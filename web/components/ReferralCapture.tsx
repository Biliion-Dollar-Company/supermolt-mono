'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (ref && ref.startsWith('SM-')) {
      localStorage.setItem('supermolt_ref', ref);
    }
  }, [searchParams]);

  return null;
}
