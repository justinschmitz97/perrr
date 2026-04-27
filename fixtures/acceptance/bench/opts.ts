/**
 * Shared benchmark timing options.
 *
 *   BENCH_SMOKE=1 — ultra-fast: 250ms window, 3 warmup. Sub-second per bench.
 *                   Use while developing. Numbers are noisy — do NOT ship based
 *                   on these alone.
 *   BENCH_QUICK=1 — fast triage: 500ms window, 5 warmup. Used in CI for
 *                   regression detection without holding up the pipeline.
 *   (default)     — full precision: 2s+ window, 30+ warmup. Use for the
 *                   final "is this optimisation worth it" numbers.
 *
 * BENCH_SMOKE implies BENCH_QUICK (both flags together keep quick behavior).
 *
 * See package.json scripts: bench, bench:quick, bench:smoke, bench:fps, bench:fps:quick.
 */

export const SMOKE = process.env["BENCH_SMOKE"] === "1";
export const QUICK = SMOKE || process.env["BENCH_QUICK"] === "1";

/** Standard timing: 2s measurement, 30 warmup iterations. */
export const stableOpts = SMOKE
  ? ({ time: 250, warmupIterations: 3 } as const)
  : QUICK
    ? ({ time: 500, warmupIterations: 5 } as const)
    : ({ time: 2000, warmupIterations: 30 } as const);

/** Heavy timing for stress/scaling/memory tests: 5s, 50 warmup. */
export const heavyOpts = SMOKE
  ? ({ time: 400, warmupIterations: 3 } as const)
  : QUICK
    ? ({ time: 800, warmupIterations: 5 } as const)
    : ({ time: 5000, warmupIterations: 50 } as const);

/** Light timing for cheap operations: 1s, 20 warmup. */
export const lightOpts = SMOKE
  ? ({ time: 150, warmupIterations: 2 } as const)
  : QUICK
    ? ({ time: 250, warmupIterations: 3 } as const)
    : ({ time: 1000, warmupIterations: 20 } as const);

/**
 * Elevated warmup variant of stableOpts (100 warmup iterations).
 * Used by popover, tooltip — components with deep Radix + Portal + Motion
 * stacks that need more warmup to reach V8 optimized tier.
 */
export const stableOptsHighWarmup = QUICK
  ? stableOpts
  : ({ time: 2000, warmupIterations: 100 } as const);

/**
 * Elevated warmup variant of heavyOpts (100 warmup iterations).
 * Used by popover, tooltip for scaling/stress tests.
 */
export const heavyOptsHighWarmup = QUICK
  ? heavyOpts
  : ({ time: 5000, warmupIterations: 100 } as const);

/** Cold-start: measures first-render cost (zero warmup). */
export const coldStartOpts = QUICK
  ? ({ time: 250, warmupIterations: 0 } as const)
  : ({ time: 1000, warmupIterations: 0 } as const);
