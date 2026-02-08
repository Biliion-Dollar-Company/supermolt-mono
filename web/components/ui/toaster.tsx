'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast:
            '!bg-[#0A0A0A] !border !border-white/[0.08] !shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl !font-sans',
          title: '!text-white !font-medium !text-sm',
          description: '!text-white/50 !text-xs',
          actionButton:
            '!bg-accent-primary/10 !border !border-accent-primary/30 !text-accent-primary hover:!bg-accent-primary/20 !text-xs !font-medium',
          cancelButton: '!text-white/40 hover:!text-white/70 !text-xs',
          success: '!border-green-500/20',
          error: '!border-red-500/20',
          warning: '!border-yellow-500/20',
          info: '!border-accent-primary/20',
        },
      }}
    />
  );
}
