'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, FileCheck, Send, RefreshCw, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ComplianceStats } from '@/components/compliance/ComplianceStats';
import { ComplianceGateVisual } from '@/components/compliance/ComplianceGateVisual';
import { TravelRuleLog } from '@/components/compliance/TravelRuleLog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface DashboardStats {
  kyc: { total: number; verified: number; pending: number };
  kyt: { activeAlerts: number };
  aml: { totalScreenings: number; blocked: number };
  travelRule: { totalMessages: number };
  recentAuditLogs: AuditLog[];
}

interface AuditLog {
  id: string;
  action: string;
  entityId: string | null;
  result: string;
  riskLevel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface TravelRuleMessage {
  id: string;
  transferId: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  currency: string;
  senderName: string;
  senderWallet: string;
  receiverName: string;
  receiverWallet: string;
  ivms101Payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

interface AmlScreeningResult {
  id: string;
  walletAddress: string;
  chain: string;
  riskLevel: string;
  result: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    VERIFIED: 'bg-green-500/10 text-green-400',
    APPROVED: 'bg-green-500/10 text-green-400',
    PENDING: 'bg-amber-500/10 text-amber-400',
    REJECTED: 'bg-red-500/10 text-red-400',
    BLOCKED: 'bg-red-500/10 text-red-400',
    FLAGGED: 'bg-orange-500/10 text-orange-400',
  };
  return colors[status] || 'bg-white/5 text-white/40';
}

export default function CompliancePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [travelRuleMessages, setTravelRuleMessages] = useState<TravelRuleMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [amlInput, setAmlInput] = useState('');
  const [amlChain, setAmlChain] = useState('solana');
  const [amlResult, setAmlResult] = useState<AmlScreeningResult | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, trRes] = await Promise.allSettled([
        fetch(`${API_URL}/compliance/dashboard`),
        fetch(`${API_URL}/compliance/travel-rule/messages`),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) setStats(await dashRes.value.json());
      if (trRes.status === 'fulfilled' && trRes.value.ok) {
        const data = await trRes.value.json();
        setTravelRuleMessages(data.messages ?? []);
      }
    } catch { /* empty state */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAmlScreen = async () => {
    if (!amlInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/compliance/aml/screen/${amlInput.trim()}?chain=${amlChain}`);
      if (res.ok) {
        setAmlResult(await res.json());
        fetchData();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#07090F]">
      <div className="mx-auto w-full max-w-[1260px] px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Shield size={24} className="text-[#2563EB]" />
              <h1 className="text-xl font-semibold text-white">Compliance Dashboard</h1>
            </div>
            <p className="text-sm text-white/30 mt-1 ml-9">KYC · KYT · AML · Travel Rule</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="space-y-6">
          {/* Stats */}
          <ComplianceStats stats={stats} />

          {/* Pipeline Visual */}
          <ComplianceGateVisual />

          {/* Two-column: AML Screener + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AML Wallet Screener */}
            <div className="bg-[#0C1020] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm text-white/40 uppercase tracking-wider mb-4">AML Wallet Screener</h3>
              <div className="flex gap-2 mb-4">
                <input
                  value={amlInput}
                  onChange={(e) => setAmlInput(e.target.value)}
                  placeholder="Enter wallet address..."
                  className="flex-1 bg-[#080B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-[#2563EB]/30"
                  onKeyDown={(e) => e.key === 'Enter' && handleAmlScreen()}
                />
                <select
                  value={amlChain}
                  onChange={(e) => setAmlChain(e.target.value)}
                  className="bg-[#080B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none"
                >
                  <option value="solana">Solana</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="bsc">BSC</option>
                  <option value="base">Base</option>
                </select>
                <button
                  onClick={handleAmlScreen}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB]/10 text-[#2563EB] text-sm rounded-lg hover:bg-[#2563EB]/20 transition-colors"
                >
                  <Search size={14} />
                  Screen
                </button>
              </div>

              {amlResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 p-4 rounded-lg border ${
                    amlResult.result === 'BLOCKED'
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-green-500/5 border-green-500/20'
                  }`}
                >
                  {amlResult.result === 'BLOCKED' ? (
                    <XCircle size={20} className="text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle size={20} className="text-green-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm text-white/80 font-mono">{amlResult.walletAddress.slice(0, 20)}...</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge(amlResult.result)}`}>{amlResult.result}</span>
                      <span className="text-xs text-white/30">{amlResult.chain} · OFAC SDN</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {!amlResult && (
                <div className="text-center py-6 text-white/15 text-xs">
                  Try: <code className="text-white/30">0x000...dead</code> (blocked) or any address (approved)
                </div>
              )}
            </div>

            {/* Recent Compliance Activity */}
            <div className="bg-[#0C1020] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm text-white/40 uppercase tracking-wider mb-4">Recent Activity</h3>
              {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  {stats.recentAuditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center gap-2.5">
                        {log.result === 'APPROVED' ? <CheckCircle size={13} className="text-green-400" /> :
                         log.result === 'BLOCKED' ? <XCircle size={13} className="text-red-400" /> :
                         <AlertTriangle size={13} className="text-amber-400" />}
                        <div>
                          <div className="text-xs text-white/60">{log.action.replace(/_/g, ' ')}</div>
                          {log.entityId && <div className="text-[10px] text-white/25 font-mono">{log.entityId.slice(0, 12)}...</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusBadge(log.result)}`}>{log.result}</span>
                        <span className="text-[10px] text-white/15">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/15 text-xs">No compliance activity yet</div>
              )}
            </div>
          </div>

          {/* Travel Rule Messages */}
          <div className="bg-[#0C1020] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm text-white/40 uppercase tracking-wider mb-4">Travel Rule Messages (IVMS101)</h3>
            <TravelRuleLog messages={travelRuleMessages} />
          </div>
        </div>
      </div>
    </div>
  );
}
