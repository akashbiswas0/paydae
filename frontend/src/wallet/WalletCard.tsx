"use client";

import { useEffect } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { Persona } from "@/lib/types";
import { WALLET_MODE } from "./config";
import { clearWalletError, connectWallet, fetchCcBalance, fetchWalletState } from "./walletSlice";

const POLL_MS = 2500;

/**
 * Contractor wallet panel: connect button while disconnected, connected party
 * identity (hint + key-namespace fingerprint) once a wallet session is active.
 * Also owns the wallet-party state polling so nothing outside src/wallet/ does.
 */
export function WalletCard({ persona }: { persona: Persona }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.wallet.status);
  const account = useAppSelector((s) => s.wallet.account);
  const error = useAppSelector((s) => s.wallet.error);
  const cc = useAppSelector((s) => s.wallet.ccBalance);

  useEffect(() => {
    if (status !== "connected") return;
    const poll = () => {
      dispatch(fetchWalletState(persona));
      dispatch(fetchCcBalance());
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, persona, status]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => dispatch(clearWalletError()), 6000);
    return () => clearTimeout(timer);
  }, [error, dispatch]);

  if (!WALLET_MODE) return null;

  return (
    <Card className="mb-4 border-teal-800/60 bg-teal-950/20">
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15">
            <Wallet className="size-4.5 text-teal-400" />
          </span>
          {status === "connected" && account ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-bold">
                {account.label}
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground" title={account.party}>
                {account.party.slice(0, 24)}…{account.namespace.slice(-8)}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[15px] font-bold">Canton wallet</div>
              <div className="text-[13px] text-muted-foreground">
                Connect your Wallet Gateway — review &amp; sign every transaction yourself
              </div>
            </div>
          )}
        </div>
        {status === "connected" ? (
          <div className="flex shrink-0 items-center gap-2">
            {cc !== null ? (
              <span
                className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400"
                title="Real Canton Coin (Amulet) held by this wallet on devnet"
              >
                {cc.toLocaleString("en-US", { maximumFractionDigits: 2 })} CC
              </span>
            ) : null}
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              wallet-signed
            </span>
          </div>
        ) : (
          <Button
            size="sm"
            className="shrink-0 bg-teal-500 text-zinc-950 hover:bg-teal-400"
            disabled={status === "connecting"}
            onClick={() => dispatch(connectWallet(persona))}
          >
            {status === "connecting" ? "Connecting…" : "Connect wallet"}
          </Button>
        )}
      </CardContent>
      {error ? (
        <CardContent className="pt-0 text-[13px] font-medium text-red-400">{error}</CardContent>
      ) : null}
    </Card>
  );
}
