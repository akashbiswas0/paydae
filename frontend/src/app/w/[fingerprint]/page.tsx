"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WalletShell } from "@/components/WalletShell";
import { CompanyView } from "@/components/CompanyView";
import { ContractorView } from "@/components/ContractorView";
import { getWallet, type StoredWallet } from "@/wallet/keystore";

export default function WalletPage({
  params,
}: {
  params: Promise<{ fingerprint: string }>;
}) {
  const { fingerprint } = use(params);
  const router = useRouter();
  // localStorage is browser-only: resolve the wallet after mount
  const [wallet, setWallet] = useState<StoredWallet | null | "missing">(null);

  useEffect(() => {
    const w = getWallet(fingerprint);
    if (!w) {
      router.replace("/");
      setWallet("missing");
    } else {
      setWallet(w);
    }
  }, [fingerprint, router]);

  if (!wallet || wallet === "missing") return null;

  return (
    <WalletShell wallet={wallet}>
      {wallet.role === "company" ? <CompanyView /> : <ContractorView />}
    </WalletShell>
  );
}
