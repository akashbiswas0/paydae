"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { performAction } from "@/store/paydaeSlice";
import { formatMoney, formatRate, partyName, type Persona } from "@/lib/types";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { SectionCard } from "./SectionCard";

const CONTRACTOR_ITEMS: Record<string, string> = { alice: "Alice", bob: "Bob" };

export function CompanyView() {
  const dispatch = useAppDispatch();
  const data = useAppSelector((s) => s.paydae.data);
  const busy = useAppSelector((s) => s.paydae.busy);

  const [balance, setBalance] = useState("50000");
  const [contractor, setContractor] = useState<Persona>("alice");
  const [role, setRole] = useState("");
  const [rate, setRate] = useState("");

  if (!data) return null;
  const treasury = data.treasury ?? null;
  const paydayTotal = data.approvedInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount ?? 0),
    0,
  );

  const act = (action: Parameters<typeof performAction>[0]["action"], payload?: Record<string, unknown>) =>
    dispatch(performAction({ persona: "company", action, payload }));

  return (
    <>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-1">
            {treasury ? (
              <>
                <div className="text-4xl font-extrabold tracking-tight tabular-nums">
                  ${formatMoney(treasury.balance)}
                  <span className="ml-1.5 text-base font-semibold text-muted-foreground">
                    {treasury.currency}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">Company treasury</p>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No treasury yet.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="tre-balance">Opening balance (USD)</Label>
                  <Input
                    id="tre-balance"
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
                <Button
                  disabled={busy}
                  onClick={() => act("bootstrapTreasury", { balance: Number(balance) })}
                >
                  Bootstrap treasury
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-1">
            <p className="text-[13px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
              Send offer
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="offer-contractor">Contractor</Label>
              <select
                id="offer-contractor"
                value={contractor}
                onChange={(e) => setContractor(e.target.value as Persona)}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
              >
                {Object.entries(CONTRACTOR_ITEMS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-role">Role</Label>
              <Input
                id="offer-role"
                placeholder="Designer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-rate">Hourly rate (USD)</Label>
              <Input
                id="offer-rate"
                type="number"
                placeholder="70"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <Button
              disabled={busy || !role.trim() || !Number(rate)}
              onClick={() =>
                act("propose", { contractor, role: role.trim(), rate: Number(rate) }).then(() => {
                  setRole("");
                  setRate("");
                })
              }
            >
              Send offer
            </Button>
          </CardContent>
        </Card>
      </div>

      <SectionCard title="Open offers">
        {data.proposals.length ? (
          data.proposals.map((p) => (
            <ItemRow
              key={p.contractId}
              title={`${partyName(p.contractor)} · ${p.role}`}
              subtitle={`$${formatRate(p.hourlyRate)}/h ${p.currency} · awaiting countersign`}
              right={<StatusChip status="offered" />}
            />
          ))
        ) : (
          <EmptyNote>No open offers.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="Agreements">
        {data.agreements.length ? (
          data.agreements.map((a) => (
            <ItemRow
              key={a.contractId}
              title={`${partyName(a.contractor)} · ${a.role}`}
              subtitle={`$${formatRate(a.hourlyRate)}/h ${a.currency}`}
              right={<StatusChip status="active" />}
            />
          ))
        ) : (
          <EmptyNote>No active agreements.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="Pending invoices">
        {data.invoices.length ? (
          data.invoices.map((inv) => (
            <ItemRow
              key={inv.contractId}
              title={`${partyName(inv.contractor)} — $${formatMoney(inv.amount)}`}
              subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
              right={
                <Button
                  size="sm"
                  className="bg-blue-500 text-zinc-950 hover:bg-blue-400"
                  disabled={busy}
                  onClick={() => act("approve", { cid: inv.contractId })}
                >
                  Approve
                </Button>
              }
            />
          ))
        ) : (
          <EmptyNote>No pending invoices.</EmptyNote>
        )}
      </SectionCard>

      <SectionCard title="Approved — ready for payday">
        {data.approvedInvoices.length ? (
          data.approvedInvoices.map((inv) => (
            <ItemRow
              key={inv.contractId}
              title={`${partyName(inv.contractor)} — $${formatMoney(inv.amount)}`}
              subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
              right={<StatusChip status="approved" />}
            />
          ))
        ) : (
          <EmptyNote>Nothing approved yet.</EmptyNote>
        )}
        <Button
          className="mt-3 w-full bg-gradient-to-r from-amber-500 to-amber-400 py-6 text-lg font-extrabold tracking-wide text-zinc-950 hover:from-amber-400 hover:to-amber-300"
          disabled={busy || !data.approvedInvoices.length || !treasury}
          onClick={() => act("payAll")}
        >
          <Zap className="size-5" strokeWidth={2.5} />
          RUN PAYDAY{paydayTotal ? ` — $${formatMoney(paydayTotal)}` : ""}
        </Button>
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          One atomic Canton transaction: every approved invoice paid, treasury debited — or
          nothing.
        </p>
      </SectionCard>

      <SectionCard title="Payments history">
        {data.payments.length ? (
          data.payments.map((p) => (
            <ItemRow
              key={p.contractId}
              title={`${partyName(p.contractor)} — $${formatMoney(p.amount)}`}
              subtitle={p.memo}
              right={<StatusChip status="paid" label="paid ✓" />}
            />
          ))
        ) : (
          <EmptyNote>No payments yet.</EmptyNote>
        )}
      </SectionCard>
    </>
  );
}
