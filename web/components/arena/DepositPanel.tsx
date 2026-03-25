'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Wallet, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getMyAgentBalance, api } from '@/lib/api';

const GOLD = '#2563EB';

interface BalanceData {
  address: string | null;
  solBalance: number;
  usdValue: number;
  hasWallet: boolean;
}

export function DepositPanel() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const fetchBalance = useCallback(async () => {
    try {
      const data = await getMyAgentBalance();
      setBalance(data);
    } catch (err) {
      console.error('[DepositPanel] Failed to fetch balance:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance().then(async () => {
      // Submit saved referral code if present
      const savedRef = localStorage.getItem('supermolt_ref');
      if (savedRef) {
        try {
          await api.post('/referral/use', { code: savedRef });
          localStorage.removeItem('supermolt_ref');
        } catch {
          // Ignore — may already be recorded or invalid
        }
      }
      // Fetch user's own referral code
      try {
        const refRes = await api.get('/referral/my-code');
        setReferralCode(refRes.data?.data?.code || '');
      } catch { /* ignore */ }
    });
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const copyAddress = () => {
    if (!balance?.address) return;
    navigator.clipboard.writeText(balance.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBalance();
  };

  if (loading) {
    return (
      <div
        className="p-4 animate-pulse"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="h-4 w-24 bg-white/5 rounded mb-3" />
        <div className="h-32 w-32 bg-white/5 rounded mx-auto mb-3" />
        <div className="h-3 w-full bg-white/5 rounded" />
      </div>
    );
  }

  if (!balance?.hasWallet) {
    return (
      <div
        className="p-4"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} style={{ color: GOLD }} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
            Agent Wallet
          </span>
        </div>
        <p className="text-xs text-white/35">
          Wallet not yet created. Sign in again to initialize.
        </p>
      </div>
    );
  }

  const truncatedAddress = balance.address
    ? `${balance.address.slice(0, 6)}...${balance.address.slice(-4)}`
    : '';

  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} style={{ color: GOLD }} />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
            Agent Wallet
          </span>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
          title="Refresh balance"
        >
          <RefreshCw size={12} className={`text-white/35 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-mono font-bold text-white/90">
          {balance.solBalance.toFixed(4)} <span className="text-sm text-white/35">SOL</span>
        </div>
        {balance.usdValue > 0 && (
          <div className="text-xs text-white/35 font-mono">
            ≈ ${balance.usdValue.toFixed(2)} USD
          </div>
        )}
      </div>

      <div className="flex justify-center mb-4 p-3 bg-white rounded">
        <QRCodeSVG value={balance.address!} size={120} level="M" />
      </div>

      <button
        onClick={copyAddress}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors rounded cursor-pointer"
      >
        <span className="text-xs font-mono text-white/55 truncate">
          {truncatedAddress}
        </span>
        {copied ? (
          <Check size={14} style={{ color: GOLD }} className="flex-shrink-0" />
        ) : (
          <Copy size={14} className="text-white/35 flex-shrink-0" />
        )}
      </button>

      <p className="text-[10px] text-white/25 mt-3 leading-relaxed">
        Send SOL to this address. Your agent starts trading automatically.
      </p>

      {referralCode && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Your referral code</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${referralCode}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-[10px] font-mono px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] rounded transition-colors cursor-pointer"
              style={{ color: GOLD }}
            >
              {referralCode}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
