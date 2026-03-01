# ⚡ Quick Start - Sepolia Testing

## 🎯 Goal
Test ERC-8004 contracts by registering 1 agent on Sepolia testnet.

## 📋 TL;DR

```bash
# 1. Get Sepolia ETH (5-10 min)
# Visit: https://sepolia-faucet.pk910.de
# Address: 0x5879ECF99B64c3C37F8AA013b434692975325e02

# 2. Run tests (3 min)
cd SR-Mobile/backend/contracts/erc8004
npm run test:sepolia

# 3. Done! ✅
# Check test-results.json for transaction hashes
```

## 🚰 Get Testnet ETH

**Your Wallet:** `0x5879ECF99B64c3C37F8AA013b434692975325e02`

**Faucet:** https://sepolia-faucet.pk910.de
- No account needed
- Mine for 5-10 minutes
- Get ~0.1 ETH (enough for 10+ tests)

## 🧪 What Gets Tested

1. ✅ Register agent (Momentum Trader strategy)
2. ✅ Update performance (42 trades, 71% win rate)
3. ✅ Submit feedback (5-star review)
4. ✅ Submit strategy proof (Sharpe 2.45, 12% drawdown)

## 📊 Expected Output

```
✅ Passed: 4/4 tests

Test Results:
   ✅ registerAgent → tx: 0x...
   ✅ updatePerformance → tx: 0x...
   ✅ submitFeedback → tx: 0x...
   ✅ submitProof → tx: 0x...

Agent Profile:
   Win Rate: 71.43%
   PnL: 18.50%
   Rating: 5/5 ⭐

💾 Results saved to: test-results.json
```

## 📝 Copy These Hashes

After tests complete, copy transaction hashes from terminal output to:
- `memory/surge_hackathon/SEPOLIA_TEST_RESULTS.md`
- Demo video script
- Hackathon submission form

## 🔗 Deployed Contracts

Already live on Sepolia (Feb 22):
- Identity: `0x34aDD8176a4EC7D1D022a56a0D4e7b153708B56a`
- Reputation: `0xA8B9e9d942CD8aeA75B418dD9FDcEaC41B3689FF`
- Validation: `0xb752fda472A5b76FE48d194809Af062a2271D52c`

## ⏱️ Time Estimate

| Step | Time |
|------|------|
| Get Sepolia ETH | 5-10 min |
| Run tests | 3 min |
| Document results | 2 min |
| **Total** | **~15 min** |

## 🎥 For Demo Video

Use transaction hashes from test output:
1. Show Etherscan links during demo
2. Point to on-chain data (win rate, PnL)
3. Highlight immutability (can't be faked)

## 🆘 Troubleshooting

**"No ETH balance"**  
→ Get more from faucet

**"Agent already exists"**  
→ Shouldn't happen (uses unique timestamp IDs)

**"Transaction reverted"**  
→ Check you're using correct network (Sepolia)

## 📞 Help

Full docs:
- `README.md` (this directory)
- `memory/surge_hackathon/SEPOLIA_TEST_PLAN.md`
- `memory/surge_hackathon/SEPOLIA_TEST_RESULTS.md`

---

**Ready in:** 15 minutes  
**Proves:** Production-ready contracts  
**Impact:** Stronger hackathon submission 🏆
