'use client';

import { useState } from 'react';
import Image from 'next/image';

interface AgentAvatarProps {
  name: string;
  avatarUrl?: string | null;
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { container: 'w-10 h-10', image: 'w-9 h-9', dot: 'w-2 h-2', text: 'text-xs' },
  md: { container: 'w-14 h-14', image: 'w-12 h-12', dot: 'w-3 h-3', text: 'text-sm' },
  lg: { container: 'w-20 h-20', image: 'w-[72px] h-[72px]', dot: 'w-4 h-4', text: 'text-base' },
};

export function AgentAvatar({ name, avatarUrl, isActive, size = 'md' }: AgentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const showFallback = !avatarUrl || imgError;
  const sizeClasses = sizes[size];

  return (
    <div className="flex flex-row items-center gap-3">
      {/* Avatar with active indicator */}
      <div className={`relative ${sizeClasses.container} rounded-full`}>
        {/* Active ring with glow */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full border-2 border-[#c4f70e]"
            style={{
              boxShadow: '0 0 16px rgba(196, 247, 14, 0.5)',
            }}
          />
        )}

        {/* Avatar image or fallback */}
        <div className={`${sizeClasses.image} rounded-full m-0.5 overflow-hidden relative`}>
          {showFallback ? (
            <div
              className="w-full h-full flex items-center justify-center font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #c4f70e 0%, #68ac6e 100%)',
              }}
            >
              <span className={sizeClasses.text}>{initials}</span>
            </div>
          ) : (
            <Image
              src={avatarUrl!}
              alt={name}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        {/* Active indicator dot */}
        {isActive && (
          <div
            className={`absolute bottom-0.5 right-0.5 ${sizeClasses.dot} rounded-full bg-[#c4f70e] border-2 border-[#0a0a0a]`}
          />
        )}
      </div>

      {/* Agent name and status */}
      <div className="flex flex-col">
        <span className="text-white font-semibold text-base">{name}</span>
        <span className="text-white/50 text-xs">
          {isActive ? 'Active • Trading' : 'Paused'}
        </span>
      </div>
    </div>
  );
}
