"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearUpdateId } from "@/store/paydaeSlice";

/**
 * Shows the Canton transaction id (updateId) returned by the last committed
 * action. There is no public explorer page for it — Canton only distributes a
 * transaction to its stakeholders' nodes — so the id itself is the proof, and
 * any stakeholder can verify it against the Ledger API.
 */
export function TxToast() {
  const updateId = useAppSelector((s) => s.paydae.lastUpdateId);
  const dispatch = useAppDispatch();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copied = copiedId !== null && copiedId === updateId;

  useEffect(() => {
    if (!updateId) return;
    const timer = setTimeout(() => dispatch(clearUpdateId()), 8000);
    return () => clearTimeout(timer);
  }, [updateId, dispatch]);

  if (!updateId) return null;

  const copy = () => {
    void navigator.clipboard.writeText(updateId);
    setCopiedId(updateId);
  };

  return (
    <button
      onClick={copy}
      title="Copy transaction id"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-200 shadow-lg"
    >
      <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
      <span className="font-semibold">Committed on Canton</span>
      <span className="font-mono text-xs text-emerald-300/80">
        tx {updateId.slice(0, 10)}…{updateId.slice(-6)}
      </span>
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-70" />
      )}
    </button>
  );
}
