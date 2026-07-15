"use client";

// The wallet confirmation dialog — Paydae's equivalent of MetaMask's confirm
// popup. The backend prepared the exact Canton transaction; this modal shows
// its human-readable summary and hash. Approve signs the hash with the ed25519
// key held in this browser's keystore and submits the signature; Reject
// discards it — nothing is ever written to the ledger without this signature.

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { executeTx, rejectPending } from "@/store/paydaeSlice";
import { signHash, type StoredWallet } from "@/wallet/keystore";

export function ConfirmModal({ wallet }: { wallet: StoredWallet }) {
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.paydae.pending);
  const busy = useAppSelector((s) => s.paydae.busy);

  if (!pending) return null;

  const approve = () => {
    const signature = signHash(wallet.privateKey, pending.preparedTransactionHash);
    void dispatch(
      executeTx({
        party: wallet.partyId,
        preparedTransaction: pending.preparedTransaction,
        signature,
      }),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-400" />
          Wallet signature request
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">{pending.summary.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pending.summary.description}</p>

        {pending.summary.fields.length > 0 && (
          <dl className="mt-4 space-y-1.5 rounded-lg border border-border p-3">
            {pending.summary.fields.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
          <p>
            Signing as <span className="font-semibold">{wallet.displayName}</span>{" "}
            <span className="font-mono">{wallet.partyId.slice(0, 24)}…</span>
          </p>
          <p className="font-mono">
            tx hash {pending.preparedTransactionHash.slice(0, 20)}…
          </p>
          <p>
            Your key signs this exact prepared transaction — not a blank instruction. Reject and
            nothing is submitted.
          </p>
        </div>

        <div className="mt-5 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => dispatch(rejectPending())}
          >
            Reject
          </Button>
          <Button
            className="flex-1 bg-emerald-500 font-bold text-zinc-950 hover:bg-emerald-400"
            disabled={busy}
            onClick={approve}
          >
            {busy ? "Submitting…" : "Approve & sign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
