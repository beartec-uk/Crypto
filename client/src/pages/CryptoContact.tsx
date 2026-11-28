// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { MarketingPageFrame } from '@/components/marketing/MarketingPageFrame';
import { Seo } from '@/components/marketing/Seo';

export default function CryptoContact() {
  return (
    <MarketingPageFrame>
      <Seo
        title="Contact — BearTec"
        description="Contact BearTec by email at beartec@beartec.uk."
      />
      <h1 className="text-4xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-6 text-zinc-400">
        Email{' '}
        <a className="text-[#00c4b4] hover:underline" href="mailto:beartec@beartec.uk">
          beartec@beartec.uk
        </a>
      </p>
    </MarketingPageFrame>
  );
}
