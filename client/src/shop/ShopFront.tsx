// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Three-wheel merch shop front. Wheel 1: category → wheel 2: product → wheel 3: colour
 * (+ size chips). Swipe up / scroll down / ↓ / tap the centre card to go to the next
 * wheel; swipe down / scroll up / ↑ / Esc / breadcrumbs to go back. One component,
 * themed by a ShopTheme (BearTec, Falcon).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHOP_CATEGORIES, formatPrice, type ShopCatalogue, type ShopProduct } from '@shared/shop/types';
import ShopWheel, { type WheelItem } from './ShopWheel';
import { loadCatalogue, startCheckout } from './api';
import { useBasket } from './useBasket';
import type { ShopTheme } from './themes';
import './shop.css';

type Level = 0 | 1 | 2;
const LEVEL_NAMES = ['Category', 'Style', 'Colour & size'] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function priceRange(min: number, max: number, currency: string) {
  return min === max ? formatPrice(min, currency) : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
}

function preload(urls: Array<string | undefined>) {
  for (const u of urls) {
    if (!u) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = u;
  }
}

/** Big centre preview that crossfades between images (colour changes, products). */
function CrossfadeImage({ src, alt, reduced }: { src: string; alt: string; reduced: boolean }) {
  const [layers, setLayers] = useState([{ src, id: 0 }]);
  const nextId = useRef(1);
  useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1]?.src === src ? prev : [...prev.slice(-1), { src, id: nextId.current++ }]));
  }, [src]);
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), reduced ? 0 : 420);
    return () => clearTimeout(t);
  }, [layers, reduced]);
  return (
    <div className="sf-preview-img">
      {layers.map((l, i) => {
        const top = i === layers.length - 1;
        return (
          <img
            key={l.id}
            src={l.src}
            alt={top ? alt : ''}
            aria-hidden={!top}
            className={top ? (layers.length > 1 ? 'is-in' : '') : 'is-out'}
            decoding="async"
            draggable={false}
          />
        );
      })}
    </div>
  );
}

