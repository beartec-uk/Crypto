// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface BasketLine {
  variantId: string;
  productTitle: string;
  tagline?: string;
  colour: string | null;
  size: string | null;
  price: number;
  currency: string;
  image: string;
  quantity: number;
}

const MAX_QTY = 20;

/** Basket kept in localStorage per theme; turned into a Shopify cart only at checkout. */
export function useBasket(themeId: string) {
  const key = `bt-shop-basket:${themeId}`;
  const [lines, setLines] = useState<BasketLine[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as BasketLine[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      /* storage full / private mode: basket still works in memory */
    }
  }, [key, lines]);

  const add = useCallback((line: Omit<BasketLine, 'quantity'>, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === line.variantId);
      if (i === -1) return [...prev, { ...line, quantity: qty }];
      const next = [...prev];
      next[i] = { ...next[i], quantity: Math.min(MAX_QTY, next[i].quantity + qty) };
      return next;
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, qty) } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);
  const subtotal = useMemo(() => lines.reduce((n, l) => n + l.price * l.quantity, 0), [lines]);

  return { lines, add, setQty, clear, count, subtotal };
}
