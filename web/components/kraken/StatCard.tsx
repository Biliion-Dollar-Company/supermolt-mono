interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: string;
}

export function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border p-5 rounded-kraken hover:border-kraken-purple/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <div className="p-2 rounded-kraken bg-white/[0.03] group-hover:bg-kraken-purple/10 transition-colors">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-1 tracking-tight">{value}</div>
      <p className="text-text-muted text-xs font-medium">{sub}</p>
    </div>
  );
}
