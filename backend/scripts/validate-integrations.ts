#!/usr/bin/env bun
/**
 * Validate Token Platform Integrations — Dry Run (FREE)
 *
 * Tests the FULL API flow for both Four.Meme and Pump.fun
 * WITHOUT sending any on-chain transactions.
 *
 * Four.Meme: nonce → sign → login → image upload → prepareCreate → ✅
 * Pump.fun:  IPFS upload → PumpPortal tx build → deserialize → ✅
 *
 * No funds needed. Uses throwaway keypairs.
 *
 * Usage:
 *   bun run scripts/validate-integrations.ts
 */

import { Keypair } from '@solana/web3.js';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Minimal 1x1 PNG for image upload tests
const PLACEHOLDER_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f86f0000000201017798cc370000000049454e44ae426082',
  'hex'
);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
  durationMs: number;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function runTest(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.push({ name, status: 'PASS', detail, durationMs: ms });
    console.log(`  ✓ ${name} (${ms}ms)`);
    console.log(`    ${detail}`);
  } catch (error: any) {
    const ms = Date.now() - start;
    results.push({ name, status: 'FAIL', detail: error.message, durationMs: ms });
    console.log(`  ✗ ${name} (${ms}ms)`);
    console.log(`    ${error.message}`);
  }
}

// ══════════════════════════════════════════════════════════
//  FOUR.MEME (BSC) — Full API flow, no on-chain tx
// ══════════════════════════════════════════════════════════

