"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { ContractView, PaydaeState, Persona } from "@/lib/types";
import { WALLET_MODE } from "./config";
import { walletExercise } from "./walletSlice";

/**
 * The single surface ContractorView needs from the wallet module. When the
 * wallet is connected, contractor state comes from the WALLET party's ACS and
 * Countersign / SubmitInvoice go through the wallet: the gateway's approve
 * popup opens for review and key signing (reference-quickstart UX).
 */
export function useContractorWallet(persona: Persona): {
  /** wallet connected — reads and actions route through the wallet */
  active: boolean;
  data: PaydaeState | null;
  busy: boolean;
  countersign: (offer: ContractView) => void;
  submitInvoice: (agreement: ContractView, hours: number, memo: string) => void;
} {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.wallet.status);
  const data = useAppSelector((s) => s.wallet.data);
  const signing = useAppSelector((s) => s.wallet.signing);

  const active = WALLET_MODE && status === "connected";

  return {
    active,
    data,
    busy: signing,
    countersign: (offer) =>
      void dispatch(
        walletExercise({
          persona,
          input: {
            action: "countersign",
            entity: "AgreementProposal",
            contractId: offer.contractId,
            choice: "Countersign",
            argument: {},
          },
        }),
      ),
    submitInvoice: (agreement, hours, memo) =>
      void dispatch(
        walletExercise({
          persona,
          input: {
            action: "submitInvoice",
            entity: "Agreement",
            contractId: agreement.contractId,
            choice: "SubmitInvoice",
            argument: { hours: String(hours), memo },
          },
        }),
      ),
  };
}
