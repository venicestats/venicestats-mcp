/**
 * Synthetic API responses: one per endpoint, as the API answers today (`current`) and with
 * the fields that may be added or become null (`next`). No value is 0, so a 0 in the
 * output of a test can only be an invented one.
 */
export type Json = null | boolean | number | string | undefined | Json[] | { [k: string]: Json };
export type Fixtures = Record<string, { [k: string]: Json }>;

const WALLET = "0x1111111111111111111111111111111111111111";
const T = Date.UTC(2026, 9, 5);
const DAY = 86_400_000;
const ISO = "2026-10-05T12:00:00.000Z";

const series = (a: number, b: number): Json => [{ t: T, v: a }, { t: T + DAY, v: b }];

const channels = {
  discUsdThen: 3400.5, discUsdNow: 3300.5, discVvv: 134.4,
  proSubUsdThen: 2342, proSubUsdNow: 2283.9, proSubVvv: 92.3, proSubCount: 1026,
  creditsUsdThen: 5080, creditsUsdNow: 4985.9, creditsVvv: 201.5, creditsCount: 1016,
};

const tierWindow = (days: number) => ({
  windowDays: days, pro: 1871, proPlus: 137, max: 21, total: 2029, proPct: 92.2, proPlusPct: 6.8, maxPct: 1.04,
  buybackUsd: 4638, dailyBuybackUsd: 662.6, blendedUsdPerSignup: 2.28, dailySignupRate: 289.9, monthlySignups: 8826.7,
  observedMrr: 205225, observedArr: 2462707,
});

const baseView = {
  activeSubs: 268123, mrr: 6196773, subsAnnual: 74361284, creditsPerDay: 320200, creditsAnnual: 116873000,
  offChainAnnual: 13530000, totalAnnual: 204764284, psRatio: 5.97,
};

const metrics = {
  vvvPrice: 24.74, priceChange24h: -1.31, marketCap: 1222758542, fdv: 2011035131, totalSupply: 115263476,
  circulatingSupply: 49426103, burnedSupply: 33973812, totalStaked: 32580562, stakingRatio: 0.641373,
  stakingRatioChange24h: -0.982, svvvSupply: 32580562, svvvLocked: 8593707, svvvUnlocked: 23986854, lockRatio: 0.263768,
  emissionPerYear: 2001369, diemPrice: 1911.9, diemPriceChange24h: -1.87, diemSupply: 37393.9, diemStaked: 29951.7,
  diemStakeRatio: 0.800978, freeFloatVvv: 16845541, freeFloatVvvPctCirc: 34.08, freeFloatVvvPctTotal: 14.61,
  freeFloatDiem: 7442.2, freeFloatDiemPct: 19.9, diemMarketCap: 71493740, diemFdv: 76476294,
  totalBurnedFromEvents: 33973808, organicBurned: 303691, burnUsdValueAnnualized: 2623644, burnUsdValueSampleMonths: 12,
  burnRevenueAnnualized: 2623644, mintRate: 467.7, mintCostUsd: 11569.7, mintParity: 0.165, diemBreakEvenDays: 1912,
  remainingMintable: 2606.1, veniceRevenue: 2611942, impliedConfidence: 5.24, netFlow7d: -662292, newStakers7dCount: 104,
  activeWallets7dCount: 3768, stakingGrowth7d: -1.99, stakingGrowth30d: -2.7, cooldownVvv: 828787, cooldownWallets: 206,
  stakerApr: 5.82, ecosystemTvl: 877508332, peRatio: 466.05, burnDeflationRate: 0.614, vestingTotalLocked: 1131826,
  vestingDailyDrip: 13495, vestingActiveStreams: 21, priceStale: true, priceLastUpdated: ISO,
};

