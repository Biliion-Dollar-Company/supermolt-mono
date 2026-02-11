#!/usr/bin/env bun
import nacl from "tweetnacl";

const API_BASE = "https://sr-mobile-production.up.railway.app";

function generateKeypair() {
  return nacl.sign.keyPair();
}

function pubkeyToBase58(pubkey: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + Buffer.from(pubkey).toString("hex"));
  let encoded = "";
  while (num > 0) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = alphabet[Number(remainder)] + encoded;
  }
  return encoded || "1";
}

const keypair = generateKeypair();
const pubkey = pubkeyToBase58(keypair.publicKey);

const challengeRes = await fetch(`${API_BASE}/auth/agent/challenge?wallet=${pubkey}`);
const { nonce } = await challengeRes.json();

const message = `Sign in to SuperMolt\n\nNonce: ${nonce}`;
const messageBytes = new TextEncoder().encode(message);
const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
const signatureBase64 = Buffer.from(signature).toString("base64");

const verifyRes = await fetch(`${API_BASE}/auth/agent/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wallet: pubkey,
    signature: signatureBase64,
    agentName: `TestAgent-${Date.now()}`
  })
});

console.log("Status:", verifyRes.status);
console.log("Response:", await verifyRes.json());
