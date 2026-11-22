// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * ShopWheel — one horizontal "dial" of image cards for the three-wheel shop.
 *
 * Inspired by the Falcon wallet's WalletCylinder, but rebuilt for shopping:
 *  - image cards on a curved ring (not text labels on a closed cylinder), so it works
 *    for 1 item or 20 without the ring looking empty or wrapping confusingly;
 *  - a real spring (rAF) with momentum + rubber-band edges instead of a fixed CSS
 *    transition, so flicks carry and settle with a tiny detent "click";
 *  - live detents: the selection (and the big preview) updates as each card passes the
 *    centre, with a short haptic tick on phones that support navigator.vibrate;
 *  - a position rail under the dial, side arrows, keyboard, horizontal trackpad /
 *    Shift+wheel, and a flat no-3D, no-spring mode for prefers-reduced-motion.
 * Vertical gestures are deliberately ignored here: the parent uses them to move
 * between wheels (swipe up / scroll down = next wheel).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface WheelItem {
  id: string;
  label: string;
  sublabel?: string;
  image?: string;
  imageAlt?: string;
  swatch?: { hex: string; hex2?: string };
  disabled?: boolean;
}

interface ShopWheelProps {
  items: WheelItem[];
  index: number;
  onChange: (index: number) => void;
  onActivate?: () => void;
  onNext?: () => void;
  onBack?: () => void;
  label: string;
  size?: 'lg' | 'sm';
  reducedMotion: boolean;
  autoFocus?: boolean;
}

const STIFFNESS = 230;
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.82; // slightly under-damped → soft detent overshoot
const STEP_RAD = 0.5; // angle between cards on the ring (~29°)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rubber = (over: number) => (over * 0.55) / (1 + over * 0.9);

