'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right';
  delay?: number;
};

export default function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}: ShinyTextProps) {
  const backgroundStyle = useMemo(() => {
    const gradientDirection = direction === 'left' ? '90deg' : '-90deg';
    return {
      backgroundImage: `linear-gradient(${gradientDirection}, ${color} 0%, ${shineColor} 50%, ${color} 100%)`,
      backgroundSize: `${spread}% 100%`,
      WebkitBackgroundClip: 'text' as const,
      backgroundClip: 'text' as const,
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    };
  }, [color, shineColor, spread, direction]);

  if (disabled) {
    return <span className={className} style={{ color }}>{text}</span>;
  }

  return (
    <motion.span
      className={className}
      style={backgroundStyle}
      animate={{ backgroundPosition: direction === 'left' ? ['-100% 0', '200% 0'] : ['200% 0', '-100% 0'] }}
      transition={{
        duration: speed,
        ease: 'linear',
        repeat: Infinity,
        repeatType: yoyo ? 'reverse' : 'loop',
        delay,
      }}
      whileHover={pauseOnHover ? { animationPlayState: 'paused' } : undefined}
    >
      {text}
    </motion.span>
  );
}
