/* components/ui/accordion.tsx */
"use client";

import { Accordion as AccordionPrimitive } from "radix-ui";

const RadixAccordionContent = AccordionPrimitive.Content;
const RadixAccordionHeader = AccordionPrimitive.Header;
const RadixAccordionItemPrimitive = AccordionPrimitive.Item;
const RadixAccordionRoot = AccordionPrimitive.Root;
const RadixAccordionTriggerPrimitive = AccordionPrimitive.Trigger;

import { ChevronDownIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { spring } from "@/lib/motion-tokens";
import type { ComponentPropsWithoutRef, FC, ReactNode, RefObject } from "react";
import { createContext, useContext, useState } from "react";

// ── Context: propagate open state without MutationObserver ─────────

const AccordionOpenContext = createContext<Set<string>>(new Set());
const ItemValueContext = createContext("");

type RootProps = ComponentPropsWithoutRef<typeof RadixAccordionRoot>;
type ItemProps = ComponentPropsWithoutRef<typeof RadixAccordionItemPrimitive>;
type TriggerProps = ComponentPropsWithoutRef<
  typeof RadixAccordionTriggerPrimitive
> & {
  children: ReactNode;
  /** Heading level for the accordion header. Defaults to "h3" (Radix default). */
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6";
};
type ContentProps = Omit<
  ComponentPropsWithoutRef<typeof RadixAccordionContent>,
  "forceMount"
> & {
  children: ReactNode;
  contentClassName?: string;
  forceMount?: boolean;
};

function normalizeValue(v: string | string[] | undefined): Set<string> {
  if (v === undefined) {
    return new Set();
  }
  return new Set(Array.isArray(v) ? v : [v]);
}

export const Accordion: FC<RootProps> = ({
  className,
  children,
  onValueChange: originalOnValueChange,
  ...props
}) => {
  const isControlled = "value" in props && props.value !== undefined;
  const [internal, setInternal] = useState(() =>
    normalizeValue(props.defaultValue as string | string[] | undefined)
  );
  const openSet = isControlled
    ? normalizeValue(props.value as string | string[] | undefined)
    : internal;

  const handleChange = (value: string | string[]) => {
    if (!isControlled) {
      setInternal(normalizeValue(value));
    }
    (originalOnValueChange as (v: string | string[]) => void)?.(value);
  };

  const root: React.JSX.Element = (
    // @ts-expect-error — TS cannot narrow discriminated union rest props after destructuring onValueChange
    <RadixAccordionRoot
      className={className}
      data-slot="accordion"
      {...props}
      onValueChange={handleChange as RootProps["onValueChange"]}
    >
      {children}
    </RadixAccordionRoot>
  );

  return (
    <MotionConfig
      reducedMotion="user"
      transition={spring.surface}
    >
      <AccordionOpenContext.Provider value={openSet}>
        {root}
      </AccordionOpenContext.Provider>
    </MotionConfig>
  );
};

export const AccordionItem = ({
  className,
  children,
  ref,
  ...props
}: ItemProps & { ref?: RefObject<HTMLDivElement | null> }) => (
  <ItemValueContext.Provider value={props.value}>
    <RadixAccordionItemPrimitive
      className={`group relative w-full gap-2 rounded-md border border-white/6 transition-colors *:my-0 hover:bg-white/3 data-[state=open]:bg-white/3 data-[state=open]:hover:bg-white/6 ${className ?? ""}
        `}
      data-slot="accordion-item"
      ref={ref}
      {...props}
    >
      {children}
    </RadixAccordionItemPrimitive>
  </ItemValueContext.Provider>
);
AccordionItem.displayName = "AccordionItem";

export const AccordionTrigger = ({
  className,
  children,
  ref,
  headingLevel: HeadingTag,
  ...props
}: TriggerProps & { ref?: RefObject<HTMLButtonElement | null> }) => {
  const openSet = useContext(AccordionOpenContext);
  const itemValue = useContext(ItemValueContext);
  const isOpen = openSet.has(itemValue);

  const triggerContent = (
    <RadixAccordionTriggerPrimitive
      asChild
      className="flex w-full items-center justify-between gap-2 rounded-md"
      {...props}
    >
      <button
        className={`p-3 transition-transform motion-safe:active:scale-[0.98] ${className ?? ""}`}
        data-slot="accordion-trigger"
        ref={ref}
        type="button"
      >
        <span className="font-semibold text-base">{children}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="inline-flex shrink-0"
          initial={false}
        >
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </motion.span>
      </button>
    </RadixAccordionTriggerPrimitive>
  );

  if (HeadingTag) {
    return (
      <HeadingTag>
        <RadixAccordionHeader asChild>{triggerContent}</RadixAccordionHeader>
      </HeadingTag>
    );
  }

  return <RadixAccordionHeader>{triggerContent}</RadixAccordionHeader>;
};
AccordionTrigger.displayName = "AccordionTrigger";

export const AccordionContent = ({
  className,
  contentClassName,
  children,
  ref: forwardedRef,
  forceMount = false,
  ...props
}: ContentProps & { ref?: RefObject<HTMLDivElement | null> }) => {
  const openSet = useContext(AccordionOpenContext);
  const itemValue = useContext(ItemValueContext);
  const isOpen = openSet.has(itemValue);

  const forceMountProps = forceMount ? { forceMount: true as const } : {};

  return (
    <RadixAccordionContent
      asChild
      data-slot="accordion-content"
      {...forceMountProps}
      {...props}
    >
      <motion.div
        {...(forceMount && !isOpen ? { hidden: true } : {})}
        animate={
          isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }
        }
        className={className ?? ""}
        initial={false}
        ref={forwardedRef}
        style={{ overflow: "hidden" }}
        transition={spring.panel}
      >
        <div className={contentClassName ?? "p-3 pt-0"}>{children}</div>
      </motion.div>
    </RadixAccordionContent>
  );
};
AccordionContent.displayName = "AccordionContent";

export type {
  ContentProps as AccordionContentProps,
  ItemProps as AccordionItemProps,
  RootProps as AccordionProps,
  TriggerProps as AccordionTriggerProps,
};
