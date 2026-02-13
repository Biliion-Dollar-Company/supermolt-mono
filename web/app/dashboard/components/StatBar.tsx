'use client';

interface StatBarProps {
  label: string;
  value: number; // 0-100
  showValue?: boolean;
}

export function StatBar({ label, value, showValue = true }: StatBarProps) {
  // Dynamic color based on value (matching mobile logic)
  const getColor = () => {
    if (value > 70) return '#22c55e'; // green (success)
    if (value > 40) return '#f59e0b'; // yellow (warning)
    return '#71717a'; // gray (muted)
  };

  const barColor = getColor();

  return (
    <div className="w-full">
      {/* Label and value */}
      <div className="flex justify-between mb-1">
        <span className="text-xs text-white/50">{label}</span>
        {showValue && <span className="text-xs text-white/50">{value}</span>}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${value}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
