import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrainrotLandingPage } from './intel/BrainrotLandingPage';

// Mock the API calls
vi.mock('@/lib/api', () => ({
  getPnL: vi.fn(() => Promise.resolve({
    totalPnlUsd: 125.50,
    trades: [
      {
        id: 'trade-1',
        agentId: '1',
        tokenSymbol: 'BTC',
        action: 'BUY',
        openedAt: new Date().toISOString(),
        pnl: 5.25
      }
    ]
  })),
  SANDBOX_MODE: true
}));

describe('Kraken Mission Dashboard', () => {
  it('should render the institutional terminal identity', async () => {
    render(<BrainrotLandingPage />);
    
    // Check for Terminal branding
    expect(screen.getByText(/TRENCH/)).toBeDefined();
    expect(screen.getByText(/Terminal/i)).toBeDefined();
    
    // Check for Kraken CLI Status
    expect(screen.getByText(/KRAKEN CLI/i)).toBeDefined();
    expect(screen.getByText(/v1.2.0/i)).toBeDefined();
  });

  it('should display the auditable execution log header', () => {
    render(<BrainrotLandingPage />);
    expect(screen.getByText(/EXECUTION LOG/i)).toBeDefined();
  });

  it('should apply the standardized 12px rounded borders (kraken radius)', () => {
    const { container } = render(<BrainrotLandingPage />);
    
    // Check for rounded-kraken class on status badges or cards
    // In our implementation, we used rounded-kraken and bg-bg-secondary
    const cards = container.getElementsByClassName('rounded-kraken');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should show active tactical units', () => {
    render(<BrainrotLandingPage />);
    expect(screen.getByText(/ACTIVE UNITS/i)).toBeDefined();
    expect(screen.getByText(/⚡ Scalper Bot/i)).toBeDefined();
  });
});
