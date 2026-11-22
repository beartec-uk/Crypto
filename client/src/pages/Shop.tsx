// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { Helmet } from 'react-helmet-async';
import ShopFront from '@/shop/ShopFront';
import { BEARTEC_THEME, SHOP_THEMES, type ShopThemeId } from '@/shop/themes';
import { SHOP_OG_IMAGE } from '@/components/marketing/shopPromo';

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
        {id === 'beartec' ? <link rel="canonical" href="https://www.beartec.uk/shop" /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="BearTec" />
        <meta property="og:title" content={theme.copy.pageTitle} />
        <meta property="og:description" content={theme.copy.metaDescription} />
        <meta property="og:url" content="https://www.beartec.uk/shop" />
        <meta property="og:image" content={SHOP_OG_IMAGE} />
        <meta property="og:image:alt" content="BearTec Chest Logo Tee" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={theme.copy.pageTitle} />
        <meta name="twitter:description" content={theme.copy.metaDescription} />
        <meta name="twitter:image" content={SHOP_OG_IMAGE} />
      </Helmet>
      <ShopFront key={theme.id} theme={theme} />
    </>
  );
}
