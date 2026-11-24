/**
 * Formatting for tool output. This is the only place that decides what a missing
 * value looks like: null, undefined, NaN and Infinity all print as "n/a".
 * A missing value is never a zero.
 */
export const NA = "n/a";

/**
 * A response the API is allowed to leave holes in. `apiGet` returns this, so the
 * compiler rejects any field read or arithmetic that does not handle a missing value.
 */
export type Maybe<T> = T extends Array<infer U>
  ? Array<Maybe<U>> | null | undefined
  : T extends object
    ? { [K in keyof T]?: Maybe<T[K]> } | null | undefined
    : T | null | undefined;

/** The value if it is a real number, otherwise null. */
export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The number if it is above zero, otherwise null. For fields where 0 means "not known". */
export function positive(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

/** The text if there is any, otherwise null. */
export function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

/** The text if there is any, otherwise "n/a". */
export function text(v: unknown): string {
  return str(v) ?? NA;
}

/** First non-empty text, otherwise the fallback. */
export function firstOf(values: readonly unknown[], fallback: string): string {
  for (const v of values) {
    const s = str(v);
    if (s !== null) return s;
  }
  return fallback;
}

/** The non-empty rows of a list that may itself be missing. */
export function rows<T>(v: ReadonlyArray<T> | null | undefined): NonNullable<T>[] {
  return Array.isArray(v) ? (v.filter((x) => x !== null && x !== undefined) as NonNullable<T>[]) : [];
}

/** How many rows a list has, or null when there is no list. */
export function countOf(v: unknown): number | null {
  return Array.isArray(v) ? v.length : null;
}

/** One "n/a" line in place of a list that is missing; nothing when there is one (even empty). */
export function missingList(v: unknown): string[] {
  return Array.isArray(v) ? [] : [`${NA} — not available from the API right now.`];
}

/** Sum, or null if any term is missing: never a partial total. */
export function sumAll(...values: unknown[]): number | null {
  let total = 0;
  for (const v of values) {
    const n = num(v);
    if (n === null) return null;
    total += n;
  }
  return total;
}

/** part ÷ whole as a percentage, or null if either is missing or there is no whole. */
export function sharePct(part: unknown, whole: unknown): number | null {
  const p = num(part);
  const w = positive(whole);
  return p === null || w === null ? null : (p / w) * 100;
}

/** Percentage change from `prev` to `now`, or null without both or without a base. */
export function changePct(now: unknown, prev: unknown): number | null {
  const a = num(now);
  const b = num(prev);
  return a === null || b === null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100;
}

/** " (+3.2% vs prev period)", or "" when there is nothing to compare. */
export function changeNote(pct: unknown, versus: string): string {
  const n = num(pct);
  return n === null ? "" : ` (${fmtPct(n)} ${versus})`;
}

/** Format USD amounts: $1.2M, $45.3K, $0.42, -$15.7K */
export function fmtUsd(v: unknown): string {
  const n = num(v);
  if (n === null) return NA;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a === 0) return "$0";
  if (a >= 1_000_000_000) return `${sign}$${(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}K`;
  if (a >= 1) return `${sign}$${a.toFixed(2)}`;
  return `${sign}$${a.toFixed(4)}`;
}

/** Format token amounts: 45.3K, 1.2M, 500 */
export function fmtToken(v: unknown, symbol?: string | null): string {
  const n = num(v);
  if (n === null) return NA;
  const s = symbol ? ` ${symbol}` : "";
  if (n === 0) return `0${s}`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M${s}`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K${s}`;
  if (Math.abs(n) >= 1) return `${Math.round(n * 100) / 100}${s}`;
  return `${n.toFixed(4)}${s}`;
}

/** Format a signed percentage change: +3.2%, -1.5% */
export function fmtPct(v: unknown): string {
  const n = num(v);
  if (n === null) return NA;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/** Format a change in percentage points: +0.98 pp */
export function fmtPp(v: unknown): string {
  const n = num(v);
  if (n === null) return NA;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)} pp`;
}

/** Format a share already in percent, without a sign: 13.8% */
export function fmtShare(v: unknown, digits = 1): string {
  const n = num(v);
  return n === null ? NA : `${Number(n.toFixed(digits))}%`;
}

/** Format a ratio as percentage: 0.702 → 70.2% */
export function fmtRatio(v: unknown): string {
  const n = num(v);
  return n === null ? NA : `${(n * 100).toFixed(1)}%`;
}

/** Format a count: 41,623 */
export function fmtCount(v: unknown): string {
  const n = num(v);
  return n === null ? NA : n.toLocaleString("en-US");
}

/** Format with a fixed number of decimals: fmtFixed(6.04, 1, "x") → 6.0x */
export function fmtFixed(v: unknown, digits: number, suffix = ""): string {
  const n = num(v);
  return n === null ? NA : `${n.toFixed(digits)}${suffix}`;
}

/** Format a price in dollars with two decimals: $24.74 */
export function fmtPrice(v: unknown): string {
  const n = num(v);
  return n === null ? NA : `$${n.toFixed(2)}`;
}

/** Milliseconds of an ISO date or of a timestamp, or null. */
function toMs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) <= 8.64e15 ? v : null;
  if (typeof v !== "string" || v === "") return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Format an ISO date or a timestamp in ms: 2026-04-03 */
export function fmtDate(v: unknown): string {
  const ms = toMs(v);
  return ms === null ? NA : new Date(ms).toISOString().slice(0, 10);
}

/** Format relative time: "2h ago", "3d ago" */
export function fmtAgo(v: unknown): string {
  const at = toMs(v);
  if (at === null) return NA;
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
