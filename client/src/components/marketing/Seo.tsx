// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'wouter';
import { OG_IMAGE, OG_IMAGE_ALT, canonicalUrl } from '@/seo/publicRoutes';

/**
 * Per-route document head for public pages. The build-time prerender reads these
 * tags out of the server render and writes them into each route's HTML file.
 */
export function Seo({
  title,
  description,
  image = OG_IMAGE,
  imageAlt = OG_IMAGE_ALT,
}: {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}) {
  const [location] = useLocation();
  const path = (location || '/').split(/[?#]/)[0] || '/';
  const url = canonicalUrl(path);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="BearTec" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Helmet>
  );
}
