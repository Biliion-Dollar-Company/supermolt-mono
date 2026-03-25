'use client';

interface YieldEntry {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: string;
}

export function YieldTable({ yields }: { yields: YieldEntry[] }) {
  if (yields.length === 0) {
    return <div className="text-center py-8 text-white/20 text-sm">No yield data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Asset</th>
            <th className="text-right py-3 px-4 text-white/40 text-xs uppercase tracking-wider">APY</th>
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Issuer</th>
            <th className="text-left py-3 px-4 text-white/40 text-xs uppercase tracking-wider">Class</th>
          </tr>
        </thead>
        <tbody>
          {yields.sort((a, b) => b.apy - a.apy).map((y) => (
            <tr key={y.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="py-3 px-4">
                <div className="text-white/80 font-medium">{y.symbol}</div>
                <div className="text-[10px] text-white/30">{y.name}</div>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-green-400 font-mono font-semibold">{y.apy.toFixed(2)}%</span>
              </td>
              <td className="py-3 px-4 text-white/50">{y.issuer}</td>
              <td className="py-3 px-4 text-white/40 text-xs">{y.assetClass.replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