const simulation = {
  inputs: { dist: { pro: 92.33, plus: 6.7, max: 0.97 }, burnModel: "all-billing", churn: 15, horizonMonths: 12, includeDiscretionary: true },
  wasv: 23.11, dailyRate: 3089.6, subsPerMonth: 94046, activeSubs: 537794, steadyState: 626977, mrr: 12429328, arr: 149151941,
  pe: 8.2, proSubAnnualUsd: 2533895, discretionaryAnnualRunRate: 4541176, totalBurnPacePerYear: 7075071,
  narrative: "Steady-state ARR", warnings: ["tierMix normalized"], wasvSource: "observed",
  credits: { perDayUsd: 320200, source: "observed", buybackPerDay: 16010, horizonTotal: 116962656 },
  currentBase: { asOf: "2026-10-04", wasv: 23.11, today: baseView, in12Months: { ...baseView, totalAnnual: 290132220, psRatio: 4.21 } },
  combined: { totalAnnualRevenue: 266114597, psWithCredits: 4.59, annualBuybackWithCredits: 12918721 },
};

const insiderKpis = {
  netFlow30d: -15656, prevNetFlow30d: -9120, sellVolume30d: 15656, buyVolume30d: 4100, sellPressure: "rising", sellTrendPct: 72,
  retentionRate: 79, totalClaimed: 6997442, totalHeld: 5552120, activeTraders30d: 3, activeTraders7d: 2, totalTrades30d: 11,
};

const recipient = {
  address: WALLET, name: "example", deposited: 2250000, claimed: 1971007, sellVolume: 116544, buyVolume: 391918,
  sellCount: 9, buyCount: 37, retention: 85, behavior: "Staker",
};

const kpis = { price: 24.74, priceChange: 42.96, volume: 1020341533, volumePrev: 676393539, buyPct: 51, traders: 4180, tradersPrev: 2697, swaps: 21299, swapsPrev: 15182 };

const livePrices = {
  vvv: 24.74, diem: 1911.9, vvvChange24h: -1.02, diemChange24h: -1.58, vvvVolume24h: 12581939, diemVolume24h: 910642,
  vvvAsOf: ISO, diemAsOf: ISO, vvvStale: true, diemStale: false, vvvChange24hKnown: true, diemChange24hKnown: true,
};

const cycle = {
  startTs: "2026-10-01T15:03:02.000Z", projectedBurnTs: "2026-11-01T16:00:00.000Z", daysElapsed: 15.1, daysRemaining: 13.9,
  slicesExecuted: 778, vvvAccumulated: 8046.6, usdcSpentEstimated: 175278, twapStarts: 2,
  pace: { slicesPerHour: 2.15, vvvPerHour: 22.2, usdcPerHour: 484.4, regimeGuess: "2 active TWAPs" },
};

const projection = {
  vvvLow: 15498, vvvHigh: 21139, usdLow: 383401, usdHigh: 522950, rangeConfidence: "mid-cycle", lowBasis: "low basis",
  highBasis: "high basis", highBasisKind: "budget",
};

