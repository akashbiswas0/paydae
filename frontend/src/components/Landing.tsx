"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/types";
import { ROLE_META, initials } from "@/lib/roles";
import { forgetWallet, listWallets, type StoredWallet } from "@/wallet/keystore";
import {
  createWallet,
  importWallet,
  inspectKeyFile,
  type LoadedProfile,
} from "@/wallet/onboarding";
import type { parseKeyFile } from "@/wallet/keystore";

const CREATE_META: Record<Role, { title: string; blurb: string; placeholder: string }> = {
  company: {
    title: "Company",
    blurb: "A Canton party with its own key — hires contractors, approves invoices, runs payday.",
    placeholder: "AcmeCo",
  },
  contractor: {
    title: "Contractor",
    blurb: "A Canton party with its own key — countersigns agreements and submits invoices.",
    placeholder: "Jane",
  },
  auditor: {
    title: "Auditor",
    blurb: "A read-only Canton party — sees the full books of any company that designates it.",
    placeholder: "Ava Audit",
  },
};

function CreateCard({ role }: { role: Role }) {
  const router = useRouter();
  const meta = ROLE_META[role];
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
      await new Promise((r) => setTimeout(r, 300));
      setStep(isCompany ? "Onboarding party + creating treasury on Canton…" : "Onboarding party on Canton…");
      const wallet = await createWallet(role, name.trim(), {
        treasuryBalance: Number(balance) || 50000,
      });
      router.push(`/w/${wallet.fingerprint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <Card className="w-80 shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex size-9 items-center justify-center rounded-lg ${meta.chip}`}>
            {meta.icon}
          </span>
          <div>
            <p className="font-semibold leading-tight">Create {CREATE_META[role].title}</p>
            <p className="text-xs text-muted-foreground">New Canton party</p>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">{CREATE_META[role].blurb}</p>
        <div className="space-y-1.5">
          <Label htmlFor={`create-${role}-name`}>Name</Label>
          <Input
            id={`create-${role}-name`}
            placeholder={CREATE_META[role].placeholder}
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
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        <p className="text-[11px] leading-snug text-muted-foreground">
          The key is generated in your browser and stays here. Use the download button in your wallet to
          save the key file — it is the only way to load this wallet on another machine.
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

  const foundRole = found?.profile.role;

  return (
    <Card className="w-80 shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="size-4" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Load Wallet</p>
            <p className="text-xs text-muted-foreground">Import an existing key</p>
          </div>
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
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Checking key…" : "Choose key file…"}
        </Button>
        <textarea
          placeholder="…or paste the key file contents here"
          rows={2}
          disabled={busy}
          className="border-input w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-[11px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(e) => {
            const text = e.target.value.trim();
            if (text.startsWith("{") && text.endsWith("}")) void inspect(text);
          }}
        />
        {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        {found && foundRole && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm">
              This is a <span className={`font-semibold ${ROLE_META[foundRole].text}`}>{foundRole}</span> profile:{" "}
              <span className="font-semibold">{found.profile.displayName}</span>
            </p>
            <Button className="w-full" onClick={load}>
              Load {ROLE_META[foundRole].label} Profile
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
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        Wallets on this device
      </p>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {wallets.map((w) => {
          const meta = ROLE_META[w.role];
          return (
            <div key={w.fingerprint} className="flex items-center gap-3 px-4 py-3">
              <button
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                onClick={() => router.push(`/w/${w.fingerprint}`)}
              >
                <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${meta.chip}`}>
                  {initials(w.displayName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{w.displayName}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {meta.label} · {w.partyId.slice(0, 22)}…
                  </span>
                </span>
              </button>
              <button
                title="Forget on this device (the key file still works)"
                className="cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={() => {
                  forgetWallet(w.fingerprint);
                  setWallets(listWallets());
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center gap-5 px-4 pt-[7vh]">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          P
        </span>
        <span className="text-2xl font-semibold tracking-tight">Paydae</span>
      </div>
      <h1 className="max-w-2xl text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        Confidential contractor payroll on Canton
      </h1>
      <p className="max-w-xl text-center text-[15px] text-muted-foreground">
        Your key, your signature, your party. No gas, no funding step — create a wallet and transact
        immediately. Every action is signed in your browser with a key only you hold.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        <CreateCard role="company" />
        <CreateCard role="contractor" />
        <CreateCard role="auditor" />
        <LoadCard />
      </div>
      <DeviceWallets />
    </main>
  );
}
