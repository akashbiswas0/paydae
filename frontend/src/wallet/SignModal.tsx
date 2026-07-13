"use client";

import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { Persona } from "@/lib/types";
import { rejectSign, walletExercise } from "./walletSlice";

/**
 * "Review & sign" modal — opens before every wallet exercise. Shows a human
 * summary of exactly what the wallet key is about to authorize.
 */
export function SignModal({ persona }: { persona: Persona }) {
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.wallet.pendingSign);
  const signing = useAppSelector((s) => s.wallet.signing);
  const account = useAppSelector((s) => s.wallet.account);

  if (!pending || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-teal-800/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-teal-500/15">
              <PenLine className="size-4 text-teal-400" />
            </span>
            Review &amp; sign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="text-[15px] font-bold">{pending.summary}</div>
            {pending.detail ? (
              <div className="mt-1 text-sm font-semibold text-emerald-400">{pending.detail}</div>
            ) : null}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signing as
            </div>
            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {account.party}
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Your wallet key signs this exact transaction. Nothing is submitted if you reject.
          </p>
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" disabled={signing} onClick={() => dispatch(rejectSign())}>
              Reject
            </Button>
            <Button
              className="bg-teal-500 text-zinc-950 hover:bg-teal-400"
              disabled={signing}
              onClick={() => dispatch(walletExercise(persona))}
            >
              {signing ? "Signing…" : "Sign & submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
