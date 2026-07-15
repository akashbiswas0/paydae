// Create/Load wallet flows — plain async functions used by the landing page.
// Keys are generated and used here in the browser; the backend only ever sees
// public keys, topology transactions and signatures.
import type { Role } from "@/lib/types";
import {
  fingerprintOf,
  generateKeyPair,
  parseKeyFile,
  saveWallet,
  signHash,
  type StoredWallet,
} from "./keystore";

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

interface TopologyResponse {
  partyId: string;
  publicKeyFingerprint: string;
  multiHash: string;
  topologyTransactions: string[];
}

/** Create a brand-new wallet: local keypair -> party onboarded on devnet.
 * For companies, also creates the treasury (signed silently with the new key —
 * part of onboarding, before the key is ever used for business actions). */
export async function createWallet(
  role: Role,
  displayName: string,
  opts: { treasuryBalance?: number } = {},
): Promise<StoredWallet> {
  const keys = generateKeyPair();
  const topo = await api<TopologyResponse>("POST", "/api/wallet/create", {
    role,
    displayName,
    publicKey: keys.publicKey,
  });
  const multiHashSignature = signHash(keys.privateKey, topo.multiHash);
  await api("POST", "/api/wallet/create/complete", {
    role,
    displayName,
    publicKey: keys.publicKey,
    partyId: topo.partyId,
    publicKeyFingerprint: topo.publicKeyFingerprint,
    topologyTransactions: topo.topologyTransactions,
    multiHashSignature,
  });
  const wallet: StoredWallet = {
    fingerprint: topo.publicKeyFingerprint,
    partyId: topo.partyId,
    role,
    displayName,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: new Date().toISOString(),
  };
  saveWallet(wallet);
  if (role === "company") {
    const balance = opts.treasuryBalance ?? 50000;
    const prep = await api<{ preparedTransaction: string; preparedTransactionHash: string }>(
      "POST",
      "/api/tx/prepare",
      { party: wallet.partyId, action: "bootstrapTreasury", payload: { balance } },
    );
    const signature = signHash(wallet.privateKey, prep.preparedTransactionHash);
    await api("POST", "/api/tx/execute", {
      party: wallet.partyId,
      preparedTransaction: prep.preparedTransaction,
      signature,
    });
  }
  return wallet;
}

export interface LoadedProfile {
  role: Role;
  partyId: string;
  displayName: string;
}

/** Inspect a key file: which profile does this key control? (no side effects) */
export async function inspectKeyFile(text: string): Promise<{ file: ReturnType<typeof parseKeyFile>; profile: LoadedProfile }> {
  const file = parseKeyFile(text);
  const profile = await api<LoadedProfile>("POST", "/api/wallet/load", {
    publicKey: file.publicKey,
  });
  return { file, profile };
}

/** Persist an inspected key file into this browser's keystore. */
export function importWallet(
  file: ReturnType<typeof parseKeyFile>,
  profile: LoadedProfile,
): StoredWallet {
  const wallet: StoredWallet = {
    fingerprint: fingerprintOf(profile.partyId),
    partyId: profile.partyId,
    role: profile.role,
    displayName: profile.displayName,
    publicKey: file.publicKey,
    privateKey: file.privateKey,
    createdAt: new Date().toISOString(),
  };
  saveWallet(wallet);
  return wallet;
}
