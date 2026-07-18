"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { fetchState, setProfile } from "@/store/paydaeSlice";
import { type StoredWallet } from "@/wallet/keystore";
import { ConfirmModal } from "./ConfirmModal";
import { ErrorToast } from "./ErrorToast";
import { TxToast } from "./TxToast";

const POLL_MS = 2500;

/**
 * Owns ledger polling and mounts the global wallet overlays (signature modal +
 * toasts). The visible layout (sidebar + top bar) lives in AppShell, rendered by
 * each role view so it can drive its own section navigation.
 */
export function WalletShell({
  wallet,
  children,
}: {
  wallet: StoredWallet;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      setProfile({
        fingerprint: wallet.fingerprint,
        partyId: wallet.partyId,
        role: wallet.role,
        displayName: wallet.displayName,
      }),
    );
    dispatch(fetchState(wallet.partyId));
    const timer = setInterval(() => dispatch(fetchState(wallet.partyId)), POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, wallet]);

  return (
    <>
      {children}
      <ConfirmModal wallet={wallet} />
      <ErrorToast />
      <TxToast />
    </>
  );
}
