// Builds the ledger command + human-readable summary for each wallet-signed
// action. The summary is what the user reviews in the confirm modal before
// their key signs the prepared transaction — payload display fields are used
// for the summary only; commands are built from contract ids + validated input.
import { templateId } from './env.js';
import { activeContracts } from './ledger.js';
import { profileByParty } from './profiles.js';
import type { ActionName, LedgerCommand, Profile, TxSummary } from './types.js';

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

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface BuiltAction {
  commands: LedgerCommand[];
  summary: TxSummary;
}

export async function buildAction(
  profile: Profile,
  action: ActionName,
  payload: Record<string, unknown> = {},
): Promise<BuiltAction> {
  const party = profile.partyId;
  switch (action) {
    case 'propose': {
      if (profile.role !== 'company') throw new Error('only a company can send offers');
      const contractor = str(payload, 'contractor');
      const target = profileByParty(contractor);
      if (!target || target.role !== 'contractor') {
        throw new Error('unknown contractor party');
      }
      const role = str(payload, 'role');
      const rate = num(payload, 'rate');
      return {
        commands: [
          createCmd('AgreementProposal', {
            company: party,
            contractor,
            role,
            hourlyRate: String(rate),
            currency: 'USD',
          }),
        ],
        summary: {
          title: 'Send contract offer',
          description: `Offer a ${role} engagement to ${target.displayName}.`,
          fields: [
            ['Contractor', target.displayName],
            ['Role', role],
            ['Hourly rate', `$${money(rate)} USD`],
          ],
        },
      };
    }
    case 'withdraw': {
      if (profile.role !== 'company') throw new Error('only a company can withdraw offers');
      return {
        commands: [exerciseCmd('AgreementProposal', str(payload, 'cid'), 'Withdraw')],
        summary: {
          title: 'Withdraw offer',
          description: 'Withdraw this open contract offer.',
          fields: [],
        },
      };
    }
    case 'countersign': {
      if (profile.role !== 'contractor') throw new Error('only a contractor can countersign');
      const fields: [string, string][] = [];
      if (typeof payload['role'] === 'string') fields.push(['Role', payload['role']]);
      if (payload['rate'] !== undefined) fields.push(['Hourly rate', `$${money(Number(payload['rate']))} USD`]);
      if (typeof payload['companyName'] === 'string') fields.push(['Company', payload['companyName']]);
      return {
        commands: [exerciseCmd('AgreementProposal', str(payload, 'cid'), 'Countersign')],
        summary: {
          title: 'Countersign agreement',
          description:
            'Accept this contract offer. Your signature makes it a binding dual-signed agreement.',
          fields,
        },
      };
    }
    case 'submitInvoice': {
      if (profile.role !== 'contractor') throw new Error('only a contractor can invoice');
      const hours = num(payload, 'hours');
      const memo = typeof payload['memo'] === 'string' ? payload['memo'] : '';
      const fields: [string, string][] = [['Hours', String(hours)]];
      if (payload['rate'] !== undefined) {
        fields.push(['Amount', `$${money(hours * Number(payload['rate']))} USD`]);
      }
      if (memo) fields.push(['Memo', memo]);
      return {
        commands: [
          exerciseCmd('Agreement', str(payload, 'agreementCid'), 'SubmitInvoice', {
            hours: String(hours),
            memo,
          }),
        ],
        summary: {
          title: 'Submit invoice',
          description: 'Bill the company for hours worked under your agreement.',
          fields,
        },
      };
    }
    case 'approve': {
      if (profile.role !== 'company') throw new Error('only a company can approve invoices');
      const fields: [string, string][] = [];
      if (payload['amount'] !== undefined) fields.push(['Amount', `$${money(Number(payload['amount']))} USD`]);
      if (typeof payload['contractorName'] === 'string') fields.push(['Contractor', payload['contractorName']]);
      return {
        commands: [exerciseCmd('Invoice', str(payload, 'cid'), 'Approve')],
        summary: {
          title: 'Approve invoice',
          description: 'Mark this invoice as approved and ready for payday.',
          fields,
        },
      };
    }
    case 'payAll': {
      if (profile.role !== 'company') throw new Error('only a company can run payday');
      const acs = await activeContracts(party);
      const treasury = acs.find((c) => c.entity === 'Treasury');
      if (!treasury) throw new Error('no treasury — create one first');
      const approved = acs.filter((c) => c.entity === 'ApprovedInvoice');
      if (!approved.length) throw new Error('no approved invoices to pay');
      const total = approved.reduce((sum, c) => sum + Number(c.arg['amount'] ?? 0), 0);
      return {
        commands: [
          exerciseCmd('Treasury', treasury.contractId, 'PayAllApproved', {
            invoiceCids: approved.map((c) => c.contractId),
          }),
        ],
        summary: {
          title: 'Run payday',
          description:
            'One atomic Canton transaction: every approved invoice paid and the treasury debited — or nothing happens at all.',
          fields: [
            ['Invoices', String(approved.length)],
            ['Total', `$${money(total)} USD`],
            ['Treasury after', `$${money(Number(treasury.arg['balance'] ?? 0) - total)} USD`],
          ],
        },
      };
    }
    case 'bootstrapTreasury': {
      if (profile.role !== 'company') throw new Error('only a company can create a treasury');
      const balance = num(payload, 'balance');
      const acs = await activeContracts(party);
      if (acs.some((c) => c.entity === 'Treasury')) throw new Error('treasury already exists');
      return {
        commands: [
          createCmd('Treasury', {
            company: party,
            balance: String(balance),
            currency: 'USD',
          }),
        ],
        summary: {
          title: 'Create treasury',
          description: 'Set up the company treasury that payday draws from.',
          fields: [['Opening balance', `$${money(balance)} USD`]],
        },
      };
    }
    default:
      throw new Error(`unknown action: ${String(action)}`);
  }
}
