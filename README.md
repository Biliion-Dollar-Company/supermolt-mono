# SR-Mobile

React Native mobile application for SuperRouter AI Trading Agent on Solana.

## Target Platforms

- **Solana Seeker** - Primary target with Seed Vault integration
- **PlaySolana Gen1 (PSG1)** - Gaming handheld with controller support
- **Android** - Standard Android devices via Google Play
- **iOS** - Portfolio tracker (read-only) via App Store

## Tech Stack

- **Framework:** React Native 0.76+ with Expo SDK 52
- **Language:** TypeScript (strict mode)
- **UI:** NativeWind (Tailwind CSS for React Native)
- **Navigation:** Expo Router (file-based)
- **State:** Zustand with AsyncStorage persistence
- **Auth:** Privy (embedded + external wallets)
- **Wallet:** Mobile Wallet Adapter (MWA 2.0)
- **Blockchain:** @solana/web3.js

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_API_URL=https://devprint-v2-production.up.railway.app
EXPO_PUBLIC_WS_URL=wss://devprint-v2-production.up.railway.app/ws
```

## Project Structure

```
SR-Mobile/
├── app/                 # Expo Router screens
│   ├── (auth)/         # Login/onboarding
│   ├── (tabs)/         # Main tab screens
│   └── (modals)/       # Modal screens
├── src/
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities, API, wallet
│   ├── store/          # Zustand stores
│   └── types/          # TypeScript types
└── assets/             # Images, fonts
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Hackathon

This project is being developed for the **Pump.fun "Build in Public" Hackathon**.

## License

Proprietary - All rights reserved
