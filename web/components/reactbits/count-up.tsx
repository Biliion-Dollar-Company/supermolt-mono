'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface CountUpProps {
  from?: number;
  to: number;
  direction?: 'up' | 'down';
  duration?: number;
  delay?: number;
  decimals?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  startWhen?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  from = 0,
  to,
  direction = 'up',
  duration = 1.2,
  delay = 0,
  decimals = 0,
  separator = '',
  prefix = '',
  suffix = '',
  className = '',
  startWhen = true,
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px' });

  const motionVal = useMotionValue(direction === 'down' ? to : from);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });

  const [display, setDisplay] = useState(
    direction === 'down' ? to.toFixed(decimals) : from.toFixed(decimals),
  );

  const fired = useRef(false);

  useEffect(() => {
    if (!inView || !startWhen || fired.current) return;
    fired.current = true;

    const timeout = setTimeout(() => {
      onStart?.();
      motionVal.set(direction === 'down' ? from : to);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [inView, startWhen, direction, from, to, delay, motionVal, onStart]);

  useEffect(() => {
    const unsub = spring.on('change', (val) => {
      let formatted = val.toFixed(decimals);
      if (separator) {
        const [int, dec] = formatted.split('.');
        formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) + (dec ? `.${dec}` : '');
      }
      setDisplay(formatted);
    });

    const done = spring.on('animationComplete', () => onEnd?.());

    return () => { unsub(); done(); };
  }, [spring, decimals, separator, onEnd]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
