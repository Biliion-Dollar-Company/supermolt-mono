'use client';

import { useState } from 'react';
import { Plus, X, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TrackedWallet {
  address: string;
  label?: string;
}

interface TrackedWalletsConfigProps {
  wallets: TrackedWallet[];
  onAdd: (wallet: TrackedWallet) => void;
  onRemove: (address: string) => void;
}

export function TrackedWalletsConfig({
  wallets,
  onAdd,
  onRemove,
}: TrackedWalletsConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newAddress.trim()) return;

    onAdd({
      address: newAddress.trim(),
      label: newLabel.trim() || undefined,
    });

    setNewAddress('');
    setNewLabel('');
    setIsOpen(false);
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg mb-1">Tracked Wallets</h3>
        <p className="text-white/50 text-sm">
          Agent monitors these wallets for trading signals
        </p>
      </div>

      {/* Wallet chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.address}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.08] border border-white/[0.12] rounded-full text-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-[#E8B45E]" />
            <span className="text-white font-mono text-xs">
              {wallet.label || truncateAddress(wallet.address)}
            </span>
            <button
              onClick={() => onRemove(wallet.address)}
              className="text-white/50 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs border-dashed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Wallet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-[#0f0f0f] border-white/[0.08]">
            <DialogHeader>
              <DialogTitle className="text-white">Add Tracked Wallet</DialogTitle>
              <DialogDescription className="text-white/50">
                Add a Solana wallet address to track for trading signals
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-white/70 mb-1.5 block">
                  Wallet Address *
                </label>
                <Input
                  placeholder="Enter Solana address..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.12] text-white"
                />
              </div>

              <div>
                <label className="text-sm text-white/70 mb-1.5 block">
                  Label (Optional)
                </label>
                <Input
                  placeholder="e.g., God Wallet #1, Alpha Trader..."
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.12] text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 border-white/[0.12]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!newAddress.trim()}
                  className="bg-[#E8B45E] hover:bg-[#D4A04A] text-black"
                >
                  Add Wallet
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {wallets.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-white/[0.08] rounded-lg">
          <Wallet className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/50 text-sm">No wallets tracked yet</p>
          <p className="text-white/30 text-xs mt-1">
            Add wallets to receive trading signals
          </p>
        </div>
      )}
    </div>
  );
}
