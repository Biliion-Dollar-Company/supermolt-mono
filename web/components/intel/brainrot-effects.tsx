'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';

export function BrainrotNoise({
  patternRefreshInterval = 5,
  patternAlpha = 12,
  className,
}: {
  patternRefreshInterval?: number;
  patternAlpha?: number;
  className?: string;
}) {
  const grainRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      return;
    }

    let frame = 0;
    let animationId = 0;
    const canvasSize = 768;

    const resize = () => {
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
    };

    const drawGrain = () => {
      const imageData = ctx.createImageData(canvasSize, canvasSize);
      const data = imageData.data;

      for (let index = 0; index < data.length; index += 4) {
        const value = Math.random() * 255;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = patternAlpha;
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const loop = () => {
      if (frame % patternRefreshInterval === 0) {
        drawGrain();
      }
      frame += 1;
      animationId = window.requestAnimationFrame(loop);
    };

    window.addEventListener('resize', resize);
    resize();
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
    };
  }, [patternAlpha, patternRefreshInterval]);

  return (
    <canvas
      ref={grainRef}
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-multiply ${className ?? ''}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export function BrainrotCircularText({
  text,
  spinDuration = 22,
  className,
}: {
  text: string;
  spinDuration?: number;
  className?: string;
}) {
  const letters = Array.from(text);
  const controls = useAnimation();
  const rotation = useMotionValue(0);

  useEffect(() => {
    const start = rotation.get();
    void controls.start({
      rotate: start + 360,
      transition: {
        ease: 'linear',
        duration: spinDuration,
        repeat: Number.POSITIVE_INFINITY,
      },
    });
  }, [controls, rotation, spinDuration, text]);

  return (
    <motion.div
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
      style={{ rotate: rotation }}
      initial={{ rotate: 0 }}
      animate={controls}
    >
      {letters.map((letter, index) => {
        const rotationDeg = (360 / letters.length) * index;
        const transform = `rotate(${rotationDeg}deg) translateY(-103px)`;
        return (
          <span
            key={`${letter}-${index}`}
            className="absolute left-1/2 top-1/2 block origin-center text-[0.92rem] font-black uppercase tracking-[0.12em] text-black"
            style={{
              transform,
              transformOrigin: 'center 103px',
              marginLeft: '-0.42em',
              marginTop: '-0.6em',
            }}
          >
            {letter}
          </span>
        );
      })}
    </motion.div>
  );
}

export function BrainrotReveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