export const current: Fixtures = {
  "/api/metrics": metrics,
  "/api/markets": {
    kpis, token: "VVV", period: "30d",
    pools: [
      { pool: WALLET, name: "VVV/WETH", dex: "Example DEX", volume: 236317622, volumePct: 23, swaps: 262667, buyPct: 49 },
      { pool: WALLET, name: "VVV/USDC", dex: "Example DEX", volume: 11317622, volumePct: 2, swaps: 2667, buyPct: 48 },
    ],
  },
  "/api/insider-flow?mode=overview": { kpis: insiderKpis, chart: [{ t: T, buyVol: 5, sellVol: 6 }] },
  "/api/insider-flow?mode=recipients": { recipients: [recipient, { ...recipient, name: null, behavior: "Net Seller" }] },
  "/api/simulate-revenue": simulation,
  "/api/burn-stats-by-tier": {
    flipTs: "2026-04-26T16:36:00Z",
    mechanism: { pro: { monthlyPrice: 18, buyback: 2 }, proPlus: { monthlyPrice: 68, buyback: 5 }, max: { monthlyPrice: 200, buyback: 10 } },
    windows: { "7d": tierWindow(7), "30d": tierWindow(30), "90d": tierWindow(90) },
  },
  "/api/discretionary-burn": {
    currentCycle: cycle, projection,
    lifetime: { usdcSpent: 2443049, vvvBurned: 303691, valueAtCurrentPrice: 7512871, multiplier: 3.08, cyclesCount: 12 },
    safeBalance: { usdc: 347671, runwayDays: 29.9 },
    meta: { vvvPriceUsd: 24.74, avgUsdcPerCycle: 378431, avgUsdcCycleCount: 3, avgUsdAtBurnLast2: 435712, now: ISO },
  },
  "/api/burns-timeline": {
    granularity: "daily", range: "90d",
    buckets: [{ t: T, ...channels, hasOneOff: false }, { t: T + DAY, ...channels, hasOneOff: true }],
    currentBucketProjection: {
      bucketT: T + DAY,
      discProjected: { usdcSpent: 61562, usdNow: 69915, vvv: 2826.2 },
      proSubProjected: { usdcSpent: 37279, usdNow: 36380, vvv: 1470.6 },
    },
    creditsProjection: { usdcSpent: 91884, usdNow: 90282, vvv: 3649.5 },
    totals: channels,
    meta: { vvvPriceNow: 24.74, startTs: T, endTs: T + DAY },
  },
  "/api/diem-analytics": {
    cohorts: [
      { name: "Genesis", walletCount: 5, totalDiemMinted: 10332.9, avgBurnRate: 93.2, stillLockedPct: 0.98 },
      { name: "Current", walletCount: 1032, totalDiemMinted: 1654.2, avgBurnRate: 640.2, stillLockedPct: 0.71 },
    ],
    topMinters: [{ address: WALLET, ensName: null, svvvLocked: 934000, outstandingDiem: 10266.9, burnRate: 90.9, badge: "Genesis", inferencePerDay: 12 }],
    totalLockedSvvv: 8593707, veniceRevenue20Pct: 2492844, currentMintRate: 467.7,
  },
  "/api/burns": {
    burns: [
      { id: 1, txHash: "0xaa", timestamp: ISO, from: WALLET, username: null, ensName: null, amount: 0.0811, category: "programmatic", tier: "pro" },
      { id: 2, txHash: "0xab", timestamp: ISO, from: WALLET, username: "example", ensName: null, amount: 12.5, category: "organic", tier: null },
    ],
    total: 719188,
  },
  "/api/live": {
    events: [
      { id: "swap:1", source: "swap", type: "sell", address: WALLET, username: null, ensName: null, botLabel: null, amount: 9.19, txHash: "0xaa", timestamp: ISO, pool: WALLET },
      { id: "burn:1", source: "burn", type: "programmatic", address: WALLET, username: "example", ensName: null, botLabel: "Example bot", amount: 1.19, txHash: "0xab", timestamp: ISO, pool: null },
    ],
    prices: livePrices,
  },
  "/api/vesting": {
    totalLocked: 1131827, totalDeposited: 8203264, totalWithdrawn: 7071437, dailyDripRate: 13495, activeStreams: 21, totalStreams: 206,
    uniqueRecipients: 188, pctLocked: 13.8, pctClaimed: 86.2, fullyVestedBy: "2030-03-02",
    dripCliff: { date: "2027-01-01", dropPct: 94, streamCount: 12 },
  },
  "/api/treasury": {
    totalVvv: 31003371, totalSvvv: 3982304, totalDiem: 336, totalValueUsd: 866136277, walletsTracked: 12,
    categoryBreakdown: [{ category: "treasury", vvv: 20711893, svvv: 2170748, diem: 226, valueUsd: 566515800 }],
  },
  "/api/airdrop": {
    kpis: { totalDistributed: 16365753, recipients: 41623, avgClaim: 393.19, medianClaim: 12, largestClaim: { address: WALLET, amount: 51319 } },
    retention: { activeStakers: 6079, diemOnly: 226, inactive: 35318, retainedPct: 15.1, loyalists: 2845 },
    comparison: { claimerAvgSvvv: 1122, claimerAvgConviction: 1618, allAvgSvvv: 2416, allAvgConviction: 1767 },
    distribution: [{ bucket: "Micro (<=10 VVV)", count: 10687, total: 106807, pctClaims: 25.68, pctVvv: 1.65 }],
    topLoyalists: [{ address: WALLET, airdropAmount: 15808, currentSvvv: 1639658, conviction: 5080, growth: 10272, ensName: null }],
  },
  "/api/social": {
    twitterFollowers: 98000, erikFollowers: 986597, watchlistUsers: 28000, sentimentUpPct: 44.83, marketCapRank: 61, diemWatchlistUsers: 1471,
    diemSentimentUpPct: 51.5, diemMarketCapRank: 289, socialVolume: 3, socialVolumeTwitter: 2, socialVolumeReddit: 4, socialVolumeTelegram: 1,
    socialDominance: 0.043919, sentimentBalance: 0.0863,
  },
  "/api/holders": {
    holders: [{ rank: 1, address: WALLET, username: null, ensName: null, svvvBalance: 2251083, svvvLocked: 915000, diemStaked: 12.5, convictionScore: 5378 }],
    totalHolders: 24473,
  },
  "/api/buzz": {
    items: [{ type: "video", title: "Example title", url: "https://example.com/a", summary: "Example summary", authorHandle: "example", sourceName: "Example", likeCount: 12, retweetCount: 3, publishedAt: ISO }],
    total: 366,
  },
  "/api/buzz/metrics": {
    totalMentions: 74364, avgEngagement: 7.5, uniqueAuthors: 26052, totalViews: 83450756, engagementRate: 0.76,
    topAuthor: { handle: "example", buzzScore: 786064 }, topAuthors: [{ handle: "example", count: 426, buzzScore: 786064 }],
    mentionsByWeek: series(134, 140), engagementByWeek: series(454, 460), viewsByWeek: series(102819, 102900),
    breakdownByWeek: [{ t: T, likes: 403, rts: 51, replies: 41, bookmarks: 7 }],
  },
  "/api/market-data": {
    count: 2,
    tokens: [
      { symbol: "TAO", name: "Bittensor", chain: "Own L1", year: 2021, category: "ai-inference", description: "Example", keyFact: "Example fact", priceUsd: 179.68, marketCap: 2110083079, volume24h: 97009512, change24h: -8.37, change7d: -7.15, change30d: -27.8, rank: 38 },
      { symbol: "FET", name: "Example", chain: "Example", year: 2019, category: "ai-agents", description: "Example", keyFact: null, priceUsd: 1.68, marketCap: 110083079, volume24h: 7009512, change24h: 8.37, change7d: 7.15, change30d: 27.8, rank: 138 },
    ],
  },
  "/api/markets/large-swaps": {
    swaps: [{ timestamp: ISO, direction: "sell", volumeUsd: 2000000, effectivePrice: 11.59, tokenAmount: 172509.3, tokenLabel: "VVV", poolName: "Example pool", dex: "Example DEX", trader: WALLET, traderName: null, isVesting: true }],
    pagination: { page: 1, limit: 3, total: 15551, pages: 5184 },
  },
  "/api/venetians": {
    address: WALLET, username: null, ensName: "example.eth", roleLabel: "Pistor", roleEmoji: "🥖", eraLabel: "Founding Era", sizeLabel: "Leviathan", sizeEmoji: "🐉",
    badges: ["voyager", "patron"], score: 4611, rank: 158, totalVenetians: 11313, svvvBalance: 2251083, svvvLocked: 915000, svvvUnlocked: 1336083,
    pendingRewards: 1484.5, diemBalance: 3.5, diemStaked: 12.5, vvvBalance: 17.5, exposureUsd: 55725223, personalBurnRate: 141.2,
    chronicle: "Example chronicle.", nextGoals: [{ icon: "🔥", text: "Example goal", category: "role" }], radar: [{ label: "Staking", value: 91 }],
  },
  "/api/wallet-swaps": {
    swaps: [{ direction: "sell", token: "VVV", amount: 4111, effectivePrice: 31.73, volumeUsd: 126939.18, via: "Example route", timestamp: ISO }],
    costBasis: { VVV: { avgBuyPrice: 6.66, avgSellPrice: 31.86, totalBought: 18768.84, totalSold: 8111, netPosition: 10657.84, invested: 125073.23, extracted: 254899.88 } },
    insights: ["Example insight"], total: 3,
  },
  "/api/charts": {
    period: "30d",
    ...Object.fromEntries(
      ["vvvPrice", "diemPrice", "ethPrice", "stakingRatio", "totalStaked", "lockRatio", "svvvLocked", "diemSupply", "diemStaked", "diemStakeRatio", "mintRate", "cooldownWave"].map((m) => [m, series(25.25, 26.5)]),
    ),
  },
  "venice-models": {
    data: [
      {
        id: "example-text", type: "text", created: 1790000000,
        model_spec: {
          name: "Example Text", pricing: { input: { usd: 0.5 }, output: { usd: 1.5 } }, availableContextTokens: 131072, maxCompletionTokens: 16384,
          constraints: { temperature: { min: 0.1, max: 2, default: 0.7 }, sizes: ["1:1", "16:9"], promptCharacterLimit: 1500 },
          capabilities: { supportsVision: true, supportsReasoning: true }, offline: false, privacy: "private",
        },
      },
      { id: "example-image", type: "image", created: 1790100000, model_spec: { name: "Example Image", pricing: { generation: { usd: 0.04 } }, constraints: { steps: { default: 25, max: 30 } }, privacy: "private" } },
    ],
  },
};

