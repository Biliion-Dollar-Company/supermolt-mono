'use client';

import { motion } from 'framer-motion';
import { User, Shield, Search, Eye, Send, CheckCircle, XCircle } from 'lucide-react';

const STEPS = [
  { label: 'Agent', icon: User, color: '#5741D9' },
  { label: 'KYC', icon: Shield, color: '#4ade80' },
  { label: 'AML', icon: Search, color: '#60a5fa' },
  { label: 'KYT', icon: Eye, color: '#f59e0b' },
  { label: 'Travel Rule', icon: Send, color: '#a78bfa' },
  { label: 'Transfer', icon: CheckCircle, color: '#4ade80' },
];

export function ComplianceGateVisual() {
  return (
    <div className="bg-[#0C1020] border border-white/[0.06] rounded-xl p-6">
      <h3 className="text-sm text-white/40 uppercase tracking-wider mb-6">Compliance Pipeline</h3>
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2 min-w-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                style={{ borderColor: step.color, backgroundColor: `${step.color}10` }}
              >
                <step.icon size={20} style={{ color: step.color }} />
              </div>
              <span className="text-[10px] text-white/50 whitespace-nowrap">{step.label}</span>
            </motion.div>

            {i < STEPS.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.15 + 0.1 }}
                className="h-px bg-gradient-to-r from-white/20 to-white/5 flex-1 min-w-[20px] origin-left mb-5"
              />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 text-[10px] text-white/30">
        <div className="flex items-center gap-1">
          <CheckCircle size={10} className="text-green-400" />
          <span>APPROVED — transfer proceeds</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangleIcon size={10} className="text-amber-400" />
          <span>FLAGGED — proceeds with enhanced logging</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle size={10} className="text-red-400" />
          <span>BLOCKED — transfer denied</span>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
