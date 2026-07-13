// Wallet-mode configuration. Everything is inert unless NEXT_PUBLIC_WALLET_MODE=1
// (set in frontend/.env.local, gitignored — see wallet/README.md).

export const WALLET_MODE = process.env.NEXT_PUBLIC_WALLET_MODE === "1";

export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_WALLET_GATEWAY_URL ?? "http://localhost:3030";

export const NETWORK_ID = "canton:da-devnet";

/**
 * Gateway users (self-signed demo IDP, see wallet/README.md "Sandbox quirks"):
 * onboarding/listing runs as the dedicated user, prepare/sign/execute as the
 * submitter user the auth proxy's m2m token maps to.
 */
export const ONBOARD_USER = "paydae-wallet";
export const SUBMIT_USER = "6";

/** Party hints of the pre-onboarded contractor wallets (wallet/onboard.mjs). */
export const WALLET_HINTS: Record<string, string> = {
  alice: "PaydaeAliceW",
  bob: "PaydaeBobW",
};

/** Same package id as config.json at the repo root (committed, stable). */
export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PAYDAE_PACKAGE_ID ??
  "b6c41b85c14063cad92ff77488b39bce6b42ef837805f7626f5bef948876d240";

export const templateId = (entity: string): string => `${PACKAGE_ID}:Paydae:${entity}`;
