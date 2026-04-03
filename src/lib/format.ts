/** Format USD amounts: $1.2M, $45.3K, $0.42 */
export function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

/** Format token amounts: 45.3K, 1.2M, 500 */
export function fmtToken(n: number, symbol?: string): string {
  const s = symbol ? ` ${symbol}` : "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M${s}`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K${s}`;
  if (Math.abs(n) >= 1) return `${Math.round(n * 100) / 100}${s}`;
  return `${n.toFixed(4)}${s}`;
}

/** Format percentage: +3.2%, -1.5% */
export function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/** Format a ratio as percentage: 0.702 → 70.2% */
export function fmtRatio(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Format date: 2026-04-03 */
export function fmtDate(iso: string | null): string {
  if (!iso) return "N/A";
  return iso.slice(0, 10);
}

/** Format relative time: "2h ago", "3d ago" */
export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
