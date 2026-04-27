/* components/ui/accordion.test.tsx */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

afterEach(cleanup);

function TestAccordion({
  type = "single",
  collapsible = true,
  defaultValue,
  forceMount,
  children,
}: {
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string | string[];
  forceMount?: boolean;
  children?: ReactNode;
}) {
  const items = children ?? (
    <>
      <AccordionItem value="a">
        <AccordionTrigger>Item A</AccordionTrigger>
        <AccordionContent forceMount={forceMount}>Content A</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Item B</AccordionTrigger>
        <AccordionContent forceMount={forceMount}>Content B</AccordionContent>
      </AccordionItem>
    </>
  );

  if (type === "multiple") {
    let resolvedDefault: string[] | undefined;
    if (Array.isArray(defaultValue)) {
      resolvedDefault = defaultValue;
    } else if (defaultValue != null) {
      resolvedDefault = [defaultValue];
    }
    return (
      <Accordion defaultValue={resolvedDefault} type="multiple">
        {items}
      </Accordion>
    );
  }

  return (
    <Accordion
      collapsible={collapsible}
      defaultValue={typeof defaultValue === "string" ? defaultValue : undefined}
      type="single"
    >
      {items}
    </Accordion>
  );
}

// ── Rendering & initial state ────────────────────────────────────────

describe("Accordion", () => {
  it("renders triggers with correct accessible role and button type", () => {
    render(<TestAccordion />);
    const triggerA = screen.getByRole("button", { name: "Item A" });
    const triggerB = screen.getByRole("button", { name: "Item B" });
    expect(triggerA).toBeTruthy();
    expect(triggerB).toBeTruthy();
    // type="button" prevents accidental form submissions
    expect(triggerA.getAttribute("type")).toBe("button");
    expect(triggerB.getAttribute("type")).toBe("button");
  });

  it("all items closed by default", () => {
    render(<TestAccordion />);
    for (const trigger of screen.getAllByRole("button")) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }
  });
});

// ── Heading level ───────────────────────────────────────────────────

