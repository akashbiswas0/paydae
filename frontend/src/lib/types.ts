export type Role = "company" | "contractor";

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
  role: Role;
  party: string;
  /** display names for every party id with a profile on this Paydae instance */
  partyNames: Record<string, string>;
  proposals: ContractView[];
  agreements: ContractView[];
  invoices: ContractView[];
  approvedInvoices: ContractView[];
  payments: ContractView[];
  treasury?: ContractView | null;
}

export type ActionName =
  | "propose"
  | "withdraw"
  | "countersign"
  | "submitInvoice"
  | "approve"
  | "payAll"
  | "bootstrapTreasury";

/** human-readable digest of a prepared transaction (from the backend) */
export interface TxSummary {
  title: string;
  description: string;
  fields: [string, string][];
}

export interface ContractorEntry {
  partyId: string;
  displayName: string;
}

/** "SomeHint::1220abcd…" labeled via the instance's profile directory */
export function nameOf(
  partyId: string | undefined,
  partyNames: Record<string, string> | undefined,
): string {
  if (!partyId) return "";
  return partyNames?.[partyId] ?? partyId.split("::")[0] ?? partyId;
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
