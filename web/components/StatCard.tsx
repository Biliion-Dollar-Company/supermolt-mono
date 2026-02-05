import React from 'react';
import Card from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  className = '',
}) => {
  const trendColor = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  }[trend || 'neutral'];

  return (
    <Card variant="default" className={`${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm mb-2">{label}</p>
          <p className={`text-3xl font-bold ${trendColor}`}>{value}</p>
          {subtext && <p className="text-gray-500 text-xs mt-1">{subtext}</p>}
        </div>
        {icon && <div className="text-3xl ml-4">{icon}</div>}
      </div>
    </Card>
  );
};

export default StatCard;
