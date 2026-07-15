"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { prepareTx } from "@/store/paydaeSlice";
import { formatMoney, formatRate, nameOf, type ActionName } from "@/lib/types";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { SectionCard } from "./SectionCard";

export function ContractorView() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.paydae.profile);
  const data = useAppSelector((s) => s.paydae.data);
  const busy = useAppSelector((s) => s.paydae.busy);
  const pending = useAppSelector((s) => s.paydae.pending);

  const [hours, setHours] = useState("");
  const [memo, setMemo] = useState("");

  if (!data || !profile) return null;
  const agreement = data.agreements[0];
  const computed = agreement ? Number(hours) * Number(agreement.hourlyRate ?? 0) : 0;
  const locked = busy || pending !== null;
  const invoices = [
    ...data.invoices.map((inv) => ({ ...inv, status: "pending" as const })),
    ...data.approvedInvoices.map((inv) => ({ ...inv, status: "approved" as const })),
  ];

  const act = (action: ActionName, payload?: Record<string, unknown>) =>
    dispatch(prepareTx({ party: profile.partyId, action, payload }));

  return (
    <>
      <SectionCard title="Offers">
        {data.proposals.length ? (
          data.proposals.map((offer) => (
            <ItemRow
              key={offer.contractId}
              title={`${offer.role} · $${formatRate(offer.hourlyRate)}/h ${offer.currency}`}
              subtitle={`Offer from ${nameOf(offer.company, data.partyNames)}`}
              right={
                <Button
                  size="sm"
                  className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  disabled={locked}
                  onClick={() =>
                    act("countersign", {
                      cid: offer.contractId,
                      role: offer.role,
                      rate: offer.hourlyRate,
                      companyName: nameOf(offer.company, data.partyNames),
                    })
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
              subtitle={`Active agreement with ${nameOf(agreement.company, data.partyNames)}`}
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
                disabled={locked || !Number(hours)}
                onClick={() =>
                  act("submitInvoice", {
                    agreementCid: agreement.contractId,
                    hours: Number(hours),
                    memo: memo.trim(),
                    rate: agreement.hourlyRate,
                  }).then(() => {
                    setHours("");
                    setMemo("");
                  })
                }
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
