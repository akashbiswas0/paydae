export type Role = 'company' | 'contractor' | 'auditor';

export interface PaydaeConfig {
  packageId: string;
  parties: Record<string, string>;
  userId: string;
}

export interface Profile {
  fingerprint: string;
  publicKey: string;
  partyId: string;
  role: Role;
  displayName: string;
  createdAt: string;
}

export interface Contract {
  contractId: string;
  entity: string;
  arg: Record<string, unknown>;
}

export interface ContractView {
  contractId: string;
  [field: string]: unknown;
}

export interface PaydaeState {
  role: Role;
  party: string;
  /** display names for every party id that has a profile (for rendering) */
  partyNames: Record<string, string>;
  proposals: ContractView[];
  agreements: ContractView[];
  invoices: ContractView[];
  approvedInvoices: ContractView[];
  payments: ContractView[];
  treasury?: ContractView | null;
  /** auditor role: every treasury whose company designated this auditor */
  treasuries?: ContractView[];
}

export type ActionName =
  | 'propose'
  | 'withdraw'
  | 'countersign'
  | 'submitInvoice'
  | 'approve'
  | 'payAll'
  | 'bootstrapTreasury'
  | 'designateAuditor';

/** human-readable digest of a prepared transaction, rendered in the confirm modal */
export interface TxSummary {
  title: string;
  description: string;
  fields: [string, string][];
}

export interface LedgerCommand {
  CreateCommand?: {
    templateId: string;
    createArguments: Record<string, unknown>;
  };
  ExerciseCommand?: {
    templateId: string;
    contractId: string;
    choice: string;
    choiceArgument: Record<string, unknown>;
  };
}
