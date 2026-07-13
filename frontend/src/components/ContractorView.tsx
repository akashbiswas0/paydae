"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { performAction } from "@/store/paydaeSlice";
import { formatMoney, formatRate, partyName, type Persona } from "@/lib/types";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { SectionCard } from "./SectionCard";
// wallet-integration: wallet mode (flag-gated) — components + routing live in src/wallet/
import { SignModal } from "@/wallet/SignModal";
import { WalletCard } from "@/wallet/WalletCard";
import { useContractorWallet } from "@/wallet/useContractorWallet";

export function ContractorView({ persona }: { persona: Persona }) {
  const dispatch = useAppDispatch();
  const custodialData = useAppSelector((s) => s.paydae.data);
  const custodialBusy = useAppSelector((s) => s.paydae.busy);

  const [hours, setHours] = useState("");
  const [memo, setMemo] = useState("");

  // wallet-integration: when a wallet is connected, read the WALLET party's state
  // and route Countersign / SubmitInvoice through the SignModal
  const wallet = useContractorWallet();
  const data = wallet.active ? wallet.data : custodialData;
  const busy = wallet.active ? wallet.busy : custodialBusy;

  if (!data) {
    // wallet-integration: keep the wallet panel reachable before first wallet poll
    return wallet.active || custodialData === null ? (
      <>
        <WalletCard persona={persona} />
        <SignModal persona={persona} />
      </>
    ) : null;
  }
  const agreement = data.agreements[0];
  const computed = agreement ? Number(hours) * Number(agreement.hourlyRate ?? 0) : 0;
  const invoices = [
    ...data.invoices.map((inv) => ({ ...inv, status: "pending" as const })),
    ...data.approvedInvoices.map((inv) => ({ ...inv, status: "approved" as const })),
  ];

  return (
    <>
      {/* wallet-integration: wallet panel + review-and-sign modal (null when flag off) */}
      <WalletCard persona={persona} />
      <SignModal persona={persona} />
      <SectionCard title="Offers">
        {data.proposals.length ? (
          data.proposals.map((offer) => (
            <ItemRow
              key={offer.contractId}
              title={`${offer.role} · $${formatRate(offer.hourlyRate)}/h ${offer.currency}`}
              subtitle={`Offer from ${partyName(offer.company)}`}
              right={
                <Button
                  size="sm"
                  className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  disabled={busy}
                  onClick={() =>
                    // wallet-integration: wallet-signed countersign (modal) when connected
                    wallet.active
                      ? wallet.requestCountersign(offer)
                      : dispatch(
                          performAction({
                            persona,
                            action: "countersign",
                            payload: { cid: offer.contractId },
                          }),
                        )
                  }
                >
                  Countersign
                </Button>
              }
            />
          ))
        ) : (
          <EmptyNote>No pending offers.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="My agreement">
        {agreement ? (
          <>
            <ItemRow
              title={`${agreement.role} · $${formatRate(agreement.hourlyRate)}/h ${agreement.currency}`}
              subtitle={`Active agreement with ${partyName(agreement.company)}`}
              right={<StatusChip status="active" />}
            />
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-hours">Hours</Label>
                <Input
                  id="inv-hours"
                  type="number"
                  placeholder="40"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-memo">Memo</Label>
                <Input
                  id="inv-memo"
                  placeholder="June design work"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
              <p className="min-h-5 text-sm font-bold text-emerald-400">
                {computed > 0 ? `= $${formatMoney(computed)} USD` : ""}
              </p>
              <Button
                disabled={busy || !Number(hours)}
                onClick={() => {
                  // wallet-integration: wallet-signed invoice (modal) when connected
                  if (wallet.active) {
                    wallet.requestSubmitInvoice(agreement, Number(hours), memo.trim());
                    return;
                  }
                  void dispatch(
                    performAction({
                      persona,
                      action: "submitInvoice",
                      payload: {
                        agreementCid: agreement.contractId,
                        hours: Number(hours),
                        memo: memo.trim(),
                      },
                    }),
                  ).then(() => {
                    setHours("");
                    setMemo("");
                  });
                }}
              >
                Submit invoice
              </Button>
            </div>
          </>
        ) : (
          <EmptyNote>No active agreement yet.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="My invoices">
        {invoices.length ? (
          invoices.map((inv) => (
            <ItemRow
              key={inv.contractId}
              title={`$${formatMoney(inv.amount)}`}
              subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
              right={<StatusChip status={inv.status} />}
            />
          ))
        ) : (
          <EmptyNote>No invoices yet.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="My payments">
        {data.payments.length ? (
          data.payments.map((p) => (
            <ItemRow
              key={p.contractId}
              title={`$${formatMoney(p.amount)}`}
              subtitle={p.memo}
              right={<StatusChip status="paid" label="Paid ✓" />}
            />
          ))
        ) : (
          <EmptyNote>No payments yet.</EmptyNote>
        )}
      </SectionCard>
    </>
  );
}
