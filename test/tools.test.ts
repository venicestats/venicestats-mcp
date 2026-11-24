import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, TOOL_COUNT } from "../src/server.js";
import { CONFIG } from "../src/config.js";
import pkg from "../package.json" with { type: "json" };
import lock from "../package-lock.json" with { type: "json" };
import { CALLS, current, longMarkets, next, type Fixtures, type Json } from "./fixtures.js";

let client: Client;
const realFetch = globalThis.fetch;

/** Response bodies by path, and the last URL asked for. */
let bodies: Fixtures = current;
let lastUrl = new URL("https://example.com");

before(async () => {
  globalThis.fetch = (async (input: string) => {
    lastUrl = new URL(input);
    const path = lastUrl.hostname === "api.venice.ai"
      ? "venice-models"
      : lastUrl.pathname === "/api/insider-flow"
        ? `${lastUrl.pathname}?mode=${lastUrl.searchParams.get("mode")}`
        : lastUrl.pathname;
    if (!(path in bodies)) return { ok: false, status: 404, text: async () => "no fixture" };
    // The object itself, not JSON text: JSON has no NaN.
    return { ok: true, status: 200, json: async () => structuredClone(bodies[path]), text: async () => "" };
  }) as unknown as typeof fetch;

  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1" });
  await createServer().connect(a);
  await client.connect(b);
});

after(async () => {
  globalThis.fetch = realFetch;
  await client.close();
});

