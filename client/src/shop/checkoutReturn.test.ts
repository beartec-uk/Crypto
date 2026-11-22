// Copyright (c) 2025-2026 BEARTEC. All rights reserved. See LICENSE.
import { describe, expect, it } from 'vitest'
import { withCheckoutReturn } from './checkoutReturn'

const CHECKOUT = 'https://puyw54-pw.myshopify.com/cart/c/hWN5abc?key=k123'

describe('withCheckoutReturn', () => {
  it('routes a myshopify checkout through the theme return handoff', () => {
    const out = new URL(withCheckoutReturn(CHECKOUT, 'beartec'))
    expect(out.origin).toBe('https://puyw54-pw.myshopify.com')
    expect(out.pathname).toBe('/')
    expect(out.searchParams.get('return')).toBe('beartec')
    expect(out.searchParams.get('checkout')).toBe(CHECKOUT)
  })
  it('leaves anything else untouched', () => {
    for (const u of ['https://evil.example/cart/c/x', 'http://puyw54-pw.myshopify.com/cart/c/x', 'https://puyw54-pw.myshopify.com/products/x', 'not a url']) {
      expect(withCheckoutReturn(u, 'beartec')).toBe(u)
    }
  })
})
