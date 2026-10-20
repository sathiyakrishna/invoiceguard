'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './P2PAnimation.css';

/* Procure-to-pay scene: goods and invoices arrive, post in the ERP, and InvoiceGuard catches a duplicate in the
   payment proposal before the payment run. Original artwork, inline SVG; timing lives in P2PAnimation.css.
   The scene is isometric: ground coordinates (x runs down-right, y runs down-left, z is height) are projected
   by X()/Y() below. Every moving part sits in a <g> with its resting (composed, static) position; the CSS
   animates it in from, or out to, an offset passed as --mx/--my. */

const OX = 330, OY = 100, KX = 0.866, KY = 0.5;
const r = (n: number) => Math.round(n * 10) / 10;
const X = (x: number, y: number) => OX + (x - y) * KX;
const Y = (x: number, y: number, z = 0) => OY + (x + y) * KY - z;
const pt = (x: number, y: number, z = 0) => `${r(X(x, y))},${r(Y(x, y, z))}`;
const at = (x: number, y: number, z = 0) => `translate(${r(X(x, y))} ${r(Y(x, y, z))})`;
const mv = (a: [number, number, number], b: [number, number, number]) =>
  ({ '--mx': `${r(X(b[0], b[1]) - X(a[0], a[1]))}px`, '--my': `${r(Y(b[0], b[1], b[2]) - Y(a[0], a[1], a[2]))}px` }) as CSSProperties;

type Tone = 'g' | 'w' | 'b' | 'bl' | 'k' | 'r' | 'lp' | 'lq' | 'rd';

function Slab({ x, y, w, d, h, z = 0, tone = 'w' }: { x: number; y: number; w: number; d: number; h: number; z?: number; tone?: Tone }) {
  const t = z + h;
  return (
    <g>
      <polygon className={`s-left s-${tone}`} points={[pt(x, y + d, z), pt(x + w, y + d, z), pt(x + w, y + d, t), pt(x, y + d, t)].join(' ')} />
      <polygon className={`s-right s-${tone}`} points={[pt(x + w, y + d, z), pt(x + w, y, z), pt(x + w, y, t), pt(x + w, y + d, t)].join(' ')} />
      <polygon className={`s-top s-${tone}`} points={[pt(x, y, t), pt(x + w, y, t), pt(x + w, y + d, t), pt(x, y + d, t)].join(' ')} />
    </g>
  );
}

/* a flat polygon on a face or the floor */
const Face = ({ cls, pts }: { cls: string; pts: [number, number, number][] }) => <polygon className={cls} points={pts.map((p) => pt(...p)).join(' ')} />;

/* every in-scene label uses this one pill; only "Held" swaps in the red variant */
function Chip({ x, y, text, cls = '' }: { x: number; y: number; text: string; cls?: string }) {
  const w = Math.round(text.length * 6.9 + 26);
  return (
    <g className={`chip ${cls}`} transform={`translate(${r(x)} ${r(y)})`}>
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} />
      <text y={4.2}>{text}</text>
    </g>
  );
}

/* ─── invoice tokens: feet at (0,0), standing and slightly floating ─── */
const Shadow = () => <ellipse className="shadow" cx={0} cy={0} rx={19} ry={7.5} />;

function EmailDoc() {
  return (
    <g>
      <Shadow />
      <rect className="doc-body" x={-22} y={-50} width={44} height={32} rx={4} />
      <path className="supplier" d="M-22 -46a4 4 0 0 1 4 -4h36a4 4 0 0 1 4 4l-22 15z" />
      <path className="doc-line" d="M-14 -24h28" />
    </g>
  );
}
function PaperDoc({ neutral = false }: { neutral?: boolean }) {
  return (
    <g>
      <Shadow />
      <path className="doc-body" d="M-17 -58H9l8 8V-18H-17z" />
      <path className={neutral ? 'neutral' : 'supplier'} d="M-17 -58H9l8 8H-17z" />
      <path className="doc-line" d="M-10 -42h20M-10 -35h20M-10 -28h12" />
    </g>
  );
}
const Tag = ({ tone }: { tone: 'a' | 'b' | 'n' }) => <rect className={`tag-${tone}`} x={-13} y={-13} width={26} height={7} rx={3.5} />;
const Tick = () => (
  <g className="tick" transform="translate(19 -55)">
    <circle className="tick-bg" r={7.5} />
    <path className="tick-fg" d="M-3.4 0.2l2.5 2.6 4.6-5.2" />
  </g>
);

