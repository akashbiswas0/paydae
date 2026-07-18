"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Globe2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { AccessWalletDialog } from "@/components/AccessWalletDialog";
import { BrandMark } from "@/components/BrandMark";
import { RolePickerDialog } from "@/components/RolePickerDialog";
import { Button } from "@/components/ui/button";
import { listWallets } from "@/wallet/keystore";

/* ─────────────────────────────────────────────────────────
 * LANDING PAGE STORYBOARD
 *
 * Static shell and primary actions are interactive immediately.
 *    0ms   nav + hero content are visible
 *   90ms   hero copy settles into place
 *  170ms   payroll product card rises in
 *  260ms   trust row settles into place
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  hero: 0.09,
  product: 0.17,
  trust: 0.26,
};

const HERO_SPRING = { type: "spring" as const, stiffness: 260, damping: 28 };

const BENEFITS = [
  {
    icon: <UsersRound className="size-5" aria-hidden="true" />,
    title: "One place for every role",
    text: "Companies, contractors and auditors each get a focused workspace built around their job.",
  },
  {
    icon: <LockKeyhole className="size-5" aria-hidden="true" />,
    title: "Private by design",
    text: "Every action is signed in your browser with a key that stays under your control.",
  },
  {
    icon: <CircleDollarSign className="size-5" aria-hidden="true" />,
    title: "Payroll without friction",
    text: "Create agreements, approve invoices and run payday without a separate gas or funding step.",
  },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div className="absolute -left-8 top-14 hidden rounded-2xl border border-white/60 bg-white/85 p-3 shadow-lg backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-mint text-emerald-900"><Check className="size-4" aria-hidden="true" /></span>
          <div><p className="text-xs font-semibold text-foreground">Invoice approved</p><p className="text-[11px] text-muted-foreground">Just now</p></div>
        </div>
      </div>
      <div className="absolute -right-5 bottom-16 z-20 hidden rounded-2xl bg-foreground p-3 text-background shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-lime" aria-hidden="true" />
          <p className="text-xs font-medium">Browser-signed</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-foreground/10 bg-card p-3 shadow-[0_30px_80px_-36px_color-mix(in_oklch,var(--foreground)_35%,transparent)] sm:p-4">
        <div className="rounded-[1.4rem] bg-foreground p-5 text-background sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-background/60">Treasury balance</p><p className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">$128,540.00</p></div>
            <span className="rounded-full bg-brand-lime px-2.5 py-1 text-[11px] font-semibold text-foreground">Ready</span>
          </div>
          <div className="mt-8 flex items-end gap-1.5" aria-label="Payroll activity chart">
            {[32, 46, 38, 62, 54, 76, 66, 88, 72, 100].map((height, index) => (
              <span key={index} className="flex-1 rounded-t-md bg-background/15 last:bg-brand-lime" style={{ height: `${height * 0.58}px` }} />
            ))}
          </div>
        </div>

        <div className="px-2 pb-2 pt-5 sm:px-3">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="font-semibold tracking-tight">Upcoming payroll</p><p className="text-xs text-muted-foreground">Friday, July 24</p></div>
            <span className="text-sm font-semibold">$24,820</span>
          </div>
          <div className="space-y-2">
            {[
              ["MC", "Maya Chen", "Product design", "$6,200"],
              ["AO", "Alex Ortiz", "Engineering", "$8,450"],
              ["SK", "Sam Kim", "Research", "$4,800"],
            ].map(([initials, name, role, amount], index) => (
              <div key={name} className="flex items-center gap-3 rounded-xl bg-muted/70 p-2.5">
                <span className={`inline-flex size-9 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-primary/10 text-primary" : index === 1 ? "bg-brand-mint text-emerald-900" : "bg-brand-sky text-sky-900"}`}>{initials}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">{role}</p></div>
                <p className="text-sm font-semibold">{amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const reduceMotion = useReducedMotion();
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [walletAccessOpen, setWalletAccessOpen] = useState(false);
  const [walletCount, setWalletCount] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setWalletCount(listWallets().length), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const entrance = (delay: number, offset = 14) => ({
    initial: { opacity: 1, y: reduceMotion ? 0 : offset },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { ...HERO_SPRING, delay },
  });

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <header className="relative z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <BrandMark />
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#how-it-works" className="rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">How it works</Link>
            <Link href="#security" className="rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Security</Link>
            <button type="button" onClick={() => setWalletAccessOpen(true)} className="min-h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              {walletCount > 0 ? `My workspaces (${walletCount})` : "Access wallet"}
            </button>
          </div>
          <Button type="button" size="lg" className="h-11 rounded-full px-5 shadow-sm" onClick={() => setRolePickerOpen(true)}>
            Get started <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      </header>

      <main>
        <section className="relative isolate px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute left-[-12rem] top-[-8rem] size-[32rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-[-10rem] top-[8rem] size-[28rem] rounded-full bg-brand-lime/30 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
            <motion.div {...entrance(TIMING.hero, 12)}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" /> Built for private global work
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-balance sm:text-6xl lg:text-7xl">
                Payroll that moves at the speed of your team.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Hire, invoice and pay contractors with confidential Canton transactions—without giving up control of your keys.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button type="button" size="lg" className="h-13 rounded-full px-6 text-base" onClick={() => setRolePickerOpen(true)}>
                  Start your workspace <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <Button type="button" size="lg" variant="outline" className="h-13 rounded-full bg-card px-6 text-base" onClick={() => setWalletAccessOpen(true)}>
                  <KeyRound className="size-4" aria-hidden="true" /> Access existing wallet
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["No gas step", "Browser-held keys", "Role-based workspaces"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4 text-primary" aria-hidden="true" />{item}</span>
                ))}
              </div>
            </motion.div>

            <motion.div {...entrance(TIMING.product, 20)}>
              <ProductPreview />
            </motion.div>
          </div>

          <motion.div {...entrance(TIMING.trust, 8)} className="mx-auto mt-20 grid max-w-7xl grid-cols-2 gap-4 border-t border-border pt-8 text-muted-foreground sm:grid-cols-4">
            {[
              [Globe2, "Global-ready"],
              [LockKeyhole, "Confidential"],
              [FileCheck2, "Auditable"],
              [Building2, "Built on Canton"],
            ].map(([Icon, label]) => {
              const TrustIcon = Icon as typeof Globe2;
              return <div key={label as string} className="flex items-center justify-center gap-2 text-sm font-medium"><TrustIcon className="size-4" aria-hidden="true" />{label as string}</div>;
            })}
          </motion.div>
        </section>

        <section id="how-it-works" className="bg-foreground px-4 py-20 text-background sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-lime">One platform, three perspectives</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.055em] text-balance sm:text-5xl">Everyone sees exactly what they need.</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["01", "Company", "Build your contractor network, approve work and control every payout."],
                  ["02", "Contractor", "Sign agreements, invoice with clarity and follow every payment."],
                  ["03", "Auditor", "Review designated records through a dedicated read-only workspace."],
                ].map(([number, title, text]) => (
                  <div key={title} className="rounded-3xl border border-background/15 bg-background/[0.06] p-5">
                    <p className="text-xs font-semibold text-brand-lime">{number}</p><h3 className="mt-8 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-background/65">{text}</p>
                    <button type="button" onClick={() => setRolePickerOpen(true)} className="mt-6 inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-semibold text-background focus-visible:ring-2 focus-visible:ring-brand-lime">Get started <ChevronRight className="size-4" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Built to feel effortless</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-balance sm:text-5xl">Serious infrastructure. Refreshingly simple.</h2></div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <article key={benefit.title} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{benefit.icon}</span>
                  <h3 className="mt-8 text-xl font-semibold tracking-tight">{benefit.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-10 lg:flex-row lg:items-center lg:p-14">
            <div><p className="text-sm font-semibold text-primary-foreground/70">Ready when you are</p><h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">Create your Paydae workspace in minutes.</h2></div>
            <Button type="button" size="lg" variant="secondary" className="h-13 shrink-0 rounded-full bg-background px-6 text-base text-foreground hover:bg-background/90" onClick={() => setRolePickerOpen(true)}>Get started <ArrowRight className="size-4" aria-hidden="true" /></Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><BrandMark /><p className="text-sm text-muted-foreground">Confidential contractor payroll on Canton.</p></div></footer>

      <RolePickerDialog open={rolePickerOpen} onClose={() => setRolePickerOpen(false)} />
      <AccessWalletDialog open={walletAccessOpen} onClose={() => setWalletAccessOpen(false)} />
    </div>
  );
}
