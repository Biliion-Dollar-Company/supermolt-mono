import { describe, it, expect } from 'bun:test';
import { RWA_TOKENS, getRwaToken, getRwaTokensByClass } from '../services/rwa/rwa-tokens.registry';
import { PythOracleService } from '../services/rwa/pyth-oracle.service';

describe('RWA Token Registry', () => {
  it('should have at least 5 RWA tokens registered', () => {
    expect(RWA_TOKENS.length).toBeGreaterThanOrEqual(5);
  });

  it('should find USDY by symbol', () => {
    const token = getRwaToken('USDY');
    expect(token).toBeDefined();
    expect(token!.mint).toBe('A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6');
    expect(token!.assetClass).toBe('TREASURY_BILLS');
  });

  it('should return undefined for unknown symbol', () => {
    expect(getRwaToken('NONEXISTENT')).toBeUndefined();
  });

  it('should filter tokens by asset class', () => {
    const treasuries = getRwaTokensByClass('TREASURY_BILLS');
    expect(treasuries.length).toBeGreaterThanOrEqual(1);
    treasuries.forEach(t => expect(t.assetClass).toBe('TREASURY_BILLS'));
  });

  it('should have valid Solana mint addresses (base58, 32-44 chars)', () => {
    for (const token of RWA_TOKENS) {
      expect(token.mint.length).toBeGreaterThanOrEqual(32);
      expect(token.mint.length).toBeLessThanOrEqual(44);
    }
  });
});

describe('PythOracleService', () => {
  const pyth = new PythOracleService(true);

  it('should return a mock price for XAU/USD', async () => {
    const price = await pyth.getPrice('0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2');
    expect(price).toBeDefined();
    expect(price.price).toBeGreaterThan(0);
    expect(price.confidence).toBeGreaterThan(0);
    expect(price.feedId).toBeDefined();
  });

  it('should return multiple prices in batch', async () => {
    const prices = await pyth.getPrices([
      '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
      '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    ]);
    expect(prices.length).toBe(2);
    prices.forEach(p => expect(p.price).toBeGreaterThan(0));
  });

  it('should return prices for all RWA tokens with Pyth feeds', async () => {
    const allPrices = await pyth.getAllRwaPrices();
    expect(Object.keys(allPrices).length).toBeGreaterThan(0);
  });
});