/* slots in the payment proposal (z = tray top) */
const TRAY_Z = 8;
const LANE_PO = 60, LANE_NON = 118;
const C0 = 484, C1 = 545;
const EXIT_X = 402;
const HELD: [number, number, number] = [470, 206, 2];
const BANK_IN: [number, number, number] = [628, 70, TRAY_Z + 14];

const Icon = {
  warn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v10M12 19v.01" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  bank: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  pause: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="3" height="10" rx="1" /><rect x="7" y="1" width="3" height="10" rx="1" /></svg>,
  play: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" /></svg>,
  cursor: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.8L10 19z" fill="#0b1f4d" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
};

const STEPS = ['Supplier delivers goods & invoice', 'Posted in ERP', 'InvoiceGuard catches duplicate', 'Payment credited to supplier'];
const MOBILE_STEPS = ['Supplier delivers goods & invoice', 'Posted in ERP (PO and non-PO)', 'InvoiceGuard catches the duplicate', 'Payment credited to supplier'];
const ODO = ['₹0', '₹1,06,802', '₹2,13,603', '₹3,20,405', '₹4,27,206', '₹5,34,008'];

function Evidence({ variant }: { variant: 'd' | 'm' }) {
  return (
    <article className={`p2p-card p2p-card--${variant}`} aria-label="Duplicate evidence">
      <h3 className="p2p-card__head">
        <span className="p2p-card__ico">{Icon.warn}</span>
        <span className="p2p-card__title">Potential duplicate — review required</span>
      </h3>
      <dl className="p2p-card__rows">
        <div className="p2p-card__row"><dt>Invoice no.</dt><dd>AS-4471<span className="p2p-eq">=</span>AS-4471</dd></div>
        <div className="p2p-card__row"><dt>Amount</dt><dd>₹5,34,008<span className="p2p-eq">=</span>₹5,34,008</dd></div>
        <div className="p2p-card__row">
          <dt>Supplier</dt>
          <dd><span className="p2p-nm">Acme Steel Ltd</span><span className="p2p-sl">/</span><span className="p2p-nm">ACME STEEL LIMITED</span><span className="p2p-card__note">two vendor accounts</span></dd>
        </div>
        <div className="p2p-card__row"><dt>Route</dt><dd><span className="p2p-nm">PO invoice</span><span className="p2p-sl">/</span><span className="p2p-nm">non-PO invoice</span></dd></div>
      </dl>
      <div className="p2p-card__foot">
        <span className="p2p-analyst"><span className="p2p-analyst__av">{Icon.user}</span>AP analyst</span>
        <span className="p2p-btn">
          <span className="p2p-btn__idle">Confirm</span>
          <span className="p2p-btn__done">{Icon.check}Confirmed</span>
        </span>
        {variant === 'd' && <span className="p2p-cursor">{Icon.cursor}</span>}
      </div>
    </article>
  );
}

const ConfirmChip = ({ variant }: { variant: 'd' | 'm' }) => (
  <p className={`p2p-chip-html p2p-chip-html--confirm p2p-chip-html--${variant}`} aria-hidden={variant === 'd' ? true : undefined}>{Icon.lock}<span>Confirmed → payment block set in ERP</span></p>
);

function readSeconds(el: HTMLElement, name: string, fallback: number) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n / 1000 : n;
}

