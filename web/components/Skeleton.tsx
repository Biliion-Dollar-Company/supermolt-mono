import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  count = 1,
}) => {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%]';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const skeletonElement = (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );

  if (count === 1) {
    return skeletonElement;
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{skeletonElement}</div>
      ))}
    </div>
  );
};

// Common skeleton patterns
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card ${className} space-y-4`}>
    <Skeleton variant="text" width="60%" height={24} />
    <Skeleton variant="text" width="100%" height={16} />
    <Skeleton variant="text" width="100%" height={16} />
    <Skeleton variant="text" width="80%" height={16} />
    <div className="flex gap-2 mt-4">
      <Skeleton variant="rectangular" width={80} height={32} />
      <Skeleton variant="rectangular" width={80} height={32} />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center p-4 bg-trench-slate/30 rounded-xl">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="50%" />
        </div>
        <Skeleton variant="text" width={80} />
      </div>
    ))}
  </div>
);

export default Skeleton;
