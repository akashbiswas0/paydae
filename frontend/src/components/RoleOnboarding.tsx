"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  HardHat,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AccessWalletDialog } from "@/components/AccessWalletDialog";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/types";
import { createWallet } from "@/wallet/onboarding";

/* ─────────────────────────────────────────────────────────
 * ONBOARDING PAGE STORYBOARD
 *
 * Static nav and form controls are usable immediately.
 *    0ms   shell visible
 *   80ms   context panel settles in from the left
 *  150ms   creation form settles in from below
 * ───────────────────────────────────────────────────────── */

const TIMING = { context: 0.08, form: 0.15 };
const SECTION_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

const ROLE_CONTENT: Record<
  Role,
  {
    eyebrow: string;
    heading: string;
    description: string;
    nameLabel: string;
    placeholder: string;
    icon: React.ReactNode;
    iconClass: string;
    benefits: string[];
  }
> = {
  company: {
    eyebrow: "Company workspace",
    heading: "Run contractor payroll with confidence.",
    description: "Create a secure company party to hire contractors, approve invoices and run payday from one focused workspace.",
    nameLabel: "Company name",
    placeholder: "Acme Inc.",
    icon: <Building2 className="size-5" aria-hidden="true" />,
    iconClass: "bg-primary/10 text-primary",
    benefits: ["Create and manage agreements", "Approve invoices before payment", "Control treasury and payday"],
  },
  contractor: {
    eyebrow: "Contractor workspace",
    heading: "Make every hour and invoice count.",
    description: "Create your contractor party to countersign agreements, submit invoices and follow payments in one clear workspace.",
    nameLabel: "Your name",
    placeholder: "Jane Smith",
    icon: <HardHat className="size-5" aria-hidden="true" />,
    iconClass: "bg-brand-mint text-emerald-900",
    benefits: ["Review and sign agreements", "Submit invoices with clarity", "Track approved work and payments"],
  },
  auditor: {
    eyebrow: "Auditor workspace",
    heading: "Clear oversight, without operational access.",
    description: "Create a read-only auditor party to review the full books of companies that explicitly designate you.",
    nameLabel: "Auditor or firm name",
    placeholder: "Ava Audit",
    icon: <ShieldCheck className="size-5" aria-hidden="true" />,
    iconClass: "bg-brand-sky text-sky-900",
    benefits: ["Read-only access by design", "Review designated company records", "Maintain an independent perspective"],
  },
};

export function RoleOnboarding({ role }: { role: Role }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const content = ROLE_CONTENT[role];
  const isCompany = role === "company";
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("5000000");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAccessOpen, setWalletAccessOpen] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setStep("Generating your key securely in this browser…");
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStep(isCompany ? "Creating your Canton party and treasury…" : "Creating your Canton party…");
      const wallet = await createWallet(role, name.trim(), {
        treasuryBalance: Number(balance) || 5000000,
      });
      router.push(`/w/${wallet.fingerprint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStep(null);
    }
  };

  const validName = Boolean(name.trim().replace(/[^A-Za-z0-9_-]/g, ""));
  const motionProps = (delay: number, x: number, y: number) => ({
    initial: { opacity: 1, x: reduceMotion ? 0 : x, y: reduceMotion ? 0 : y },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { ...SECTION_SPRING, delay },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Onboarding navigation">
          <BrandMark />
          <button type="button" onClick={() => setWalletAccessOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <KeyRound className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Already have a wallet?</span><span className="font-semibold text-foreground">Access it</span>
          </button>
        </nav>
      </header>

      <main className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true"><div className="absolute -left-40 top-10 size-[30rem] rounded-full bg-primary/10 blur-3xl" /><div className="absolute -right-32 bottom-0 size-[24rem] rounded-full bg-brand-lime/20 blur-3xl" /></div>
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
          </Link>

          <div className="grid items-stretch gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
            <motion.section {...motionProps(TIMING.context, -16, 0)} className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-primary/15 bg-secondary/55 p-7 shadow-sm sm:p-10">
              <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 size-56 rounded-full bg-brand-lime/20 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/10 bg-card/80 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur">
                  <span className={`inline-flex size-9 items-center justify-center rounded-full ${content.iconClass}`}>{content.icon}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{content.eyebrow}</span>
                </div>
                <h1 className="mt-8 text-4xl font-semibold leading-[1.05] tracking-[-0.055em] text-balance text-foreground sm:text-5xl">{content.heading}</h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">{content.description}</p>
                <div className="mt-9 space-y-3">
                  {content.benefits.map((benefit) => (
                    <div key={benefit} className="flex min-h-12 items-center gap-3 rounded-2xl border border-primary/10 bg-card/75 px-3.5 py-2.5 backdrop-blur">
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3.5" aria-hidden="true" /></span>
                      <span className="text-sm font-semibold text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative mt-10 flex items-start gap-3 rounded-2xl bg-primary/[0.07] px-4 py-3 text-sm font-medium text-foreground">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm"><LockKeyhole className="size-4" aria-hidden="true" /></span>
                <span>Private by default on Canton — every transaction is confidential, so no one outside the deal can see yours. Your key stays in this browser.</span>
              </div>
            </motion.section>

            <motion.section {...motionProps(TIMING.form, 0, 18)} className="flex">
              <div className="flex w-full flex-col justify-center rounded-[2rem] border border-border bg-card p-6 shadow-[0_24px_70px_-40px_color-mix(in_oklch,var(--foreground)_40%,transparent)] sm:p-9">
                <div className="mb-8 flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" aria-hidden="true" /></span>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Step 1 of 1</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Create your {role} profile</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">It takes less than a minute. You’ll go straight to your dashboard when it’s ready.</p></div>
                </div>

                <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor={`${role}-name`} className="text-sm font-semibold">{content.nameLabel}</Label>
                    <Input id={`${role}-name`} name="name" type="text" autoComplete={isCompany ? "organization" : "name"} placeholder={content.placeholder} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} className="h-12 rounded-xl px-4 text-base" />
                    <p className="text-xs text-muted-foreground">This is how your name appears across Paydae.</p>
                  </div>
                  {isCompany && (
                    <div className="space-y-2">
                      <Label htmlFor="company-balance" className="text-sm font-semibold">Treasury opening balance</Label>
                      <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-muted-foreground">$</span><Input id="company-balance" name="treasuryBalance" type="number" inputMode="decimal" min="0" autoComplete="off" value={balance} onChange={(event) => setBalance(event.target.value)} disabled={busy} className="h-12 rounded-xl pl-8 pr-14 text-base" /><span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-muted-foreground">USD</span></div>
                      <p className="text-xs text-muted-foreground">Used as the starting balance for your company treasury.</p>
                    </div>
                  )}
                  {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive"><p>We couldn’t create your profile.</p><p className="mt-1 font-normal">{error} Check your details and try again.</p></div>}
                  <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={busy || !validName}>
                    {busy ? "Creating your workspace…" : `Create ${role} workspace`} {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
                  </Button>
                  {step && busy && <div role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden="true" />{step}</div>}
                </form>
              </div>
            </motion.section>
          </div>
        </div>
      </main>
      <AccessWalletDialog open={walletAccessOpen} onClose={() => setWalletAccessOpen(false)} />
    </div>
  );
}
