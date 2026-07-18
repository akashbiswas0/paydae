"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileKey2, KeyRound, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_META, initials } from "@/lib/roles";
import { forgetWallet, listWallets, type StoredWallet, type parseKeyFile } from "@/wallet/keystore";
import { importWallet, inspectKeyFile, type LoadedProfile } from "@/wallet/onboarding";

const PANEL_MOTION = { type: "spring" as const, stiffness: 420, damping: 34 };

export function AccessWalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const fileInput = useRef<HTMLInputElement>(null);
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ file: ReturnType<typeof parseKeyFile>; profile: LoadedProfile } | null>(null);

  useEffect(() => {
    if (!open) return;
    const walletTimer = window.setTimeout(() => setWallets(listWallets()), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(walletTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  const inspect = async (text: string) => {
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      setFound(await inspectKeyFile(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const openWallet = (fingerprint: string) => {
    onClose();
    router.push(`/w/${fingerprint}`);
  };

  const load = () => {
    if (!found) return;
    const wallet = importWallet(found.file, found.profile);
    openWallet(wallet.fingerprint);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close wallet access"
            className="absolute inset-0 size-full cursor-default bg-foreground/55 backdrop-blur-sm"
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: reduceMotion ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }} onClick={onClose}
          />
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="wallet-access-title"
            className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl sm:p-7"
            initial={{ opacity: 1, scale: reduceMotion ? 1 : 0.97, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.97 }}
            transition={reduceMotion ? { duration: 0 } : PANEL_MOTION}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Welcome back</p>
                <h2 id="wallet-access-title" className="text-2xl font-semibold tracking-[-0.04em]">Access your workspace</h2>
                <p className="mt-2 text-sm text-muted-foreground">Continue on this device or import your Paydae key file.</p>
              </div>
              <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {wallets.length > 0 && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">On this device</p>
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {wallets.map((wallet) => {
                    const meta = ROLE_META[wallet.role];
                    return (
                      <div key={wallet.fingerprint} className="flex items-center gap-2 p-2">
                        <button type="button" onClick={() => openWallet(wallet.fingerprint)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                          <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${meta.chip}`}>{initials(wallet.displayName)}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{wallet.displayName}</span><span className="block truncate text-xs text-muted-foreground">{meta.label} workspace</span></span>
                        </button>
                        <button type="button" aria-label={`Forget ${wallet.displayName} on this device`} onClick={() => { forgetWallet(wallet.fingerprint); setWallets(listWallets()); }} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.035] p-4 sm:p-5">
              <div className="flex gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileKey2 className="size-5" aria-hidden="true" /></span>
                <div><p className="font-semibold">Import a key file</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Your key is inspected locally in this browser.</p></div>
              </div>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(inspect); }} />
              <Button type="button" variant="outline" size="lg" className="mt-4 h-11 w-full bg-card" disabled={busy} onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" aria-hidden="true" />{busy ? "Checking key…" : "Choose key file"}
              </Button>
              <label htmlFor="key-file-contents" className="mt-4 block text-xs font-semibold text-muted-foreground">Or paste key file contents</label>
              <textarea id="key-file-contents" rows={3} disabled={busy} placeholder="Paste JSON key contents here" className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => { const text = event.target.value.trim(); if (text.startsWith("{") && text.endsWith("}")) void inspect(text); }} />
              {error && <div role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</div>}
              {found && (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" aria-hidden="true" /><p className="text-sm"><span className="font-semibold">{found.profile.displayName}</span><span className="text-muted-foreground"> · {ROLE_META[found.profile.role].label}</span></p></div>
                  <Button type="button" onClick={load}>Open workspace</Button>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