export default function ShopFront({ theme }: { theme: ShopTheme }) {
  const reduced = usePrefersReducedMotion();
  const [catalogue, setCatalogue] = useState<ShopCatalogue | null>(null);
  const [level, setLevel] = useState<Level>(0);
  const [dir, setDir] = useState<'down' | 'up'>('down');
  const [catIdx, setCatIdx] = useState(0);
  const [prodIdx, setProdIdx] = useState(0);
  const [colourIdx, setColourIdx] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [bump, setBump] = useState(0);
  const [checkoutState, setCheckoutState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [announce, setAnnounce] = useState('');
  const basket = useBasket(theme.id);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    loadCatalogue(theme, ctrl.signal)
      .then((c) => {
        setCatalogue(c);
        preload(c.products.slice(0, 8).map((p) => p.image.url));
      })
      .catch(() => {
        /* aborted */
      });
    return () => ctrl.abort();
  }, [theme]);

  // Drop preview-only basket lines once real Shopify data is live.
  useEffect(() => {
    if (catalogue?.source !== 'shopify') return;
    for (const l of basket.lines) if (l.variantId.startsWith('mock:')) basket.setQty(l.variantId, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue?.source]);

  const categories = useMemo(() => {
    const products = catalogue?.products ?? [];
    return SHOP_CATEGORIES.map((c) => ({ ...c, products: products.filter((p) => p.category === c.id) })).filter(
      (c) => c.products.length > 0,
    );
  }, [catalogue]);

  const category = categories[Math.min(catIdx, categories.length - 1)];
  const products: ShopProduct[] = category?.products ?? [];
  const product: ShopProduct | undefined = products[Math.min(prodIdx, products.length - 1)];
  const colour = product?.colours[Math.min(colourIdx, Math.max(0, product.colours.length - 1))];
  const needsSize = (product?.sizes.length ?? 0) > 0;
  const variant = product?.variants.find(
    (v) => (colour ? v.colour === colour.name : true) && (needsSize ? v.size === size : true),
  );

  // ---- wheel items ----
  const categoryItems: WheelItem[] = useMemo(
    () =>
      categories.map((c) => {
        const min = Math.min(...c.products.map((p) => p.priceMin));
        return {
          id: c.id,
          label: c.label,
          sublabel: `${c.products.length} style${c.products.length === 1 ? '' : 's'} · from ${formatPrice(min, c.products[0].currency)}`,
          image: c.products[0].image.url,
        };
      }),
    [categories],
  );
  const productItems: WheelItem[] = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.title,
        sublabel: p.tagline ? `${p.tagline}` : formatPrice(p.priceMin, p.currency),
        image: p.image.url,
      })),
    [products],
  );
  const colourItems: WheelItem[] = useMemo(
    () =>
      (product?.colours ?? []).map((c) => ({
        id: c.name,
        label: c.name,
        image: c.image?.url ?? product?.image.url,
        swatch: { hex: c.hex, hex2: c.hex2 },
        disabled: !product?.variants.some((v) => v.colour === c.name && v.available),
      })),
    [product],
  );

  // ---- selection changes ----
  const pickCategory = useCallback((i: number) => {
    setCatIdx(i);
    setProdIdx(0);
    setColourIdx(0);
    setSize(null);
  }, []);
  const pickProduct = useCallback((i: number) => {
    setProdIdx(i);
    setColourIdx(0);
    setSize(null);
  }, []);
  const pickColour = useCallback((i: number) => setColourIdx(i), []);

  useEffect(() => {
    if (product) preload(product.colours.map((c) => c.image?.url));
  }, [product]);

  const levelRef = useRef<Level>(0);
  levelRef.current = level;
  const goTo = useCallback(
    (l: Level) => {
      const cur = levelRef.current;
      if (l === cur) return;
      setDir(l > cur ? 'down' : 'up');
      setLevel(l);
      if (!reduced) {
        try {
          navigator.vibrate?.(l > cur ? 10 : 6);
        } catch {
          /* ignore */
        }
      }
    },
    [reduced],
  );
  const next = useCallback(() => {
    if (levelRef.current < 2) goTo((levelRef.current + 1) as Level);
  }, [goTo]);
  const back = useCallback(() => {
    if (levelRef.current > 0) goTo((levelRef.current - 1) as Level);
  }, [goTo]);

  // Announce the current selection for screen readers.
  useEffect(() => {
    if (!catalogue) return;
    if (level === 0 && category) setAnnounce(`${category.label}, ${catIdx + 1} of ${categories.length}`);
    else if (level === 1 && product) setAnnounce(`${product.title}${product.tagline ? `, ${product.tagline}` : ''}, ${priceRange(product.priceMin, product.priceMax, product.currency)}`);
    else if (level === 2 && colour) setAnnounce(`${colour.name}${size ? `, size ${size}` : ''}`);
  }, [catalogue, level, category, product, colour, size, catIdx, categories.length]);

  // ---- vertical gestures: swipe up / scroll down = next wheel ----
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
    swipe.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || basketOpen) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) > 56 && Math.abs(dy) > Math.abs(dx) * 1.4 && e.timeStamp - s.t < 800) {
      if (dy < 0) next();
      else back();
    }
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let acc = 0;
    let lastStep = 0;
    let idle: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) return;
      e.preventDefault();
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => (acc = 0), 220);
      const now = performance.now();
      if (Math.abs(acc) > 45 && now - lastStep > 600) {
        lastStep = now;
        if (acc > 0) next();
        else back();
        acc = 0;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (idle) clearTimeout(idle);
    };
  }, [next, back]);

  // Keys when focus is outside a wheel (wheels handle their own arrows).
  const onRootKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (basketOpen) {
      if (e.key === 'Escape') setBasketOpen(false);
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Escape') { e.preventDefault(); back(); }
  };

  // ---- basket ----
  const addToBasket = () => {
    if (!product || !variant || !variant.available) return;
    basket.add({
      variantId: variant.id,
      productTitle: product.title,
      tagline: product.tagline,
      colour: variant.colour,
      size: variant.size,
      price: variant.price,
      currency: variant.currency,
      image: variant.image?.url ?? colour?.image?.url ?? product.image.url,
    });
    setAdded(true);
    setBump((b) => b + 1);
    if (!reduced) {
      try {
        navigator.vibrate?.([12, 40, 18]);
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => setAdded(false), 1500);
  };

  const isPreviewData = catalogue?.source === 'mock';
  const canCheckout = !isPreviewData && basket.lines.length > 0 && basket.lines.every((l) => !l.variantId.startsWith('mock:'));

  const checkout = async () => {
    if (!canCheckout) return;
    setCheckoutState({ busy: true });
    try {
      const url = await startCheckout(basket.lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })));
      window.location.assign(url);
    } catch (err) {
      setCheckoutState({ busy: false, error: err instanceof Error ? err.message : 'Could not start checkout' });
    }
  };

  const basketBtnRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (basketOpen) drawerCloseRef.current?.focus();
  }, [basketOpen]);
  const closeBasket = () => {
    setBasketOpen(false);
    basketBtnRef.current?.focus();
  };

  // ---- preview content per level ----
  const preview = useMemo(() => {
    if (!catalogue || !category) return null;
    if (level === 0) {
      const min = Math.min(...category.products.map((p) => p.priceMin));
      return {
        src: category.products[0].image.url,
        alt: category.products[0].image.alt,
        title: category.label,
        sub: `${category.products.length} style${category.products.length === 1 ? '' : 's'}`,
        price: `from ${formatPrice(min, category.products[0].currency)}`,
        tint: undefined as string | undefined,
      };
    }
    if (!product) return null;
    if (level === 1) {
      return {
        src: product.image.url,
        alt: product.image.alt,
        title: product.title,
        sub: product.tagline ?? '',
        price: priceRange(product.priceMin, product.priceMax, product.currency),
        tint: undefined,
      };
    }
    return {
      src: colour?.image?.url ?? product.image.url,
      alt: colour?.image?.alt ?? product.image.alt,
      title: product.title,
      sub: [colour?.name, size].filter(Boolean).join(' / ') || product.tagline || '',
      price: variant && (!needsSize || size) ? formatPrice(variant.price, variant.currency) : `from ${formatPrice(product.priceMin, product.currency)}`,
      tint: colour?.hex,
    };
  }, [catalogue, category, product, colour, size, level, variant, needsSize]);

  const crumbs: Array<{ label: string; level: Level; current: boolean }> = [];
  if (category) crumbs.push({ label: category.label, level: 0, current: level === 0 });
  if (product && level >= 1) crumbs.push({ label: product.title, level: 1, current: level === 1 });
  if (product && level >= 2) crumbs.push({ label: [colour?.name, size ?? (needsSize ? 'size?' : null)].filter(Boolean).join(' / '), level: 2, current: true });

  const styleVars = {
    '--sf-bg': theme.vars.bg,
    '--sf-bg-glow': theme.vars.bgGlow,
    '--sf-surface': theme.vars.surface,
    '--sf-surface-hi': theme.vars.surfaceHi,
    '--sf-border': theme.vars.border,
    '--sf-text': theme.vars.text,
    '--sf-muted': theme.vars.muted,
    '--sf-accent': theme.vars.accent,
    '--sf-accent-2': theme.vars.accent2,
    '--sf-accent-ink': theme.vars.accentInk,
    '--sf-glow': theme.vars.glow,
    '--sf-font': theme.vars.font,
    '--sf-tint': preview?.tint ?? theme.vars.accent,
  } as React.CSSProperties;

  const hint = level === 0 ? theme.copy.categoryHint : level === 1 ? theme.copy.productHint : theme.copy.variantHint;

  return (
    <div
      ref={rootRef}
      className={`sf sf-theme-${theme.id}${reduced ? ' sf-reduced' : ''}`}
      style={styleVars}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onKeyDown={onRootKeyDown}
      data-level={level}
    >
      <header className="sf-header">
        <a className="sf-brand" href={theme.homeHref} aria-label={`${theme.brand} home`}>
          <img
            src={theme.logo.src}
            alt={theme.logo.alt}
            style={{ height: theme.logo.height }}
            className={theme.logo.round ? 'is-round' : undefined}
          />
          <span className="sf-brand-shop">Shop</span>
        </a>
        <div className="sf-header-right">
          {isPreviewData ? (
            <span className="sf-badge" title="Shopify isn't connected yet, so this is sample data. Checkout is disabled.">
              Preview data
            </span>
          ) : null}
          <button
            ref={basketBtnRef}
            type="button"
            className="sf-basket-btn"
            onClick={() => setBasketOpen(true)}
            aria-label={`Basket, ${basket.count} item${basket.count === 1 ? '' : 's'}`}
            aria-haspopup="dialog"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 7h12l-1 13H7L6 7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {basket.count > 0 ? (
              <span key={bump} className="sf-basket-count">
                {basket.count}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <nav className="sf-crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <button type="button" onClick={() => goTo(0)} className="sf-crumb">
              Shop
            </button>
          </li>
          {crumbs.map((c) => (
            <li key={c.level}>
              <span className="sf-crumb-sep" aria-hidden="true">›</span>
              <button
                type="button"
                className={`sf-crumb${c.current ? ' is-current' : ''}`}
                aria-current={c.current ? 'step' : undefined}
                onClick={() => goTo(c.level)}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className="sf-main">
        <section className="sf-stage" aria-label="Preview">
          {preview ? (
            <>
              <div className="sf-preview">
                <div className="sf-halo" aria-hidden="true" />
                <CrossfadeImage src={preview.src} alt={preview.alt} reduced={reduced} />
              </div>
              <div className="sf-info">
                <h1 className="sf-title">{preview.title}</h1>
                {preview.sub ? <p className="sf-sub">{preview.sub}</p> : null}
                <p className="sf-price">{preview.price}</p>
              </div>
            </>
          ) : (
            <div className="sf-preview sf-skeleton" aria-busy="true" aria-label="Loading shop" />
          )}
        </section>

        <section className="sf-dock" aria-label={`${LEVEL_NAMES[level]} wheel`}>
          <div className="sf-levels" role="tablist" aria-label="Wheels">
            {LEVEL_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={level === i}
                className={`sf-level-dot${level === i ? ' is-on' : ''}${i < level ? ' is-done' : ''}`}
                disabled={i > level + 1}
                onClick={() => goTo(i as Level)}
              >
                <span className="sf-level-num">{i + 1}</span>
                <span className="sf-level-name">{name}</span>
              </button>
            ))}
          </div>

          {catalogue && category ? (
            <div key={level === 0 ? 'l0' : level === 1 ? `l1-${catIdx}` : `l2-${catIdx}-${prodIdx}`} className={`sf-wheel-wrap is-${dir}`}>
              {level === 0 ? (
                <ShopWheel
                  label="Categories"
                  items={categoryItems}
                  index={Math.min(catIdx, categoryItems.length - 1)}
                  onChange={pickCategory}
                  onActivate={next}
                  onNext={next}
                  reducedMotion={reduced}
                  autoFocus={dir === 'up'}
                />
              ) : level === 1 ? (
                <ShopWheel
                  label={`${category.label} styles`}
                  items={productItems}
                  index={Math.min(prodIdx, productItems.length - 1)}
                  onChange={pickProduct}
                  onActivate={next}
                  onNext={next}
                  onBack={back}
                  reducedMotion={reduced}
                  autoFocus
                />
              ) : (
                <div className="sf-variant">
                  {colourItems.length > 1 ? (
                    <ShopWheel
                      label="Colours"
                      size="sm"
                      items={colourItems}
                      index={Math.min(colourIdx, colourItems.length - 1)}
                      onChange={pickColour}
                      onBack={back}
                      reducedMotion={reduced}
                      autoFocus
                    />
                  ) : colour ? (
                    <p className="sf-single-colour">
                      <span
                        className="sf-dot"
                        style={{ background: colour.hex2 ? `linear-gradient(135deg, ${colour.hex} 0 50%, ${colour.hex2} 50%)` : colour.hex }}
                      />
                      {colour.name}
                    </p>
                  ) : null}

                  {needsSize && product ? (
                    <div className="sf-sizes" role="radiogroup" aria-label="Size" data-no-swipe>
                      {product.sizes.map((s) => {
                        const v = product.variants.find((x) => x.size === s && (!colour || x.colour === colour.name));
                        const disabled = !v || !v.available;
                        const extra = v && v.price > product.priceMin ? `+${formatPrice(v.price - product.priceMin, v.currency)}` : '';
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={size === s}
                            disabled={disabled}
                            className={`sf-size${size === s ? ' is-on' : ''}`}
                            onClick={() => {
                              setSize(s);
                              if (!reduced) {
                                try {
                                  navigator.vibrate?.(6);
                                } catch {
                                  /* ignore */
                                }
                              }
                            }}
                          >
                            <span>{s}</span>
                            {extra ? <small>{extra}</small> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className={`sf-add${added ? ' is-added' : ''}`}
                    onClick={addToBasket}
                    disabled={!variant || !variant.available || (needsSize && !size)}
                  >
                    {added
                      ? 'Added to basket ✓'
                      : needsSize && !size
                        ? 'Choose a size'
                        : variant && !variant.available
                          ? 'Sold out'
                          : `Add to basket · ${variant ? formatPrice(variant.price, variant.currency) : ''}`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="sf-wheel-wrap sf-skeleton-wheel" aria-hidden="true" />
          )}

          <div className="sf-nav">
            {level > 0 ? (
              <button type="button" className="sf-nav-back" onClick={back}>
                <span aria-hidden="true">⌃</span> Back
              </button>
            ) : (
              <span className="sf-nav-intro">{theme.copy.intro}</span>
            )}
            {level < 2 ? (
              <button type="button" className="sf-nav-next" onClick={next}>
                {hint} <span aria-hidden="true" className="sf-chevron">⌄</span>
              </button>
            ) : (
              <span className="sf-nav-hint">{hint}</span>
            )}
          </div>
        </section>
      </main>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {basketOpen ? (
        <div className="sf-drawer-backdrop" onClick={closeBasket} data-no-swipe>
          <div
            className="sf-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Basket"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sf-drawer-head">
              <h2>Basket</h2>
              <button ref={drawerCloseRef} type="button" className="sf-icon-btn" onClick={closeBasket} aria-label="Close basket">
                ✕
              </button>
            </div>
            {basket.lines.length === 0 ? (
              <p className="sf-empty">Your basket is empty.</p>
            ) : (
              <ul className="sf-lines">
                {basket.lines.map((l) => (
                  <li key={l.variantId} className="sf-line">
                    <img src={l.image} alt="" loading="lazy" />
                    <div className="sf-line-info">
                      <strong>{l.productTitle}</strong>
                      <span>{[l.tagline, l.colour, l.size].filter(Boolean).join(' · ')}</span>
                      <div className="sf-qty" aria-label={`Quantity ${l.quantity}`}>
                        <button type="button" onClick={() => basket.setQty(l.variantId, l.quantity - 1)} aria-label={`Remove one ${l.productTitle}`}>
                          −
                        </button>
                        <span>{l.quantity}</span>
                        <button type="button" onClick={() => basket.setQty(l.variantId, l.quantity + 1)} aria-label={`Add one ${l.productTitle}`}>
                          +
                        </button>
                      </div>
                    </div>
                    <span className="sf-line-price">{formatPrice(l.price * l.quantity, l.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="sf-drawer-foot">
              <div className="sf-subtotal">
                <span>Subtotal</span>
                <strong>{formatPrice(basket.subtotal, basket.lines[0]?.currency ?? 'GBP')}</strong>
              </div>
              <p className="sf-note">UK shipping is added at checkout. Secure payment by Shopify.</p>
              {isPreviewData ? (
                <p className="sf-note is-warn">Preview mode: checkout opens once the shop is connected to Shopify.</p>
              ) : null}
              {checkoutState.error ? <p className="sf-note is-warn" role="alert">{checkoutState.error}</p> : null}
              <button type="button" className="sf-checkout" disabled={!canCheckout || checkoutState.busy} onClick={checkout}>
                {checkoutState.busy ? 'Opening checkout…' : 'Checkout'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
