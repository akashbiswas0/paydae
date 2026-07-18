"use client";

import { useState } from "react";
import { FileText, Inbox, LayoutDashboard, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { prepareTx } from "@/store/paydaeSlice";
import { formatMoney, formatRate, nameOf, type ActionName } from "@/lib/types";
import { ROLE_META } from "@/lib/roles";
import { type StoredWallet } from "@/wallet/keystore";
import { AppShell, type NavItem } from "./AppShell";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { Avatar, PageHeader, StatCard } from "./Primitives";
import { SectionCard } from "./SectionCard";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { key: "offers", label: "Offers", icon: <Inbox className="size-4" /> },
  { key: "agreement", label: "Agreement", icon: <FileText className="size-4" /> },
  { key: "invoices", label: "Invoices", icon: <Receipt className="size-4" /> },
  { key: "payments", label: "Payments", icon: <Wallet className="size-4" /> },
];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  offers: "Offers",
  agreement: "Agreement",
  invoices: "Invoices",
  payments: "Payments",
};

export function ContractorView({ wallet }: { wallet: StoredWallet }) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.paydae.profile);
  const data = useAppSelector((s) => s.paydae.data);
  const busy = useAppSelector((s) => s.paydae.busy);
  const pending = useAppSelector((s) => s.paydae.pending);

  const [section, setSection] = useState("dashboard");
  const [hours, setHours] = useState("");
  const [memo, setMemo] = useState("");

  const act = (action: ActionName, payload?: Record<string, unknown>) =>
    dispatch(prepareTx({ party: profile!.partyId, action, payload }));

  const shell = (children: React.ReactNode) => (
    <AppShell wallet={wallet} nav={NAV} active={section} onSelect={setSection} title={TITLES[section]}>
      {children}
    </AppShell>
  );

  if (!data || !profile) {
    return shell(<p className="py-16 text-center text-sm text-muted-foreground">Loading ledger state…</p>);
  }

  const agreement = data.agreements[0];
  const computed = agreement ? Number(hours) * Number(agreement.hourlyRate ?? 0) : 0;
  const locked = busy || pending !== null;
  const invoices = [
    ...data.invoices.map((inv) => ({ ...inv, status: "pending" as const })),
    ...data.approvedInvoices.map((inv) => ({ ...inv, status: "approved" as const })),
  ];
  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = invoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0);

  const offersCard = (
    <SectionCard title="Offers">
      {data.proposals.length ? (
        data.proposals.map((offer) => (
          <ItemRow
            key={offer.contractId}
            left={<Avatar name={nameOf(offer.company, data.partyNames)} chip={ROLE_META.company.chip} />}
            title={`${offer.role} · $${formatRate(offer.hourlyRate)}/h ${offer.currency}`}
            subtitle={`Offer from ${nameOf(offer.company, data.partyNames)}`}
            right={
              <Button
                size="sm"
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
  );

  const agreementCard = (
    <SectionCard title="My agreement">
      {agreement ? (
        <>
          <ItemRow
            left={<Avatar name={nameOf(agreement.company, data.partyNames)} chip={ROLE_META.company.chip} />}
            title={`${agreement.role} · $${formatRate(agreement.hourlyRate)}/h ${agreement.currency}`}
            subtitle={`Active agreement with ${nameOf(agreement.company, data.partyNames)}`}
            right={<StatusChip status="active" />}
          />
          <div className="grid gap-3 py-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-hours">Hours</Label>
              <Input id="inv-hours" type="number" placeholder="40" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-memo">Memo</Label>
              <Input id="inv-memo" placeholder="June design work" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4 pb-3">
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
            <span className="text-sm font-semibold text-emerald-600">
              {computed > 0 ? `= $${formatMoney(computed)} USD` : ""}
            </span>
          </div>
        </>
      ) : (
        <EmptyNote>No active agreement yet — accept an offer first.</EmptyNote>
      )}
    </SectionCard>
  );

  const renderSection = () => {
    switch (section) {
      case "dashboard":
        return (
          <>
            <PageHeader title="Dashboard" description="Your agreement, outstanding invoices and total earnings." />
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total earned"
                value={`$${formatMoney(totalPaid)}`}
                sub={`${data.payments.length} payments`}
                icon={<Wallet className="size-4" />}
                accent="bg-emerald-50 text-emerald-600"
              />
              <StatCard
                label="Outstanding"
                value={`$${formatMoney(outstanding)}`}
                sub={`${invoices.length} invoices`}
                icon={<Receipt className="size-4" />}
                accent="bg-amber-50 text-amber-600"
              />
              <StatCard
                label="Open offers"
                value={data.proposals.length}
                sub="awaiting countersign"
                icon={<Inbox className="size-4" />}
                accent="bg-indigo-50 text-indigo-600"
              />
            </div>
            {data.proposals.length > 0 && offersCard}
            {agreementCard}
          </>
        );

      case "offers":
        return (
          <>
            <PageHeader title="Offers" description="Countersign an offer to turn it into an active agreement." />
            {offersCard}
          </>
        );

      case "agreement":
        return (
          <>
            <PageHeader title="Agreement" description="Submit invoices against your active agreement." />
            {agreementCard}
          </>
        );

      case "invoices":
        return (
          <>
            <PageHeader title="Invoices" description="Invoices you have submitted and their approval status." />
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
          </>
        );

      case "payments":
        return (
          <>
            <PageHeader title="Payments" description="Payments settled to you on Canton." />
            <SectionCard title="My payments">
              {data.payments.length ? (
                data.payments.map((p) => (
                  <ItemRow
                    key={p.contractId}
                    title={`$${formatMoney(p.amount)}`}
                    subtitle={p.memo}
                    right={<StatusChip status="paid" label="Paid" />}
                  />
                ))
              ) : (
                <EmptyNote>No payments yet.</EmptyNote>
              )}
            </SectionCard>
          </>
        );

      default:
        return null;
    }
  };

  return shell(renderSection());
}
