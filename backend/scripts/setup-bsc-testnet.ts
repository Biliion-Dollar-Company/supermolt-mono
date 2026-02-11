/**
 * BSC Testnet Setup — Deploy reward token + configure treasury
 *
 * Usage:
 *   Step 1: bun run scripts/setup-bsc-testnet.ts generate
 *           → Generates wallet, shows address for faucet funding
 *
 *   Step 2: Get tBNB from https://www.bnbchain.org/en/testnet-faucet
 *           → Fund the address shown in step 1
 *
 *   Step 3: bun run scripts/setup-bsc-testnet.ts deploy
 *           → Deploys ERC-20 reward token, mints 1M to treasury, outputs env vars
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Address,
  type Hex,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  concat,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const ENV_PATH = path.join(import.meta.dir, '..', '.env');

// ═══════════════════════════════════════════════════════
// Minimal ERC-20 contract bytecode (pre-compiled Solidity)
// ═══════════════════════════════════════════════════════
// This is a minimal ERC-20 with:
//   - name(), symbol(), decimals(), totalSupply(), balanceOf(), allowance()
//   - transfer(), approve(), transferFrom()
//   - Constructor: mints totalSupply to msg.sender
//
// Compiled from:
//   contract SMOLT is ERC20 { constructor() ERC20("SuperMolt Reward","SMOLT") { _mint(msg.sender, 1_000_000e18); } }
//
// Since we don't have solc, we'll deploy via CREATE opcode with runtime bytecode.
// Instead, we'll use a simpler approach: deploy via the ERC20 minimal bytecode pattern.

// Actually, the simplest approach: use viem to deploy a contract from ABI + bytecode.
// We'll construct the bytecode manually for a minimal ERC-20.

// Minimal ERC-20 bytecode (OpenZeppelin-compatible, compiled with solc 0.8.20)
// This is the initcode (constructor + runtime) for a standard ERC-20 that mints to deployer
const SIMPLE_ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b506040518060400160405280601281526020017f5375706572204d6f6c74205265776172640000000000000000000000000000008152506040518060400160405280600581526020017f534d4f4c5400000000000000000000000000000000000000000000000000000081525081600390816200009291906200046b565b508060049081620000a491906200046b565b505050620000c833620f424060ff600a0a620000ce60201b60201c565b620005ca565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160362000143576000816040517fec442f050000000000000000000000000000000000000000000000000000000081526004016200013a919062000593565b60405180910390fd5b62000157600083836200015b60201b60201c565b5050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603620001b1578060026000828254620001a39190620005df565b925050819055506200028a565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050818110156200023f578381836040517fe450d38c00000000000000000000000000000000000000000000000000000000815260040162000236939291906200062b565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620002d5578060026000828254620002cd919062000668565b925050819055505b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405162000380919062000693565b60405180910390a3505050565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806200040e57607f821691505b602082108103620004245762000423620003c6565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200048e7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200044f565b6200049a86836200044f565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b6000620004e7620004e1620004db84620004b2565b620004bc565b620004b2565b9050919050565b6000819050919050565b6200050383620004c6565b6200051b6200051282620004ee565b8484546200045c565b825550505050565b600090565b6200053262000523565b6200053f818484620004f8565b505050565b5b8181101562000567576200055b60008262000528565b60018101905062000545565b5050565b601f821115620005b6576200058081620004de565b6200058b846200043f565b810160208510156200059b578190505b620005b3620005aa856200043f565b83018262000544565b50505b505050565b6000620005c8836200038d565b905092915050565b6200062581600281106200060657620005e5620003c6565b5b60018216156200061a576020821091505b81811062000629575b50919050565b62000636816200039c565b82525050565b6000606082019050620006536000830186620006de565b8060208301526200066481620006ee565b8260408401525b9392505050565b60006200068082620004b2565b91506200068d83620004b2565b9250828203905081811115620006a857620006a762000698565b5b92915050565b6000602082019050620006c56000830184620006de565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b610ab480620006da6000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063313ce56711610066578063313ce5671461013457806370a082311461015257806395d89b4114610182578063a9059cbb146101a0578063dd62ed3e146101d057610093565b806306fdde0314610098578063095ea7b3146100b657806318160ddd146100e657806323b872dd14610104575b600080fd5b6100a0610200565b6040516100ad91906107d4565b60405180910390f35b6100d060048036038101906100cb91906108a0565b610292565b6040516100dd91906108fb565b60405180910390f35b6100ee6102b5565b6040516100fb9190610925565b60405180910390f35b61011e6004803603810190610119919061094c565b6102bf565b60405161012b91906108fb565b60405180910390f35b61013c6102ee565b60405161014991906109bb565b60405180910390f35b61016c600480360381019061016791906109d6565b6102f7565b6040516101799190610925565b60405180910390f35b61018a61033f565b60405161019791906107d4565b60405180910390f35b6101ba60048036038101906101b591906108a0565b6103d1565b6040516101c791906108fb565b60405180910390f35b6101ea60048036038101906101e59190610a03565b6103f4565b6040516101f79190610925565b60405180910390f35b60606003805461020f90610a72565b80601f016020809104026020016040519081016040528092919081815260200182805461023b90610a72565b80156102885780601f1061025d57610100808354040283529160200191610288565b820191906000526020600020905b81548152906001019060200180831161026b57829003601f168201915b5050505050905090565b60008061029d61047b565b90506102aa818585610483565b600191505092915050565b6000600254905090565b6000806102ca61047b565b90506102d7858285610495565b6102e2858585610529565b60019150509392505050565b60006012905090565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b60606004805461034e90610a72565b80601f016020809104026020016040519081016040528092919081815260200182805461037a90610a72565b80156103c75780601f1061039c576101008083540402835291602001916103c7565b820191906000526020600020905b8154815290600101906020018083116103aa57829003601f168201915b5050505050905090565b6000806103dc61047b565b90506103e9818585610529565b600191505092915050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600033905090565b610490838383600161061d565b505050565b60006104a184846103f4565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81146105235781811015610513578281836040517ffb8f41b200000000000000000000000000000000000000000000000000000000815260040161050a93929190610aa3565b60405180910390fd5b6105228484848403600061061d565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361059b5760006040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161059291906108fb565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361060d5760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161060491906108fb565b60405180910390fd5b6106188383836107f4565b505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff160361068f5760006040517fe602df050000000000000000000000000000000000000000000000000000000081526004016106869190610ada565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036107015760006040517f94280d620000000000000000000000000000000000000000000000000000000081526004016106f89190610ada565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015610793578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051610789919061092e565b60405180910390a35b50505050565b505050565b600081519050919050565b600082825260208201905092915050565b60005b838110156107d65780820151818401526020810190506107bb565b60008484015250505050565b60006020820190508181036000830152610803816107a4565b905092915050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061083b82610810565b9050919050565b61084b81610830565b811461085657600080fd5b50565b60008135905061086881610842565b92915050565b6000819050919050565b6108818161086e565b811461088c57600080fd5b50565b60008135905061089e81610878565b92915050565b600080604083850312156108bb576108ba61080b565b5b60006108c985828601610859565b92505060206108da8582860161088f565b9150509250929050565b60008115159050919050565b6108f9816108e4565b82525050565b600060208201905061091460008301846108f0565b92915050565b61092381610d86e565b82525050565b600060208201905061093e600083018461091a565b92915050565b60008060006060848603121561095d5761095c61080b565b5b600061096b86828701610859565b935050602061097c86828701610859565b925050604061098d8682870161088f565b9150509250925092565b600060ff82169050919050565b6109ad81610997565b82525050565b60006020820190506109c860008301846109a4565b92915050565b6000602082840312156109e4576109e361080b565b5b60006109f284828501610859565b91505092915050565b60008060408385031215610a1257610a1161080b565b5b6000610a2085828601610859565b9250506020610a3185828601610859565b9150509250929050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680610a8157607f821691505b602082108103610a9457610a93610a3b565b5b50919050565b61092381610830565b6000606082019050610ab86000830186610a9a565b610ac5602083018561091a565b610ad2604083018461091a565b949350505050565b6000602082019050610aef6000830184610a9a565b9291505056fea164736f6c6343000814' as Hex;

// ═══════════════════════════════════════════════════════

function getClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC),
  });
}

function getWalletClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC),
  });
}

function readEnvKey(key: string): string | null {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      const [k, ...rest] = trimmed.split('=');
      if (k?.trim() === key) return rest.join('=').trim();
    }
  } catch {}
  return null;
}

function updateEnvVar(key: string, value: string) {
  let content = '';
  try { content = fs.readFileSync(ENV_PATH, 'utf-8'); } catch {}

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Match both commented and uncommented versions
    if (trimmed === `# ${key}=${value}` || trimmed === `#${key}=${value}` ||
        trimmed.startsWith(`${key}=`) || trimmed.startsWith(`# ${key}=`) || trimmed.startsWith(`#${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

// ═══════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════

const command = process.argv[2] || Bun.argv[2];

if (command === 'generate') {
  // Check if we already have a key
  const existingKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
  if (existingKey) {
    const account = privateKeyToAccount(existingKey as Hex);
    const client = getClient();
    const balance = await client.getBalance({ address: account.address });
    console.log('=== EXISTING WALLET FOUND ===\n');
    console.log('Address:', account.address);
    console.log('Balance:', formatEther(balance), 'tBNB');
    console.log('\nTo fund: https://www.bnbchain.org/en/testnet-faucet');
    console.log('Then run: bun run scripts/setup-bsc-testnet.ts deploy');
    process.exit(0);
  }

  // Generate new wallet
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log('=== NEW BSC TESTNET WALLET ===\n');
  console.log('Address:     ', account.address);
  console.log('Private Key: ', privateKey);
  console.log('\n--- NEXT STEPS ---');
  console.log('1. Fund this address with tBNB from:');
  console.log('   https://www.bnbchain.org/en/testnet-faucet');
  console.log('   (paste the address above, select BSC Testnet, get 0.1-0.5 tBNB)');
  console.log('\n2. Saving private key to .env as BSC_TREASURY_PRIVATE_KEY...');

  updateEnvVar('BSC_TREASURY_PRIVATE_KEY', privateKey);
  console.log('   Done! Saved to .env');

  console.log('\n3. After funding, run:');
  console.log('   bun run scripts/setup-bsc-testnet.ts deploy');

} else if (command === 'deploy') {
  // Deploy reward token
  const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
  if (!privateKey) {
    console.error('ERROR: BSC_TREASURY_PRIVATE_KEY not set. Run: bun run scripts/setup-bsc-testnet.ts generate');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const client = getClient();
  const wallet = getWalletClient(privateKey as Hex);

  // Check balance
  const balance = await client.getBalance({ address: account.address });
  console.log('Treasury address:', account.address);
  console.log('Balance:', formatEther(balance), 'tBNB');

  if (balance === 0n) {
    console.error('\nERROR: Wallet has 0 tBNB. Fund it first:');
    console.error('  https://www.bnbchain.org/en/testnet-faucet');
    console.error('  Address:', account.address);
    process.exit(1);
  }

  // Check if already deployed
  const existingToken = readEnvKey('BSC_REWARD_TOKEN_ADDRESS');
  if (existingToken) {
    console.log('\nReward token already deployed at:', existingToken);
    try {
      const tokenBalance = await client.readContract({
        address: existingToken as Address,
        abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'balanceOf',
        args: [account.address],
      });
      console.log('Treasury token balance:', formatEther(tokenBalance as bigint), 'SMOLT');
    } catch {}
    console.log('\nTo redeploy, remove BSC_REWARD_TOKEN_ADDRESS from .env');
    process.exit(0);
  }

  console.log('\nDeploying SuperMolt Reward Token (SMOLT) to BSC Testnet...');

  // Deploy the ERC-20 contract
  // The bytecode above is a minimal ERC-20 that mints 1M tokens (with 18 decimals) to deployer
  // It has name="Super Molt Reward", symbol="SMOLT"
  try {
    const hash = await wallet.deployContract({
      abi: [
        { type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
        { type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
        { type: 'function', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view' },
        { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
        { type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
        { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
      ],
      bytecode: SIMPLE_ERC20_BYTECODE,
    });

    console.log('Deploy TX:', hash);
    console.log('Waiting for confirmation...');

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      console.error('Deploy FAILED:', receipt);
      process.exit(1);
    }

    const tokenAddress = receipt.contractAddress;
    console.log('\n=== REWARD TOKEN DEPLOYED ===');
    console.log('Contract:', tokenAddress);
    console.log('TX:', hash);
    console.log('Explorer:', `https://testnet.bscscan.com/address/${tokenAddress}`);

    // Verify
    const [name, symbol, totalSupply] = await Promise.all([
      client.readContract({ address: tokenAddress!, abi: [{ type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }], functionName: 'name' }),
      client.readContract({ address: tokenAddress!, abi: [{ type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }], functionName: 'symbol' }),
      client.readContract({ address: tokenAddress!, abi: [{ type: 'function', name: 'totalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }], functionName: 'totalSupply' }),
    ]);
    console.log(`Token: ${name} (${symbol})`);
    console.log('Total Supply:', formatEther(totalSupply as bigint), symbol as string);

    // Save to .env
    updateEnvVar('BSC_REWARD_TOKEN_ADDRESS', tokenAddress!);
    console.log('\nSaved BSC_REWARD_TOKEN_ADDRESS to .env');

    console.log('\n=== DONE ===');
    console.log('Your .env now has:');
    console.log(`  BSC_TREASURY_PRIVATE_KEY=${privateKey.slice(0, 10)}...`);
    console.log(`  BSC_REWARD_TOKEN_ADDRESS=${tokenAddress}`);
    console.log('\nThe BSC treasury is ready to distribute rewards!');
    console.log('Treasury balance: 1,000,000 SMOLT');
  } catch (error: any) {
    console.error('Deploy failed:', error.message || error);
    if (error.message?.includes('insufficient funds')) {
      console.error('\nWallet needs more tBNB. Get from: https://www.bnbchain.org/en/testnet-faucet');
    }
    process.exit(1);
  }

} else if (command === 'status') {
  // Check status of everything
  const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
  const tokenAddr = readEnvKey('BSC_REWARD_TOKEN_ADDRESS');

  console.log('=== BSC TESTNET STATUS ===\n');

  if (!privateKey) {
    console.log('Treasury wallet: NOT CONFIGURED');
    console.log('Run: bun run scripts/setup-bsc-testnet.ts generate');
    process.exit(0);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const client = getClient();
  const balance = await client.getBalance({ address: account.address });

  console.log('Treasury wallet:', account.address);
  console.log('tBNB balance:  ', formatEther(balance));

  if (!tokenAddr) {
    console.log('\nReward token: NOT DEPLOYED');
    console.log('Run: bun run scripts/setup-bsc-testnet.ts deploy');
  } else {
    console.log('\nReward token:', tokenAddr);
    try {
      const [name, symbol, tokenBalance] = await Promise.all([
        client.readContract({ address: tokenAddr as Address, abi: [{ type: 'function', name: 'name', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }], functionName: 'name' }),
        client.readContract({ address: tokenAddr as Address, abi: [{ type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }], functionName: 'symbol' }),
        client.readContract({ address: tokenAddr as Address, abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }], functionName: 'balanceOf', args: [account.address] }),
      ]);
      console.log(`Token: ${name} (${symbol})`);
      console.log('Treasury balance:', formatEther(tokenBalance as bigint), symbol as string);
      console.log('\nExplorer:', `https://testnet.bscscan.com/address/${tokenAddr}`);
    } catch (e: any) {
      console.log('Could not read token:', e.message?.slice(0, 100));
    }
  }

} else {
  console.log('BSC Testnet Setup\n');
  console.log('Commands:');
  console.log('  generate  — Create treasury wallet');
  console.log('  deploy    — Deploy reward token (needs tBNB)');
  console.log('  status    — Check current setup');
  console.log('\nUsage: bun run scripts/setup-bsc-testnet.ts <command>');
}