async function validateFourMeme() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  FOUR.MEME (BSC) — API Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Generate a random EVM key (no funds needed for API calls)
  const { privateKeyToAccount } = await import('viem/accounts');
  const randomKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`;
  const account = privateKeyToAccount(randomKey);
  log(`Test wallet: ${account.address} (random, unfunded)`);

  const API_BASE = process.env.FOURMEME_API_URL || 'https://four.meme/meme-api/v1';
  let accessToken: string | null = null;
  let uploadedImgUrl: string | null = null;

  // Test 1: Nonce generation
  await runTest('Four.Meme nonce generation', async () => {
    const resp = await fetch(`${API_BASE}/private/user/nonce/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountAddress: account.address.toLowerCase(),
        verifyType: 'LOGIN',
        networkCode: 'BSC',
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as any;
    if (data.code !== 0 && data.code !== '0') throw new Error(`API error: ${JSON.stringify(data)}`);
    if (!data.data) throw new Error('No nonce in response');
    return `Nonce: ${data.data}`;
  });

  // Test 2: Sign message + Login
  await runTest('Four.Meme auth (sign + login)', async () => {
    // Get fresh nonce
    const nonceResp = await fetch(`${API_BASE}/private/user/nonce/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountAddress: account.address.toLowerCase(),
        verifyType: 'LOGIN',
        networkCode: 'BSC',
      }),
    });
    const nonceData = await nonceResp.json() as any;
    const nonce = nonceData.data;

    // Sign
    const message = `You are sign in Meme ${nonce}`;
    const signature = await account.signMessage({ message });

    // Login
    const loginResp = await fetch(`${API_BASE}/private/user/login/dex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region: 'WEB',
        langType: 'EN',
        loginIp: '',
        inviteCode: '',
        verifyInfo: {
          address: account.address.toLowerCase(),
          networkCode: 'BSC',
          signature,
          verifyType: 'LOGIN',
        },
        walletName: 'MetaMask',
      }),
    });

    if (!loginResp.ok) throw new Error(`HTTP ${loginResp.status}`);
    const loginData = await loginResp.json() as any;
    if (loginData.code !== 0 && loginData.code !== '0') throw new Error(`Login error: ${JSON.stringify(loginData)}`);
    if (!loginData.data) throw new Error('No token in login response');

    accessToken = loginData.data;
    return `Got accessToken (${String(accessToken).slice(0, 20)}...)`;
  });

  // Test 3: Image upload
  await runTest('Four.Meme image upload', async () => {
    if (!accessToken) throw new Error('No access token (login failed)');

    const formData = new FormData();
    const arrayBuf = PLACEHOLDER_PNG.buffer.slice(
      PLACEHOLDER_PNG.byteOffset,
      PLACEHOLDER_PNG.byteOffset + PLACEHOLDER_PNG.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: 'image/png' });
    formData.append('file', blob, 'test.png');

    const resp = await fetch(`${API_BASE}/private/token/upload`, {
      method: 'POST',
      headers: { 'meme-web-access': accessToken },
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as any;
    if (data.code !== 0 && data.code !== '0') throw new Error(`Upload error: ${JSON.stringify(data)}`);
    if (!data.data) throw new Error('No imgUrl in upload response');

    uploadedImgUrl = data.data;
    return `Image URL: ${data.data}`;
  });

  // Test 4: Prepare token creation (gets createArg + signature from API)
  await runTest('Four.Meme prepareCreate', async () => {
    if (!accessToken) throw new Error('No access token');

    const payload = {
      name: `ValidationTest ${Date.now() % 10000}`,
      shortName: 'VTEST',
      desc: 'Dry-run validation test — will not be deployed on-chain',
      imgUrl: uploadedImgUrl || 'https://four.meme/default.png',
      label: 'Meme',
      launchTime: Date.now() + 120_000,
      preSale: '0',
      onlyMPC: false,
      lpTradingFee: 0.0025,
      totalSupply: 1_000_000_000,
      raisedAmount: 24,
      saleRate: 0.8,
      reserveRate: 0,
      funGroup: false,
      clickFun: false,
      symbol: 'BNB',
      symbolAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    };

    const resp = await fetch(`${API_BASE}/private/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'meme-web-access': accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const raw = await resp.json() as any;
    if (raw.code && raw.code !== 0 && raw.code !== '0') {
      throw new Error(`Create API error: ${JSON.stringify(raw)}`);
    }

    const d = raw.data ?? raw;
    const createArg = d.createArg || d.create_arg || d.arg || d.create_args;
    const signature = d.signature || d.sign || d.signatureHex;

    if (!createArg) throw new Error(`Missing createArg. Keys: ${Object.keys(d)}`);
    if (!signature) throw new Error(`Missing signature. Keys: ${Object.keys(d)}`);

    return `createArg: ${String(createArg).slice(0, 30)}... signature: ${String(signature).slice(0, 30)}...`;
  });

  log('');
  log('Four.Meme: All API steps validated. Only on-chain tx remains (needs BNB).');
}

// ══════════════════════════════════════════════════════════
//  PUMP.FUN (Solana) — Full API flow, no on-chain tx
// ══════════════════════════════════════════════════════════

async function validatePumpFun() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PUMP.FUN (Solana) — API Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Generate random Solana keypairs (no funds needed for API calls)
  const wallet = Keypair.generate();
  const mint = Keypair.generate();
  log(`Test wallet: ${wallet.publicKey.toBase58()} (random, unfunded)`);
  log(`Test mint:   ${mint.publicKey.toBase58()} (random)`);

  let metadataUri: string | null = null;

  // Test 1: IPFS metadata upload
  await runTest('Pump.fun IPFS metadata upload', async () => {
    const formData = new FormData();

    const arrayBuf = PLACEHOLDER_PNG.buffer.slice(
      PLACEHOLDER_PNG.byteOffset,
      PLACEHOLDER_PNG.byteOffset + PLACEHOLDER_PNG.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: 'image/png' });
    formData.append('file', blob, 'test.png');
    formData.append('name', `PumpTest ${Date.now() % 10000}`);
    formData.append('symbol', 'PTEST');
    formData.append('description', 'Dry-run validation test');
    formData.append('showName', 'true');

    const resp = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const data = await resp.json() as any;
    if (!data.metadataUri) throw new Error(`No metadataUri. Got: ${JSON.stringify(data).slice(0, 200)}`);

    metadataUri = data.metadataUri;
    return `metadataUri: ${data.metadataUri}`;
  });

  // Test 2: PumpPortal local transaction build
  await runTest('PumpPortal local tx build', async () => {
    if (!metadataUri) throw new Error('No metadataUri (IPFS upload failed)');

    const resp = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: wallet.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: `PumpTest ${Date.now() % 10000}`,
          symbol: 'PTEST',
          uri: metadataUri,
        },
        mint: mint.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: 0,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    // PumpPortal returns raw bytes of a VersionedTransaction
    const txBytes = new Uint8Array(await resp.arrayBuffer());
    if (txBytes.length < 100) {
      throw new Error(`Response too small (${txBytes.length} bytes) — expected a transaction`);
    }

    // Deserialize to prove it's a valid VersionedTransaction
    const tx = VersionedTransaction.deserialize(txBytes);
    const ixCount = tx.message.compiledInstructions.length;

    return `Valid VersionedTransaction (${txBytes.length} bytes, ${ixCount} instructions)`;
  });

  // Test 3: Verify we can sign the transaction
  await runTest('Transaction signing (local)', async () => {
    if (!metadataUri) throw new Error('No metadataUri');

    // Re-build for fresh blockhash
    const resp = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: wallet.publicKey.toBase58(),
        action: 'create',
        tokenMetadata: {
          name: `PumpTest ${Date.now() % 10000}`,
          symbol: 'PTEST',
          uri: metadataUri,
        },
        mint: mint.publicKey.toBase58(),
        denominatedInSol: 'true',
        amount: 0,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
    });

    const txBytes = new Uint8Array(await resp.arrayBuffer());
    const tx = VersionedTransaction.deserialize(txBytes);

    // Sign with both keypairs (this is what we'd do before sending)
    tx.sign([wallet, mint]);

    // Verify signatures exist
    const sigs = tx.signatures.filter((s) => !s.every((b) => b === 0));
    if (sigs.length < 2) throw new Error(`Expected 2 signatures, got ${sigs.length}`);

    return `Signed successfully (${sigs.length} signatures). Ready to send (needs SOL for gas).`;
  });

  log('');
  log('Pump.fun: All API steps validated. Only sendTransaction remains (needs SOL).');
}

// ══════════════════════════════════════════════════════════
//  Main
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('==================================================');
  console.log('  Integration Validation — Dry Run (FREE)');
  console.log('==================================================');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('  No funds needed. Tests API flows only.');
  console.log('');

  await validateFourMeme();
  await validatePumpFun();

  // Summary
  console.log('');
  console.log('==================================================');
  console.log('  RESULTS');
  console.log('==================================================');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '○';
    console.log(`  ${icon} ${r.name} — ${r.status} (${r.durationMs}ms)`);
  }

  console.log('');
  console.log(`  ${passed}/${total} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('');
    console.log('  Failed tests:');
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.log(`    ${r.name}: ${r.detail}`);
    }
  }

  console.log('');
  console.log('  Next step: Fund wallets and run deploy-test-token.ts');
  console.log('==================================================');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nValidation failed:', err);
  process.exit(1);
});
