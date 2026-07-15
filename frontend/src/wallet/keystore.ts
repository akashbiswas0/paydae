// Browser-side wallet keystore. The ed25519 private key is generated here,
// stored ONLY in this browser's localStorage and in the key file the user
// downloads — it never reaches the backend or the ledger. Keys deliberately
// stay out of Redux so they never show up in devtools state dumps.
//
// The key file IS the wallet: importing it on any machine restores access to
// the party. Losing every copy orphans the party permanently — there is no
// recovery, exactly like losing a seed phrase.
import nacl from "tweetnacl";
import type { Role } from "@/lib/types";

export interface StoredWallet {
  /** party namespace fingerprint (derived from the public key) */
  fingerprint: string;
  partyId: string;
  role: Role;
  displayName: string;
  /** base64, 32 bytes */
  publicKey: string;
  /** base64, 64-byte ed25519 secret key */
  privateKey: string;
  createdAt: string;
}

export interface KeyFile {
  version: 1;
  app: "paydae";
  role: Role;
  displayName: string;
  partyId: string;
  publicKey: string;
  privateKey: string;
}

const STORAGE_KEY = "paydae.wallets";

const b64encode = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const b64decode = (s: string): Uint8Array => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const pair = nacl.sign.keyPair();
  return { publicKey: b64encode(pair.publicKey), privateKey: b64encode(pair.secretKey) };
}

/** detached ed25519 signature over a base64 hash — the ONLY thing keys ever sign */
export function signHash(privateKeyB64: string, hashB64: string): string {
  return b64encode(nacl.sign.detached(b64decode(hashB64), b64decode(privateKeyB64)));
}

// ---------- localStorage persistence ----------

function readAll(): Record<string, StoredWallet> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      StoredWallet
    >;
  } catch {
    return {};
  }
}

function writeAll(wallets: Record<string, StoredWallet>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function listWallets(): StoredWallet[] {
  return Object.values(readAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getWallet(fingerprint: string): StoredWallet | null {
  return readAll()[fingerprint] ?? null;
}

export function saveWallet(wallet: StoredWallet): void {
  const all = readAll();
  all[wallet.fingerprint] = wallet;
  writeAll(all);
}

export function forgetWallet(fingerprint: string): void {
  const all = readAll();
  delete all[fingerprint];
  writeAll(all);
}

// ---------- key file import/export ----------

export function keyFileOf(wallet: StoredWallet): KeyFile {
  return {
    version: 1,
    app: "paydae",
    role: wallet.role,
    displayName: wallet.displayName,
    partyId: wallet.partyId,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
  };
}

export function downloadKeyFile(wallet: StoredWallet): void {
  const blob = new Blob([JSON.stringify(keyFileOf(wallet), null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paydae-wallet-${wallet.displayName.replace(/[^A-Za-z0-9_-]/g, "")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse + sanity-check a pasted/uploaded key file. Throws with a friendly message. */
export function parseKeyFile(text: string): KeyFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That is not a valid key file (expected JSON).");
  }
  const f = parsed as Partial<KeyFile>;
  if (f.app !== "paydae" || typeof f.privateKey !== "string" || typeof f.publicKey !== "string") {
    throw new Error("That is not a Paydae wallet key file.");
  }
  // recompute the public key from the private key so a tampered file fails fast
  try {
    const derived = nacl.sign.keyPair.fromSecretKey(b64decode(f.privateKey));
    if (b64encode(derived.publicKey) !== f.publicKey) {
      throw new Error("mismatch");
    }
  } catch {
    throw new Error("Key file is corrupted: the private key does not match the public key.");
  }
  return f as KeyFile;
}

export const fingerprintOf = (partyId: string): string => partyId.split("::")[1] ?? partyId;
