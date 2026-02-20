# ERC-8004 Integration - Pre-Launch Checklist

**Use this checklist before deploying to production**

---

## ✅ Phase 1: Development Complete

- [x] IPFS integration (`src/lib/ipfs.ts`)
- [x] Identity service (`src/services/erc8004-identity.service.ts`)
- [x] Reputation service (`src/services/erc8004-reputation.service.ts`)
- [x] Validation service (`src/services/erc8004-validation.service.ts`)
- [x] API routes (`src/routes/erc8004.routes.ts`)
- [x] Database schema updated (`prisma/schema.prisma`)
- [x] Routes wired into main app (`src/index.ts`)
- [x] Environment variables documented (`.env.example`)
- [x] Test script created (`scripts/test-erc8004-integration.ts`)
- [x] Documentation written (`README-ERC8004.md`)
- [x] TypeScript compilation (0 errors)
- [x] Build success (8.61 MB bundle)

---

## ⏳ Phase 2: Testing (Before Production)

### Environment Setup
- [ ] Pinata account created
- [ ] Pinata JWT added to `.env`
- [ ] Ethereum RPC URL configured (Infura/Alchemy)
- [ ] Deployer wallet private key added
- [ ] Wallet funded with Sepolia ETH (get from faucet)
- [ ] Contract addresses verified in `contracts/deployments.json`
- [ ] Validator address set (if using validation)

### Database
- [ ] Migration applied: `bunx prisma migrate dev --name add_erc8004`
- [ ] Prisma client regenerated: `bunx prisma generate`
- [ ] Schema verified: `bunx prisma studio` (check new fields)

### IPFS Testing
- [ ] IPFS test endpoint passes: `GET /erc8004/test/ipfs`
- [ ] Can upload test JSON to Pinata
- [ ] Can fetch data from IPFS gateway
- [ ] Pinata dashboard shows uploaded files

### Integration Testing
- [ ] Integration test script runs successfully
- [ ] Agent registered on-chain (check Sepolia Etherscan)
- [ ] Feedback submitted (check transaction on Etherscan)
- [ ] Validation created (check transaction on Etherscan)
- [ ] On-chain data retrievable via SDK

### API Testing
- [ ] All 12 endpoints tested with curl/Postman
- [ ] Error handling works (invalid IDs, missing data)
- [ ] Response format consistent
- [ ] Rate limiting doesn't break bulk operations

---

## 🚀 Phase 3: Production Deployment

### Security
- [ ] Private keys stored in secure environment (not in code)
- [ ] .env file added to .gitignore
- [ ] API endpoints protected (authentication where needed)
- [ ] CORS configured for production domains
- [ ] Rate limiting configured

### Monitoring
- [ ] Logging enabled for all ERC-8004 operations
- [ ] Error tracking configured (Sentry/similar)
- [ ] IPFS upload failures monitored
- [ ] Transaction failures logged
- [ ] Gas usage tracked

### Performance
- [ ] Bulk operations tested with large datasets
- [ ] IPFS rate limits respected (1 req/sec)
- [ ] RPC rate limits respected
- [ ] Database indexes optimized
- [ ] Transaction delays configured (avoid nonce conflicts)

### Documentation
- [ ] README updated with production notes
- [ ] API documentation published
- [ ] Team trained on new endpoints
- [ ] Runbook created for common issues

---

## 📊 Phase 4: Monitoring & Maintenance

### Daily Checks
- [ ] IPFS uploads successful
- [ ] Transaction confirmation times acceptable
- [ ] No failed registrations/feedback/validations
- [ ] Database growth monitored

### Weekly Checks
- [ ] Agent registration stats reviewed
- [ ] Reputation data integrity verified
- [ ] Validation proof quality assessed
- [ ] Gas costs analyzed

### Monthly Checks
- [ ] Pinata storage usage (1GB limit)
- [ ] RPC provider limits (upgrade if needed)
- [ ] Contract upgrade considerations
- [ ] User feedback collected

---

## 🆘 Emergency Procedures

### IPFS Down
1. Check Pinata status page
2. Switch to backup gateway if available
3. Queue uploads for retry
4. Alert users of delayed on-chain updates

### RPC Provider Issues
1. Switch to backup RPC URL
2. Monitor transaction confirmation times
3. Increase gas prices if needed
4. Contact provider support

### Database Issues
1. Check connection pool
2. Review slow queries
3. Optimize indexes
4. Scale database if needed

### Contract Issues
1. Pause new registrations if needed
2. Investigate failed transactions
3. Contact contract deployer
4. Plan upgrade if critical bug found

---

## 📝 Maintenance Tasks

### Code
- [ ] Add unit tests for services
- [ ] Add integration tests for all endpoints
- [ ] Improve error messages
- [ ] Add retry logic for failed transactions
- [ ] Implement transaction hash storage (remove "pending")

### Features
- [ ] Store feedback index in database
- [ ] Add real-time liquidity snapshots
- [ ] Implement automated validator responses
- [ ] Create admin dashboard
- [ ] Add webhook notifications

### Optimization
- [ ] Cache on-chain data (reduce RPC calls)
- [ ] Batch similar transactions
- [ ] Implement IPFS pinning strategy
- [ ] Add CDN for IPFS content
- [ ] Optimize database queries

---

## 🎯 Success Metrics

### Adoption
- [ ] 90%+ of agents registered on-chain
- [ ] 80%+ of closed trades have feedback
- [ ] 70%+ of trades have validation proofs
- [ ] Average reputation score > 60

### Performance
- [ ] IPFS upload success rate > 99%
- [ ] Transaction confirmation time < 30s
- [ ] API response time < 500ms
- [ ] Zero data loss

### Cost
- [ ] Average gas cost per agent < $0.01
- [ ] IPFS storage under 1GB (free tier)
- [ ] RPC calls within free tier
- [ ] Total monthly cost < $50

---

## 📞 Support Contacts

- **Pinata Support:** support@pinata.cloud
- **Infura Support:** infura.io/contact
- **Contract Deployer:** [Add contact]
- **Backend Team:** [Add Slack/Discord]
- **On-Call Engineer:** [Add contact]

---

## 🔗 Resources

- **Sepolia Faucet:** https://sepoliafaucet.com
- **Sepolia Etherscan:** https://sepolia.etherscan.io
- **Pinata Dashboard:** https://app.pinata.cloud
- **Infura Dashboard:** https://infura.io/dashboard
- **ERC-8004 Spec:** https://eips.ethereum.org/EIPS/eip-8004

---

**Last Updated:** February 20, 2026  
**Version:** 1.0  
**Status:** Ready for Testing
