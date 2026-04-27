interface StatusBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

export function StatusBadge({ icon, label, value, color }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-bg-secondary border border-border px-3 py-1.5 rounded-kraken text-[11px] font-bold">
      <span className="text-text-muted uppercase">{label}:</span>
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
