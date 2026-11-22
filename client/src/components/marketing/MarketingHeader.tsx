// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { Link, useLocation } from 'wouter';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Public site header: BearTec home link, Pricing, and an obvious Shop button.
 * `overlay` sits it transparently on top of the landing hero.
 */
export function MarketingHeader({ overlay = false }: { overlay?: boolean }) {
  const [location] = useLocation();
  return (
    <header
      className={cn(
        'z-20 w-full px-4 py-3 sm:px-6 sm:py-4',
        overlay ? 'absolute inset-x-0 top-0' : 'border-b border-white/10',
      )}
      data-testid="marketing-header"
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3" aria-label="Main">
        <Link href="/">
          <a className="text-lg font-semibold tracking-tight text-white hover:text-[#00c4b4]">BearTec</a>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing">
            <a
              className={cn(
                'rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white',
                location === '/pricing' ? 'text-white' : 'text-zinc-300',
              )}
              data-testid="nav-pricing"
            >
              Pricing
            </a>
          </Link>
          <Link href="/shop">
            <a
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[#00c4b4] bg-[#00c4b4]/10 px-4 text-sm font-semibold text-[#00c4b4] shadow-[0_0_18px_rgba(0,196,180,0.25)] transition-colors hover:bg-[#00c4b4] hover:text-black"
              data-testid="nav-shop"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Shop
              <span className="rounded-full bg-[#00c4b4] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide text-black">
                New
              </span>
            </a>
          </Link>
        </div>
      </nav>
    </header>
  );
}
