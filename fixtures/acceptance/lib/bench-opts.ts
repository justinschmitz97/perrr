/**
 * Backwards-compatible re-export.
 *
 * The canonical location is `@/bench/opts`. Bench files have been gradually
 * migrated to import from there. Any file still importing from here will
 * continue to work.
 */

export {
  coldStartOpts,
  heavyOpts,
  heavyOptsHighWarmup,
  lightOpts,
  QUICK,
  SMOKE,
  stableOpts,
  stableOptsHighWarmup,
} from "@/bench/opts";
