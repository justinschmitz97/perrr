import type { Transition } from "motion/react";

/**
 * Centralized spring configs for motion animations.
 * Use these instead of defining spring params inline per component.
 *
 * Tiers map to interaction weight:
 *   micro   — checkmarks, badge dismiss, select items
 *   fast    — tabs, switch, radio indicator
 *   normal  — popovers, tooltips, color transitions
 *   panel   — accordion content, expandables
 *   surface — sheet, modal, lightbox
 */
export const spring = {
  micro: {
    type: "spring",
    bounce: 0,
    visualDuration: 0.12,
  },
  fast: {
    type: "spring",
    bounce: 0.14,
    visualDuration: 0.18,
  },
  normal: {
    type: "spring",
    bounce: 0.18,
    visualDuration: 0.25,
  },
  panel: {
    type: "spring",
    bounce: 0.2,
    visualDuration: 0.3,
  },
  surface: {
    type: "spring",
    bounce: 0.2,
    visualDuration: 0.4,
  },
} as const satisfies Record<string, Transition>;

/**
 * Asymmetric enter/exit tween transitions.
 *
 * Arrivals (enter) are slower and decelerate — the element eases into place.
 * Departures (exit) are faster and accelerate — the element leaves quickly
 * so it never blocks the next interaction.
 */
export const tween = {
  enter: {
    type: "tween",
    duration: 0.22,
    ease: [0.0, 0.0, 0.2, 1],
  },
  exit: {
    type: "tween",
    duration: 0.15,
    ease: [0.4, 0.0, 1, 1],
  },
} as const satisfies Record<string, Transition>;
