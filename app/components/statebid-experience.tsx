'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesAtlas from 'us-atlas/states-10m.json';
import { ArrowUpRight, Check, ChevronRight, CircleDollarSign, ExternalLink, LoaderCircle, Moon, Radio, ShieldCheck, Sun, Trophy, Upload, X } from 'lucide-react';
import { STATE_BY_CODE, STATE_BY_FIPS, type StateCode } from '@/lib/states';
import type { BoardSnapshot, CheckoutQuote, ListingPreview, PublicListing, StatePosition } from '@/lib/types';
import { DEFAULT_STATE_BORDER, lighterColor } from '@/lib/colors';

type AtlasObjects = { states: GeometryCollection };
const atlas = statesAtlas as unknown as Topology<AtlasObjects>;
const NORTHEAST_CALLOUTS: Partial<Record<StateCode, [number, number]>> = {
  ME: [923, 90], NH: [923, 142], VT: [923, 194], MA: [923, 246], RI: [923, 298],
  CT: [923, 350], NJ: [923, 402], DE: [923, 454], MD: [923, 506],
};

function formatMoney(cents: string) {
  const dollars = BigInt(cents || '0') / 100n;
  return `$${dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function initials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '•';
}

function brandColor(key: string) {
  const colors = ['#ff785a', '#c8ff62', '#7ee7ff', '#c4a7ff', '#ffd25f', '#82f1c8'];
  let hash = 0;
  for (const character of key) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function Logo({ listing, small = false }: { listing: PublicListing; small?: boolean }) {
  return <span className={`brand-logo ${small ? 'is-small' : ''}`} style={{ background: brandColor(listing.normalizedKey) }} aria-hidden="true">
    {listing.logoUrl ? <img src={listing.logoUrl} alt="" /> : initials(listing.title)}
  </span>;
}

function MapLogo({ position, x, y, code }: { position: StatePosition | undefined; x: number; y: number; code: string }) {
  return <g className="map-logo" transform={`translate(${roundCoordinate(x)} ${roundCoordinate(y)})`} aria-hidden="true" filter="url(#logo-shadow)">
    <circle r="19" fill={position ? brandColor(position.listing.normalizedKey) : 'var(--map-empty-badge)'} />
    {position?.listing.logoUrl
      ? <image href={position.listing.logoUrl} x="-15" y="-15" width="30" height="30" preserveAspectRatio="xMidYMid slice" clipPath="url(#avatar-clip)" />
      : <text y="1">{position ? initials(position.listing.title) : code}</text>}
  </g>;
}

function MapSurface({ selected, positions, onSelect }: { selected: StateCode; positions: Map<StateCode, StatePosition>; onSelect: (code: StateCode) => void }) {
  const hoverTimer = useRef<number | null>(null);
  const map = useMemo(() => {
    const collection = feature(atlas, atlas.objects.states) as unknown as FeatureCollection<Geometry, { name: string }>;
    const states = collection.features.filter((item) => STATE_BY_FIPS.has(String(item.id).padStart(2, '0')));
    const filtered: FeatureCollection<Geometry, { name: string }> = { type: 'FeatureCollection', features: states };
    const projection = geoAlbersUsa().fitExtent([[26, 24], [865, 586]], filtered);
    return { states, path: geoPath(projection).digits(2) };
  }, []);

  const selectFromKeyboard = (event: KeyboardEvent<SVGGElement>, code: StateCode) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(code); }
  };
  const scheduleHover = (code: StateCode) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => onSelect(code), 160);
  };
  const cancelHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => cancelHover, []);

  return <svg className="state-map" viewBox="0 0 1000 610" role="group" aria-label="Interactive map of the 50 United States">
    <defs>
      <filter id="logo-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.25" /></filter>
      <clipPath id="avatar-clip"><circle r="15" /></clipPath>
    </defs>
    {map.states.map((item) => {
      const state = STATE_BY_FIPS.get(String(item.id).padStart(2, '0'));
      if (!state) return null;
      const position = positions.get(state.code);
      const callout = NORTHEAST_CALLOUTS[state.code];
      const stateStyle = position ? { '--state-border': position.stateBorderColor, '--state-fill': position.stateFillColor } as CSSProperties : undefined;
      return <path key={state.code} d={map.path(item) ?? undefined}
        className={`state-shape ${position ? 'is-claimed' : ''} ${selected === state.code ? 'is-selected' : ''}`}
        style={stateStyle}
        tabIndex={callout ? -1 : 0} role={callout ? undefined : 'button'} aria-hidden={callout ? true : undefined}
        aria-label={callout ? undefined : `${state.name}. ${position ? `${position.listing.title} leads at ${formatMoney(position.totalCents)}.` : 'Unclaimed. Claim for one dollar.'}`}
        onClick={() => onSelect(state.code)} onMouseEnter={() => scheduleHover(state.code)} onMouseLeave={cancelHover} onFocus={() => onSelect(state.code)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(state.code); } }} />;
    })}
    {map.states.map((item) => {
      const state = STATE_BY_FIPS.get(String(item.id).padStart(2, '0'));
      if (!state || NORTHEAST_CALLOUTS[state.code]) return null;
      const position = positions.get(state.code);
      if (!position) return null;
      const [x, y] = map.path.centroid(item);
      return Number.isFinite(x) && Number.isFinite(y) ? <MapLogo key={`logo-${state.code}`} position={position} x={x} y={y} code={state.code} /> : null;
    })}
    {map.states.map((item) => {
      const state = STATE_BY_FIPS.get(String(item.id).padStart(2, '0'));
      if (!state) return null;
      const callout = NORTHEAST_CALLOUTS[state.code];
      if (!callout) return null;
      const [originX, originY] = map.path.centroid(item);
      const [x, y] = callout;
      const position = positions.get(state.code);
      return <g key={`callout-${state.code}`} className={`state-callout ${selected === state.code ? 'is-selected' : ''}`}
        role="button" tabIndex={0}
        aria-label={`${state.name}. ${position ? `${position.listing.title} leads at ${formatMoney(position.totalCents)}.` : 'Unclaimed. Claim for one dollar.'}`}
        onClick={() => onSelect(state.code)} onMouseEnter={() => scheduleHover(state.code)} onMouseLeave={cancelHover} onFocus={() => onSelect(state.code)} onKeyDown={(event) => selectFromKeyboard(event, state.code)}>
        <path d={`M ${roundCoordinate(originX)} ${roundCoordinate(originY)} L ${x - 28} ${y}`} />
        <MapLogo position={position} x={x} y={y} code={position ? state.code : ''} />
        <text className="callout-code" x={x + 27} y={y + 4}>{state.code}</text>
      </g>;
    })}
  </svg>;
}

export function StateBidExperience({ initialSnapshot }: { initialSnapshot: BoardSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selected, setSelected] = useState<StateCode>(() => initialSnapshot.positions[0]?.stateCode ?? 'CA');
  const [claimOpen, setClaimOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [boardTab, setBoardTab] = useState<'permanent' | 'daily'>('permanent');
  const [notice, setNotice] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/board', { headers: etag.current ? { 'if-none-match': etag.current } : undefined });
    if (response.status === 304) return;
    if (!response.ok) throw new Error('Board refresh failed.');
    etag.current = response.headers.get('etag');
    setSnapshot(await response.json() as BoardSnapshot);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('state')?.toUpperCase() as StateCode | undefined;
    const stored = window.localStorage.getItem('statebid-theme');
    const nextDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
    const frame = window.requestAnimationFrame(() => {
      if (requested && STATE_BY_CODE.has(requested)) setSelected(requested);
      if (params.get('checkout') === 'cancelled') setNotice('Checkout was cancelled. No bid was recorded.');
      setDark(nextDark);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const tick = () => { if (!document.hidden) refresh().catch(() => undefined); };
    const timer = window.setInterval(tick, 8000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [refresh]);

  useEffect(() => {
    if (!claimOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') closeClaim(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  });

  const positions = useMemo(() => new Map(snapshot.positions.map((position) => [position.stateCode, position])), [snapshot]);
  const state = STATE_BY_CODE.get(selected)!;
  const position = positions.get(selected);

  function toggleTheme() {
    setDark((current) => {
      const next = !current; document.documentElement.dataset.theme = next ? 'dark' : 'light';
      window.localStorage.setItem('statebid-theme', next ? 'dark' : 'light'); return next;
    });
  }

  function openClaim() { returnFocus.current = document.activeElement as HTMLElement | null; setClaimOpen(true); }
  function closeClaim() { setClaimOpen(false); window.setTimeout(() => returnFocus.current?.focus(), 0); }
  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' || event.key === 'ArrowLeft' ? 'permanent' : 'daily';
    setBoardTab(next); document.getElementById(`board-tab-${next}`)?.focus();
  }

  return <main className="site-shell">
    <header className="topbar">
      <a className="wordmark" href="#top" aria-label="StateBid home"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></a>
      <nav className="nav-links" aria-label="Main navigation"><a href="#map">Map</a><a href="#how-it-works">How it works</a><a href="/rules">Rules</a></nav>
      <div className="topbar-actions"><span className="live-pill"><Radio size={13} /> Live</span>
        <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="primary-button compact" type="button" onClick={openClaim}>Claim a state <ArrowUpRight size={15} /></button>
      </div>
    </header>

    {notice ? <div className="site-notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div> : null}

    <section className="hero" id="top"><div><div className="eyebrow"><span /> 50 states. One leader each.</div><h1>Own a piece<br />of the map.</h1><p>Every state is permanent paid placement. The highest verified standing bid gets the logo—and the attention.</p></div>
      <div className="hero-stats" aria-label="Live marketplace statistics"><div><span>Total map value</span><strong>{formatMoney(snapshot.stats.mapValueCents)}</strong></div><div><span>States claimed</span><strong>{snapshot.stats.claimedStates} <small>/ 50</small></strong></div><div><span>Last 24 hours</span><strong>{formatMoney(snapshot.stats.dailyVolumeCents)}</strong></div></div>
    </section>

    <section className="market-grid" id="map">
      <aside className={`side-panel permanent-panel mobile-${boardTab === 'permanent' ? 'active' : 'hidden'}`} id="board-panel-permanent" role="tabpanel" aria-labelledby="board-tab-permanent">
        <div className="panel-heading"><div><span className="panel-kicker"><Trophy size={13} /> All time</span><h2>Permanent leaders</h2></div><span className="count-badge">{snapshot.positions.length}</span></div>
        <div className="leader-list">{snapshot.allTimeLeaders.length ? snapshot.allTimeLeaders.map((item, index) => <button key={item.stateCode} className={`leader-row ${selected === item.stateCode ? 'is-active' : ''}`} type="button" onClick={() => setSelected(item.stateCode)}>
          <span className="rank">{String(index + 1).padStart(2, '0')}</span><Logo listing={item.listing} /><span className="leader-copy"><strong>{item.listing.title}</strong><small>{item.stateName}</small></span><span className="leader-amount"><strong>{formatMoney(item.totalCents)}</strong><small>{formatMoney(item.takeoverCents)} to claim</small></span>
        </button>) : <EmptyPanel title="The map is wide open" copy="Be the first verified bidder to claim a state for $1." />}</div>
        <a className="panel-link" href="#all-states">View all 50 states <ChevronRight size={15} /></a>
      </aside>

      <div className="map-column"><div className="map-toolbar"><div><span className="map-pulse" /> Live ownership map</div><span>Updated {relativeTime(snapshot.generatedAt)}</span></div>
        <div className="map-card"><div className="map-grid-bg" aria-hidden="true" /><MapSurface selected={selected} positions={positions} onSelect={setSelected} />
          <div className="state-detail-card" role="status" aria-live="polite"><div className="detail-topline"><span>{state.name}</span><span>{position ? 'Claimed' : 'Available'}</span></div>
            {position ? <><div className="detail-owner"><Logo listing={position.listing} /><div><strong>{position.listing.title}</strong><small>{position.listing.normalizedKey.replace(/^\w+:/, '')}</small></div><span>{formatMoney(position.totalCents)}</span></div><div className="detail-metrics"><span><small>Last 24h</small>{formatMoney(position.dailyCents)}</span><span><small>Clicks</small>{new Intl.NumberFormat('en-US').format(position.clicks)}</span></div><div className="detail-links"><a href={`/go/${selected}`} target="_blank" rel="sponsored nofollow noopener">Visit sponsor <ExternalLink size={13} /></a><a href={`/state/${selected.toLowerCase()}`}>Share page</a></div><button className="claim-button" type="button" onClick={openClaim}>Claim {state.code} for {formatMoney(position.takeoverCents)} <ArrowUpRight size={16} /></button></>
              : <><p className="available-copy">Put your logo on {state.name}. The first verified dollar takes it.</p><button className="claim-button" type="button" onClick={openClaim}>Claim {state.code} for $1 <ArrowUpRight size={16} /></button></>}
          </div>
        </div><div className="map-legend"><span><i className="legend-dot claimed" /> Claimed</span><span><i className="legend-dot available" /> Available</span><span>Hover, focus, or tap a state</span></div>
        <div className="boards-mobile-tabs" role="tablist" aria-label="Ranking boards" onKeyDown={handleTabKeys}><button id="board-tab-permanent" role="tab" aria-selected={boardTab === 'permanent'} aria-controls="board-panel-permanent" tabIndex={boardTab === 'permanent' ? 0 : -1} onClick={() => setBoardTab('permanent')}>Permanent</button><button id="board-tab-daily" role="tab" aria-selected={boardTab === 'daily'} aria-controls="board-panel-daily" tabIndex={boardTab === 'daily' ? 0 : -1} onClick={() => setBoardTab('daily')}>Last 24 hours</button></div>
      </div>

      <aside className={`side-panel daily-panel mobile-${boardTab === 'daily' ? 'active' : 'hidden'}`} id="board-panel-daily" role="tabpanel" aria-labelledby="board-tab-daily">
        <div className="panel-heading"><div><span className="panel-kicker hot"><CircleDollarSign size={13} /> Rolling 24h</span><h2>Last 24 hours</h2></div><span className="count-badge">Live</span></div>
        <div className="daily-list">{snapshot.dailyLeaders.length ? snapshot.dailyLeaders.map((item, index) => <button key={`${item.stateCode}-${item.listing.id}`} className="daily-row" type="button" onClick={() => setSelected(item.stateCode)}><span className="rank">{index + 1}</span><Logo listing={item.listing} small /><span className="leader-copy"><strong>{item.listing.title}</strong><small>{item.stateCode} · {formatMoney(item.permanentCents)} standing</small></span><strong className="today-amount">+{formatMoney(item.dailyCents)}</strong></button>) : <EmptyPanel title="No payments yet" copy="Verified increments from the rolling previous 24 hours will appear here." />}</div>
        <div className="activity-block"><div className="activity-title"><span>Latest verified activity</span><span className="activity-pulse" /></div>{snapshot.activity.length ? snapshot.activity.map((item) => <p key={item.id}><Logo listing={item.listing} small /><span><strong>{item.listing.title}</strong> funded {item.stateName}</span><time>{relativeTime(item.paidAt)}</time></p>) : <p className="activity-empty">No verified payments yet.</p>}</div>
      </aside>
    </section>

    <section className="all-states-section" id="all-states"><div><span className="eyebrow"><span /> Accessible list</span><h2>All 50 states</h2></div><div className="state-chip-grid">{[...STATE_BY_CODE.values()].map((item) => { const leader = positions.get(item.code); return <button key={item.code} onClick={() => { setSelected(item.code); document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' }); }}><span>{item.code}</span><strong>{item.name}</strong><small>{leader ? formatMoney(leader.totalCents) : '$1 to claim'}</small></button>; })}</div></section>

    <section className="how-section" id="how-it-works"><div><span className="eyebrow"><span /> Plain rules, real stakes</span><h2>Money talks.<br />The map listens.</h2></div><div className="steps"><article><span>01</span><h3>Pick a state</h3><p>Choose any state. Empty ones start at a single dollar.</p></article><article><span>02</span><h3>Add your link</h3><p>Use a website or X handle. Identity locks on its first verified payment.</p></article><article><span>03</span><h3>Pay the difference</h3><p>Returning listings keep their standing total and only fund the raise.</p></article></div></section>
    <footer><div className="wordmark footer-mark"><span className="wordmark-icon"><span /></span><span>statebid</span><strong>.lol</strong></div><p>Paid advertising, visibly ranked. Placement is not endorsement. Inspired by <a href="https://outbid.lol" target="_blank" rel="noopener noreferrer">Outbid.lol</a>.</p><nav><a href="/about">About</a><a href="/rules">Rules</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav></footer>
    {claimOpen ? <ClaimDialog stateCode={selected} stateName={state.name} position={position} snapshot={snapshot} onClose={closeClaim} /> : null}
  </main>;
}

function roundCoordinate(value: number) { return Math.round(value * 100) / 100; }

function EmptyPanel({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-panel"><span>01</span><strong>{title}</strong><p>{copy}</p></div>;
}

function ClaimDialog({ stateCode, stateName, position, snapshot, onClose }: { stateCode: StateCode; stateName: string; position?: StatePosition; snapshot: BoardSnapshot; onClose: () => void }) {
  const [destination, setDestination] = useState('');
  const [targetDollars, setTargetDollars] = useState(() => String(BigInt(position?.takeoverCents ?? '100') / 100n));
  const [preview, setPreview] = useState<ListingPreview | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [stateBorderColor, setStateBorderColor] = useState(DEFAULT_STATE_BORDER);
  const firstInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    firstInput.current?.focus();
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter((item) => item.offsetParent !== null);
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, []);
  function resetChallenge() { setTurnstileToken(undefined); setTurnstileReset((value) => value + 1); }

  async function previewListing() {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/listing-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ destination, turnstileToken }) });
      const payload = await response.json() as ListingPreview & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not preview that listing.');
      setPreview(payload); setQuote(null); resetChallenge();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not preview that listing.'); }
    finally { setBusy(false); }
  }

  async function uploadLogo(file: File) {
    if (!preview?.previewId) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.set('destination', destination); form.set('previewId', preview.previewId); form.set('file', file); if (turnstileToken) form.set('turnstileToken', turnstileToken);
      const response = await fetch('/api/logo-upload', { method: 'POST', body: form });
      const payload = await response.json() as { logoUrl?: string; error?: string };
      if (!response.ok || !payload.logoUrl) throw new Error(payload.error ?? 'Could not upload that logo.');
      setPreview({ ...preview, listing: { ...preview.listing, logoUrl: payload.logoUrl } }); resetChallenge();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload that logo.'); }
    finally { setBusy(false); }
  }

  async function createCheckout() {
    if (!preview || !terms) return;
    if (!/^\d+$/.test(targetDollars)) { setError('Enter a whole-dollar target.'); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stateCode, destination, previewId: preview.previewId, targetTotalCents: (BigInt(targetDollars) * 100n).toString(), stateBorderColor, termsAccepted: true, turnstileToken }) });
      const payload = await response.json() as CheckoutQuote & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not create Checkout.');
      setQuote(payload); resetChallenge();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create Checkout.'); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section ref={dialog} className="claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title" aria-describedby="claim-note" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button><span className="modal-state">{stateName} · {position ? `${formatMoney(position.totalCents)} current leader` : 'Available now'}</span><h2 id="claim-title">Put your brand<br />on {stateName}.</h2>
    {!quote ? <><label>Website or X handle<input ref={firstInput} type="text" value={destination} onChange={(event) => { setDestination(event.target.value); setPreview(null); }} placeholder="yourbrand.com or @handle" autoComplete="url" /></label><label>Your new standing total<div className="money-input"><span>$</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={targetDollars} onChange={(event) => setTargetDollars(event.target.value.replace(/\D/g, ''))} /></div></label><div className="quote-row"><span>Current public minimum</span><strong>{formatMoney(position?.takeoverCents ?? '100')}</strong></div>
      {preview ? <div className="listing-preview-card"><Logo listing={preview.listing} /><div><span>{preview.existing ? 'Locked listing' : 'First-time identity'}</span><strong>{preview.listing.title}</strong><small>{preview.listing.canonicalUrl}</small></div><Check size={18} />{!preview.existing ? <label className="upload-button"><Upload size={14} /> Replace with PNG, JPEG, or WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadLogo(file); }} /></label> : null}</div> : null}
      {preview ? <label className="terms-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>I accept the <a href="/terms" target="_blank">Terms</a> and understand this payment is a permanent standing bid, not a traffic guarantee.</span></label> : null}
      {preview ? <div className="state-color-control"><div><strong>State color</strong><small>Choose the border. The fill uses a lighter tone automatically.</small></div><label className="color-picker-label"><input type="color" value={stateBorderColor} onChange={(event) => setStateBorderColor(event.target.value)} aria-label="State border color" /><span style={{ borderColor: stateBorderColor, background: lighterColor(stateBorderColor) }} /></label></div> : null}
      {snapshot.turnstileSiteKey ? <TurnstileWidget key={turnstileReset} siteKey={snapshot.turnstileSiteKey} onToken={setTurnstileToken} /> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
      {!preview ? <button className="claim-button large" type="button" disabled={busy || !destination || Boolean(snapshot.turnstileSiteKey && !turnstileToken)} onClick={previewListing}>{busy ? <LoaderCircle className="spin" size={17} /> : null} Preview your listing <ArrowUpRight size={17} /></button> : <button className="claim-button large" type="button" disabled={busy || !terms || !snapshot.checkoutEnabled || Boolean(snapshot.turnstileSiteKey && !turnstileToken)} onClick={createCheckout}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} {snapshot.checkoutEnabled ? 'Get secure Checkout quote' : 'Checkout setup required'}</button>}
    </> : <div className="checkout-quote-card"><span className="quote-ready"><Check size={15} /> Server-verified quote</span><div><span>New standing total</span><strong>{formatMoney(quote.targetTotalCents)}</strong></div><div><span>Existing standing credit</span><strong>− {formatMoney(quote.existingTotalCents)}</strong></div><div className="quote-charge"><span>Charged now</span><strong>{formatMoney(quote.chargeCents)}</strong></div><button className="claim-button large" type="button" onClick={() => window.location.assign(quote.checkoutUrl)}>Continue to Stripe <ArrowUpRight size={17} /></button><button className="text-button" type="button" onClick={() => setQuote(null)}>Change bid</button></div>}
    <p className="modal-note" id="claim-note">Only a signed, paid Stripe webhook changes the map. If the state moves during Checkout, your full payment still credits this listing.</p>
  </section></div>;
}

declare global { interface Window { turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; theme: 'auto' }) => string; remove: (id: string) => void } } }

function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string | undefined) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId: string | null = null; let cancelled = false;
    const render = () => { if (!cancelled && container.current && window.turnstile && !widgetId) widgetId = window.turnstile.render(container.current, { sitekey: siteKey, callback: (token) => onToken(token), 'expired-callback': () => onToken(undefined), theme: 'auto' }); };
    let script = document.getElementById('statebid-turnstile') as HTMLScriptElement | null;
    if (!script) { script = document.createElement('script'); script.id = 'statebid-turnstile'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; document.head.appendChild(script); }
    script.addEventListener('load', render); render(); const timer = window.setInterval(render, 200);
    return () => { cancelled = true; window.clearInterval(timer); script?.removeEventListener('load', render); if (widgetId) window.turnstile?.remove(widgetId); };
  }, [siteKey, onToken]);
  return <div className="turnstile-slot" ref={container} aria-label="Security check" />;
}
