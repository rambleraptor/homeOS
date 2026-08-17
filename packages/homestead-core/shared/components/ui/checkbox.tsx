import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@rambleraptor/homestead-core/shared/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 shadow-sm transition-colors duration-(--duration-quick) ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-terracotta/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-terracotta data-[state=checked]:border-accent-terracotta data-[state=checked]:text-white",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      {/*
        Lucide's <Check> inlined so the path itself is addressable: drawing the
        stroke requires setting `pathLength` and animating `stroke-dashoffset`,
        and lucide forwards props to the <svg>, not to the path inside it.

        `pathLength={1}` renormalises the path so a dash of 1 is exactly its
        full length regardless of the icon's real geometry — no magic numbers,
        and it stays correct if the box is ever resized.

        Only the check-on direction is animated. Radix unmounts the indicator
        when unchecked, and un-ticking should feel immediate anyway: the state
        is being cleared, not created.
      */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          d="M20 6 9 17l-5-5"
          pathLength={1}
          className="[stroke-dasharray:1] animate-check-draw"
        />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
