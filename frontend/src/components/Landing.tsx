"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, HardHat, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/types";
import { forgetWallet, listWallets, type StoredWallet } from "@/wallet/keystore";
import { downloadKeyFile } from "@/wallet/keystore";
import {
  createWallet,
  importWallet,
  inspectKeyFile,
  type LoadedProfile,
} from "@/wallet/onboarding";
import type { parseKeyFile } from "@/wallet/keystore";

const ROLE_META: Record<Role, { badge: string; label: string }> = {
  company: { badge: "bg-amber-500 text-zinc-950", label: "COMPANY" },
  contractor: { badge: "bg-teal-500 text-zinc-950", label: "CONTRACTOR" },
};

function CreateCard({ role }: { role: Role }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("50000");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCompany = role === "company";

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setStep("Generating your key in this browser…");
      // small delay so the step is visible before the network round-trips
      await new Promise((r) => setTimeout(r, 300));
      setStep(isCompany ? "Onboarding party + creating treasury on Canton…" : "Onboarding party on Canton…");
      const wallet = await createWallet(role, name.trim(), {
        treasuryBalance: Number(balance) || 50000,
      });
      setStep("Downloading your key file — it is the ONLY copy…");
      downloadKeyFile(wallet);
      router.push(`/w/${wallet.fingerprint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <Card className="w-80">
      <CardContent className="space-y-3 pt-1">
        <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-extrabold ${ROLE_META[role].badge}`}>
          {isCompany ? <Building2 className="size-4" /> : <HardHat className="size-4" />}
          Create {isCompany ? "Company" : "Contractor"}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {isCompany
            ? "A new Canton party with its own key — hires contractors, approves invoices, runs payday."
            : "A new Canton party with its own key — countersigns agreements and submits invoices."}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor={`create-${role}-name`}>Name</Label>
          <Input
            id={`create-${role}-name`}
            placeholder={isCompany ? "AcmeCo" : "Jane"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
        {isCompany && (
          <div className="space-y-1.5">
            <Label htmlFor="create-balance">Treasury opening balance (USD)</Label>
            <Input
              id="create-balance"
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              disabled={busy}
            />
          </div>
        )}
        <Button
          className="w-full"
          disabled={busy || !name.trim().replace(/[^A-Za-z0-9_-]/g, "")}
          onClick={() => void create()}
        >
          {busy ? "Creating…" : "Create wallet"}
        </Button>
        {step && busy && <p className="text-xs text-muted-foreground">{step}</p>}
        {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        <p className="text-[11px] leading-snug text-muted-foreground">
          The key is generated in your browser and downloaded as a file. Keep it — it is the only
          way to load this wallet again.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadCard() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{
    file: ReturnType<typeof parseKeyFile>;
    profile: LoadedProfile;
  } | null>(null);

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

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void file.text().then(inspect);
  };

  const load = () => {
    if (!found) return;
    const wallet = importWallet(found.file, found.profile);
    router.push(`/w/${wallet.fingerprint}`);
  };

  const isCompany = found?.profile.role === "company";

  return (
    <Card className="w-80">
      <CardContent className="space-y-3 pt-1">
        <div className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-extrabold text-zinc-950">
          <KeyRound className="size-4" />
          Load Wallet
        </div>
        <p className="text-[13px] text-muted-foreground">
          Already have a Paydae key file? Import it to reconnect to your party — on any machine.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? "Checking key…" : "Choose key file…"}
        </Button>
        <textarea
          placeholder="…or paste the key file contents here"
          rows={2}
          disabled={busy}
          className="border-input w-full rounded-md border bg-transparent px-3 py-2 font-mono text-[11px] shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          onChange={(e) => {
            const text = e.target.value.trim();
            if (text.startsWith("{") && text.endsWith("}")) void inspect(text);
          }}
        />
        {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        {found && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm">
              {isCompany ? (
                <>
                  This is a <span className="font-bold text-amber-400">company</span> profile:{" "}
                  <span className="font-semibold">{found.profile.displayName}</span>
                </>
              ) : (
                <>
                  This is a <span className="font-bold text-teal-400">contractor</span> profile:{" "}
                  <span className="font-semibold">{found.profile.displayName}</span>
                </>
              )}
            </p>
            <Button className="w-full" onClick={load}>
              Load {isCompany ? "Company" : "Contractor"} Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceWallets() {
  const router = useRouter();
  const [wallets, setWallets] = useState<StoredWallet[] | null>(null);

  useEffect(() => {
    setWallets(listWallets());
  }, []);

  if (!wallets?.length) return null;

  return (
    <div className="w-full max-w-3xl px-4">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
        Wallets on this device
      </p>
      <div className="flex flex-wrap gap-2.5">
        {wallets.map((w) => (
          <div
            key={w.fingerprint}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
          >
            <button
              className="cursor-pointer text-left"
              onClick={() => router.push(`/w/${w.fingerprint}`)}
            >
              <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${ROLE_META[w.role].badge}`}>
                {ROLE_META[w.role].label}
              </span>
              <span className="text-sm font-bold">{w.displayName}</span>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {w.partyId.slice(0, 18)}…
              </span>
            </button>
            <button
              title="Forget on this device (the key file still works)"
              className="cursor-pointer text-muted-foreground hover:text-red-400"
              onClick={() => {
                forgetWallet(w.fingerprint);
                setWallets(listWallets());
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center gap-5 pt-[8vh]">
      <h1 className="text-5xl font-extrabold tracking-tight">Paydae</h1>
      <p className="text-muted-foreground">
        Confidential contractor payroll on Canton — your key, your signature, your party.
      </p>
      <p className="mb-2 max-w-xl px-4 text-center text-[13px] text-muted-foreground">
        No gas, no funding step: Canton has no per-transaction fee for users. Create a wallet and
        transact immediately — every action is signed in your browser with a key only you hold.
      </p>
      <div className="flex flex-wrap justify-center gap-4 px-4">
        <CreateCard role="company" />
        <CreateCard role="contractor" />
        <LoadCard />
      </div>
      <DeviceWallets />
    </main>
  );
}
