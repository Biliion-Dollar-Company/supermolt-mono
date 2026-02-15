"use client";

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import WalletProvider from './WalletProvider';

const solanaConnectors = toSolanaWalletConnectors();

export default function AppProviders({ children }: { children: ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  if (!privyAppId) {
    console.warn('⚠️ NEXT_PUBLIC_PRIVY_APP_ID not set - authentication will not work');
    return <WalletProvider>{children}</WalletProvider>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#E8B45E',
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      <WalletProvider>
        {children}
      </WalletProvider>
    </PrivyProvider>
  );
}
