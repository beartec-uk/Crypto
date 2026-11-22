// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { Helmet } from 'react-helmet-async';
import ShopFront from '@/shop/ShopFront';
import { BEARTEC_THEME, SHOP_THEMES, type ShopThemeId } from '@/shop/themes';

/**
 * /shop → BearTec theme.
 * /shop?theme=falcon or /shop/falcon-preview → Falcon theme (review only; destined for falcon-fpl.com).
 */
export default function Shop({ themeId }: { themeId?: ShopThemeId }) {
  const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('theme') : null;
  const id: ShopThemeId = themeId ?? (fromQuery === 'falcon' ? 'falcon' : 'beartec');
  const theme = SHOP_THEMES[id] ?? BEARTEC_THEME;
  return (
    <>
      <Helmet>
        <title>{theme.copy.pageTitle}</title>
        <meta name="description" content={theme.copy.metaDescription} />
        <meta name="theme-color" content={theme.vars.bg} />
        {id !== 'beartec' ? <meta name="robots" content="noindex" /> : null}
      </Helmet>
      <ShopFront key={theme.id} theme={theme} />
    </>
  );
}
