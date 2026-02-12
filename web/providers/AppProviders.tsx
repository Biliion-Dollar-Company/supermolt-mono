"use client";

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import WalletProvider from './WalletProvider';

export default function AppProviders({ children }: { children: ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  const content = (
    <WalletProvider>
      {children}
    </WalletProvider>
  );

  if (!privyAppId) {
    return content;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#E8B45E',
        },
      }}
    >
      {content}
    </PrivyProvider>
  );
}
