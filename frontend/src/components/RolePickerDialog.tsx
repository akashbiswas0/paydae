"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Building2, HardHat, ShieldCheck, X } from "lucide-react";
import type { Role } from "@/lib/types";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Role picker
 *
 *    0ms   backdrop and panel appear together
 *   80ms   role choices rise in (50ms apart)
 *  260ms   all content visible, idle
 *
 * Exit: backdrop + panel fade together
 * ───────────────────────────────────────────────────────── */

const MOTION = {
  backdropDuration: 0.2,
  panelScale: 0.97,
  cardDelay: 0.08,
  cardStagger: 0.05,
  cardOffset: 10,
  panelSpring: { type: "spring" as const, stiffness: 420, damping: 34 },
  cardSpring: { type: "spring" as const, stiffness: 460, damping: 32 },
};

const OPTIONS: Array<{
  role: Role;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}> = [
  {
    role: "company",
    title: "I’m a company",
    description: "Hire contractors, approve invoices and run payroll.",
    icon: <Building2 className="size-5" aria-hidden="true" />,
    iconClass: "bg-primary/10 text-primary",
  },
  {
    role: "contractor",
    title: "I’m a contractor",
    description: "Sign agreements, submit invoices and track payments.",
    icon: <HardHat className="size-5" aria-hidden="true" />,
    iconClass: "bg-brand-mint text-emerald-900",
  },
  {
    role: "auditor",
    title: "I’m an auditor",
    description: "Review designated company records with read-only access.",
    icon: <ShieldCheck className="size-5" aria-hidden="true" />,
    iconClass: "bg-brand-sky text-sky-900",
  },
];

export function RolePickerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const firstOption = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstOption.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const choose = (role: Role) => {
    onClose();
    router.push(`/${role}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6" role="presentation">
          <motion.button
            type="button"
            aria-label="Close role selection"
            className="absolute inset-0 size-full cursor-default bg-foreground/55 backdrop-blur-sm"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduceMotion ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : MOTION.backdropDuration }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-picker-title"
            className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl sm:p-7"
            initial={{ opacity: 1, scale: reduceMotion ? 1 : MOTION.panelScale, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : MOTION.panelScale, y: reduceMotion ? 0 : 8 }}
            transition={reduceMotion ? { duration: 0 } : MOTION.panelSpring}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Get started</p>
                <h2 id="role-picker-title" className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                  Who are you?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose the workspace that matches your role.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3">
              {OPTIONS.map((option, index) => (
                <motion.button
                  ref={index === 0 ? firstOption : undefined}
                  key={option.role}
                  type="button"
                  onClick={() => choose(option.role)}
                  className="group flex min-h-20 w-full items-center gap-4 rounded-2xl border border-border bg-background p-4 text-left transition-colors duration-100 hover:border-primary/35 hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  initial={{ opacity: 1, y: reduceMotion ? 0 : MOTION.cardOffset }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { ...MOTION.cardSpring, delay: MOTION.cardDelay + index * MOTION.cardStagger }
                  }
                >
                  <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${option.iconClass}`}>
                    {option.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold tracking-tight">{option.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span>
                  </span>
                  <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </motion.button>
              ))}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
