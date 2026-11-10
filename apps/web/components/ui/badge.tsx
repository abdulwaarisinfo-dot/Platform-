import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]",
        accent: "bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]",
        success: "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]",
        danger: "bg-[var(--color-danger-subtle)] text-[var(--color-danger)]",
        info: "bg-[var(--color-info-subtle)] text-[var(--color-info)]",
        // Prospect statuses
        new: "bg-[var(--color-info-subtle)] text-[var(--color-info)]",
        researched: "bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]",
        ready: "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
        sent: "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]",
        replied: "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
        "not-interested": "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]",
        converted: "bg-[var(--color-success)] text-white",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[11px]",
        md: "px-2 py-0.5 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
