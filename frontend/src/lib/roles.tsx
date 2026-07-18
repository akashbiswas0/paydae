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
    chip: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
    text: "text-indigo-600",
    icon: <Building2 className="size-4" />,
  },
  contractor: {
    label: "Contractor",
    chip: "bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
    text: "text-teal-600",
    icon: <HardHat className="size-4" />,
  },
  auditor: {
    label: "Auditor",
    chip: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    text: "text-sky-600",
    icon: <ShieldCheck className="size-4" />,
  },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
