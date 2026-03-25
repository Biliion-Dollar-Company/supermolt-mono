'use client';

import Image from 'next/image';

interface IconProps {
  className?: string;
}

export function DexscreenerIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-black ${className}`}>
      <Image
        src="/icons/dexscreener.png"
        alt="DexScreener"
        fill
        sizes="24px"
        className="object-contain p-px"
      />
    </span>
  );
}

export function CopyCaIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CopySuccessIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
