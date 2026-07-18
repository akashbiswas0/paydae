"use client";

import { useState } from "react";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatMoney, formatRate, nameOf, type ContractView } from "@/lib/types";
import { ROLE_META } from "@/lib/roles";
import { type StoredWallet } from "@/wallet/keystore";
import { AppShell, type NavItem } from "./AppShell";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { Avatar, EmptyState, PageHeader } from "./Primitives";
import { SectionCard } from "./SectionCard";

// Read-only: everything shown here is exactly what Canton delivered to the
// auditor party — companies that designated this auditor, and nothing else.
// There are no actions; an auditor never signs anything after onboarding.

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
];

function byCompany(lists: ContractView[][]): string[] {
  const companies = new Set<string>();
  for (const list of lists) {
    for (const c of list) if (typeof c.company === "string") companies.add(c.company);
  }
  return [...companies].sort();
}

const forCompany = (list: ContractView[], company: string) =>
  list.filter((c) => c.company === company);

export function AuditorView({ wallet }: { wallet: StoredWallet }) {
  const data = useAppSelector((s) => s.paydae.data);
  const [section, setSection] = useState("dashboard");

  const shell = (children: React.ReactNode) => (
    <AppShell wallet={wallet} nav={NAV} active={section} onSelect={setSection} title="Audit books">
      {children}
    </AppShell>
  );

  if (!data) {
    return shell(<p className="py-16 text-center text-sm text-muted-foreground">Loading ledger state…</p>);
  }

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
    return shell(
      <>
        <PageHeader title="Audit books" description="Read-only visibility of every company that designates you." />
        <EmptyState icon={<ShieldCheck className="size-5" />} title="No companies have designated you yet">
          When a company designates you as its auditor, its treasury and every agreement, invoice and
          payment it creates will appear here automatically — delivered by the ledger itself, not by the app.
        </EmptyState>
      </>,
    );
  }

  return shell(
    <>
      <PageHeader
        title="Audit books"
        description="Canton delivers only the contracts you are a stakeholder of. This view is entirely read-only."
      />
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
              <span className="flex items-center gap-2.5">
                <Avatar name={nameOf(company, data.partyNames)} chip={ROLE_META.company.chip} className="size-7" />
                {nameOf(company, data.partyNames)}
              </span>
            }
            action={
              treasury ? (
                <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  Treasury ${formatMoney(treasury.balance)} {treasury.currency}
                </span>
              ) : undefined
            }
          >
            {agreements.map((a) => (
              <ItemRow
                key={a.contractId}
                title={`${nameOf(a.contractor, data.partyNames)} · ${a.role}`}
                subtitle={`Agreement · $${formatRate(a.hourlyRate)}/h ${a.currency}`}
                right={<StatusChip status="active" />}
              />
            ))}
            {invoices.map((inv) => (
              <ItemRow
                key={inv.contractId}
                title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                subtitle={`Invoice · ${formatRate(inv.hours)}h · ${inv.memo}`}
                right={<StatusChip status="pending" />}
              />
            ))}
            {approved.map((inv) => (
              <ItemRow
                key={inv.contractId}
                title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                subtitle={`Approved invoice · ${formatRate(inv.hours)}h · ${inv.memo}`}
                right={<StatusChip status="approved" />}
              />
            ))}
            {payments.map((p) => (
              <ItemRow
                key={p.contractId}
                title={`${nameOf(p.contractor, data.partyNames)} — $${formatMoney(p.amount)}`}
                subtitle={`Payment · ${p.memo}`}
                right={<StatusChip status="paid" label="Paid" />}
              />
            ))}
            {!agreements.length && !invoices.length && !approved.length && !payments.length && (
              <EmptyNote>Designated — no activity on the books yet.</EmptyNote>
            )}
          </SectionCard>
        );
      })}
    </>,
  );
}
