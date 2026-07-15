"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearUpdateId } from "@/store/paydaeSlice";

/**
 * Shows the Canton transaction id (updateId) returned by the last committed
 * action. Clicking it opens the in-app transaction receipt — there is no
 * public explorer to link to, because Canton only distributes a transaction
 * to its stakeholders' nodes; the receipt works because this wallet is one.
 */
export function TxToast() {
  const updateId = useAppSelector((s) => s.paydae.lastUpdateId);
  const profile = useAppSelector((s) => s.paydae.profile);
  const dispatch = useAppDispatch();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copied = copiedId !== null && copiedId === updateId;

  useEffect(() => {
    if (!updateId) return;
    const timer = setTimeout(() => dispatch(clearUpdateId()), 12000);
    return () => clearTimeout(timer);
  }, [updateId, dispatch]);

  if (!updateId || !profile) return null;

  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(updateId);
    setCopiedId(updateId);
  };

  return (
    <Link
      href={`/w/${profile.fingerprint}/tx/${updateId}`}
      onClick={() => dispatch(clearUpdateId())}
      title="View transaction receipt"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-200 shadow-lg hover:border-emerald-500"
    >
      <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
      <span className="font-semibold">Committed on Canton</span>
      <span className="font-mono text-xs text-emerald-300/80 underline decoration-emerald-600 underline-offset-2">
        tx {updateId.slice(0, 10)}…{updateId.slice(-6)}
      </span>
      <span
        role="button"
        title="Copy transaction id"
        onClick={copy}
        className="cursor-pointer"
      >
        {copied ? (
          <Check className="size-3.5 shrink-0" />
        ) : (
          <Copy className="size-3.5 shrink-0 opacity-70" />
        )}
      </span>
    </Link>
  );
}
