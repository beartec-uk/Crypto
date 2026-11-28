// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
import { renderToString } from 'react-dom/server';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { Router } from 'wouter';
import CryptoContact from '@/pages/CryptoContact';
import CryptoLanding from '@/pages/CryptoLanding';
import CryptoLogin from '@/pages/CryptoLogin';
import CryptoPricing from '@/pages/CryptoPricing';
import CryptoPrivacy from '@/pages/CryptoPrivacy';
import CryptoTerms from '@/pages/CryptoTerms';
import Shop from '@/pages/Shop';
import { PUBLIC_ROUTES, ROBOTS_DISALLOW, SITE_ORIGIN, type PublicRoute } from '@/seo/publicRoutes';

export { PUBLIC_ROUTES, ROBOTS_DISALLOW, SITE_ORIGIN };
export type { PublicRoute };

const PAGES: Record<string, () => JSX.Element> = {
  '/': () => <CryptoLanding />,
  '/crypto': () => <CryptoLanding />,
  '/pricing': () => <CryptoPricing />,
  '/shop': () => <Shop />,
  '/privacy': () => <CryptoPrivacy />,
  '/terms': () => <CryptoTerms />,
  '/contact': () => <CryptoContact />,
  '/login': () => <CryptoLogin />,
  '/cryptologin': () => <CryptoLogin />,
};

export function render(url: string): { html: string; helmet: HelmetServerState } {
  const Page = PAGES[url];
  if (!Page) throw new Error(`No prerender page for ${url}`);
  const context: { helmet?: HelmetServerState } = {};
  const html = renderToString(
    <HelmetProvider context={context}>
      <Router ssrPath={url}>
        <Page />
      </Router>
    </HelmetProvider>,
  );
  if (!context.helmet) throw new Error(`Helmet missing for ${url}`);
  return { html, helmet: context.helmet };
}
