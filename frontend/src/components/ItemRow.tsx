import { cn } from "@/lib/utils";

// Deel-style status pills: light pastel background + darker text + a small dot.
const CHIP_STYLES = {
  offered: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
} as const;

const DOT_STYLES = {
  offered: "bg-amber-500",
  pending: "bg-amber-500",
  approved: "bg-blue-500",
  active: "bg-emerald-500",
  paid: "bg-emerald-500",
} as const;

export type ChipStatus = keyof typeof CHIP_STYLES;

export function StatusChip({ status, label }: { status: ChipStatus; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        CHIP_STYLES[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_STYLES[status])} />
      {label ?? status}
    </span>
  );
}

export function ItemRow({
  title,
  subtitle,
  left,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-1 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        {left}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-4 text-sm text-muted-foreground">{children}</p>;
}
