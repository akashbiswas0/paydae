import { partyNames } from './profiles.js';
import type { Contract, ContractView, PaydaeState, Role } from './types.js';

const ENTITIES = [
  'AgreementProposal',
  'Agreement',
  'Invoice',
  'ApprovedInvoice',
  'Payment',
  'Treasury',
] as const;

export function groupState(contracts: Contract[], role: Role, party: string): PaydaeState {
  const groups: Record<string, ContractView[]> = Object.fromEntries(
    ENTITIES.map((e) => [e, []]),
  );
  for (const c of contracts) {
    groups[c.entity]?.push({ contractId: c.contractId, ...c.arg });
  }
  const state: PaydaeState = {
    role,
    party,
    partyNames: partyNames(),
    proposals: groups['AgreementProposal'] ?? [],
    agreements: groups['Agreement'] ?? [],
    invoices: groups['Invoice'] ?? [],
    approvedInvoices: groups['ApprovedInvoice'] ?? [],
    payments: groups['Payment'] ?? [],
  };
  if (role === 'company') {
    // a company can only see its own treasury (signatory-only contract)
    state.treasury = (groups['Treasury'] ?? []).find((t) => t['company'] === party) ?? null;
  }
  return state;
}
