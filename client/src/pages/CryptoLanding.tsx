// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import videoFile from '@assets/grok_video_2025-11-13-19-48-28_1763063433278.mp4';
import { MarketingAuthCtas } from '@/components/marketing/MarketingAuthCtas';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';

const FREE_CARDS = [
  {
    title: 'Oscillators',
    detail: 'RSI, MACD, Stoch RSI, MFI, OBV, Williams %R, CCI, ADX',
  },
  {
    title: 'SMC',
    detail: 'order blocks, FVGs, BOS/CHoCH',
  },
  {
    title: 'Auto Fibonacci',
    detail: '',
  },
  {
    title: 'Training',
    detail: '',
  },
] as const;

const PLANS = [
  'Free — charts and indicators',
  'Core £15/mo — 1 ticker, 80 tokens',
  'Pro £30/mo — 3 tickers, 160 tokens',
  'Elite £50/mo — 5 tickers, 270 tokens',
] as const;

function CyanHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (animate: boolean) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const gap = 72;
      const offset = animate ? (t * 28) % gap : 0;
      ctx.strokeStyle = 'rgba(0, 196, 180, 0.14)';
      ctx.lineWidth = 1;
      for (let x = -gap + offset; x < w + gap; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h * 0.12, h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.32, 160 + (animate ? Math.sin(t) * 18 : 0), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.18, h * 0.7, 90, 0, Math.PI * 2);
      ctx.stroke();
    };

    resize();
    draw(false);
    window.addEventListener('resize', resize);

    if (reduced) {
      return () => window.removeEventListener('resize', resize);
    }

    const loop = () => {
      t += 0.004;
      draw(true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      data-testid="hero-canvas"
    />
  );
}

export default function CryptoLanding() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      video.pause();
      return;
    }
    const play = () => {
      const playing = video.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(() => {
          /* autoplay can be blocked; canvas still provides motion */
        });
      }
    };
    play();
    video.addEventListener('canplay', play);
    return () => video.removeEventListener('canplay', play);
  }, []);

  return (
    <div className="bg-[#0e0e0e] text-white" data-testid="crypto-landing-container">
      <Helmet>
        <title>BearTec — Charts that explain themselves.</title>
        <meta
          name="description"
          content="BearTec: charts that explain themselves. Free indicators. Optional AI."
        />
        <meta property="og:title" content="BearTec — Charts that explain themselves." />
        <meta property="og:description" content="Free indicators. Optional AI." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.beartec.uk" />
        <meta property="og:site_name" content="BearTec" />
      </Helmet>

      <a href="#free" className="skip-link">
        Skip to content
      </a>

      <section
        className="relative isolate flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-black pb-24"
        data-testid="marketing-hero"
        aria-label="BearTec"
      >
        <MarketingHeader overlay />
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          data-testid="crypto-landing-video"
        >
          <source src={videoFile} type="video/mp4" />
        </video>
        <CyanHeroCanvas />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,196,180,0.18),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(14,14,14,0.92))]"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="bt-reveal text-6xl font-semibold tracking-tight text-white sm:text-7xl md:text-8xl">
            BearTec
          </h1>
          <p
            className="bt-reveal mt-5 text-xl text-zinc-200 sm:text-2xl"
            style={{ animationDelay: '160ms' }}
          >
            Charts that explain themselves.
          </p>
          <p
            className="bt-reveal mt-3 text-sm text-zinc-400 sm:text-base"
            style={{ animationDelay: '280ms' }}
          >
            Free indicators. Optional AI.
          </p>
          <div className="bt-reveal mt-8" style={{ animationDelay: '420ms' }}>
            <MarketingAuthCtas className="justify-center" />
          </div>
        </div>

        <a
          href="#free"
          className="bt-reveal relative z-10 mb-8 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.35em] text-zinc-400 hover:text-white"
          style={{ animationDelay: '560ms' }}
          data-testid="hero-scroll"
        >
          <span>Scroll</span>
          <span className="bt-scroll-line block h-10 w-px bg-[#00c4b4]" aria-hidden="true" />
        </a>
      </section>

      <section id="free" className="px-6 py-24 sm:py-32" data-testid="section-free">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[#00c4b4]">Free with email</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The tools, in English.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FREE_CARDS.map((card) => (
              <article
                key={card.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="text-lg font-medium text-white">{card.title}</h3>
                {card.detail ? (
                  <p className="mt-2 text-sm text-zinc-400">{card.detail}</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="border-t border-white/10 px-6 py-24 sm:py-32" data-testid="section-plans">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-[#00c4b4]">Optional</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Pay only for AI.</h2>
          <ul className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {PLANS.map((plan) => (
              <li key={plan} className="py-4 text-zinc-200">
                {plan}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-zinc-400">Charts stay free.</p>
          <Link href="/pricing">
            <a className="mt-3 inline-block text-sm text-[#00c4b4] hover:underline">
              See the full table
            </a>
          </Link>
        </div>
      </section>

      <section id="cta" className="border-t border-white/10 px-6 py-24 sm:py-32" data-testid="section-cta">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Open a chart.</h2>
          <div className="mt-8 flex justify-center">
            <MarketingAuthCtas className="justify-center" />
          </div>
          <p className="mt-8 text-xs text-zinc-500" data-testid="risk-line">
            Educational only. Not financial advice. You can lose money.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
