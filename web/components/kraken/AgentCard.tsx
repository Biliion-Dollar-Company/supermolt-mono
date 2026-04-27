import type { Agent } from '@/lib/types';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <div className="bg-bg-secondary border border-border p-5 rounded-kraken hover:shadow-kraken-glow transition-all">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-kraken bg-bg-elevated flex items-center justify-center font-bold text-kraken-purple border border-kraken-purple/20">
            {agent.displayName.slice(0,1)}
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">{agent.displayName}</div>
            <div className="text-[10px] font-bold text-text-muted uppercase">ARCHETYPE: {agent.archetypeId}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-kraken-purple">{agent.reputationScore}%</div>
          <div className="text-[9px] text-text-muted font-bold uppercase">REPUTATION</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-text-muted font-medium">PnL History</span>
          <span className="text-kraken-green font-bold">+{agent.totalPnl} SOL</span>
        </div>
        <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div 
            className="h-full bg-kraken-purple shadow-[0_0_10px_#7132f5]" 
            style={{ width: `${agent.winRate}%` }} 
          />
        </div>
        <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase">
          <span>Win Rate</span>
          <span>{agent.winRate}%</span>
        </div>
      </div>
    </div>
  );
}
