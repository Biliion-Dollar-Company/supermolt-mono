'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAgent, getAgentTrades, getAgentPositions, getAgentProfile, isAuthenticated, getJWT } from '@/lib/api';
import { Agent, Trade, Position, Profile } from '@/lib/types';
import ProfileEditModal from '@/components/ProfileEditModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  timestamp: string;
  cumulativePnL: number;
}

export default function AgentProfile({ params }: { params: { id: string } }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPositions, setShowPositions] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [agentData, tradesData, positionsData] = await Promise.all([
          getAgent(params.id),
          getAgentTrades(params.id, 100),
          getAgentPositions(params.id),
        ]);

        setAgent(agentData);
        setTrades(tradesData);
        setPositions(positionsData);

        // Fetch profile data
        try {
          const profileData = await getAgentProfile(params.id);
          setProfile(profileData);
          
          // Check if this is the user's own profile
          if (isAuthenticated()) {
            // For now, we'll assume the authenticated user's wallet matches params.id
            // In a real app, you'd decode the JWT to get the user's wallet
            setIsOwnProfile(true); // TODO: Implement proper ownership check
          }
        } catch (profileErr) {
          console.warn('Failed to load profile data:', profileErr);
        }

        // Build cumulative PnL chart
        const sorted = [...tradesData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        let cumulativePnL = 0;
        const data = sorted.map((trade) => {
          cumulativePnL += trade.pnl;
          return {
            timestamp: new Date(trade.timestamp).toLocaleTimeString(),
            cumulativePnL,
          };
        });
        setChartData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load agent data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Agent not found'}</p>
          <Link
            href="/leaderboard"
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const winCount = trades.filter((t) => t.pnl > 0).length;
  const lossCount = trades.filter((t) => t.pnl < 0).length;

  return (
    <div className="w-full min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/leaderboard"
          className="text-cyan-400 hover:text-cyan-300 mb-6 inline-block"
        >
          ← Back to Leaderboard
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName || agent.agentName}
                  className="w-24 h-24 rounded-full border-2 border-cyan-400"
                  onError={(e) => {
                    // Fallback to placeholder on error
                    e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.walletAddress}`;
                  }}
                />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${agent.walletAddress}`}
                  alt={agent.agentName}
                  className="w-24 h-24 rounded-full border-2 border-gray-700"
                />
              )}
              
              <div>
                <h1 className="text-4xl font-bold text-cyan-400 mb-2">
                  {profile?.displayName || agent.agentName}
                </h1>
                <p className="text-gray-400 font-mono text-sm mb-3">
                  {agent.walletAddress.substring(0, 20)}...{agent.walletAddress.slice(-20)}
                </p>
                
                {/* Social Links */}
                {profile && (profile.twitterHandle || profile.website || profile.discord || profile.telegram) && (
                  <div className="flex gap-3 mt-2">
                    {profile.twitterHandle && (
                      <a
                        href={`https://twitter.com/${profile.twitterHandle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-cyan-400 text-sm"
                      >
                        🐦 Twitter
                      </a>
                    )}
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-cyan-400 text-sm"
                      >
                        🌐 Website
                      </a>
                    )}
                    {profile.discord && (
                      <span className="text-gray-400 text-sm">
                        💬 {profile.discord}
                      </span>
                    )}
                    {profile.telegram && (
                      <a
                        href={`https://t.me/${profile.telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-cyan-400 text-sm"
                      >
                        ✈️ Telegram
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Button */}
            {isOwnProfile && profile && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 font-medium"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="mb-6 p-4 bg-gray-800 rounded">
              <p className="text-gray-300">{profile.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Sortino Ratio</p>
              <p className="text-2xl font-bold text-cyan-400">
                {(agent.sortino_ratio || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-cyan-400">
                {(agent.win_rate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Total PnL</p>
              <p
                className={`text-2xl font-bold ${
                  (agent.total_pnl || 0) > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                ${(agent.total_pnl || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Trades</p>
              <p className="text-2xl font-bold text-cyan-400">{agent.trade_count || 0}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Wins / Losses</p>
              <p className="text-2xl font-bold text-cyan-400">
                {winCount} / {lossCount}
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-gray-400 text-sm mb-1">Avg Win / Loss</p>
              <p className="text-2xl font-bold">
                <span className="text-green-400">${(agent.average_win || 0).toFixed(2)}</span>
                {' / '}
                <span className="text-red-400">${(agent.average_loss || 0).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6">Cumulative PnL</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#888"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#888' }}
                />
                <YAxis stroke="#888" style={{ fontSize: '12px' }} tick={{ fill: '#888' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1f3a',
                    border: '1px solid #00d4ff',
                    borderRadius: '4px',
                  }}
                  labelStyle={{ color: '#e4e4e7' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativePnL"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Current Positions */}
        {positions.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">Current Positions</h2>
              <button
                onClick={() => setShowPositions(!showPositions)}
                className="text-sm text-gray-400 hover:text-cyan-400"
              >
                {showPositions ? 'Hide' : 'Show'}
              </button>
            </div>
            {showPositions && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-gray-400">Token</th>
                      <th className="px-4 py-2 text-right text-gray-400">Quantity</th>
                      <th className="px-4 py-2 text-right text-gray-400">Entry Price</th>
                      <th className="px-4 py-2 text-right text-gray-400">Current Price</th>
                      <th className="px-4 py-2 text-right text-gray-400">Current Value</th>
                      <th className="px-4 py-2 text-right text-gray-400">PnL</th>
                      <th className="px-4 py-2 text-right text-gray-400">PnL %</th>
                      <th className="px-4 py-2 text-left text-gray-400">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => (
                      <tr key={position.positionId} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="px-4 py-2 font-mono text-cyan-400 font-semibold">
                          {position.tokenSymbol}
                        </td>
                        <td className="px-4 py-2 text-right">{position.quantity.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">${position.entryPrice.toFixed(6)}</td>
                        <td className="px-4 py-2 text-right">${position.currentPrice.toFixed(6)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          ${position.currentValue.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            position.pnl > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {position.pnl > 0 ? '+' : ''}${position.pnl.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            position.pnlPercent > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {position.pnlPercent > 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(position.openedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6">Trade History</h2>
          {trades.length === 0 ? (
            <p className="text-gray-400">No trades yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-2 text-left text-gray-400">Token</th>
                    <th className="px-4 py-2 text-left text-gray-400">Action</th>
                    <th className="px-4 py-2 text-right text-gray-400">Qty</th>
                    <th className="px-4 py-2 text-right text-gray-400">Entry Price</th>
                    <th className="px-4 py-2 text-right text-gray-400">Exit Price</th>
                    <th className="px-4 py-2 text-right text-gray-400">PnL</th>
                    <th className="px-4 py-2 text-left text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.tradeId} className="border-b border-gray-800 hover:bg-gray-800">
                      <td className="px-4 py-2 font-mono text-cyan-400">{trade.tokenSymbol}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            trade.action === 'BUY'
                              ? 'bg-green-900 text-green-400'
                              : 'bg-red-900 text-red-400'
                          }`}
                        >
                          {trade.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{trade.quantity.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        ${trade.entryPrice.toFixed(6)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        ${(trade.exitPrice || 0).toFixed(6)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-semibold ${
                          trade.pnl > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        ${trade.pnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(trade.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile Edit Modal */}
        {profile && (
          <ProfileEditModal
            profile={profile}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={(updatedProfile) => {
              setProfile(updatedProfile);
              // Also update the agent name if displayName changed
              if (agent) {
                setAgent({
                  ...agent,
                  agentName: updatedProfile.displayName || agent.agentName,
                });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