describe("Accordion — heading", () => {
  it("default heading level is h3 (Radix default)", () => {
    render(
      <Accordion collapsible type="single">
        <AccordionItem value="a">
          <AccordionTrigger>My Question</AccordionTrigger>
          <AccordionContent>Answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
  });
});

// ── Single mode (collapsible) ────────────────────────────────────────

describe("Accordion — single collapsible", () => {
  it("opens item on click", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("closes open item on second click", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const trigger = screen.getByRole("button", { name: "Item A" });
    await user.click(trigger);
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes previous item when opening another", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    await user.click(screen.getByRole("button", { name: "Item A" }));
    await user.click(screen.getByRole("button", { name: "Item B" }));

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("respects defaultValue", () => {
    render(<TestAccordion defaultValue="b" />);
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });
});

// ── Single mode (non-collapsible) ────────────────────────────────────

describe("Accordion — single non-collapsible", () => {
  it("clicking the open trigger does not close it", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="a" type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const triggerA = screen.getByRole("button", { name: "Item A" });
    expect(triggerA.getAttribute("aria-expanded")).toBe("true");

    await user.click(triggerA);
    expect(triggerA.getAttribute("aria-expanded")).toBe("true");
  });

  it("switching to another item still works", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue="a" type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    await user.click(screen.getByRole("button", { name: "Item B" }));
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });
});

// ── Multiple mode ────────────────────────────────────────────────────

describe("Accordion — multiple mode", () => {
  it("allows several items open simultaneously", async () => {
    const user = userEvent.setup();
    render(<TestAccordion type="multiple" />);

    await user.click(screen.getByRole("button", { name: "Item A" }));
    await user.click(screen.getByRole("button", { name: "Item B" }));

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("defaultValue array opens all specified items", () => {
    render(
      <Accordion defaultValue={["a", "b"]} type="multiple">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("empty defaultValue array starts all items closed", () => {
    render(
      <Accordion defaultValue={[]} type="multiple">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("defaultValue with duplicate values opens item once and single click closes it", async () => {
    const user = userEvent.setup();
    render(
      <Accordion defaultValue={["a", "a"]} type="multiple">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const trigger = screen.getByRole("button", { name: "Item A" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

// ── Controlled mode ──────────────────────────────────────────────────

describe("Accordion — controlled", () => {
  it("reflects externally supplied value", () => {
    const { rerender } = render(
      <Accordion collapsible onValueChange={() => {}} type="single" value="a">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("false");

    rerender(
      <Accordion collapsible onValueChange={() => {}} type="single" value="b">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("switching value from one item to another leaves exactly one expanded", async () => {
    function ControlledWrapper() {
      const [value, setValue] = useState("a");
      return (
        <>
          <button onClick={() => setValue("b")} type="button">
            Switch to B
          </button>
          <Accordion
            collapsible
            onValueChange={setValue}
            type="single"
            value={value}
          >
            <AccordionItem value="a">
              <AccordionTrigger>Item A</AccordionTrigger>
              <AccordionContent>Content A</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Item B</AccordionTrigger>
              <AccordionContent>Content B</AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      );
    }

    const user = userEvent.setup();
    render(<ControlledWrapper />);

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");

    await user.click(screen.getByRole("button", { name: "Switch to B" }));

    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("controlled multiple mode reflects array value and responds to value changes", () => {
    const onValueChange = vi.fn();

    const { rerender } = render(
      <Accordion onValueChange={onValueChange} type="multiple" value={["a"]}>
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("false");

    // Update to both open
    rerender(
      <Accordion
        onValueChange={onValueChange}
        type="multiple"
        value={["a", "b"]}
      >
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");

    // Collapse A only
    rerender(
      <Accordion onValueChange={onValueChange} type="multiple" value={["b"]}>
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(
      screen
        .getByRole("button", { name: "Item A" })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Item B" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });
});

// ── onValueChange callback ───────────────────────────────────────────

describe("Accordion — onValueChange", () => {
  it("fires with string value in single mode on open", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Accordion
        collapsible
        onValueChange={onValueChange}
        type="single"
        value=""
      >
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("fires with empty string when collapsible item is closed", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Accordion collapsible onValueChange={onValueChange} type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const trigger = screen.getByRole("button", { name: "Item A" });
    await user.click(trigger); // open
    await user.click(trigger); // close
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("fires with string[] in multiple mode", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Accordion onValueChange={onValueChange} type="multiple" value={[]}>
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(Array.isArray(onValueChange.mock.calls[0]![0])).toBe(true);
  });

  it("fires on uncontrolled accordion too", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Accordion collapsible onValueChange={onValueChange} type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("a");
  });
});

// ── Keyboard interaction ─────────────────────────────────────────────

describe("Accordion — keyboard", () => {
  it("Enter toggles item", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const trigger = screen.getByRole("button", { name: "Item A" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("Space opens a closed item", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const trigger = screen.getByRole("button", { name: "Item A" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("Space closes an open item (collapsible)", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const trigger = screen.getByRole("button", { name: "Item A" });
    trigger.focus();
    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("ArrowDown moves focus from first to second trigger", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const first = screen.getByRole("button", { name: "Item A" });
    const second = screen.getByRole("button", { name: "Item B" });

    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);
  });

  it("ArrowUp moves focus from second to first trigger", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    const second = screen.getByRole("button", { name: "Item B" });
    second.focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item A" })
    );
  });

  it("Home moves focus to first trigger", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    screen.getByRole("button", { name: "Item B" }).focus();
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item A" })
    );
  });

  it("End moves focus to last trigger", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    screen.getByRole("button", { name: "Item A" }).focus();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item B" })
    );
  });

  it("ArrowDown on last trigger wraps to first", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    screen.getByRole("button", { name: "Item B" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item A" })
    );
  });

  it("ArrowUp on first trigger wraps to last", async () => {
    const user = userEvent.setup();
    render(<TestAccordion />);

    screen.getByRole("button", { name: "Item A" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item B" })
    );
  });
});

// ── Disabled items ──────────────────────────────────────────────────

describe("Accordion — disabled items", () => {
  it("disabled item cannot be opened by click", async () => {
    const user = userEvent.setup();
    render(
      <Accordion collapsible type="single">
        <AccordionItem disabled value="a">
          <AccordionTrigger>Disabled Item</AccordionTrigger>
          <AccordionContent>Secret</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const trigger = screen.getByRole("button", { name: "Disabled Item" });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("keyboard navigation skips disabled items", async () => {
    const user = userEvent.setup();
    render(
      <Accordion collapsible type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem disabled value="b">
          <AccordionTrigger>Item B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
        <AccordionItem value="c">
          <AccordionTrigger>Item C</AccordionTrigger>
          <AccordionContent>Content C</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    screen.getByRole("button", { name: "Item A" }).focus();
    await user.keyboard("{ArrowDown}");
    // Should skip disabled Item B and land on Item C
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Item C" })
    );
  });
});

// ── forceMount & content lifecycle ───────────────────────────────────

describe("Accordion — forceMount & content lifecycle", () => {
  it("force-mounted content is in the DOM when closed", () => {
    render(<TestAccordion forceMount />);
    expect(screen.getByText("Content A")).toBeTruthy();
    expect(screen.getByText("Content B")).toBeTruthy();
  });

  it("force-mounted closed content has data-state=closed on the content wrapper", () => {
    render(<TestAccordion forceMount />);

    const contentText = screen.getByText("Content A");
    // The inner div wraps children; grandparent is the motion.div / accordion content
    const contentWrapper = contentText.parentElement?.parentElement;
    expect(contentWrapper?.getAttribute("data-state")).toBe("closed");
  });

  it("force-mounted open content has data-state=open on the content wrapper", async () => {
    const user = userEvent.setup();
    render(<TestAccordion forceMount />);

    await user.click(screen.getByRole("button", { name: "Item A" }));

    const contentText = screen.getByText("Content A");
    const contentWrapper = contentText.parentElement?.parentElement;
    expect(contentWrapper?.getAttribute("data-state")).toBe("open");
  });

  it("lazy content (forceMount=false) is removed from DOM after panel closes", async () => {
    const user = userEvent.setup();
    render(<TestAccordion forceMount={false} />);

    // Content absent before open
    expect(screen.queryByText("Content A")).toBeNull();

    // Open: content appears
    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(screen.getByText("Content A")).toBeTruthy();

    // Close: content removed
    await user.click(screen.getByRole("button", { name: "Item A" }));
    expect(screen.queryByText("Content A")).toBeNull();
  });

  it("forceMount + controlled: data-state tracks value prop", () => {
    const { rerender } = render(
      <Accordion collapsible onValueChange={() => {}} type="single" value="">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent forceMount>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const contentText = screen.getByText("Content A");
    // grandparent is the motion.div / accordion content wrapper
    const contentWrapper = contentText.parentElement?.parentElement;

    // Closed: data-state should be "closed"
    expect(contentWrapper?.getAttribute("data-state")).toBe("closed");

    rerender(
      <Accordion collapsible onValueChange={() => {}} type="single" value="a">
        <AccordionItem value="a">
          <AccordionTrigger>Item A</AccordionTrigger>
          <AccordionContent forceMount>Content A</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    // Open: data-state should be "open"
    expect(contentWrapper?.getAttribute("data-state")).toBe("open");
  });
});

// ── Ref forwarding ───────────────────────────────────────────────────

describe("Accordion — ref forwarding", () => {
  it("forwards ref on AccordionItem to the item wrapper element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Accordion collapsible type="single">
        <AccordionItem ref={ref} value="a">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("forwards ref on AccordionTrigger to the button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Accordion collapsible type="single">
        <AccordionItem value="a">
          <AccordionTrigger ref={ref}>Trigger</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.getAttribute("aria-expanded")).toBe("false");
  });

  it("forwards ref on AccordionContent to the content wrapper element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Accordion collapsible defaultValue="a" type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent ref={ref}>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
