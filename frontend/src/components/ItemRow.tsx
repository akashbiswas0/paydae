import { Badge } from "@/components/ui/badge";

const CHIP_STYLES = {
  offered: "border-transparent bg-amber-500/15 text-amber-400",
  pending: "border-transparent bg-amber-500/15 text-amber-400",
  approved: "border-transparent bg-blue-500/15 text-blue-400",
  active: "border-transparent bg-emerald-500/15 text-emerald-400",
  paid: "border-transparent bg-emerald-500/15 text-emerald-400",
} as const;

export type ChipStatus = keyof typeof CHIP_STYLES;

export function StatusChip({ status, label }: { status: ChipStatus; label?: string }) {
  return <Badge className={CHIP_STYLES[status]}>{label ?? status}</Badge>;
}

export function ItemRow({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3 last:mb-0">
      <div className="min-w-0">
        <div className="text-[15px] font-bold">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-0.5 py-1.5 text-sm text-muted-foreground">{children}</p>;
}
