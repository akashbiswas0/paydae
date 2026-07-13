// Wallet-mode configuration. Everything is inert unless NEXT_PUBLIC_WALLET_MODE=1
// (set in frontend/.env.local, gitignored — see wallet/README.md).

export const WALLET_MODE = process.env.NEXT_PUBLIC_WALLET_MODE === "1";

/**
 * One Wallet Gateway instance per contractor (each holds that contractor's
 * wallet + signing keys): alice :3030, bob :3031. Base URLs — the adapter
 * appends /api/v0/dapp.
 */
export const GATEWAY_URLS: Record<string, string> = {
  alice: process.env.NEXT_PUBLIC_WALLET_GATEWAY_URL ?? "http://localhost:3030",
  bob: process.env.NEXT_PUBLIC_WALLET_GATEWAY_URL_BOB ?? "http://localhost:3031",
};

/** Must equal the main network id in the gateway configs (bootstrap.networks[].id). */
export const NETWORK_ID = "canton:da-devnet";

/** Same package id as config.json at the repo root (committed, stable). */
export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PAYDAE_PACKAGE_ID ??
  "b6c41b85c14063cad92ff77488b39bce6b42ef837805f7626f5bef948876d240";

export const templateId = (entity: string): string => `${PACKAGE_ID}:Paydae:${entity}`;
