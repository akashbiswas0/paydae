"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { prepareTx } from "@/store/paydaeSlice";
import {
  formatMoney,
  formatRate,
  nameOf,
  type ActionName,
  type ContractorEntry,
} from "@/lib/types";
import { ROLE_META } from "@/lib/roles";
import { type StoredWallet } from "@/wallet/keystore";
import { AppShell, type NavItem } from "./AppShell";
import { EmptyNote, ItemRow, StatusChip } from "./ItemRow";
import { Avatar, EmptyState, PageHeader, StatCard } from "./Primitives";
import { SectionCard } from "./SectionCard";

const CONTRACTORS_POLL_MS = 5000;

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { key: "people", label: "People", icon: <Users className="size-4" /> },
  { key: "agreements", label: "Agreements", icon: <FileText className="size-4" /> },
  { key: "invoices", label: "Invoices", icon: <Receipt className="size-4" /> },
  { key: "payday", label: "Payday", icon: <Wallet className="size-4" /> },
  { key: "auditor", label: "Auditor", icon: <ShieldCheck className="size-4" /> },
];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  people: "People",
  agreements: "Agreements",
  invoices: "Invoices",
  payday: "Payday",
  auditor: "Auditor",
};

export function CompanyView({ wallet }: { wallet: StoredWallet }) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.paydae.profile);
  const data = useAppSelector((s) => s.paydae.data);
  const busy = useAppSelector((s) => s.paydae.busy);
  const pending = useAppSelector((s) => s.paydae.pending);

  const [section, setSection] = useState("dashboard");
  const [balance, setBalance] = useState("50000");
  const [contractors, setContractors] = useState<ContractorEntry[]>([]);
  const [contractor, setContractor] = useState("");
  const [role, setRole] = useState("");
  const [rate, setRate] = useState("");
  const [auditorsDir, setAuditorsDir] = useState<ContractorEntry[]>([]);
  const [auditor, setAuditor] = useState("");

  // directories of contractor/auditor wallets on this Paydae instance
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch("/api/contractors", { cache: "no-store" })
        .then((r) => r.json())
        .then((list: ContractorEntry[]) => {
          if (!cancelled && Array.isArray(list)) setContractors(list);
        })
        .catch(() => undefined);
      fetch("/api/auditors", { cache: "no-store" })
        .then((r) => r.json())
        .then((list: ContractorEntry[]) => {
          if (!cancelled && Array.isArray(list)) setAuditorsDir(list);
        })
        .catch(() => undefined);
    };
    void poll();
    const timer = setInterval(poll, CONTRACTORS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const act = (action: ActionName, payload?: Record<string, unknown>) =>
    dispatch(prepareTx({ party: profile!.partyId, action, payload }));

  const shell = (children: React.ReactNode) => (
    <AppShell
      wallet={wallet}
      nav={NAV}
      active={section}
      onSelect={setSection}
      title={TITLES[section]}
    >
      {children}
    </AppShell>
  );

  if (!data || !profile) {
    return shell(<p className="py-16 text-center text-sm text-muted-foreground">Loading ledger state…</p>);
  }

  const treasury = data.treasury ?? null;
  const currentAuditors = Array.isArray(treasury?.auditors) ? treasury.auditors : [];
  const paydayTotal = data.approvedInvoices.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
  const locked = busy || pending !== null;

  const contractorSelect = (
    <select
      value={contractor}
      onChange={(e) => setContractor(e.target.value)}
      className="border-input h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">{contractors.length ? "Pick a contractor…" : "No contractor wallets yet"}</option>
      {contractors.map((c) => (
        <option key={c.partyId} value={c.partyId}>
          {c.displayName} ({c.partyId.slice(0, 18)}…)
        </option>
      ))}
    </select>
  );

  const sendOfferCard = (
    <SectionCard title="Send offer">
      <div className="grid gap-4 py-2 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="offer-contractor">Contractor</Label>
          {contractorSelect}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer-role">Role</Label>
          <Input id="offer-role" placeholder="Designer" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer-rate">Hourly rate (USD)</Label>
          <Input id="offer-rate" type="number" placeholder="70" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
      </div>
      <div className="pb-3">
        <Button
          disabled={locked || !contractor || !role.trim() || !Number(rate)}
          onClick={() =>
            act("propose", { contractor, role: role.trim(), rate: Number(rate) }).then(() => {
              setRole("");
              setRate("");
            })
          }
        >
          Send offer
        </Button>
      </div>
    </SectionCard>
  );

  const treasuryStat = treasury ? (
    <StatCard
      label="Treasury balance"
      value={`$${formatMoney(treasury.balance)}`}
      sub={treasury.currency}
      icon={<Wallet className="size-4" />}
      accent="bg-indigo-50 text-indigo-600"
    />
  ) : null;

  const renderSection = () => {
    switch (section) {
      case "dashboard":
        return (
          <>
            <PageHeader
              title="Dashboard"
              description="Your treasury, invoices awaiting action and recent payments at a glance."
            />
            {treasury ? (
              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {treasuryStat}
                <StatCard label="Pending invoices" value={data.invoices.length} sub="awaiting approval" icon={<Receipt className="size-4" />} accent="bg-amber-50 text-amber-600" />
                <StatCard label="Ready for payday" value={`$${formatMoney(paydayTotal)}`} sub={`${data.approvedInvoices.length} approved`} icon={<Wallet className="size-4" />} accent="bg-blue-50 text-blue-600" />
                <StatCard label="Active contractors" value={data.agreements.length} sub="signed agreements" icon={<Users className="size-4" />} accent="bg-teal-50 text-teal-600" />
              </div>
            ) : (
              <SectionCard title="Create your treasury">
                <div className="max-w-sm space-y-3 py-3">
                  <p className="text-sm text-muted-foreground">
                    No treasury yet. It funds every payday and is visible only to you (and any auditor you designate).
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="tre-balance">Opening balance (USD)</Label>
                    <Input id="tre-balance" type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
                  </div>
                  <Button disabled={locked} onClick={() => act("bootstrapTreasury", { balance: Number(balance) })}>
                    Create treasury
                  </Button>
                </div>
              </SectionCard>
            )}

            {data.approvedInvoices.length > 0 && (
              <SectionCard title="Ready for payday">
                {data.approvedInvoices.map((inv) => (
                  <ItemRow
                    key={inv.contractId}
                    left={<Avatar name={nameOf(inv.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                    subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
                    right={<StatusChip status="approved" />}
                  />
                ))}
                <div className="py-3">
                  <Button
                    className="w-full py-5 text-base font-semibold"
                    disabled={locked || !treasury}
                    onClick={() => act("payAll")}
                  >
                    <Zap className="size-5" strokeWidth={2.5} />
                    Run payday{paydayTotal ? ` — $${formatMoney(paydayTotal)}` : ""}
                  </Button>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    One atomic Canton transaction: every approved invoice paid, treasury debited — or nothing. Signed by your key.
                  </p>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Recent payments">
              {data.payments.length ? (
                data.payments.slice(0, 5).map((p) => (
                  <ItemRow
                    key={p.contractId}
                    left={<Avatar name={nameOf(p.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(p.contractor, data.partyNames)} — $${formatMoney(p.amount)}`}
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

      case "people":
        return (
          <>
            <PageHeader title="People" description="Send offers to contractors and see who you already work with." />
            {sendOfferCard}
            <SectionCard title="Contractor directory">
              {contractors.length ? (
                contractors.map((c) => (
                  <ItemRow
                    key={c.partyId}
                    left={<Avatar name={c.displayName} chip={ROLE_META.contractor.chip} />}
                    title={c.displayName}
                    subtitle={`${c.partyId.slice(0, 28)}…`}
                  />
                ))
              ) : (
                <EmptyNote>No contractor wallets on this Paydae instance yet.</EmptyNote>
              )}
            </SectionCard>
          </>
        );

      case "agreements":
        return (
          <>
            <PageHeader title="Agreements" description="Offers awaiting a contractor countersignature, and active agreements." />
            <SectionCard title="Open offers">
              {data.proposals.length ? (
                data.proposals.map((p) => (
                  <ItemRow
                    key={p.contractId}
                    left={<Avatar name={nameOf(p.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(p.contractor, data.partyNames)} · ${p.role}`}
                    subtitle={`$${formatRate(p.hourlyRate)}/h ${p.currency} · awaiting countersign`}
                    right={<StatusChip status="offered" />}
                  />
                ))
              ) : (
                <EmptyNote>No open offers.</EmptyNote>
              )}
            </SectionCard>
            <SectionCard title="Active agreements">
              {data.agreements.length ? (
                data.agreements.map((a) => (
                  <ItemRow
                    key={a.contractId}
                    left={<Avatar name={nameOf(a.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(a.contractor, data.partyNames)} · ${a.role}`}
                    subtitle={`$${formatRate(a.hourlyRate)}/h ${a.currency}`}
                    right={<StatusChip status="active" />}
                  />
                ))
              ) : (
                <EmptyNote>No active agreements.</EmptyNote>
              )}
            </SectionCard>
          </>
        );

      case "invoices":
        return (
          <>
            <PageHeader title="Invoices" description="Approve pending invoices; approved ones move to Payday." />
            <SectionCard title="Pending approval">
              {data.invoices.length ? (
                data.invoices.map((inv) => (
                  <ItemRow
                    key={inv.contractId}
                    left={<Avatar name={nameOf(inv.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                    subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
                    right={
                      <Button
                        size="sm"
                        disabled={locked}
                        onClick={() =>
                          act("approve", {
                            cid: inv.contractId,
                            amount: inv.amount,
                            contractorName: nameOf(inv.contractor, data.partyNames),
                          })
                        }
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
            <SectionCard title="Approved">
              {data.approvedInvoices.length ? (
                data.approvedInvoices.map((inv) => (
                  <ItemRow
                    key={inv.contractId}
                    left={<Avatar name={nameOf(inv.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                    subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
                    right={<StatusChip status="approved" />}
                  />
                ))
              ) : (
                <EmptyNote>Nothing approved yet.</EmptyNote>
              )}
            </SectionCard>
          </>
        );

      case "payday":
        return (
          <>
            <PageHeader title="Payday" description="Pay every approved invoice in one atomic Canton transaction." />
            <SectionCard title="Ready for payday">
              {data.approvedInvoices.length ? (
                data.approvedInvoices.map((inv) => (
                  <ItemRow
                    key={inv.contractId}
                    left={<Avatar name={nameOf(inv.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(inv.contractor, data.partyNames)} — $${formatMoney(inv.amount)}`}
                    subtitle={`${formatRate(inv.hours)}h · ${inv.memo}`}
                    right={<StatusChip status="approved" />}
                  />
                ))
              ) : (
                <EmptyNote>Nothing approved yet.</EmptyNote>
              )}
              <div className="py-3">
                <Button
                  className="w-full py-5 text-base font-semibold"
                  disabled={locked || !data.approvedInvoices.length || !treasury}
                  onClick={() => act("payAll")}
                >
                  <Zap className="size-5" strokeWidth={2.5} />
                  Run payday{paydayTotal ? ` — $${formatMoney(paydayTotal)}` : ""}
                </Button>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  One atomic Canton transaction: every approved invoice paid, treasury debited — or nothing. Signed by your key.
                </p>
              </div>
            </SectionCard>
            <SectionCard title="Payments history">
              {data.payments.length ? (
                data.payments.map((p) => (
                  <ItemRow
                    key={p.contractId}
                    left={<Avatar name={nameOf(p.contractor, data.partyNames)} chip={ROLE_META.contractor.chip} />}
                    title={`${nameOf(p.contractor, data.partyNames)} — $${formatMoney(p.amount)}`}
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

      case "auditor":
        return (
          <>
            <PageHeader title="Auditor" description="Give a read-only party visibility of your books — enforced by the ledger." />
            <SectionCard title="Designate auditor">
              {currentAuditors.length ? (
                <p className="flex items-start gap-2 py-2 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-600" />
                  <span>
                    <span className="font-semibold text-sky-700">
                      {currentAuditors.map((a) => nameOf(a, data.partyNames)).join(", ")}
                    </span>{" "}
                    audits your books — every agreement, invoice and payment created since designation. Read-only, enforced by the ledger.
                  </span>
                </p>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  No auditor designated. Designating one gives them read-only visibility of your treasury and everything you create from then on — nobody else can see your books.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3 pb-3">
                <div className="min-w-56 flex-1 space-y-1.5">
                  <Label htmlFor="auditor-party">Auditor</Label>
                  <select
                    id="auditor-party"
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    className="border-input h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">{auditorsDir.length ? "Pick an auditor…" : "No auditor wallets yet"}</option>
                    {auditorsDir.map((a) => (
                      <option key={a.partyId} value={a.partyId}>
                        {a.displayName} ({a.partyId.slice(0, 18)}…)
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  disabled={locked || !auditor || !treasury}
                  onClick={() => act("designateAuditor", { auditor }).then(() => setAuditor(""))}
                >
                  <ShieldCheck className="size-4" />
                  Designate auditor
                </Button>
              </div>
            </SectionCard>
          </>
        );

      default:
        return <EmptyState icon={<LayoutDashboard className="size-5" />} title="Nothing here" />;
    }
  };

  return shell(renderSection());
}
