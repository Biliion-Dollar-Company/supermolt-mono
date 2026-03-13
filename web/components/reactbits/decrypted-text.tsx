'use client';

import { useEffect, useRef, useState } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  animateOn?: 'hover' | 'view' | 'mount';
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

export default function DecryptedText({
  text,
  speed = 40,
  maxIterations = 8,
  sequential = true,
  revealDirection = 'start',
  animateOn = 'view',
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = 'text-text-muted/40',
  parentClassName = '',
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const iterRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof setTimeout>>(null!);
  const containerRef = useRef<HTMLSpanElement>(null);

  const getRevealOrder = () => {
    const indices = Array.from({ length: text.length }, (_, i) => i);
    if (revealDirection === 'end') return indices.reverse();
    if (revealDirection === 'center') {
      const mid = Math.floor(text.length / 2);
      return indices.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    }
    return indices;
  };

  const animate = () => {
    setIsAnimating(true);
    iterRef.current = 0;
    const order = getRevealOrder();
    let revealed = 0;

    const tick = () => {
      if (revealed >= text.length) {
        setDisplayText(text);
        setRevealedCount(text.length);
        setIsAnimating(false);
        return;
      }

      iterRef.current++;
      if (sequential && iterRef.current >= maxIterations) {
        iterRef.current = 0;
        revealed++;
        setRevealedCount(revealed);
      }

      setDisplayText(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' ';
            const posInOrder = order.indexOf(i);
            if (posInOrder < revealed) return char;
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join(''),
      );

      rafRef.current = setTimeout(tick, speed);
    };

    tick();
  };

  useEffect(() => {
    if (animateOn === 'mount') {
      animate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (animateOn !== 'view') return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isAnimating) {
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateOn]);

  useEffect(() => {
    return () => clearTimeout(rafRef.current);
  }, []);

  const order = getRevealOrder();

  return (
    <span
      ref={containerRef}
      className={`inline ${parentClassName}`}
      onMouseEnter={animateOn === 'hover' ? animate : undefined}
    >
      {displayText.split('').map((char, i) => {
        const isRevealed = order.indexOf(i) < revealedCount;
        return (
          <span
            key={i}
            className={isRevealed || !isAnimating ? className : encryptedClassName}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
