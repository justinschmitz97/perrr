/* components/ui/accordion.bench.tsx
 *
 * Run:   npx vitest bench components/ui/accordion.bench.tsx
 * Filter: npx vitest bench components/ui/accordion.bench.tsx -t "mount"
 *
 * Dimensions measured:
 *   1. Initial mount cost (cold render, isolated from unmount via teardown)
 *   2. Open/close re-render cycle (the hot path during user interaction)
 *   3. Scaling: mount cost with N items
 *   4. forceMount vs lazy content (at scale — 20 items)
 *   5. Cleanup cost (unmount tears down motion spring schedulers)
 *   6. Rapid open/close toggle (simulates fast repeated clicks)
 *   7. Controlled accordion re-render cost (external value prop)
 *   8. Context re-render isolation (propagation cost without mount/unmount noise)
 *   9. type="multiple" open/close cycles (simultaneous transitions)
 *  10. forceMount open-many at scale (all panels open with forceMount)
 *  11. Dynamic item list (add/remove items at runtime)
 *  12. Rich content inside panels (complex sub-trees)
 *  13. Keyboard navigation re-render cost
 *  14. Parent re-render stress (accordion inside frequently re-rendering parent)
 *  15. All-open initial render (every item pre-opened at mount)
 *  16. Context propagation scaling (subscriber count as explicit axis)
 *  17. Memory stability under extended rapid toggle
 *  18. Concurrent animation burst (all items toggled simultaneously)
 *  19. Rapid mount-unmount cycles (virtualizer pattern)
 *  20. Controlled mode high-frequency value churn
 *  21. forceMount + controlled mode combined at scale
 *  22. Animation-interrupted toggle (direction reversal)
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useState } from "react";
import { bench, describe } from "vitest";
import { heavyOpts, stableOpts } from "@/bench/opts";
import { forEachN } from "@/bench/scaling";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

/* ── Shared test helpers ───────────────────────────────────────────── */

function Items({ count, forceMount }: { count: number; forceMount?: boolean }) {
  const items: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      <AccordionItem key={i} value={`item-${i}`}>
        <AccordionTrigger>Trigger {i}</AccordionTrigger>
        <AccordionContent forceMount={forceMount}>
          Content body for item {i}
        </AccordionContent>
      </AccordionItem>
    );
  }
  return items;
}

function RichItems({
  count,
  forceMount,
}: {
  count: number;
  forceMount?: boolean;
}) {
  const items: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      <AccordionItem key={i} value={`item-${i}`}>
        <AccordionTrigger>Trigger {i}</AccordionTrigger>
        <AccordionContent forceMount={forceMount}>
          <div>
            <h3>Section heading {i}</h3>
            <p>
              Paragraph with <strong>bold</strong> and <em>italic</em> text.
            </p>
            <ul>
              {Array.from({ length: 5 }, (_, j) => (
                <li key={j}>List item {j}</li>
              ))}
            </ul>
            <button type="button">Action {i}</button>
            <input placeholder={`Input ${i}`} type="text" />
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
  return items;
}

function TestAccordion({
  count = 2,
  type = "single",
  defaultValue,
  forceMount,
}: {
  count?: number;
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  forceMount?: boolean;
}) {
  return (
    <Accordion
      {...(type === "multiple"
        ? {
            type: "multiple" as const,
            defaultValue: (() => {
              if (!defaultValue) {
                return undefined;
              }
              return Array.isArray(defaultValue)
                ? defaultValue
                : [defaultValue];
            })(),
          }
        : {
            type: "single" as const,
            collapsible: true,
            defaultValue: Array.isArray(defaultValue)
              ? defaultValue[0]
              : defaultValue,
          })}
    >
      <Items count={count} forceMount={forceMount} />
    </Accordion>
  );
}

function RichTestAccordion({
  count = 2,
  type = "single",
  defaultValue,
  forceMount,
}: {
  count?: number;
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  forceMount?: boolean;
}) {
  return (
    <Accordion
      {...(type === "multiple"
        ? {
            type: "multiple" as const,
            defaultValue: (() => {
              if (!defaultValue) {
                return undefined;
              }
              return Array.isArray(defaultValue)
                ? defaultValue
                : [defaultValue];
            })(),
          }
        : {
            type: "single" as const,
            collapsible: true,
            defaultValue: Array.isArray(defaultValue)
              ? defaultValue[0]
              : defaultValue,
          })}
    >
      <RichItems count={count} forceMount={forceMount} />
    </Accordion>
  );
}

