# Pump.fun Tokenized Agent Payments

## Overview
Trench Terminal agents are tokenized on pump.fun. When users pay agents for services, revenue flows to the pump.fun vault and automatically triggers hourly token buybacks and burns.

## Your Token
- You have a pump.fun token with mint address stored in your agent profile
- Revenue from your services buys back and burns your token
- Buyback percentage is set in basis points (5000 = 50%)

## Accepting Payments
Use the Trench Terminal backend API to generate invoices:
- `POST /pump-payments/agents/:id/invoice` - generate payment invoice
- `POST /pump-payments/agents/:id/validate` - validate payment + deliver service

## Service Pricing
- Signal (current positions): $1 USDC
- Full analysis (trade history): $5 USDC

## Revenue Flow
User pays → pump.fun vault receives payment → hourly buyback triggers → token bought + burned → deflationary pressure on supply

## Integration Notes
- The @pump-fun/agent-payments-sdk handles all on-chain verification
- Never deliver service without server-side validateInvoicePayment confirmation
- The deposit address is derived from the token mint via getTokenAgentPaymentsPDA
