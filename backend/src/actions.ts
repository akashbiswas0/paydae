import { config, templateId } from './env.js';
import { activeContracts, submitAndWait } from './ledger.js';
import type { ActionName, LedgerCommand, Persona } from './types.js';

const createCmd = (entity: string, createArguments: Record<string, unknown>): LedgerCommand => ({
  CreateCommand: { templateId: templateId(entity), createArguments },
});

const exerciseCmd = (
  entity: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown> = {},
): LedgerCommand => ({
  ExerciseCommand: { templateId: templateId(entity), contractId, choice, choiceArgument },
});

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (typeof v !== 'string' || !v) throw new Error(`missing or invalid "${key}"`);
  return v;
}

function num(payload: Record<string, unknown>, key: string): number {
  const v = Number(payload[key]);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`missing or invalid "${key}"`);
  return v;
}

export async function handleAction(
  persona: Persona,
  action: ActionName,
  payload: Record<string, unknown> = {},
): Promise<{ updateId?: string }> {
  const party = config.parties[persona];
  switch (action) {
    case 'propose': {
      if (persona !== 'company') throw new Error('only company can propose');
      const contractorKey = str(payload, 'contractor') as Persona;
      const contractor = config.parties[contractorKey];
      if (!contractor || contractorKey === 'company') {
        throw new Error(`unknown contractor: ${String(payload['contractor'])}`);
      }
      return submitAndWait(
        party,
        createCmd('AgreementProposal', {
          company: party,
          contractor,
          role: str(payload, 'role'),
          hourlyRate: String(num(payload, 'rate')),
          currency: 'USD',
        }),
      );
    }
    case 'countersign':
      return submitAndWait(party, exerciseCmd('AgreementProposal', str(payload, 'cid'), 'Countersign'));
    case 'submitInvoice':
      return submitAndWait(
        party,
        exerciseCmd('Agreement', str(payload, 'agreementCid'), 'SubmitInvoice', {
          hours: String(num(payload, 'hours')),
          memo: typeof payload['memo'] === 'string' ? payload['memo'] : '',
        }),
      );
    case 'approve':
      if (persona !== 'company') throw new Error('only company can approve');
      return submitAndWait(party, exerciseCmd('Invoice', str(payload, 'cid'), 'Approve'));
    case 'payAll': {
      if (persona !== 'company') throw new Error('only company can run payday');
      const acs = await activeContracts(party);
      const treasury = acs.find((c) => c.entity === 'Treasury');
      if (!treasury) throw new Error('no treasury — bootstrap it first');
      const invoiceCids = acs
        .filter((c) => c.entity === 'ApprovedInvoice')
        .map((c) => c.contractId);
      if (invoiceCids.length === 0) throw new Error('no approved invoices to pay');
      return submitAndWait(
        party,
        exerciseCmd('Treasury', treasury.contractId, 'PayAllApproved', { invoiceCids }),
      );
    }
    case 'bootstrapTreasury': {
      if (persona !== 'company') throw new Error('only company can bootstrap treasury');
      const acs = await activeContracts(party);
      if (acs.some((c) => c.entity === 'Treasury')) throw new Error('treasury already exists');
      return submitAndWait(
        party,
        createCmd('Treasury', {
          company: party,
          balance: String(num(payload, 'balance')),
          currency: 'USD',
        }),
      );
    }
    default:
      throw new Error(`unknown action: ${String(action)}`);
  }
}