/* A single userEvent instance reused across async benchmarks to avoid
 * measuring userEvent.setup() initialisation cost in every iteration. */
const user = userEvent.setup();

/* ── 1. Mount ──────────────────────────────────────────────────────── */

describe("1. Mount", () => {
  bench(
    "2 items (typical)",
    () => {
      render(<TestAccordion count={2} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "2 items, 1 open by default",
    () => {
      render(<TestAccordion count={2} defaultValue="item-0" />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "1 item (minimal)",
    () => {
      render(<TestAccordion count={1} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "5 items",
    () => {
      render(<TestAccordion count={5} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "10 items",
    () => {
      render(<TestAccordion count={10} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "20 items (stress)",
    () => {
      render(<TestAccordion count={20} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "50 items (large FAQ page)",
    () => {
      render(<TestAccordion count={50} />);
    },
    { ...heavyOpts, teardown: () => cleanup() }
  );
});

/* ── 2. Open/Close Cycle ───────────────────────────────────────────── */

describe("2. Open/Close Cycle", () => {
  bench(
    "open one item (click)",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      await user.click(screen.getByText("Trigger 0"));
      unmount();
    },
    stableOpts
  );

  bench(
    "open then close (two clicks)",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      const trigger = screen.getByText("Trigger 0");
      await user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );

  bench(
    "switch between items (close A, open B)",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      await user.click(screen.getByText("Trigger 0"));
      await user.click(screen.getByText("Trigger 1"));
      unmount();
    },
    stableOpts
  );

  bench(
    "interleaved toggle A-B-A-B-A (single)",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      const a = screen.getByText("Trigger 0");
      const b = screen.getByText("Trigger 1");
      await user.click(a);
      await user.click(b);
      await user.click(a);
      await user.click(b);
      await user.click(a);
      unmount();
    },
    stableOpts
  );
});

/* ── 3. Scaling (mount + open last) ────────────────────────────────── */

describe("3. Scaling (mount + open last)", () => {
  for (const n of [1, 3, 5, 10, 20]) {
    bench(
      `${n} items: mount + open last`,
      async () => {
        const { unmount } = render(<TestAccordion count={n} />);
        await user.click(screen.getByText(`Trigger ${n - 1}`));
        unmount();
      },
      stableOpts
    );
  }
});

/* ── 4. forceMount vs lazy ─────────────────────────────────────────── */

describe("4. forceMount vs lazy", () => {
  for (const n of [5, 10, 20]) {
    bench(
      `mount ${n} items, forceMount=true`,
      () => {
        render(<TestAccordion count={n} forceMount />);
      },
      { ...stableOpts, teardown: () => cleanup() }
    );

    bench(
      `mount ${n} items, forceMount=false (lazy)`,
      () => {
        render(<TestAccordion count={n} forceMount={false} />);
      },
      { ...stableOpts, teardown: () => cleanup() }
    );
  }

  bench(
    "open/close cycle, forceMount=true (20 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={20} forceMount />);
      const trigger = screen.getByText("Trigger 10");
      await user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );

  bench(
    "open/close cycle, forceMount=false (20 items, lazy)",
    async () => {
      const { unmount } = render(
        <TestAccordion count={20} forceMount={false} />
      );
      const trigger = screen.getByText("Trigger 10");
      await user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );
});

/* ── 5. Unmount ────────────────────────────────────────────────────── */

describe("5. Unmount", () => {
  bench(
    "unmount 2 items",
    () => {
      const { unmount } = render(<TestAccordion count={2} />);
      unmount();
    },
    stableOpts
  );

  bench(
    "unmount 10 items",
    () => {
      const { unmount } = render(<TestAccordion count={10} />);
      unmount();
    },
    stableOpts
  );

  bench(
    "unmount 20 items (motion spring scheduler teardown stress)",
    () => {
      const { unmount } = render(<TestAccordion count={20} />);
      unmount();
    },
    stableOpts
  );
});

/* ── 6. Rapid Toggle ───────────────────────────────────────────────── */

describe("6. Rapid Toggle", () => {
  bench(
    "5 toggles on same item",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      const trigger = screen.getByText("Trigger 0");
      for (let i = 0; i < 5; i++) {
        await user.click(trigger);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "10 toggles on same item",
    async () => {
      const { unmount } = render(<TestAccordion count={3} />);
      const trigger = screen.getByText("Trigger 0");
      for (let i = 0; i < 10; i++) {
        await user.click(trigger);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "cycle through 5 items sequentially",
    async () => {
      const { unmount } = render(<TestAccordion count={5} />);
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "interleaved toggle between two items (A-B-A-B-A)",
    async () => {
      const { unmount } = render(<TestAccordion count={5} />);
      const a = screen.getByText("Trigger 0");
      const b = screen.getByText("Trigger 1");
      for (let i = 0; i < 5; i++) {
        await user.click(i % 2 === 0 ? a : b);
      }
      unmount();
    },
    stableOpts
  );
});

/* ── 7. Controlled Mode ────────────────────────────────────────────── */

describe("7. Controlled Mode", () => {
  function ControlledSingleAccordion({ count }: { count: number }) {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <Accordion
        collapsible
        onValueChange={setValue}
        type="single"
        value={value ?? ""}
      >
        <Items count={count} />
      </Accordion>
    );
  }

  function ControlledMultipleAccordion({ count }: { count: number }) {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Accordion onValueChange={setValue} type="multiple" value={value}>
        <Items count={count} />
      </Accordion>
    );
  }

  bench(
    "controlled single: open one item (2 items)",
    async () => {
      const { unmount } = render(<ControlledSingleAccordion count={2} />);
      await user.click(screen.getByText("Trigger 0"));
      unmount();
    },
    stableOpts
  );

  bench(
    "controlled single: open one item (10 items)",
    async () => {
      const { unmount } = render(<ControlledSingleAccordion count={10} />);
      await user.click(screen.getByText("Trigger 0"));
      unmount();
    },
    stableOpts
  );

  bench(
    "controlled single: switch items (10 items)",
    async () => {
      const { unmount } = render(<ControlledSingleAccordion count={10} />);
      await user.click(screen.getByText("Trigger 0"));
      await user.click(screen.getByText("Trigger 5"));
      unmount();
    },
    stableOpts
  );

  bench(
    "controlled single: parent re-render with stable value (10 items)",
    () => {
      const { rerender, unmount } = render(
        <ControlledSingleAccordion count={10} />
      );
      for (let i = 0; i < 5; i++) {
        rerender(<ControlledSingleAccordion count={10} />);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "controlled multiple: open 3 items (10 items)",
    async () => {
      const { unmount } = render(<ControlledMultipleAccordion count={10} />);
      await user.click(screen.getByText("Trigger 0"));
      await user.click(screen.getByText("Trigger 3"));
      await user.click(screen.getByText("Trigger 7"));
      unmount();
    },
    stableOpts
  );
});

/* ── 8. Context Re-render Isolation ────────────────────────────────── */

describe("8. Context Re-render Isolation", () => {
  bench(
    "re-render 10-item accordion (no state change)",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={10} />);
      for (let i = 0; i < 5; i++) {
        rerender(<TestAccordion count={10} />);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "re-render 20-item accordion (no state change)",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={20} />);
      for (let i = 0; i < 5; i++) {
        rerender(<TestAccordion count={20} />);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "toggle once on 20-item accordion (re-render only)",
    async () => {
      const { unmount } = render(<TestAccordion count={20} />);
      await user.click(screen.getByText("Trigger 0"));
      unmount();
    },
    stableOpts
  );

  bench(
    "toggle twice on 20-item accordion (open + close)",
    async () => {
      const { unmount } = render(<TestAccordion count={20} />);
      const trigger = screen.getByText("Trigger 0");
      await user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );

  bench(
    "re-render 50-item accordion (no state change, subscriber stress)",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={50} />);
      for (let i = 0; i < 5; i++) {
        rerender(<TestAccordion count={50} />);
      }
      unmount();
    },
    heavyOpts
  );
});

/* ── 9. Multiple Type Cycles ───────────────────────────────────────── */

describe("9. Multiple Type Cycles", () => {
  function MultiAccordion({
    count,
    forceMount,
  }: {
    count: number;
    forceMount?: boolean;
  }) {
    return (
      <Accordion type="multiple">
        <Items count={count} forceMount={forceMount} />
      </Accordion>
    );
  }

  bench(
    "open two items simultaneously (5 items)",
    async () => {
      const { unmount } = render(<MultiAccordion count={5} />);
      await user.click(screen.getByText("Trigger 0"));
      await user.click(screen.getByText("Trigger 1"));
      unmount();
    },
    stableOpts
  );

  bench(
    "open all 5 items sequentially",
    async () => {
      const { unmount } = render(<MultiAccordion count={5} />);
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "open then close all 5 items (full cycle)",
    async () => {
      const { unmount } = render(<MultiAccordion count={5} />);
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      for (let i = 0; i < 5; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "open all 10 items sequentially",
    async () => {
      const { unmount } = render(<MultiAccordion count={10} />);
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "interleaved toggle A-B-A-B-A (multiple)",
    async () => {
      const { unmount } = render(<MultiAccordion count={5} />);
      const a = screen.getByText("Trigger 0");
      const b = screen.getByText("Trigger 1");
      await user.click(a);
      await user.click(b);
      await user.click(a);
      await user.click(b);
      await user.click(a);
      unmount();
    },
    stableOpts
  );
});

/* ── 10. forceMount Open-Many (Scale) ──────────────────────────────── */

describe("10. forceMount Open-Many (Scale)", () => {
  bench(
    "forceMount=true: open all 10 items sequentially",
    async () => {
      const { unmount } = render(
        <TestAccordion count={10} forceMount type="multiple" />
      );
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "forceMount=false: open all 10 items sequentially",
    async () => {
      const { unmount } = render(
        <TestAccordion count={10} forceMount={false} type="multiple" />
      );
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "forceMount=true: open all 10 then close all 10 (full cycle)",
    async () => {
      const { unmount } = render(
        <TestAccordion count={10} forceMount type="multiple" />
      );
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    stableOpts
  );
});

/* ── 11. Dynamic Item List ─────────────────────────────────────────── */

describe("11. Dynamic Item List", () => {
  bench(
    "add one item to a mounted 5-item accordion",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={5} />);
      rerender(<TestAccordion count={6} />);
      unmount();
    },
    stableOpts
  );

  bench(
    "remove one item from a mounted 5-item accordion",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={5} />);
      rerender(<TestAccordion count={4} />);
      unmount();
    },
    stableOpts
  );

  bench(
    "grow from 1 to 20 items incrementally",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={1} />);
      for (let n = 2; n <= 20; n++) {
        rerender(<TestAccordion count={n} />);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "shrink from 20 to 1 items incrementally",
    () => {
      const { rerender, unmount } = render(<TestAccordion count={20} />);
      for (let n = 19; n >= 1; n--) {
        rerender(<TestAccordion count={n} />);
      }
      unmount();
    },
    stableOpts
  );
});

/* ── 12. Rich Content ──────────────────────────────────────────────── */

describe("12. Rich Content", () => {
  bench(
    "mount 5 items with rich content",
    () => {
      render(<RichTestAccordion count={5} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "mount 10 items with rich content",
    () => {
      render(<RichTestAccordion count={10} />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "mount 5 items with rich content, forceMount=true",
    () => {
      render(<RichTestAccordion count={5} forceMount />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "mount 10 items with rich content, forceMount=true",
    () => {
      render(<RichTestAccordion count={10} forceMount />);
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "open one rich-content item (5 items)",
    async () => {
      const { unmount } = render(<RichTestAccordion count={5} />);
      await user.click(screen.getByText("Trigger 0"));
      unmount();
    },
    stableOpts
  );

  bench(
    "open + close one rich-content item (5 items)",
    async () => {
      const { unmount } = render(<RichTestAccordion count={5} />);
      const trigger = screen.getByText("Trigger 0");
      await user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );
});

/* ── 13. Keyboard Navigation ───────────────────────────────────────── */

describe("13. Keyboard Navigation", () => {
  bench(
    "arrow-down through 10 triggers",
    async () => {
      const { unmount } = render(<TestAccordion count={10} />);
      screen.getByText("Trigger 0").focus();
      for (let i = 0; i < 9; i++) {
        await user.keyboard("{ArrowDown}");
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "arrow-down through 20 triggers",
    async () => {
      const { unmount } = render(<TestAccordion count={20} />);
      screen.getByText("Trigger 0").focus();
      for (let i = 0; i < 19; i++) {
        await user.keyboard("{ArrowDown}");
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "Home + End jump (20 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={20} />);
      screen.getByText("Trigger 0").focus();
      await user.keyboard("{End}");
      await user.keyboard("{Home}");
      unmount();
    },
    stableOpts
  );

  bench(
    "keyboard open via Enter (10 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={10} />);
      screen.getByText("Trigger 0").focus();
      await user.keyboard("{Enter}");
      unmount();
    },
    stableOpts
  );

  bench(
    "arrow-down + Enter to open each of 5 items",
    async () => {
      const { unmount } = render(<TestAccordion count={5} type="multiple" />);
      screen.getByText("Trigger 0").focus();
      for (let i = 0; i < 5; i++) {
        await user.keyboard("{Enter}");
        if (i < 4) {
          await user.keyboard("{ArrowDown}");
        }
      }
      unmount();
    },
    stableOpts
  );
});

/* ── 14. Parent Re-render Stress ───────────────────────────────────── */

describe("14. Parent Re-render Stress", () => {
  function ParentWithCounter({ accordionCount }: { accordionCount: number }) {
    const [tick, setTick] = useState(0);
    return (
      <div data-tick={tick}>
        <button onClick={() => setTick((t) => t + 1)} type="button">
          Tick
        </button>
        <TestAccordion count={accordionCount} />
      </div>
    );
  }

  bench(
    "10 parent re-renders, 5-item accordion stable",
    async () => {
      const { unmount } = render(<ParentWithCounter accordionCount={5} />);
      const btn = screen.getByText("Tick");
      for (let i = 0; i < 10; i++) {
        await user.click(btn);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "10 parent re-renders, 20-item accordion stable",
    async () => {
      const { unmount } = render(<ParentWithCounter accordionCount={20} />);
      const btn = screen.getByText("Tick");
      for (let i = 0; i < 10; i++) {
        await user.click(btn);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "50 parent re-renders, 10-item accordion stable (stress)",
    async () => {
      const { unmount } = render(<ParentWithCounter accordionCount={10} />);
      const btn = screen.getByText("Tick");
      for (let i = 0; i < 50; i++) {
        await user.click(btn);
      }
      unmount();
    },
    stableOpts
  );
});

/* ── 15. All-Open Initial Render ───────────────────────────────────── */

describe("15. All-Open Initial Render", () => {
  bench(
    "5 items, all open at mount (type=multiple)",
    () => {
      const allValues = Array.from({ length: 5 }, (_, i) => `item-${i}`);
      render(
        <TestAccordion count={5} defaultValue={allValues} type="multiple" />
      );
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "10 items, all open at mount (type=multiple)",
    () => {
      const allValues = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      render(
        <TestAccordion count={10} defaultValue={allValues} type="multiple" />
      );
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "20 items, all open at mount (type=multiple, stress)",
    () => {
      const allValues = Array.from({ length: 20 }, (_, i) => `item-${i}`);
      render(
        <TestAccordion count={20} defaultValue={allValues} type="multiple" />
      );
    },
    { ...stableOpts, teardown: () => cleanup() }
  );

  bench(
    "10 items, all open + forceMount=true (type=multiple)",
    () => {
      const allValues = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      render(
        <TestAccordion
          count={10}
          defaultValue={allValues}
          forceMount
          type="multiple"
        />
      );
    },
    { ...stableOpts, teardown: () => cleanup() }
  );
});

/* ── 16. Context Propagation Scaling ─────────────────────────── */
/* RPN 20: Highest risk. Isolates context spread cost as subscriber
 * count grows. The slope across 5→10→20→50 reveals whether
 * AccordionOpenContext propagation is O(1) or O(n). */

describe("16. Context Propagation Scaling", () => {
  forEachN([5, 10, 20, 50], (n, opts) => {
    bench(
      `toggle item-0 in ${n}-item accordion (context spread)`,
      async () => {
        const { unmount } = render(<TestAccordion count={n} />);
        await user.click(screen.getByText("Trigger 0"));
        unmount();
      },
      opts
    );
  });
});

/* ── 17. Memory Stability Under Extended Rapid Toggle ────────── */
/* RPN 12: High iteration count over a fixed setup reveals throughput
 * degradation symptomatic of scheduler accumulation or GC pauses. */

describe("17. Extended Toggle Memory Stability", () => {
  bench(
    "100 open/close toggles on 10-item accordion",
    async () => {
      const { unmount } = render(<TestAccordion count={10} />);
      const trigger = screen.getByText("Trigger 0");
      for (let i = 0; i < 100; i++) {
        await user.click(trigger);
      }
      unmount();
    },
    heavyOpts
  );

  bench(
    "100 open/close toggles, forceMount=true (scheduler stability)",
    async () => {
      const { unmount } = render(<TestAccordion count={10} forceMount />);
      const trigger = screen.getByText("Trigger 0");
      for (let i = 0; i < 100; i++) {
        await user.click(trigger);
      }
      unmount();
    },
    heavyOpts
  );
});

/* ── 18. Concurrent Animation Burst ──────────────────────────── */
/* RPN 12: All motion.div spring schedulers fire in the same frame
 * budget when all items are toggled simultaneously.
 * NOTE: jsdom limitation — cannot measure real animation frame budget.
 * Playwright/CDP required for 120fps validation. */

describe("18. Concurrent Animation Burst", () => {
  bench(
    "programmatic all-open → all-closed transition (10 items, type=multiple)",
    () => {
      const allValues = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      const { rerender, unmount } = render(
        <TestAccordion count={10} defaultValue={allValues} type="multiple" />
      );
      rerender(<TestAccordion count={10} defaultValue={[]} type="multiple" />);
      unmount();
    },
    stableOpts
  );

  bench(
    "programmatic all-closed → all-open transition (10 items, type=multiple)",
    () => {
      const allValues = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      const { rerender, unmount } = render(
        <TestAccordion count={10} type="multiple" />
      );
      rerender(
        <TestAccordion count={10} defaultValue={allValues} type="multiple" />
      );
      unmount();
    },
    stableOpts
  );

  bench(
    "all-open → all-closed → all-open (20 items, full cycle)",
    () => {
      const allValues = Array.from({ length: 20 }, (_, i) => `item-${i}`);
      const { rerender, unmount } = render(
        <TestAccordion count={20} defaultValue={allValues} type="multiple" />
      );
      rerender(<TestAccordion count={20} defaultValue={[]} type="multiple" />);
      rerender(
        <TestAccordion count={20} defaultValue={allValues} type="multiple" />
      );
      unmount();
    },
    heavyOpts
  );
});

/* ── 19. Rapid Mount-Unmount Cycles ──────────────────────────── */
/* RPN 6: Common in virtualized list rows where the accordion is
 * repeatedly mounted and unmounted by the virtualizer. Tests the
 * mount-unmount-remount cycle cost in rapid succession. */

describe("19. Rapid Mount-Unmount Cycles", () => {
  bench(
    "20 mount-unmount cycles (5 items)",
    () => {
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(<TestAccordion count={5} />);
        unmount();
      }
    },
    stableOpts
  );

  bench(
    "20 mount-unmount cycles (10 items)",
    () => {
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(<TestAccordion count={10} />);
        unmount();
      }
    },
    heavyOpts
  );

  bench(
    "50 mount-unmount cycles (5 items, extended stability)",
    () => {
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(<TestAccordion count={5} />);
        unmount();
      }
    },
    heavyOpts
  );
});

/* ── 20. Controlled Mode High-Frequency Value Churn ──────────── */
/* RPN 12: Simulates a parent calling setValue on every frame.
 * normalizeValue always produces a new Set, invalidating
 * AccordionOpenContext on every render. */

describe("20. Controlled Mode Value Churn", () => {
  function ControlledSingleAccordion({
    count,
    value,
  }: {
    count: number;
    value?: string;
  }) {
    const [val, setVal] = useState<string>(value ?? "");
    return (
      <Accordion collapsible onValueChange={setVal} type="single" value={val}>
        <Items count={count} />
      </Accordion>
    );
  }

  bench(
    "100 rerender cycles with stable value (20 items)",
    () => {
      const { rerender, unmount } = render(
        <ControlledSingleAccordion count={20} />
      );
      for (let i = 0; i < 100; i++) {
        rerender(<ControlledSingleAccordion count={20} />);
      }
      unmount();
    },
    heavyOpts
  );

  bench(
    "50 rerender cycles with alternating value (20 items)",
    () => {
      const { rerender, unmount } = render(
        <ControlledSingleAccordion count={20} value="item-0" />
      );
      for (let i = 0; i < 50; i++) {
        rerender(
          <ControlledSingleAccordion
            count={20}
            value={i % 2 === 0 ? "item-1" : "item-0"}
          />
        );
      }
      unmount();
    },
    heavyOpts
  );
});

/* ── 21. forceMount + Controlled Mode Combined ───────────────── */
/* RPN 12: The heaviest combination — all DOM nodes live, all receive
 * context updates, all motion.div animators are active. */

describe("21. forceMount + Controlled Mode Combined", () => {
  function ForceMountControlled({ count }: { count: number }) {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Accordion onValueChange={setValue} type="multiple" value={value}>
        <Items count={count} forceMount />
      </Accordion>
    );
  }

  bench(
    "open all 10 items (controlled + forceMount)",
    async () => {
      const { unmount } = render(<ForceMountControlled count={10} />);
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    heavyOpts
  );

  bench(
    "20 parent re-renders (controlled + forceMount, 10 items, stable value)",
    () => {
      const { rerender, unmount } = render(<ForceMountControlled count={10} />);
      for (let i = 0; i < 20; i++) {
        rerender(<ForceMountControlled count={10} />);
      }
      unmount();
    },
    stableOpts
  );

  bench(
    "open all 20 items (controlled + forceMount, stress)",
    async () => {
      const { unmount } = render(<ForceMountControlled count={20} />);
      for (let i = 0; i < 20; i++) {
        await user.click(screen.getByText(`Trigger ${i}`));
      }
      unmount();
    },
    heavyOpts
  );
});

/* ── 22. Animation-Interrupted Toggle (Direction Reversal) ───── */
/* RPN 12: Spring reversal mid-animation. motion/react reverses the
 * spring from current velocity when the user clicks during open animation.
 * NOTE: jsdom limitation — cannot measure real animation frame budget.
 * Playwright/CDP required for 120fps validation. In jsdom, motion/react
 * resolves animations synchronously, so this approximates a rapid
 * re-render rather than a true mid-spring reversal. */

describe("22. Animation-Interrupted Toggle (direction reversal)", () => {
  bench(
    "click open then immediately click close (spring reversal, 5 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={5} />);
      const trigger = screen.getByText("Trigger 0");
      // Do not await first click — simulate interruption mid-animation
      user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );

  bench(
    "3 rapid direction reversals on same item (5 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={5} />);
      const trigger = screen.getByText("Trigger 0");
      user.click(trigger);
      user.click(trigger);
      user.click(trigger);
      user.click(trigger);
      user.click(trigger);
      await user.click(trigger);
      unmount();
    },
    stableOpts
  );

  bench(
    "interrupted toggle across different items (10 items)",
    async () => {
      const { unmount } = render(<TestAccordion count={10} />);
      user.click(screen.getByText("Trigger 0"));
      user.click(screen.getByText("Trigger 1"));
      user.click(screen.getByText("Trigger 2"));
      await user.click(screen.getByText("Trigger 3"));
      unmount();
    },
    stableOpts
  );
});