/** The same API with the additive fields, and null where a value is not known. */
export const next: Fixtures = {
  ...current,
  "/api/metrics": {
    ...metrics,
    stakingRatio: 0.6592,
    marketCapToDiscretionaryBurn: 466.05,
    revenueModelToday: { annualUsd: 204764284, psRatio: 5.97, asOf: "2026-10-04", churnPct: 15, definition: "Market cap ÷ modeled annualized revenue today. Not reported revenue." },
    burnRunRate30d: { windowDays: 30, usd: 1272995, vvv: 57786, usdPerYear: 15488105, vvvPerYear: 703063, deflationPctPerYear: 1.42 },
  },
  "/api/insider-flow?mode=overview": {
    kpis: { ...insiderKpis, retentionRate: 78.6, sellTrendNote: "+72% sell vol vs prev 30d", retentionClaimed: 6900000, walletsWithoutBalance: 2 },
    chart: [],
  },
  "/api/insider-flow?mode=recipients": {
    recipients: [{ ...recipient, soldVvv: 9512, boughtVvv: 31044 }, { ...recipient, name: null, retention: null, soldVvv: null, boughtVvv: null, behavior: "No trade data" }],
  },
  "/api/simulate-revenue": {
    ...simulation,
    burnPaceAllChannelsPerYear: 12918721,
    credits: { ...simulation.credits, known: true, annualBuyback: 5843650 },
    currentBase: { ...simulation.currentBase, complete: true },
    combined: { ...simulation.combined, creditsKnown: true, annualBuybackAllChannels: 12918721 },
  },
  "/api/burn-stats-by-tier": {
    ...current["/api/burn-stats-by-tier"],
    windows: {
      "7d": { ...tierWindow(7), daysCovered: 7, complete: true, windowStart: ISO, windowEnd: ISO },
      "30d": { ...tierWindow(30), daysCovered: 29, complete: false, windowStart: ISO, windowEnd: ISO },
      "90d": null,
    },
  },
  "/api/discretionary-burn": {
    ...current["/api/discretionary-burn"],
    projection: { ...projection, highBasisDetail: "usdc-average" },
    safeBalance: { usdc: 347671, vvv: 8050.1, runwayDays: 29.9 },
  },
  "/api/diem-analytics": {
    ...current["/api/diem-analytics"],
    cohorts: [
      { name: "Late", label: "Late", mintingNow: true, walletCount: 1112, totalDiemMinted: 10332.9, avgBurnRate: 470.2, stillLockedPct: 0.98 },
      { name: "Current", label: "Peak (600+)", mintingNow: false, walletCount: 1032, totalDiemMinted: 1654.2, avgBurnRate: 640.2, stillLockedPct: 0.71 },
    ],
    topMinters: [{ address: WALLET, ensName: null, svvvLocked: 934000, outstandingDiem: 10266.9, burnRate: 640.9, badge: "Current", badgeLabel: "Peak (600+)", inferencePerDay: 12 }],
  },
  "/api/burns": {
    burns: [
      { id: 1, txHash: "0xaa", timestamp: ISO, from: WALLET, username: null, ensName: null, amount: 0.0811, category: "programmatic", tier: "credits", channel: "programmatic_credits" },
      { id: 2, txHash: "0xab", timestamp: ISO, from: WALLET, username: null, ensName: null, amount: 1.5, category: "organic", tier: null, channel: null },
    ],
    total: 719188,
  },
};

