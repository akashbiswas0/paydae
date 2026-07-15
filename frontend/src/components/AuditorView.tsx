"use client";

import { ShieldCheck } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatMoney, formatRate, nameOf, type ContractView } from "@/lib/types";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { SectionCard } from "./SectionCard";

// Read-only: everything shown here is exactly what Canton delivered to the
// auditor party — companies that designated this auditor, and nothing else.
// There are no actions; an auditor never signs anything after onboarding.

function byCompany(lists: ContractView[][]): string[] {
  const companies = new Set<string>();
  for (const list of lists) {
    for (const c of list) if (typeof c.company === "string") companies.add(c.company);
  }
  return [...companies].sort();
}

const forCompany = (list: ContractView[], company: string) =>
  list.filter((c) => c.company === company);

export function AuditorView() {
  const data = useAppSelector((s) => s.paydae.data);
  if (!data) return null;

  const treasuries = data.treasuries ?? [];
  const companies = byCompany([
    treasuries,
    data.proposals,
    data.agreements,
    data.invoices,
    data.approvedInvoices,
    data.payments,
  ]);

  if (!companies.length) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
        <ShieldCheck className="mx-auto mb-3 size-8 text-sky-400" />
        <p className="text-lg font-bold">No companies have designated you yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          When a company designates you as its auditor, its treasury and every agreement,
          invoice and payment it creates will appear here automatically — delivered by the
          ledger itself, not by the app.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-sky-400" />
        Read-only audit view — Canton delivers only the contracts you are a stakeholder of.
      </p>
      {companies.map((company) => {
        const treasury = treasuries.find((t) => t.company === company);
        const agreements = forCompany(data.agreements, company);
        const invoices = forCompany(data.invoices, company);
        const approved = forCompany(data.approvedInvoices, company);
        const payments = forCompany(data.payments, company);
        return (
          <SectionCard
            key={company}
            title={
              <span className="flex flex-wrap items-baseline gap-x-3">
                {nameOf(company, data.partyNames)}
                {treasury && (
                  <span className="text-sm font-semibold text-muted-foreground">
                    treasury ${formatMoney(treasury.balance)} {treasury.currency}
                  </span>
                )}
              </span>
            }
          >
            {agreements.map((a) => (
              <ItemRow
                key={a.contractId}
                title={`${nameOf(a.contractor, data.partyNames)} · ${a.role}`}
                subtitle={`agreement · $${formatRate(a.hourlyRate)}/h ${a.currency}`}
                right={<StatusChip status="active" />}
              />
            ))}
            {invoices.map((inv) => (
              <ItemRow
                key={inv.contractId}
                title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                subtitle={`invoice · ${formatRate(inv.hours)}h · ${inv.memo}`}
                right={<StatusChip status="pending" />}
              />
            ))}
            {approved.map((inv) => (
              <ItemRow
                key={inv.contractId}
                title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                subtitle={`approved invoice · ${formatRate(inv.hours)}h · ${inv.memo}`}
                right={<StatusChip status="approved" />}
              />
            ))}
            {payments.map((p) => (
              <ItemRow
                key={p.contractId}
                title={`${nameOf(p.contractor, data.partyNames)} — $${formatMoney(p.amount)}`}
                subtitle={`payment · ${p.memo}`}
                right={<StatusChip status="paid" label="paid ✓" />}
              />
            ))}
            {!agreements.length && !invoices.length && !approved.length && !payments.length && (
              <EmptyNote>Designated — no activity on the books yet.</EmptyNote>
            )}
          </SectionCard>
        );
      })}
    </>
  );
}
