import { Building2, HardHat, ShieldCheck } from "lucide-react";
import type { Role } from "@/lib/types";

/**
 * Per-role identity used across the shell, landing and avatars. Deel keeps one
 * indigo brand accent; role colour here is a *subdued* hue used only for small
 * avatars/dot chips, never full-bleed backgrounds.
 */
export const ROLE_META: Record<
  Role,
  {
    label: string;
    /** avatar / dot chip — soft tint + readable text */
    chip: string;
    /** small solid dot */
    dot: string;
    /** text-only accent */
    text: string;
    icon: React.ReactNode;
  }
> = {
  company: {
    label: "Company",
    chip: "bg-primary/10 text-primary",
    dot: "bg-primary",
    text: "text-primary",
    icon: <Building2 className="size-4" />,
  },
  contractor: {
    label: "Contractor",
    chip: "bg-brand-mint text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: <HardHat className="size-4" />,
  },
  auditor: {
    label: "Auditor",
    chip: "bg-brand-sky text-sky-900 dark:text-sky-100",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    icon: <ShieldCheck className="size-4" />,
  },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
