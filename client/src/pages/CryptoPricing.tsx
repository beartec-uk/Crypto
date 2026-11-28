// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { MarketingAuthCtas } from '@/components/marketing/MarketingAuthCtas';
import { MarketingPageFrame } from '@/components/marketing/MarketingPageFrame';
import { Seo } from '@/components/marketing/Seo';

const PLANS = [
  { name: 'Free', price: 'Free', detail: 'charts and indicators' },
  { name: 'Core', price: '£15/mo', detail: '1 ticker, 80 tokens' },
  { name: 'Pro', price: '£30/mo', detail: '3 tickers, 160 tokens' },
  { name: 'Elite', price: '£50/mo', detail: '5 tickers, 270 tokens' },
] as const;

export default function CryptoPricing() {
  return (
    <MarketingPageFrame wide>
      <Seo
        title="Pricing — BearTec"
        description="Charts stay free. Pay only for optional AI. Free, Core, Pro and Elite plans."
      />
      <p className="text-xs uppercase tracking-[0.28em] text-[#00c4b4]">Optional</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pay only for AI.</h1>
      <div className="mt-12 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm" data-testid="pricing-table">
          <thead className="bg-white/[0.04] text-zinc-400">
            <tr>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Includes</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((plan) => (
              <tr key={plan.name} className="border-t border-white/10">
                <td className="px-5 py-4 font-medium text-white">{plan.name}</td>
                <td className="px-5 py-4 text-zinc-300">{plan.price}</td>
                <td className="px-5 py-4 text-zinc-400">{plan.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-zinc-400">Charts stay free.</p>
      <div className="mt-10">
        <MarketingAuthCtas />
      </div>
    </MarketingPageFrame>
  );
}
