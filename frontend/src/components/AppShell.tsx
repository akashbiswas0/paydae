"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_META } from "@/lib/roles";
import { downloadKeyFile, type StoredWallet } from "@/wallet/keystore";
import { Avatar } from "./Primitives";
import { LogoGlyph } from "./BrandMark";

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Deel-style application shell: a persistent left sidebar (brand + role nav) and
 * a top bar (section title + wallet identity). Section switching is local state
 * owned by the role view — no routing — so this component is purely presentational.
 */
export function AppShell({
  wallet,
  nav,
  active,
  onSelect,
  title,
  children,
}: {
  wallet: StoredWallet;
  nav: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const meta = ROLE_META[wallet.role];
  const party = wallet.partyId.split("::")[1]?.slice(0, 8) ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex min-h-10 items-center gap-2 rounded-lg px-2 focus-visible:ring-2 focus-visible:ring-ring">
          <LogoGlyph className="size-8 rounded-lg" />
          <span className="text-lg font-semibold tracking-[-0.04em]">paydae</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active === item.key
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted",
              )}
            >
              <span className={cn("shrink-0", active === item.key ? "" : "text-muted-foreground")}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-border p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={wallet.displayName} chip={meta.chip} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{wallet.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{meta.label}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Paydae home" className="flex min-h-10 items-center gap-2 rounded-lg text-base font-semibold tracking-[-0.04em] focus-visible:ring-2 focus-visible:ring-ring md:hidden">
              <LogoGlyph className="size-7 rounded-lg" />
              paydae
            </Link>
            <span className="hidden text-base font-semibold tracking-tight md:inline">{title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              title="Download the key file — the only way to restore this wallet elsewhere"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => downloadKeyFile(wallet)}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Download wallet</span>
            </button>
            <div className="flex items-center gap-2.5 rounded-lg border border-border py-1 pl-1 pr-3">
              <Avatar name={wallet.displayName} chip={meta.chip} className="size-7" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold">{wallet.displayName}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {meta.label} · {party}…
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
                active === item.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