export default function P2PAnimation() {
  const root = useRef<HTMLElement>(null);
  const [canAnimate, setCanAnimate] = useState(false); // wide screen and motion allowed
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)');
    const sync = () => setCanAnimate(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Restart the scene every --loop: drop data-live, force a reflow, set it again so every animation restarts.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!(canAnimate && inView && !paused)) {
      delete el.dataset.live;
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const play = () => {
      delete el.dataset.live;
      void el.offsetWidth;
      el.dataset.live = '1';
      timer = setTimeout(play, readSeconds(el, '--loop', 15) * 1000);
    };
    play();
    return () => {
      clearTimeout(timer);
      delete el.dataset.live;
    };
  }, [canAnimate, inView, paused]);

  return (
    <section ref={root} className="p2p" data-can-animate={canAnimate ? '1' : '0'} aria-labelledby="p2p-cap">
      <p id="p2p-cap" className="p2p-sr">
        Illustrated procure-to-pay flow. A supplier delivers goods by truck to the warehouse and two invoices arrive, one by email and one on
        paper. Both are read by OCR, posted in the ERP under two different vendor accounts, one on the PO route and one on the non-PO route, and land
        in the payment proposal. InvoiceGuard flags them as a potential duplicate (invoice AS-4471, amount ₹5,34,008). The analyst confirms, the
        payment block is set in the ERP and the duplicate is held. Payment is then credited to the suppliers for the eligible invoices.
      </p>

      <div className="p2p-stage">
        <div className="p2p-view">
        <svg className="p2p-svg" viewBox="0 0 1000 620" aria-hidden="true" focusable="false">
          {/* ───── everything except the payment proposal; dims during the catch ───── */}
          <g className="bg">
            {/* ground plate */}
                        <Slab x={-40} y={-10} w={760} d={300} h={10} z={-10} tone="g" />
            <Slab x={-40} y={258} w={250} d={30} h={1} tone="r" />
            <Slab x={40} y={LANE_PO - 12} w={420} d={24} h={2} tone="lp" />
            <Slab x={40} y={LANE_NON - 12} w={420} d={24} h={2} tone="lq" />

            {/* warehouse + truck */}
            <Slab x={10} y={148} w={120} d={84} h={62} tone="w" />
            <Slab x={6} y={144} w={128} d={92} h={5} z={62} tone="b" />
            <Face cls="door" pts={[[50, 232, 0], [84, 232, 0], [84, 232, 36], [50, 232, 36]]} />
            <Face cls="win" pts={[[96, 232, 26], [120, 232, 26], [120, 232, 44], [96, 232, 44]]} />
            <Face cls="win" pts={[[18, 232, 26], [38, 232, 26], [38, 232, 44], [18, 232, 44]]} />

            {/* OCR gate (left post, documents pass under the beam, right post) */}
            <Slab x={194} y={32} w={12} d={10} h={78} tone="w" />
            <g>
              {/* pre-ERP invoices: arrive (phase A), then travel through OCR into the ERP (phase B) */}
              <g transform={at(150, LANE_PO, 4)}>
                <g className="a-b1" style={mv([150, LANE_PO, 4], [300, LANE_PO, 4])}>
                  <g className="a-a--email" style={mv([150, LANE_PO, 4], [20, LANE_PO, 4])}><EmailDoc /></g>
                </g>
              </g>
              <g transform={at(150, LANE_NON, 4)}>
                <g className="a-b1" style={mv([150, LANE_NON, 4], [300, LANE_NON, 4])}>
                  <g className="a-a--paper" style={mv([150, LANE_NON, 4], [20, LANE_NON, 4])}><PaperDoc /></g>
                </g>
              </g>
              <polygon className="curtain" points={[pt(200, 42, 2), pt(200, 142, 2), pt(200, 142, 70), pt(200, 42, 70)].join(' ')} />
            </g>
            <Slab x={194} y={142} w={12} d={10} h={78} tone="w" />
            <Slab x={192} y={30} w={16} d={124} h={9} z={78} tone="b" />

            {/* ERP */}
            <Slab x={300} y={20} w={100} d={134} h={74} tone="w" />
            <Slab x={296} y={16} w={108} d={142} h={6} z={74} tone="b" />
            <polygon className="glow erp-glow" points={[pt(296, 16, 80), pt(404, 16, 80), pt(404, 158, 80), pt(296, 158, 80)].join(' ')} />
            <Face cls="win" pts={[[316, 154, 30], [340, 154, 30], [340, 154, 52], [316, 154, 52]]} />
            <Face cls="win" pts={[[352, 154, 30], [376, 154, 30], [376, 154, 52], [352, 154, 52]]} />
            <Face cls="door" pts={[[400, LANE_PO - 10, 0], [400, LANE_PO + 10, 0], [400, LANE_PO + 10, 28], [400, LANE_PO - 10, 28]]} />
            <Face cls="door" pts={[[400, LANE_NON - 10, 0], [400, LANE_NON + 10, 0], [400, LANE_NON + 10, 28], [400, LANE_NON - 10, 28]]} />

            {/* truck, crates */}
            <g className="truck" style={mv([47, 274, 3], [-53, 274, 3])}>
              <Slab x={14} y={264} w={48} d={20} h={24} z={3} tone="w" />
              <Slab x={62} y={266} w={18} d={16} h={16} z={3} tone="b" />
              <Face cls="tyre" pts={[[22, 284, 0], [30, 284, 0], [30, 284, 8], [22, 284, 8]]} />
              <Face cls="tyre" pts={[[46, 284, 0], [54, 284, 0], [54, 284, 8], [46, 284, 8]]} />
              <Face cls="tyre" pts={[[66, 282, 0], [74, 282, 0], [74, 282, 8], [66, 282, 8]]} />
            </g>
            <g className="crate crate--1" style={mv([22, 268, 27], [58, 236, 6])}><Slab x={22} y={268} w={11} d={11} h={11} z={27} tone="bl" /></g>
            <g className="crate crate--2" style={mv([38, 268, 27], [58, 236, 6])}><Slab x={38} y={268} w={11} d={11} h={11} z={27} tone="b" /></g>

            {/* bank + supplier */}
            <Slab x={626} y={22} w={96} d={84} h={6} tone="w" />
            <Slab x={634} y={30} w={82} d={14} h={46} z={6} tone="w" />
            {[0, 1, 2, 3].map((i) => <Slab key={i} x={638 + i * 24} y={88} w={8} d={8} h={46} z={6} tone="w" />)}
            <Slab x={624} y={20} w={100} d={88} h={10} z={52} tone="b" />
            <polygon className="glow bank-glow" points={[pt(624, 20, 62), pt(724, 20, 62), pt(724, 108, 62), pt(624, 108, 62)].join(' ')} />
            <Slab x={642} y={150} w={64} d={46} h={34} tone="w" />
            <Slab x={638} y={146} w={72} d={54} h={5} z={34} tone="b" />
            <Face cls="door" pts={[[666, 196, 0], [682, 196, 0], [682, 196, 20], [666, 196, 20]]} />
            {[0, 1, 2].map((i) => (
              <g key={i} transform={at(674, 112, 36)}>
                <g className={`coin coin--${i}`} style={mv([674, 112, 36], [674, 160, 52])}>
                  <circle className="coin-c" r={7} /><circle className="coin-in" r={3.4} />
                </g>
              </g>
            ))}
            <g transform={at(674, 173, 62)}>
              <g className="credit">
                <circle className="tick-bg" r={10} />
                <path className="tick-fg" d="M-4.4 0.2l3.2 3.4 6-6.6" />
              </g>
            </g>
          </g>

          {/* ───── labels: one style, never dimmed so they stay readable ───── */}
          <g className="lbls">
            <g transform="translate(140 304)"><g className="deliver"><Chip x={0} y={0} text="Supplier delivers goods" /></g></g>
            <g transform={`translate(${r(X(72, 190))} ${r(Y(72, 190, 104))})`}><g className="grn"><Chip x={0} y={0} text="GRN posted" /></g></g>
            <g transform={`translate(${r(X(200, 92))} ${r(Y(200, 92, 112))})`}><Chip x={0} y={0} text="OCR" /></g>
            <g transform={at(160, 30, 4)}><Chip x={0} y={0} text="PO" /></g>
            <g transform={at(172, 148, 4)}><Chip x={0} y={0} text="non-PO" /></g>
            <g transform={`translate(${r(X(350, 88))} ${r(Y(350, 88, 100))})`}><Chip x={0} y={0} text="ERP" /></g>
            <g transform={`translate(${r(X(674, 64))} ${r(Y(674, 64, 82))})`}><Chip x={0} y={0} text="Bank" /></g>
            <g transform="translate(800 574)"><g className="credit-lbl"><Chip x={0} y={0} text="Payment credited to supplier" /></g></g>
          </g>

          {/* ───── payment proposal: stays in focus during the catch ───── */}
          <g className="focus" style={{ transformOrigin: `${r(X(520, 100))}px ${r(Y(520, 100, 30))}px` }}>
            <g className="bay">
              <Slab x={428} y={178} w={86} d={56} h={2} tone="rd" />
              <polygon className="bay-edge" points={[pt(432, 182, 2), pt(510, 182, 2), pt(510, 230, 2), pt(432, 230, 2)].join(' ')} />
              <g transform={`translate(${r(X(500, 234))} ${r(Y(500, 234, 12))})`}><Chip x={0} y={0} text="Held" cls="chip--held" /></g>
            </g>
            <Slab x={455} y={26} w={125} d={126} h={TRAY_Z} tone="bl" />
            <g transform={`translate(678 466)`}><Chip x={0} y={0} text="Payment proposal" /></g>
            <polygon className="sweep" style={mv([455, 90, TRAY_Z], [565, 90, TRAY_Z])} points={[pt(455, 26, TRAY_Z), pt(471, 26, TRAY_Z), pt(471, 152, TRAY_Z), pt(455, 152, TRAY_Z)].join(' ')} />

            {/* original (email): pays in phase D */}
            <g transform={at(C0, LANE_PO, TRAY_Z)}>
              <g className="pay pay--0" style={mv([C0, LANE_PO, TRAY_Z], BANK_IN)}>
                <g className="a-b2" style={mv([C0, LANE_PO, TRAY_Z], [EXIT_X, LANE_PO, 4])}><EmailDoc /><Tag tone="a" /><Tick /></g>
              </g>
            </g>
            <polyline className="link" points={[pt(C0, LANE_PO + 6, TRAY_Z), pt(C0, LANE_NON - 6, TRAY_Z)].join(' ')} />

            {/* duplicate (paper, second vendor account): flagged, then held */}
            <g transform={at(HELD[0], HELD[1], HELD[2])}>
              <g className="held-move" style={mv(HELD, [C0, LANE_NON, TRAY_Z])}>
                <g className="a-b2" style={mv([C0, LANE_NON, TRAY_Z], [EXIT_X, LANE_NON, 4])}>
                  <ellipse className="ring" cx={0} cy={0} rx={22} ry={9} />
                  <PaperDoc /><Tag tone="b" /><Tick />
                  <g className="pin"><path className="pin-body" d="M0 -60L-8 -74A10 10 0 1 1 8 -74Z" /><circle className="pin-dot" cx={0} cy={-80} r={3.6} /></g>
                </g>
              </g>
            </g>

            {/* two other eligible invoices */}
            <g transform={at(C1, LANE_PO, TRAY_Z)}>
              <g className="pay pay--1" style={mv([C1, LANE_PO, TRAY_Z], BANK_IN)}>
                <g className="a-b2" style={mv([C1, LANE_PO, TRAY_Z], [EXIT_X, LANE_PO, 4])}><PaperDoc neutral /><Tag tone="n" /><Tick /></g>
              </g>
            </g>
            <g transform={at(C1, LANE_NON, TRAY_Z)}>
              <g className="pay pay--2" style={mv([C1, LANE_NON, TRAY_Z], BANK_IN)}>
                <g className="a-b2" style={mv([C1, LANE_NON, TRAY_Z], [EXIT_X, LANE_NON, 4])}><PaperDoc neutral /><Tag tone="n" /><Tick /></g>
              </g>
            </g>
          </g>
        </svg>
        </div>

        <ul className="p2p-kpis" aria-label="Illustrative figures">
          <li className="p2p-kpis__tag">Illustrative</li>
          <li className="p2p-kpi"><span className="p2p-kpi__label">Invoices scanned</span><span className="p2p-kpi__value">2,000</span></li>
          <li className="p2p-kpi"><span className="p2p-kpi__label">Duplicates flagged</span><span className="p2p-kpi__value">25</span></li>
          <li className="p2p-kpi p2p-kpi--held">
            <span className="p2p-kpi__label">Confirmed duplicate value held</span>
            <span className="p2p-kpi__value">
              <span className="p2p-sr">₹5,34,008</span>
              <span className="p2p-odo" aria-hidden="true"><span className="p2p-odo__strip">{ODO.map((v) => <span key={v}>{v}</span>)}</span></span>
            </span>
          </li>
        </ul>

        <Evidence variant="d" />
        <ConfirmChip variant="d" />
        <p className="p2p-chip-html p2p-chip-html--paid" aria-hidden="true">{Icon.bank}<span>Payment executed for eligible invoices</span></p>
      </div>

      <ol className="p2p-steps" aria-label="Steps shown in the animation">
        {STEPS.map((s, i) => (
          <li key={s} className="p2p-step">
            <span className="p2p-step__on" aria-hidden="true" />
            <span className="p2p-step__n" aria-hidden="true">{i + 1}</span>
            <span>{s}</span>
            <span className="p2p-step__bar" aria-hidden="true" />
          </li>
        ))}
      </ol>

      <ol className="p2p-tl" aria-label="Steps">
        {MOBILE_STEPS.map((t, i) => (
          <li key={t} className={`p2p-tl__item${i === 2 ? ' is-open' : ''}`}>
            <span className="p2p-tl__n" aria-hidden="true">{i + 1}</span>
            <span className="p2p-tl__t">{t}</span>
            {i === 2 && (
              <div className="p2p-tl__body">
                <Evidence variant="m" />
                <ConfirmChip variant="m" />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="p2p-foot">
        <p className="p2p-note">InvoiceGuard flags and explains. The analyst sets the payment block in the ERP; InvoiceGuard does not write to the ERP or make payments. Figures are illustrative.</p>
        <button type="button" className="p2p-pause" onClick={() => setPaused((p) => !p)}>
          {paused ? Icon.play : Icon.pause}
          {paused ? 'Play animation' : 'Pause animation'}
        </button>
      </div>
    </section>
  );
}