async function call(tool: string, args: Record<string, unknown>, fixtures: Fixtures): Promise<{ text: string; isError: boolean }> {
  bodies = fixtures;
  const r = (await client.callTool({ name: tool, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: r.content.map((c) => c.text).join("\n"), isError: r.isError === true };
}

// The last two: a missing date read as 1970, and "n/a" quoted as if it were a string value.
const GARBAGE = /\b(null|undefined|NaN|Infinity|Invalid Date)\b|\[object |\$-|\$n\/a|\d{5,}d ago|: "n\/a"/;
/** A zero on its own: 0, $0, 0.00%, 0K. Not 0x…, not a digit inside a number or a date. */
const ZERO = /(?<![\w.,:+-])[-+]?\$?0(?:\.0+)?(?:[KMBx×%d]|(?=\W|$))(?![\w.])/;

function assertClean(text: string, what: string): void {
  const bad = text.split("\n").find((l) => GARBAGE.test(l));
  assert.equal(bad, undefined, `${what}: garbage in "${bad}"`);
}

function assertNoZero(text: string, what: string): void {
  const bad = text.split("\n").find((l) => ZERO.test(l));
  assert.equal(bad, undefined, `${what}: invented zero in "${bad}"`);
}

const label = (c: { tool: string; args: object }): string => `${c.tool} ${JSON.stringify(c.args)}`;
const body = (fixtures: Fixtures, path: string, value: unknown): Fixtures => ({ ...fixtures, [path]: value as Fixtures[string] });

/** Every path inside a value, containers included. */
function paths(v: Json, at: (string | number)[] = []): (string | number)[][] {
  if (v === null || typeof v !== "object") return at.length > 0 ? [at] : [];
  const inner = Array.isArray(v) ? v.flatMap((x, i) => paths(x, [...at, i])) : Object.entries(v).flatMap(([k, x]) => paths(x, [...at, k]));
  return at.length > 0 ? [at, ...inner] : inner;
}

const DELETE = Symbol("delete");

function withValue(root: Json, path: (string | number)[], value: unknown): unknown {
  const copy = structuredClone(root) as Record<string | number, unknown>;
  let o = copy;
  for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (value === DELETE) delete o[last];
  else o[last] = value;
  return copy;
}

/** The same shape with every leaf replaced. */
function mapLeaves(v: Json, value: unknown): unknown {
  if (Array.isArray(v)) return (value === DELETE ? v.filter((x) => x !== null && typeof x === "object") : v).map((x) => mapLeaves(x, value));
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v);
    return value === DELETE
      ? Object.fromEntries(entries.filter(([, x]) => x !== null && typeof x === "object").map(([k, x]) => [k, mapLeaves(x, value)]))
      : Object.fromEntries(entries.map(([k, x]) => [k, mapLeaves(x, value)]));
  }
  return value;
}

test("the calls cover every registered tool", async () => {
  const { tools } = await client.listTools();
  assert.equal(tools.length, TOOL_COUNT);
  assert.deepEqual([...new Set(CALLS.map((c) => c.tool))].sort(), tools.map((t) => t.name).sort());
});

test("one version everywhere", () => {
  assert.equal(CONFIG.version, pkg.version);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
});

for (const [name, fixtures] of [["current", current], ["next", next]] as const) {
  test(`${name} API: every tool answers`, async () => {
    for (const c of CALLS) {
      const r = await call(c.tool, c.args, fixtures);
      assert.equal(r.isError, false, `${label(c)}: ${r.text}`);
      assertClean(r.text, label(c));
      assertNoZero(r.text, label(c));
      assert.doesNotMatch(r.text, /No data:|Partial data:/, label(c));
    }
  });

  test(`${name} API: every tool with every field null, NaN or absent`, async () => {
    for (const c of CALLS) {
      const shape = fixtures[c.path];
      const variants: [string, unknown][] = [
        ["leaves null", mapLeaves(shape, null)],
        ["leaves NaN", mapLeaves(shape, NaN)],
        ["leaves Infinity", mapLeaves(shape, Infinity)],
        ["leaves absent", mapLeaves(shape, DELETE)],
        ["top level null", Object.fromEntries(Object.keys(shape).map((k) => [k, null]))],
        ["empty object", {}],
      ];
      for (const [what, value] of variants) {
        const r = await call(c.tool, c.args, body(fixtures, c.path, value));
        const at = `${label(c)} ${what}`;
        if (c.path === "venice-models" && !Array.isArray((value as { data?: unknown }).data)) {
          assert.match(r.text, /no model list/, at);
          continue;
        }
        assert.equal(r.isError, false, `${at}: ${r.text}`);
        assertClean(r.text, at);
        assertNoZero(r.text, at);
      }
    }
  });

  test(`${name} API: one field missing at a time`, async () => {
    let checks = 0;
    for (const c of CALLS) {
      const shape = fixtures[c.path];
      for (const path of paths(shape)) {
        for (const value of [null, DELETE, NaN]) {
          const r = await call(c.tool, c.args, body(fixtures, c.path, withValue(shape, path, value)));
          const at = `${label(c)} ${path.join(".")}=${String(value)}`;
          checks++;
          if (c.path === "venice-models" && path.join(".") === "data") continue;
          assert.equal(r.isError, false, `${at}: ${r.text}`);
          assertClean(r.text, at);
          assertNoZero(r.text, at);
        }
      }
    }
    assert.ok(checks > 1500, `only ${checks} checks`);
  });
}

test("a response with no data says so at the top", async () => {
  for (const tool of ["venicestats_price", "venicestats_staking", "venicestats_vesting", "venicestats_protocol_overview", "venicestats_free_float", "venicestats_social"]) {
    const c = CALLS.find((x) => x.tool === tool)!;
    const r = await call(tool, c.args, body(current, c.path, {}));
    assert.match(r.text, /⚠️ No data:/, tool);
  }
});

test("a failed endpoint is an error, not an empty answer", async () => {
  const r = await call("venicestats_social", {}, {});
  assert.equal(r.isError, true);
  assert.doesNotMatch(r.text, /coming soon/);
});

test("market_volume: traders above 30 days", async () => {
  for (const period of ["90d", "1y", "all"]) {
    const r = await call("venicestats_market_volume", { period }, body(current, "/api/markets", longMarkets));
    assert.equal(r.isError, false);
    assert.match(r.text, /Traders: n\/a \(unique wallets are only counted up to 30 days\) \| Swaps: 21,299/);
    assert.match(r.text, /Volume: \$1\.02B \(\+50\.85% vs prev period\)/);
  }
  // An older API sends a number that is not a count of wallets: not shown either.
  const old = await call("venicestats_market_volume", { period: "90d" }, current);
  assert.match(old.text, /Traders: n\/a \(unique wallets/);
  const short = await call("venicestats_market_volume", { period: "24h" }, body(current, "/api/markets", longMarkets));
  assert.match(short.text, /Traders: n\/a \| Swaps/);
  const both = await call("venicestats_market_volume", { period: "30d" }, current);
  assert.match(both.text, /Traders: 4,180 \(\+54\.99% vs prev period\)/);
});

test("market_volume: a change needs both values", async () => {
  const kpis = current["/api/markets"].kpis as Record<string, Json>;
  for (const patch of [{ volumePrev: null }, { volumePrev: 0 }]) {
    const r = await call("venicestats_market_volume", { period: "30d" }, body(current, "/api/markets", { ...current["/api/markets"], kpis: { ...kpis, ...patch } }));
    assert.match(r.text, /Volume: \$1\.02B\n/);
  }
});

test("insider_flow: dollars are dollars, claimed is VVV", async () => {
  const r = await call("venicestats_insider_flow", {}, current);
  assert.match(r.text, /Net Flow: -\$15\.7K net selling/);
  assert.match(r.text, /Sell Volume: \$15\.7K \| Buy Volume: \$4\.1K/);
  assert.match(r.text, /Total Claimed: 7\.00M VVV/);
  assert.match(r.text, /\+72% sell volume vs prev 30d/);
  assert.doesNotMatch(r.text, /sell ratio/);
  const rec = await call("venicestats_insider_flow", { mode: "recipients" }, current);
  assert.match(rec.text, /Sold: \$116\.5K \| Bought: \$391\.9K \| Retention: 85%/);
  const recNext = await call("venicestats_insider_flow", { mode: "recipients" }, next);
  assert.match(recNext.text, /Sold: 9\.5K VVV \(\$116\.5K\)/);
  assert.match(recNext.text, /Retention: n\/a/);
});

test("insider_flow: no base is not a 0% change", async () => {
  const kpis = current["/api/insider-flow?mode=overview"].kpis as Record<string, Json>;
  const r = await call("venicestats_insider_flow", {}, body(current, "/api/insider-flow?mode=overview", { kpis: { ...kpis, prevNetFlow30d: 0, sellTrendPct: 0, sellPressure: "stable" } }));
  assert.match(r.text, /\(change vs prev 30d n\/a\)/);
  assert.match(r.text, /Net Flow: -\$15\.7K net selling\n/);
});

test("insider_flow: no known balance is not zero held", async () => {
  const path = "/api/insider-flow?mode=overview";
  const kpis = { ...(next[path].kpis as object), retentionRate: null, totalHeld: 0, retentionClaimed: 0, walletsWithoutBalance: 25 };
  const r = await call("venicestats_insider_flow", {}, body(next, path, { kpis }));
  assert.match(r.text, /Currently Held: n\/a\nRetention Rate: n\/a\nWallets without a balance read[^\n]*: 25/);
});

test("simulate_revenue: churn 15 by default, and revenue today first", async () => {
  for (const f of [current, next]) {
    const r = await call("venicestats_simulate_revenue", {}, f);
    assert.equal(lastUrl.searchParams.get("churn"), "15");
    assert.match(r.text, /Revenue today[^\n]*\nTotal: \$204\.76M\/year annualized, as of 2026-10-04/);
    assert.match(r.text, /P\/S: 6\.0×/);
    assert.match(r.text, /The three channels together: \$12\.92M/);
    assert.match(r.text, /NOT today's revenue/);
    assert.ok(r.text.indexOf("$204.76M") < r.text.indexOf("$149.15M"));
    assert.doesNotMatch(r.text, /\$266\.11M/);
  }
});

test("simulate_revenue: unknown credits never enter a total", async () => {
  const sim = next["/api/simulate-revenue"] as { [k: string]: Json };
  const cur = current["/api/simulate-revenue"] as { [k: string]: Json };
  const zeroed = { perDayUsd: 0, buybackPerDay: 0, horizonTotal: 0 };
  const cases: { [k: string]: Json }[] = [
    { ...sim, credits: { ...zeroed, source: "none", known: false, annualBuyback: null } },
    { ...sim, currentBase: { ...(sim.currentBase as object), complete: false } as Json },
    // The older API has no flag: the source says it, and its totals already count a zero.
    { ...cur, credits: { ...zeroed, source: "none" } },
    { ...cur, credits: undefined },
  ];
  for (const c of cases) {
    const patched = { ...c, burnPaceAllChannelsPerYear: "burnPaceAllChannelsPerYear" in c ? null : undefined };
    const r = await call("venicestats_simulate_revenue", {}, body(next, "/api/simulate-revenue", patched));
    assert.match(r.text, /Total: n\/a\/year/);
    assert.match(r.text, /API credits: n\/a\/year \(n\/a\/day\)/);
    assert.match(r.text, /No total: the pace of credit purchases is not known/);
    assert.match(r.text, /Credits: n\/a\n/);
    assert.match(r.text, /The three channels together: n\/a/);
    assert.doesNotMatch(r.text, /P\/S|204\.76M|290\.13M|12\.92M/);
    assertNoZero(r.text, "unknown credits");
  }
});

test("simulate_revenue: no model of today is not replaced by the projection", async () => {
  const r = await call("venicestats_simulate_revenue", {}, body(current, "/api/simulate-revenue", { ...current["/api/simulate-revenue"], currentBase: null }));
  assert.match(r.text, /n\/a — the model of today's revenue is not available/);
});

test("simulate_revenue: no signup rate is not a projection of zero", async () => {
  const noRate = { ...current["/api/simulate-revenue"], dailyRate: 0, subsPerMonth: 0, activeSubs: 0, steadyState: 0, mrr: 0, arr: 0, proSubAnnualUsd: 0 };
  const r = await call("venicestats_simulate_revenue", {}, body(current, "/api/simulate-revenue", noRate));
  assertNoZero(r.text, "no signup rate");
  assert.match(r.text, /Projected MRR: n\/a · Projected ARR: n\/a/);
  assert.match(r.text, /The three channels together: n\/a/);
  assert.doesNotMatch(r.text, /In 12 months/);
  assert.match(r.text, /Total: \$204\.76M/);
});

test("simulate_revenue: the mix says where it came from", async () => {
  const r = await call("venicestats_simulate_revenue", {}, body(current, "/api/simulate-revenue", { ...current["/api/simulate-revenue"], wasvSource: "preset" }));
  assert.match(r.text, /Tier mix: preset, observed mix not available/);
});

test("protocol_overview: P/S only from the revenue model", async () => {
  const old = await call("venicestats_protocol_overview", {}, current);
  assert.doesNotMatch(old.text, /P\/S|466/);
  assert.match(old.text, /Discretionary burns only, annualized from a 12-month average: \$2\.62M/);
  assert.match(old.text, /Deflation from discretionary burns only: 0\.61%/);
  const now = await call("venicestats_protocol_overview", {}, next);
  assert.match(now.text, /P\/S Ratio: 6\.0x — Market cap ÷ modeled annualized revenue today/);
  assert.match(now.text, /every buy-and-burn channel, last 30 days\): 57\.8K VVV \(\$1\.27M\) → 703\.1K VVV \(\$15\.49M\) per year/);
  assert.match(now.text, /1\.42% of circulating supply per year/);
  assert.doesNotMatch(now.text, /466|Discretionary burns only/);
});

test("free_float: the site's numbers, not recomputed", async () => {
  const r = await call("venicestats_free_float", {}, body(current, "/api/metrics", { ...current["/api/metrics"], freeFloatVvv: 1234567, freeFloatVvvPctCirc: 12.34, freeFloatDiemPct: 56.78 }));
  assert.match(r.text, /\*\*Free Float\*\*: 1\.23M VVV/);
  assert.match(r.text, /12\.34% — circulating/);
  assert.match(r.text, /56\.78%/);
  assert.match(r.text, /7-day cooldown/);
  const missing = await call("venicestats_free_float", { token: "vvv" }, body(current, "/api/metrics", { ...current["/api/metrics"], freeFloatVvv: null }));
  assert.match(missing.text, /\*\*Free Float\*\*: n\/a \(≈ n\/a\)/);
});

test("diem: cohort label when there is one", async () => {
  const now = await call("venicestats_diem", {}, next);
  assert.match(now.text, /\*\*Peak \(600\+\)\*\*/);
  assert.match(now.text, /\*\*Late\*\* \(minting now at 468\)/);
  assert.doesNotMatch(now.text, /Current\*\*|\(Current\)/);
  const old = await call("venicestats_diem", {}, current);
  assert.match(old.text, /\*\*Current\*\*:/);
});

test("staking: points, not percent", async () => {
  const r = await call("venicestats_staking", {}, current);
  assert.match(r.text, /Staking Ratio: 64\.1% \(24h change: -0\.98 pp\)/);
});

test("burns_timeline: three channels or no combined total", async () => {
  const r = await call("venicestats_burns_timeline", {}, current);
  assert.match(r.text, /Combined \(the channels above\): 428\.2 VVV · worth \$10\.6K/);
  assert.match(r.text, /\| 2026-10-05 \| 134\.4 \| \$3\.4K \| 92\.3 \| 1,026 \| 201\.5 \| 1,016 \| \$10\.6K \|/);
  const { creditsVvv: _v, creditsUsdNow: _u, ...noCredits } = current["/api/burns-timeline"].totals as { [k: string]: Json };
  const partial = await call("venicestats_burns_timeline", {}, body(current, "/api/burns-timeline", { ...current["/api/burns-timeline"], totals: noCredits }));
  assert.match(partial.text, /Combined \(the channels above\): n\/a · worth n\/a/);
});

test("burns_timeline and discretionary_burn: no price is not a $0 value", async () => {
  const t = current["/api/burns-timeline"];
  const zeroed = { ...(t.totals as object), discUsdNow: 0, proSubUsdNow: 0, creditsUsdNow: 0 };
  const r = await call("venicestats_burns_timeline", {}, body(current, "/api/burns-timeline", { ...t, totals: zeroed, meta: { vvvPriceNow: 0 } }));
  assertNoZero(r.text, "no price");
  const d = current["/api/discretionary-burn"];
  const lifetime = { ...(d.lifetime as object), valueAtCurrentPrice: 0, multiplier: 0 };
  const r2 = await call("venicestats_discretionary_burn", {}, body(current, "/api/discretionary-burn", { ...d, lifetime, meta: { vvvPriceUsd: 0 } }));
  assertNoZero(r2.text, "no price");
});

test("burn_stats_by_tier: a window without data is not a window of zeros", async () => {
  const r = await call("venicestats_burn_stats_by_tier", {}, next);
  assert.match(r.text, /Last 90 days\nn\/a/);
  assert.match(r.text, /Incomplete window: 29 of 30 days/);
  assert.match(r.text, /Pro \(\$18\/mo\) → \$2/);
});

test("live: an unknown change is not 0%", async () => {
  const live = current["/api/live"];
  const prices = { ...(live.prices as object), vvvChange24h: 0, vvvChange24hKnown: false };
  const r = await call("venicestats_live", {}, body(current, "/api/live", { ...live, prices }));
  assert.match(r.text, /VVV: \$24\.74 \(n\/a\)/);
});

test("trades with no side are not shown as sells", async () => {
  const d = current["/api/markets/large-swaps"];
  const swap = { ...((d.swaps as Json[])[0] as object), direction: null };
  const r = await call("venicestats_large_trades", {}, body(current, "/api/markets/large-swaps", { ...d, swaps: [swap] }));
  assert.doesNotMatch(r.text, /SELL|BUY/);
});

test("trends: gaps are skipped, not read as zero", async () => {
  const s = [{ t: 1790000000000, v: 10 }, { t: 1790086400000, v: null }, { t: 1790172800000, v: 12 }];
  const r = await call("venicestats_trends", { metric: "vvvPrice" }, body(current, "/api/charts", { vvvPrice: s }));
  assert.match(r.text, /2 data points, 1 without a value left out/);
  assert.match(r.text, /\| Change \| \+20\.00% \|/);
});

test("descriptions carry no stale or hand-written figures", async () => {
  const { tools } = await client.listTools();
  const all = tools.map((t) => `${t.description} ${JSON.stringify(t.inputSchema)}`).join("\n");
  assert.doesNotMatch(all, /both burn channels|one of two|\$1-per|90d cooldown|90-day cooldown|~95%|\b63 AI|burn revenue|Aerodrome/i);
});
