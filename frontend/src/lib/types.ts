export type Persona = "company" | "alice" | "bob";

export interface ContractView {
  contractId: string;
  company?: string;
  contractor?: string;
  role?: string;
  hourlyRate?: string;
  currency?: string;
  amount?: string;
  hours?: string;
  memo?: string;
  balance?: string;
}

export interface PaydaeState {
  persona: Persona;
  proposals: ContractView[];
  agreements: ContractView[];
  invoices: ContractView[];
  approvedInvoices: ContractView[];
  payments: ContractView[];
  treasury?: ContractView | null;
}

export type ActionName =
  | "propose"
  | "countersign"
  | "submitInvoice"
  | "approve"
  | "payAll"
  | "bootstrapTreasury";

export interface ActionPayloads {
  propose: { contractor: Persona; role: string; rate: number };
  countersign: { cid: string };
  submitInvoice: { agreementCid: string; hours: number; memo: string };
  approve: { cid: string };
  payAll: Record<string, never>;
  bootstrapTreasury: { balance: number };
}

export interface PersonaMeta {
  name: string;
  label: string;
  route: string;
  /** Tailwind classes for the big persona badge */
  badgeClass: string;
}

export const PERSONAS: Record<Persona, PersonaMeta> = {
  company: {
    name: "Paydae Inc.",
    label: "COMPANY",
    route: "/company",
    badgeClass: "bg-amber-500 text-zinc-950",
  },
  alice: {
    name: "Alice",
    label: "ALICE",
    route: "/c/alice",
    badgeClass: "bg-teal-500 text-zinc-950",
  },
  bob: {
    name: "Bob",
    label: "BOB",
    route: "/c/bob",
    badgeClass: "bg-violet-500 text-zinc-950",
  },
};

const PARTY_NAMES: Record<string, string> = {
  PaydaeCo: "Paydae Inc.",
  PaydaeAlice: "Alice",
  PaydaeBob: "Bob",
};

/** "PaydaeAlice::1220…" -> "Alice" */
export function partyName(partyId: string | undefined): string {
  const hint = (partyId ?? "").split("::")[0] ?? "";
  return PARTY_NAMES[hint] ?? hint;
}

export function formatMoney(value: string | number | undefined): string {
  return Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRate(value: string | number | undefined): string {
  return Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
