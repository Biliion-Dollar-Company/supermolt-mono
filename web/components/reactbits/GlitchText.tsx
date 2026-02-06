'use client';

import { FC, CSSProperties, useState, useEffect } from 'react';

interface GlitchTextProps {
  children: string;
  speed?: number;
  enableShadows?: boolean;
  enableOnHover?: boolean;
  className?: string;
  settleAfter?: number;
}

interface CustomCSSProperties extends CSSProperties {
  '--after-duration': string;
  '--before-duration': string;
  '--after-shadow': string;
  '--before-shadow': string;
  '--after-offset': string;
  '--before-offset': string;
  '--after-opacity': string;
  '--before-opacity': string;
  transition?: string;
}

const GlitchText: FC<GlitchTextProps> = ({
  children,
  speed = 0.5,
  enableShadows = true,
  enableOnHover = false,
  className = '',
  settleAfter,
}) => {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (settleAfter == null) return;
    const timer = setTimeout(() => setSettled(true), settleAfter);
    return () => clearTimeout(timer);
  }, [settleAfter]);

  const inlineStyles: CustomCSSProperties = {
    '--after-duration': settled ? `${speed * 6}s` : `${speed * 3}s`,
    '--before-duration': settled ? `${speed * 5}s` : `${speed * 2}s`,
    '--after-shadow': enableShadows ? (settled ? '-2px 0 rgba(255,0,0,0.3)' : '-5px 0 red') : 'none',
    '--before-shadow': enableShadows ? (settled ? '2px 0 rgba(0,255,255,0.3)' : '5px 0 cyan') : 'none',
    '--after-offset': settled ? '3px' : '10px',
    '--before-offset': settled ? '-3px' : '-10px',
    '--after-opacity': settled ? '0.3' : '1',
    '--before-opacity': settled ? '0.3' : '1',
  };

  const baseClasses = 'text-white font-black relative inline-block select-none';

  const alwaysOnClasses =
    'after:content-[attr(data-text)] after:absolute after:top-0 after:left-[var(--after-offset)] after:text-white after:bg-transparent after:overflow-hidden after:[clip-path:inset(0_0_0_0)] after:[text-shadow:var(--after-shadow)] after:animate-glitch-after after:opacity-[var(--after-opacity)] after:transition-all after:duration-700 ' +
    'before:content-[attr(data-text)] before:absolute before:top-0 before:left-[var(--before-offset)] before:text-white before:bg-transparent before:overflow-hidden before:[clip-path:inset(0_0_0_0)] before:[text-shadow:var(--before-shadow)] before:animate-glitch-before before:opacity-[var(--before-opacity)] before:transition-all before:duration-700';

  const hoverOnlyClasses =
    "after:content-[''] after:absolute after:top-0 after:left-[10px] after:text-white after:bg-transparent after:overflow-hidden after:[clip-path:inset(0_0_0_0)] after:opacity-0 " +
    "before:content-[''] before:absolute before:top-0 before:left-[-10px] before:text-white before:bg-transparent before:overflow-hidden before:[clip-path:inset(0_0_0_0)] before:opacity-0 " +
    'hover:after:content-[attr(data-text)] hover:after:opacity-100 hover:after:[text-shadow:var(--after-shadow)] hover:after:animate-glitch-after ' +
    'hover:before:content-[attr(data-text)] hover:before:opacity-100 hover:before:[text-shadow:var(--before-shadow)] hover:before:animate-glitch-before';

  const pseudoClasses = enableOnHover ? hoverOnlyClasses : alwaysOnClasses;
  const combinedClasses = `${baseClasses} ${pseudoClasses} ${className}`;

  return (
    <div style={inlineStyles} data-text={children} className={combinedClasses}>
      {children}
    </div>
  );
};

export default GlitchText;
