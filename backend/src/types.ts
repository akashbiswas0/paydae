export type Persona = 'company' | 'alice' | 'bob';

export interface PaydaeConfig {
  packageId: string;
  parties: Record<Persona, string>;
  userId: string;
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
  persona: Persona;
  proposals: ContractView[];
  agreements: ContractView[];
  invoices: ContractView[];
  approvedInvoices: ContractView[];
  payments: ContractView[];
  treasury?: ContractView | null;
}

export type ActionName =
  | 'propose'
  | 'countersign'
  | 'submitInvoice'
  | 'approve'
  | 'payAll'
  | 'bootstrapTreasury';

export interface ActionRequest {
  p: Persona;
  action: ActionName;
  payload?: Record<string, unknown>;
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
