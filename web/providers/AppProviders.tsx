"use client";

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import WalletProvider from './WalletProvider';

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
        loginMethods: ['email', 'wallet', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#E8B45E',
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
      }}
    >
      <WalletProvider>
        {children}
      </WalletProvider>
    </PrivyProvider>
  );
}
