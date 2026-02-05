import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text = 'Loading...',
  fullScreen = false,
}) => {
  const sizeStyles = {
    sm: 'h-8 w-8 border-2',
    md: 'h-12 w-12 border-3',
    lg: 'h-16 w-16 border-4',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`rounded-full border-b-cyan-400 border-gray-800 ${sizeStyles[size]} animate-spin`}></div>
      {text && <p className="text-gray-400">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
