// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { ShopProduct } from '@shared/shop/types';
import { loadCatalogue } from '@/shop/api';
import { BEARTEC_THEME } from '@/shop/themes';

/** Homepage card promoting /shop with a few real product shots (text-only until they load). */
export function ShopPromoSection() {
  const [products, setProducts] = useState<ShopProduct[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadCatalogue(BEARTEC_THEME, ctrl.signal)
      .then((c) => {
        const seen = new Set<string>();
        const picks = c.products.filter((p) => p.image?.url && !seen.has(p.category) && seen.add(p.category));
        setProducts(picks.slice(0, 3));
      })
      .catch(() => {
        /* aborted or offline: text card only */
      });
    return () => ctrl.abort();
  }, []);

  return (
    <section id="shop" className="border-t border-white/10 px-6 py-24 sm:py-32" data-testid="section-shop">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#00c4b4]">New · Merch</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Wear the bear.</h2>
          <p className="mt-4 text-zinc-400">
            Official BearTec tees, hoodies, caps and stickers. Printed to order and delivered to your door.
          </p>
          <Link href="/shop">
            <a
              className="mt-8 inline-flex h-11 items-center rounded-full bg-[#00c4b4] px-6 text-sm font-semibold text-black transition-colors hover:bg-[#00d8f0]"
              data-testid="section-shop-cta"
            >
              Shop the collection
            </a>
          </Link>
        </div>
        {products.length > 0 ? (
          <Link href="/shop">
            <a className="grid grid-cols-3 gap-3" aria-label="Browse the BearTec shop" data-testid="section-shop-products">
              {products.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                  <img
                    src={p.image.url}
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <figcaption className="truncate px-2 py-2 text-xs text-zinc-400">{p.title}</figcaption>
                </figure>
              ))}
            </a>
          </Link>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-zinc-300">
            Tees · Hoodies · Caps · Stickers
          </div>
        )}
      </div>
    </section>
  );
}
