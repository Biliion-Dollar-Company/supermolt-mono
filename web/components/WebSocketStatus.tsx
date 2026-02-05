'use client';

import React from 'react';
import { useWebSocket } from '@/lib/hooks';

interface WebSocketStatusProps {
  className?: string;
  showText?: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  className = '',
  showText = true,
}) => {
  const { connected, error } = useWebSocket();

  const statusColor = connected ? 'bg-green-500' : 'bg-red-500';
  const statusText = connected ? 'Live' : 'Offline';

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={error ? `WebSocket Error: ${error}` : 'WebSocket Status'}
    >
      <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
      {showText && <span className="text-xs text-gray-400">{statusText}</span>}
    </div>
  );
};

export default WebSocketStatus;