function haptic(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

export default function ShopWheel({
  items,
  index,
  onChange,
  onActivate,
  onNext,
  onBack,
  label,
  size = 'lg',
  reducedMotion,
  autoFocus,
}: ShopWheelProps) {
  const n = items.length;
  const max = Math.max(0, n - 1);
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [pos, setPos] = useState(index);
  const [dragging, setDragging] = useState(false);

  const posRef = useRef(index);
  const velRef = useRef(0);
  const targetRef = useRef(index);
  const rafRef = useRef<number | null>(null);
  const lastDetent = useRef(index);
  const interacted = useRef(false);
  const suppressClick = useRef(false);
  const wheelSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    start: number;
    axis: 'x' | 'y' | null;
    samples: Array<{ x: number; t: number }>;
    id: number;
  } | null>(null);

  // Keep latest callbacks without re-binding listeners.
  const cb = useRef({ onChange, onActivate, onNext, onBack });
  cb.current = { onChange, onActivate, onNext, onBack };

  const cardW = size === 'lg' ? clamp(width * 0.3, 104, 150) : clamp(width * 0.22, 78, 104);
  const cardH = size === 'lg' ? cardW * 1.24 : cardW * 1.22;
  const radius = cardW * 2.05;
  const pxPerItem = cardW * 0.95;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const render = useCallback(
    (p: number) => {
      posRef.current = p;
      setPos(p);
      const detent = clamp(Math.round(p), 0, max);
      if (detent !== lastDetent.current) {
        lastDetent.current = detent;
        if (interacted.current && !reducedMotion) haptic(6);
        cb.current.onChange(detent);
      }
    },
    [max, reducedMotion],
  );

  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const animateTo = useCallback(
    (target: number, initialVel?: number) => {
      const t = clamp(Math.round(target), 0, max);
      targetRef.current = t;
      stop();
      if (reducedMotion) {
        velRef.current = 0;
        render(t);
        return;
      }
      if (initialVel !== undefined) velRef.current = initialVel;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const x = posRef.current - targetRef.current;
        const acc = -STIFFNESS * x - DAMPING * velRef.current;
        velRef.current += acc * dt;
        const next = posRef.current + velRef.current * dt;
        if (Math.abs(next - targetRef.current) < 0.0015 && Math.abs(velRef.current) < 0.02) {
          velRef.current = 0;
          render(targetRef.current);
          rafRef.current = null;
          return;
        }
        render(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [max, reducedMotion, render],
  );

  useEffect(() => () => stop(), []);

  // External index changes (e.g. list reset, breadcrumb) → glide there.
  useEffect(() => {
    // Ignore echoes of our own live detent updates; only react to outside changes.
    if (drag.current || index === lastDetent.current) return;
    lastDetent.current = clamp(index, 0, max);
    animateTo(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, n]);

  const step = (d: number) => {
    interacted.current = true;
    animateTo(targetRef.current + d);
  };

  // ---- pointer (touch / mouse / pen) ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, y: e.clientY, start: posRef.current, axis: null, samples: [{ x: e.clientX, t: e.timeStamp }], id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'x') {
        stop();
        d.start = posRef.current;
        d.x = e.clientX;
        interacted.current = true;
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (d.axis !== 'x') return;
    e.stopPropagation();
    let raw = d.start - (e.clientX - d.x) / pxPerItem;
    if (raw < 0) raw = -rubber(-raw);
    else if (raw > max) raw = max + rubber(raw - max);
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
    render(raw);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== 'x') return;
    suppressClick.current = true;
    setDragging(false);
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const recent = e.timeStamp - last.t < 80;
    const vPx = recent ? (last.x - first.x) / dt : 0; // px/ms
    const vItems = (-vPx * 1000) / pxPerItem; // items/s
    const capped = clamp(vItems, -24, 24);
    const projected = posRef.current + capped * 0.16;
    animateTo(projected, capped);
  };

  // ---- horizontal wheel / trackpad (vertical is left to the parent) ----
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal && !e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      interacted.current = true;
      stop();
      const delta = horizontal ? e.deltaX : e.deltaY;
      let raw = posRef.current + delta / (pxPerItem * 1.1);
      raw = clamp(raw, -0.35, max + 0.35);
      render(raw);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => animateTo(posRef.current, 0), 110);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
    };
  }, [animateTo, max, pxPerItem, render]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    let handled = true;
    if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'Home') { interacted.current = true; animateTo(0); }
    else if (k === 'End') { interacted.current = true; animateTo(max); }
    else if ((k === 'Enter' || k === ' ') && cb.current.onActivate) cb.current.onActivate();
    else if (k === 'ArrowDown' && cb.current.onNext) cb.current.onNext();
    else if ((k === 'ArrowUp' || k === 'Escape' || k === 'Backspace') && cb.current.onBack) cb.current.onBack();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const centre = clamp(Math.round(pos), 0, max);
  const activeId = n ? `sfw-${label.replace(/\W+/g, '-')}-${centre}` : undefined;

  return (
    <div
      ref={rootRef}
      className={`sfw sfw-${size}${dragging ? ' is-dragging' : ''}${reducedMotion ? ' is-flat' : ''}`}
      role="listbox"
      aria-label={`${label}. Use left and right arrows to browse, Enter or down arrow to choose.`}
      aria-activedescendant={activeId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ height: cardH + 46, ['--w' as string]: `${cardW}px`, ['--h' as string]: `${cardH}px` }}
    >
      <div className="sfw-track" aria-hidden={false}>
        {items.map((item, i) => {
          const o = i - pos;
          if (Math.abs(o) > 3.4) return null;
          let transform: string;
          let opacity: number;
          if (reducedMotion) {
            transform = `translate3d(${o * cardW * 1.08}px, 0, 0) scale(${i === centre ? 1 : 0.86})`;
            opacity = Math.abs(o) > 2.5 ? 0 : 1 - Math.min(1, Math.abs(o)) * 0.35;
          } else {
            const a = clamp(o, -3.2, 3.2) * STEP_RAD;
            const x = Math.sin(a) * radius;
            const z = (Math.cos(a) - 1) * radius;
            const y = (1 - Math.cos(a)) * cardH * 0.55;
            transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${((a * 180) / Math.PI).toFixed(2)}deg)`;
            opacity = clamp(1 - Math.abs(o) * 0.24, 0, 1);
          }
          const isCentre = i === centre;
          return (
            <button
              key={item.id}
              id={`sfw-${label.replace(/\W+/g, '-')}-${i}`}
              type="button"
              role="option"
              aria-selected={isCentre}
              aria-disabled={item.disabled || undefined}
              tabIndex={-1}
              className={`sfw-card${isCentre ? ' is-centre' : ''}${item.disabled ? ' is-disabled' : ''}`}
              style={{ transform, opacity, zIndex: 100 - Math.round(Math.abs(o) * 10) }}
              onClick={() => {
                if (suppressClick.current) return;
                interacted.current = true;
                if (isCentre) cb.current.onActivate?.();
                else animateTo(i);
              }}
            >
              <span className="sfw-media">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    draggable={false}
                    loading={Math.abs(o) < 1.5 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                ) : null}
                {item.swatch ? (
                  <span
                    className="sfw-swatch"
                    style={{
                      background: item.swatch.hex2
                        ? `linear-gradient(135deg, ${item.swatch.hex} 0 50%, ${item.swatch.hex2} 50% 100%)`
                        : item.swatch.hex,
                    }}
                  />
                ) : null}
              </span>
              <span className="sfw-label">{item.label}</span>
              {item.sublabel ? <span className="sfw-sub">{item.sublabel}</span> : null}
            </button>
          );
        })}
      </div>

      {n > 1 ? (
        <>
          <button
            type="button"
            className="sfw-arrow is-prev"
            aria-label="Previous"
            disabled={centre === 0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="sfw-arrow is-next"
            aria-label="Next"
            disabled={centre === max}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => step(1)}
          >
            ›
          </button>
          <div className="sfw-rail" aria-hidden="true">
            {items.map((it, i) => (
              <span key={it.id} className={`sfw-tick${i === centre ? ' is-on' : ''}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
