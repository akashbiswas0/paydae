import type { Contract, ContractView, PaydaeState, Persona } from './types.js';

const ENTITIES = [
  'AgreementProposal',
  'Agreement',
  'Invoice',
  'ApprovedInvoice',
  'Payment',
  'Treasury',
] as const;

export function groupState(contracts: Contract[], persona: Persona): PaydaeState {
  const groups: Record<string, ContractView[]> = Object.fromEntries(
    ENTITIES.map((e) => [e, []]),
  );
  for (const c of contracts) {
    groups[c.entity]?.push({ contractId: c.contractId, ...c.arg });
  }
  const state: PaydaeState = {
    persona,
    proposals: groups['AgreementProposal'] ?? [],
    agreements: groups['Agreement'] ?? [],
    invoices: groups['Invoice'] ?? [],
    approvedInvoices: groups['ApprovedInvoice'] ?? [],
    payments: groups['Payment'] ?? [],
  };
  if (persona === 'company') {
    state.treasury = groups['Treasury']?.[0] ?? null;
  }
  return state;
}
