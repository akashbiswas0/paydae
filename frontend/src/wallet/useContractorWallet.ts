"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { formatMoney, formatRate, partyName, type ContractView, type PaydaeState } from "@/lib/types";
import { WALLET_MODE } from "./config";
import { requestSign } from "./walletSlice";

/**
 * The single surface ContractorView needs from the wallet module. When the
 * wallet is connected, contractor state comes from the WALLET party's ACS and
 * Countersign / SubmitInvoice open the SignModal instead of hitting the
 * custodial backend.
 */
export function useContractorWallet(): {
  /** wallet connected — reads and actions route through the wallet */
  active: boolean;
  data: PaydaeState | null;
  busy: boolean;
  requestCountersign: (offer: ContractView) => void;
  requestSubmitInvoice: (agreement: ContractView, hours: number, memo: string) => void;
} {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.wallet.status);
  const data = useAppSelector((s) => s.wallet.data);
  const signing = useAppSelector((s) => s.wallet.signing);
  const pending = useAppSelector((s) => s.wallet.pendingSign);

  const active = WALLET_MODE && status === "connected";

  return {
    active,
    data,
    busy: signing || pending !== null,
    requestCountersign: (offer) =>
      dispatch(
        requestSign({
          summary: `Countersign: ${offer.role} · $${formatRate(offer.hourlyRate)}/h from ${partyName(offer.company)}`,
          detail: null,
          action: "countersign",
          entity: "AgreementProposal",
          contractId: offer.contractId,
          choice: "Countersign",
          argument: {},
        }),
      ),
    requestSubmitInvoice: (agreement, hours, memo) =>
      dispatch(
        requestSign({
          summary: `Submit invoice: ${formatRate(hours)}h · ${memo || "no memo"}`,
          detail: `= $${formatMoney(hours * Number(agreement.hourlyRate ?? 0))} ${agreement.currency ?? "USD"}`,
          action: "submitInvoice",
          entity: "Agreement",
          contractId: agreement.contractId,
          choice: "SubmitInvoice",
          argument: { hours: String(hours), memo },
        }),
      ),
  };
}
