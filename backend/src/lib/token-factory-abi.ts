/**
 * Four.Meme TokenManager2 ABI — BSC Token Launcher
 *
 * Contract: 0x5c952063c7fc8610FFDB798152D69F0B9550762b (BSC Mainnet)
 *
 * Sourced from: github.com/slightlyuseless/fourMemeLauncher/docs/TokenManager2.lite.abi
 * and Four.Meme official protocol docs (API-Documents.md).
 *
 * We include only the functions/events we actually call. The full ABI has many more
 * overloads (buyToken 4x, buyTokenAMAP 4x, sellToken 6x) — add as needed.
 */

export const FOUR_MEME_TOKEN_MANAGER_ABI = [
  // ── Core Functions ────────────────────────────────────────

  // createToken(bytes args, bytes signature) payable
  // args + signature come from Four.Meme API /private/token/create
  // value = 0.01 BNB (creation fee) + presaleBNB
  {
    type: 'function',
    name: 'createToken',
    inputs: [
      { name: 'args', type: 'bytes', internalType: 'bytes' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },

  // buyTokenAMAP(address token, uint256 funds, uint256 minAmount) payable
  // Buy tokens on the bonding curve — spend `funds` BNB, get at least `minAmount` tokens
  {
    type: 'function',
    name: 'buyTokenAMAP',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'funds', type: 'uint256', internalType: 'uint256' },
      { name: 'minAmount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },

  // sellToken(address token, uint256 amount) — simple sell, no fee recipient
  {
    type: 'function',
    name: 'sellToken',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── View Functions ────────────────────────────────────────

  // _tokenInfos(address) — bonding curve state for a token
  // Returns the full TokenInfo struct (13 fields)
  {
    type: 'function',
    name: '_tokenInfos',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'base', type: 'address', internalType: 'address' },
      { name: 'quote', type: 'address', internalType: 'address' },
      { name: 'template', type: 'uint256', internalType: 'uint256' },
      { name: 'totalSupply', type: 'uint256', internalType: 'uint256' },
      { name: 'maxOffers', type: 'uint256', internalType: 'uint256' },
      { name: 'maxRaising', type: 'uint256', internalType: 'uint256' },
      { name: 'launchTime', type: 'uint256', internalType: 'uint256' },
      { name: 'offers', type: 'uint256', internalType: 'uint256' },
      { name: 'funds', type: 'uint256', internalType: 'uint256' },
      { name: 'lastPrice', type: 'uint256', internalType: 'uint256' },
      { name: 'K', type: 'uint256', internalType: 'uint256' },
      { name: 'T', type: 'uint256', internalType: 'uint256' },
      { name: 'status', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },

  // _launchFee() — current token creation fee in wei
  {
    type: 'function',
    name: '_launchFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },

  // _tokenCount() — total tokens created
  {
    type: 'function',
    name: '_tokenCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },

  // ── Events ────────────────────────────────────────────────
  // NOTE: All params are non-indexed in the real contract

  // TokenCreate(address creator, address token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)
  {
    type: 'event',
    name: 'TokenCreate',
    inputs: [
      { name: 'creator', type: 'address', indexed: false, internalType: 'address' },
      { name: 'token', type: 'address', indexed: false, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'name', type: 'string', indexed: false, internalType: 'string' },
      { name: 'symbol', type: 'string', indexed: false, internalType: 'string' },
      { name: 'totalSupply', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'launchTime', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'launchFee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },

  // TokenPurchase(address token, address account, uint256 price, uint256 amount, uint256 cost, uint256 fee, uint256 offers, uint256 funds)
  {
    type: 'event',
    name: 'TokenPurchase',
    inputs: [
      { name: 'token', type: 'address', indexed: false, internalType: 'address' },
      { name: 'account', type: 'address', indexed: false, internalType: 'address' },
      { name: 'price', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'cost', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'offers', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'funds', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },

  // TokenSale(address token, address account, uint256 price, uint256 amount, uint256 cost, uint256 fee, uint256 offers, uint256 funds)
  {
    type: 'event',
    name: 'TokenSale',
    inputs: [
      { name: 'token', type: 'address', indexed: false, internalType: 'address' },
      { name: 'account', type: 'address', indexed: false, internalType: 'address' },
      { name: 'price', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'cost', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'offers', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'funds', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },

  // LiquidityAdded(address base, uint256 offers, address quote, uint256 funds)
  {
    type: 'event',
    name: 'LiquidityAdded',
    inputs: [
      { name: 'base', type: 'address', indexed: false, internalType: 'address' },
      { name: 'offers', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'quote', type: 'address', indexed: false, internalType: 'address' },
      { name: 'funds', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },

  // TradeStop(address token)
  {
    type: 'event',
    name: 'TradeStop',
    inputs: [
      { name: 'token', type: 'address', indexed: false, internalType: 'address' },
    ],
    anonymous: false,
  },
] as const;

/** Standard ERC-20 ABI (subset needed for transfers) */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;
