"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Download, KeyRound } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchState, setProfile } from "@/store/paydaeSlice";
import { downloadKeyFile, type StoredWallet } from "@/wallet/keystore";
import { ConfirmModal } from "./ConfirmModal";
import { ErrorToast } from "./ErrorToast";
import { TxToast } from "./TxToast";

const POLL_MS = 2500;

const ROLE_BADGE: Record<StoredWallet["role"], string> = {
  company: "bg-amber-500 text-zinc-950",
  contractor: "bg-teal-500 text-zinc-950",
  auditor: "bg-sky-500 text-zinc-950",
};

export function WalletShell({
  wallet,
  children,
}: {
  wallet: StoredWallet;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((s) => s.paydae.loaded);

  useEffect(() => {
    dispatch(
      setProfile({
        fingerprint: wallet.fingerprint,
        partyId: wallet.partyId,
        role: wallet.role,
        displayName: wallet.displayName,
      }),
    );
    dispatch(fetchState(wallet.partyId));
    const timer = setInterval(() => dispatch(fetchState(wallet.partyId)), POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, wallet]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-6">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-2xl font-extrabold tracking-tight">
          Paydae
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            private payroll on Canton
          </span>
        </Link>
        <div className="flex items-center gap-2.5">
          <button
            title="Download the key file — the only way to restore this wallet elsewhere"
            className="cursor-pointer rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            onClick={() => downloadKeyFile(wallet)}
          >
            <Download className="size-4" />
          </button>
          <div
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-base font-extrabold tracking-wide ${ROLE_BADGE[wallet.role]}`}
          >
            <KeyRound className="size-4" />
            {wallet.displayName.toUpperCase()}
            <span className="font-mono text-[11px] font-medium opacity-70">
              {wallet.partyId.split("::")[1]?.slice(0, 10)}…
            </span>
          </div>
        </div>
      </header>
      {loaded ? (
        children
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading ledger state…
        </p>
      )}
      <ConfirmModal wallet={wallet} />
      <ErrorToast />
      <TxToast />
    </div>
  );
}
