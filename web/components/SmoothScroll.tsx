'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    const handleLock = () => {
      lenis.stop();
    };

    const handleUnlock = () => {
      lenis.start();
    };

    window.addEventListener('app-scroll-lock', handleLock);
    window.addEventListener('app-scroll-unlock', handleUnlock);

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      window.removeEventListener('app-scroll-lock', handleLock);
      window.removeEventListener('app-scroll-unlock', handleUnlock);
      lenis.destroy();
    };
  }, []);

  return null;
}
