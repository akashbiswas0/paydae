"use client";

// Transaction receipt — Paydae's stand-in for a block explorer page. Canton has
// no public explorer because a transaction is only ever delivered to its
// stakeholders' nodes; this page fetches the update from the ledger AS the
// current wallet's party, which works precisely because that party signed or
// observed it. Anyone else asking for the same update id gets "not found".

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, FilePlus2, FileX2, ShieldCheck } from "lucide-react";
import { getWallet, type StoredWallet } from "@/wallet/keystore";
import { nameOf } from "@/lib/types";

interface ReceiptEvent {
  kind: "created" | "archived";
  entity: string;
  contractId: string;
  fields?: Record<string, unknown>;
}

interface Receipt {
  updateId: string;
  effectiveAt: string;
  events: ReceiptEvent[];
  partyNames: Record<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  company: "Company",
  contractor: "Contractor",
  role: "Role",
  hourlyRate: "Hourly rate",
  currency: "Currency",
  amount: "Amount",
  hours: "Hours",
  memo: "Memo",
  balance: "Balance",
};

function FieldValue({ name, value, partyNames }: { name: string; value: unknown; partyNames: Record<string, string> }) {
  const raw = String(value);
  if (raw.includes("::")) {
    return (
      <span>
        {nameOf(raw, partyNames)}{" "}
        <span className="font-mono text-[10px] text-muted-foreground">{raw.slice(0, 20)}…</span>
      </span>
    );
  }
  if (["hourlyRate", "amount", "balance"].includes(name)) {
    return <span>${Number(raw).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  }
  return <span>{raw}</span>;
}

export default function TxReceiptPage({
  params,
}: {
  params: Promise<{ fingerprint: string; updateId: string }>;
}) {
  const { fingerprint, updateId } = use(params);
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const w = getWallet(fingerprint);
    setWallet(w);
    if (!w) {
      setError("No wallet with this fingerprint on this device.");
      return;
    }
    fetch(`/api/update/${encodeURIComponent(updateId)}?party=${encodeURIComponent(w.partyId)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const body = (await r.json()) as Receipt & { error?: string };
        if (!r.ok || body.error) throw new Error(body.error ?? `HTTP ${r.status}`);
        setReceipt(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [fingerprint, updateId]);

  const copy = () => {
    void navigator.clipboard.writeText(updateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6">
      <header className="mb-7 flex items-center justify-between">
        <Link href="/" className="text-2xl font-extrabold tracking-tight">
          Paydae
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            private payroll on Canton
          </span>
        </Link>
        {wallet && (
          <Link
            href={`/w/${fingerprint}`}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {wallet.displayName}
          </Link>
        )}
      </header>

      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald-400" />
        Transaction receipt
      </div>
      <button
        onClick={copy}
        title="Copy full transaction id"
        className="group flex cursor-pointer items-center gap-2 text-left"
      >
        <span className="break-all font-mono text-lg font-bold tracking-tight">
          {updateId}
        </span>
        {copied ? (
          <Check className="size-4 shrink-0 text-emerald-400" />
        ) : (
          <Copy className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        )}
      </button>

      {error && (
        <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {receipt && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Committed {new Date(receipt.effectiveAt).toLocaleString()} · viewed as{" "}
            <span className="font-semibold">{wallet?.displayName}</span>
          </p>

          <div className="mt-6 space-y-3">
            {receipt.events.map((ev) => (
              <div key={`${ev.kind}-${ev.contractId}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  {ev.kind === "created" ? (
                    <FilePlus2 className="size-4 text-emerald-400" />
                  ) : (
                    <FileX2 className="size-4 text-amber-500" />
                  )}
                  <span className="font-bold">
                    {ev.kind === "created" ? "Created" : "Archived"} {ev.entity}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                  {ev.contractId}
                </p>
                {ev.fields && (
                  <dl className="mt-3 space-y-1 border-t border-border pt-3">
                    {Object.entries(ev.fields).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{FIELD_LABELS[k] ?? k}</dt>
                        <dd className="text-right font-semibold">
                          <FieldValue name={k} value={v} partyNames={receipt.partyNames} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
            There is no public explorer for this page to link to — Canton delivers a transaction
            only to its stakeholders&apos; nodes. This receipt exists because{" "}
            <span className="font-semibold">{wallet?.displayName}</span> is a stakeholder; anyone
            else querying this id gets &ldquo;not found&rdquo;.
          </p>
        </>
      )}
    </div>
  );
}
