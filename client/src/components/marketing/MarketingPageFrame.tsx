// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import type { ReactNode } from 'react';
import { MarketingFooter } from './MarketingFooter';
import { MarketingHeader } from './MarketingHeader';

export function MarketingPageFrame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0e0e0e] text-white">
      <MarketingHeader />
      <main className={`mx-auto w-full flex-1 px-6 py-12 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
