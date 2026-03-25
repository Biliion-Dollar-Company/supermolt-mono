/**
 * RWA Token Registry — single source of truth for all supported RWA tokens.
 * Mint addresses are for Solana mainnet. Pyth feed IDs from https://pyth.network/developers/price-feed-ids
 */

export type AssetClassType =
  | 'CRYPTO'
  | 'TREASURY_BILLS'
  | 'EQUITIES'
  | 'GOLD'
  | 'REAL_ESTATE'
  | 'FIXED_INCOME'
  | 'GOVERNMENT_BONDS';

export interface RwaTokenInfo {
  symbol: string;
  name: string;
  mint: string;
  assetClass: AssetClassType;
  issuer: string;
  estimatedYield: number | null;
  pythFeedId: string | null;
  decimals: number;
  description: string;
}

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const RWA_TOKENS: RwaTokenInfo[] = [
  {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
    assetClass: 'TREASURY_BILLS',
    issuer: 'Ondo Finance',
    estimatedYield: 4.0,
    pythFeedId: null,
    decimals: 6,
    description: 'Yield-bearing token backed by short-term US Treasuries (~4% APY)',
  },
  {
    symbol: 'PRCL',
    name: 'Parcl',
    mint: '4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs',
    assetClass: 'REAL_ESTATE',
    issuer: 'Parcl',
    estimatedYield: null,
    pythFeedId: null,
    decimals: 6,
    description: 'Synthetic perpetual futures on city-specific real estate price indices',
  },
  {
    symbol: 'CETES',
    name: 'Etherfuse CETES',
    mint: 'CETES7CKqqKQizuSN6iWQwmTeFRjbJR6Vw2XRKfEDR8f',
    assetClass: 'GOVERNMENT_BONDS',
    issuer: 'Etherfuse',
    estimatedYield: 10.5,
    pythFeedId: null,
    decimals: 6,
    description: 'Tokenized Mexican government bonds (CETES)',
  },
  {
    symbol: 'XAU',
    name: 'Gold (Pyth Feed)',
    mint: 'GOLD_PLACEHOLDER_MINT_ADDRESS_TBD_ON_MAINNET',
    assetClass: 'GOLD',
    issuer: 'Matrixdock (XAUm)',
    estimatedYield: null,
    pythFeedId: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    decimals: 6,
    description: 'Tokenized LBMA gold (1 token = 1 troy oz)',
  },
  {
    symbol: 'syrupUSDC',
    name: 'Maple syrupUSDC',
    mint: 'SYRUP_USDC_PLACEHOLDER_MINT_TBD_ON_MAINNET',
    assetClass: 'FIXED_INCOME',
    issuer: 'Maple Finance',
    estimatedYield: 6.75,
    pythFeedId: null,
    decimals: 6,
    description: 'Institutional overcollateralized lending (~6.5-7% APY)',
  },
  {
    symbol: 'SPYx',
    name: 'Backed SPY ETF',
    mint: 'SPY_BACKED_PLACEHOLDER_MINT_TBD_ON_MAINNET',
    assetClass: 'EQUITIES',
    issuer: 'Backed Finance',
    estimatedYield: null,
    pythFeedId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    decimals: 6,
    description: 'Tokenized S&P 500 ETF (1:1 backed by real shares)',
  },
];

export function getRwaToken(symbol: string): RwaTokenInfo | undefined {
  return RWA_TOKENS.find(t => t.symbol === symbol);
}

export function getRwaTokensByClass(assetClass: AssetClassType): RwaTokenInfo[] {
  return RWA_TOKENS.filter(t => t.assetClass === assetClass);
}
