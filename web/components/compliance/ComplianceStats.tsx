'use client';

import { motion } from 'framer-motion';
import { Shield, AlertTriangle, FileCheck, Send } from 'lucide-react';

interface Stats {
  kyc: { total: number; verified: number; pending: number };
  kyt: { activeAlerts: number };
  aml: { totalScreenings: number; blocked: number };
  travelRule: { totalMessages: number };
}

export function ComplianceStats({ stats }: { stats: Stats | null }) {
  const cards = [
    {
      label: 'KYC Verified',
      value: stats?.kyc.verified ?? 0,
      sub: `${stats?.kyc.pending ?? 0} pending`,
      icon: Shield,
      color: '#4ade80',
    },
    {
      label: 'KYT Alerts',
      value: stats?.kyt.activeAlerts ?? 0,
      sub: 'unresolved',
      icon: AlertTriangle,
      color: stats?.kyt.activeAlerts ? '#f59e0b' : '#4ade80',
    },
    {
      label: 'AML Screenings',
      value: stats?.aml.totalScreenings ?? 0,
      sub: `${stats?.aml.blocked ?? 0} blocked`,
      icon: FileCheck,
      color: stats?.aml.blocked ? '#ef4444' : '#4ade80',
    },
    {
      label: 'Travel Rule',
      value: stats?.travelRule.totalMessages ?? 0,
      sub: 'IVMS101 messages',
      icon: Send,
      color: '#2563EB',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-[#0C1020] border border-white/[0.06] rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <card.icon size={16} style={{ color: card.color }} />
            <span className="text-xs text-white/40 uppercase tracking-wider">{card.label}</span>
          </div>
          <div className="text-2xl font-semibold text-white font-mono">{card.value}</div>
          <div className="text-xs text-white/30 mt-1">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
