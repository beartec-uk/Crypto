// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ShoppingBag, X } from 'lucide-react';
import { dismissShopPromo, isShopPromoDismissed, shouldShowShopBar } from './shopPromo';

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

/** Slim, dismissible "merch is here" strip across the top of every page except /shop. */
export function ShopAnnouncementBar() {
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isShopPromoDismissed(storage()));
  }, []);

  if (dismissed || !shouldShowShopBar(location)) return null;

  return (
    <div
      className="relative z-30 flex h-9 items-center justify-center border-b border-[#00c4b4]/30 bg-[#001614] px-10 text-xs text-zinc-200 sm:text-sm"
      role="region"
      aria-label="Shop announcement"
      data-testid="shop-announcement-bar"
    >
      <Link href="/shop">
        <a className="inline-flex items-center gap-2 truncate hover:text-white" data-testid="shop-announcement-link">
          <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-[#00c4b4]" aria-hidden="true" />
          <span className="truncate">
            <span className="font-semibold text-[#00c4b4]">New:</span> official BearTec merch is here
            <span className="hidden sm:inline"> — tees, hoodies, caps &amp; stickers</span>
          </span>
          <span className="shrink-0 font-semibold text-[#00c4b4] underline-offset-2 hover:underline">Shop now →</span>
        </a>
      </Link>
      <button
        type="button"
        onClick={() => {
          dismissShopPromo(storage());
          setDismissed(true);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss shop announcement"
        data-testid="shop-announcement-dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
