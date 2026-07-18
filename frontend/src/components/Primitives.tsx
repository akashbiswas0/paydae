import { cn } from "@/lib/utils";
import { initials } from "@/lib/roles";

/** Initials avatar — soft tinted square, Deel style. */
export function Avatar({
  name,
  className,
  chip = "bg-muted text-muted-foreground",
}: {
  name: string;
  className?: string;
  /** tailwind bg+text classes for the tint */
  chip?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        chip,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Dashboard stat tile — label + big tabular number + optional sub-line. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  /** tailwind classes for the icon puck */
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg",
              accent ?? "bg-accent text-accent-foreground",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Section header — title + optional right-side action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Empty state — soft circle icon + title + subtext. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {children && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}