/** What /api/markets answers above 30 days. */
export const longMarkets = { ...current["/api/markets"], kpis: { ...kpis, traders: null, tradersPrev: null } };

/** Every tool with the calls that cover its modes. */
export const CALLS: Array<{ tool: string; args: Record<string, unknown>; path: string }> = [
  { tool: "venicestats_price", args: {}, path: "/api/metrics" },
  { tool: "venicestats_staking", args: {}, path: "/api/metrics" },
  { tool: "venicestats_market_volume", args: { period: "30d" }, path: "/api/markets" },
  { tool: "venicestats_market_volume", args: { period: "90d", token: "DIEM" }, path: "/api/markets" },
  { tool: "venicestats_wallet", args: { address: WALLET }, path: "/api/venetians" },
  { tool: "venicestats_burns", args: {}, path: "/api/burns" },
  { tool: "venicestats_protocol_overview", args: {}, path: "/api/metrics" },
  { tool: "venicestats_insider_flow", args: {}, path: "/api/insider-flow?mode=overview" },
  { tool: "venicestats_insider_flow", args: { mode: "recipients" }, path: "/api/insider-flow?mode=recipients" },
  { tool: "venicestats_large_trades", args: {}, path: "/api/markets/large-swaps" },
  { tool: "venicestats_treasury", args: {}, path: "/api/treasury" },
  { tool: "venicestats_airdrop", args: {}, path: "/api/airdrop" },
  { tool: "venicestats_diem", args: {}, path: "/api/diem-analytics" },
  { tool: "venicestats_vesting", args: {}, path: "/api/vesting" },
  { tool: "venicestats_buzz", args: {}, path: "/api/buzz" },
  { tool: "venicestats_buzz_metrics", args: {}, path: "/api/buzz/metrics" },
  { tool: "venicestats_social", args: {}, path: "/api/social" },
  { tool: "venicestats_leaderboard", args: {}, path: "/api/holders" },
  { tool: "venicestats_wallet_trades", args: { address: WALLET }, path: "/api/wallet-swaps" },
  { tool: "venicestats_live", args: {}, path: "/api/live" },
  { tool: "venicestats_trends", args: { metric: "stakingRatio" }, path: "/api/charts" },
  { tool: "venice_models", args: { type: "all" }, path: "venice-models" },
  { tool: "venice_models", args: { type: "all", sort: "context" }, path: "venice-models" },
  { tool: "venicestats_token_benchmarks", args: {}, path: "/api/market-data" },
  { tool: "venicestats_token_benchmarks", args: { sort_by: "change_7d" }, path: "/api/market-data" },
  { tool: "venicestats_discretionary_burn", args: {}, path: "/api/discretionary-burn" },
  { tool: "venicestats_simulate_revenue", args: {}, path: "/api/simulate-revenue" },
  { tool: "venicestats_simulate_revenue", args: { includeDiscretionary: false }, path: "/api/simulate-revenue" },
  { tool: "venicestats_burns_timeline", args: {}, path: "/api/burns-timeline" },
  { tool: "venicestats_burns_timeline", args: { granularity: "monthly" }, path: "/api/burns-timeline" },
  { tool: "venicestats_burn_stats_by_tier", args: {}, path: "/api/burn-stats-by-tier" },
  { tool: "venicestats_free_float", args: {}, path: "/api/metrics" },
];
